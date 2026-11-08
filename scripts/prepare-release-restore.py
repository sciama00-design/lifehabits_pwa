"""Generate isolated restore and data-preserving security rollback from a private snapshot.

Never connects to Supabase. schema.sql/data.sql are for an EMPTY disposable database
only. rollback-security.sql restores configuration, without restoring historical data.
"""
import json
import os
import re
import sys
from pathlib import Path


def ident(value):
    return '"' + value.replace('"', '""') + '"'


def literal(value):
    return "'" + value.replace("'", "''") + "'"


def qualified(schema, name):
    return ident(schema) + '.' + ident(name)


def policy_sql(policy):
    roles = ', '.join('PUBLIC' if r == 'public' else ident(r) for r in policy['roles'])
    sql = (f'CREATE POLICY {ident(policy["policyname"])} ON '
           f'{qualified(policy["schemaname"], policy["tablename"])} '
           f'AS {policy["permissive"]} FOR {policy["cmd"]} TO {roles}')
    if policy['qual'] is not None:
        sql += ' USING (' + policy['qual'] + ')'
    if policy['with_check'] is not None:
        sql += ' WITH CHECK (' + policy['with_check'] + ')'
    return sql + ';'


def function_restore(fn):
    signature = qualified(fn['schema_name'], fn['name']) + '(' + fn['identity_arguments'] + ')'
    sql = [fn['definition'].rstrip().rstrip(';') + ';',
           f'ALTER FUNCTION {signature} OWNER TO {ident(fn["owner"])};',
           f'REVOKE ALL ON FUNCTION {signature} FROM PUBLIC, anon, authenticated, service_role;']
    # The snapshot's function ACLs use the standard Supabase role names. Refuse
    # unfamiliar ACL syntax rather than generating a guessed security boundary.
    for item in (fn['acl'] or '{=X/postgres}').strip('{}').split(','):
        match = re.fullmatch(r'([a-zA-Z_0-9]*)=(X\*?)/([a-zA-Z_0-9]+)', item)
        if not match:
            raise ValueError('Unsupported function ACL format')
        grantee = ident(match[1]) if match[1] else 'PUBLIC'
        option = ' WITH GRANT OPTION' if '*' in match[2] else ''
        sql.append(f'GRANT EXECUTE ON FUNCTION {signature} TO {grantee}{option};')
    return sql


def write_private(path, content):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as stream:
        stream.write(content)
    path.chmod(0o600)


if len(sys.argv) != 2:
    raise SystemExit('Usage: python3 scripts/prepare-release-restore.py PRIVATE_BACKUP_DIRECTORY')
root = Path(sys.argv[1]).resolve()
m = json.loads((root / 'metadata.json').read_text())
snapshot = json.loads((root / 'data.json').read_text())
if m['project_ref'] != 'gkbxiyzmtrxukpoaqdqn' or snapshot['project_ref'] != m['project_ref']:
    raise SystemExit('Unexpected source project')

schema = ['-- EMPTY DISPOSABLE DATABASE ONLY. Never execute this file on production.',
          "SET check_function_bodies = false;", 'CREATE SCHEMA IF NOT EXISTS extensions;',
          'CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;',
          'CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;']
roles = {'anon', 'authenticated', 'service_role', 'supabase_admin',
         'supabase_auth_admin', 'supabase_storage_admin'}
roles.update(g['grantee'] for g in m['table_grants'] if g['grantee'] not in {'PUBLIC', 'postgres'})
roles.update(r for p in m['policies'] for r in p['roles'] if r != 'public')
for fn in m['functions']:
    roles.add(fn['owner'])
    roles.update(match[1] for match in re.finditer(r'(?:\{|,)([a-zA-Z_0-9]+)=', fn['acl'] or ''))
roles.discard('postgres')
for role in sorted(roles):
    bypass = ' BYPASSRLS' if role == 'service_role' else ''
    schema.append(f'DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname={literal(role)}) '
                  f'THEN CREATE ROLE {ident(role)} NOLOGIN{bypass}; END IF; END $$;')
for s in m['schemas']:
    schema.append(f'CREATE SCHEMA IF NOT EXISTS {ident(s["name"])} AUTHORIZATION {ident(s["owner"])};')
for enum in m['enums'] or []:
    schema.append(f'CREATE TYPE {qualified(enum["schema_name"], enum["name"])} AS ENUM ('
                  + ', '.join(literal(label) for label in enum['labels']) + ');')
for t in json.loads((root / 'composite-types.json').read_text()):
    schema.append(f'CREATE TYPE {qualified(t["schema_name"], t["name"])} AS ('
                  + ', '.join(ident(a['name']) + ' ' + a['type'] for a in t['attributes']) + ');')
for seq in m['sequences'] or []:
    schema.append(f'CREATE SEQUENCE {qualified(seq["schemaname"], seq["sequencename"])} '
                  f'AS {seq["data_type"]} START {seq["start_value"]} INCREMENT {seq["increment_by"]} '
                  f'MINVALUE {seq["min_value"]} MAXVALUE {seq["max_value"]} CACHE {seq["cache_size"]};')

# Functions can be referenced by generated columns, so declare them first with
# body checks disabled; their table dependencies are available before import.
for fn in m['functions']:
    schema.append(fn['definition'].rstrip().rstrip(';') + ';')
for table in m['tables']:
    cols = []
    for c in m['columns']:
        if (c['schema_name'], c['table_name']) != (table['schema_name'], table['table_name']):
            continue
        sql = ident(c['column_name']) + ' ' + c['data_type']
        if c['generated']:
            sql += ' GENERATED ALWAYS AS (' + c['default_expression'] + ') STORED'
        elif c['identity']:
            raise ValueError('Identity column requires explicit sequence mapping')
        elif c['default_expression'] is not None:
            sql += ' DEFAULT ' + c['default_expression']
        if c['not_null']:
            sql += ' NOT NULL'
        cols.append(sql)
    schema.append(f'CREATE TABLE {qualified(table["schema_name"], table["table_name"])} (' + ', '.join(cols) + ');')
for c in sorted(m['constraints'], key=lambda c: c['type'] == 'f'):
    schema.append(f'ALTER TABLE {qualified(c["schema_name"], c["table_name"])} '
                  f'ADD CONSTRAINT {ident(c["name"])} {c["definition"]};')
constraint_names = {(c['schema_name'], c['table_name'], c['name']) for c in m['constraints']}
for index in m['indexes']:
    if (index['schemaname'], index['tablename'], index['indexname']) not in constraint_names:
        schema.append(index['indexdef'] + ';')
for table in m['tables']:
    name = qualified(table['schema_name'], table['table_name'])
    schema.append(f'ALTER TABLE {name} OWNER TO {ident(table["owner"])};')
    if table['rls_enabled']:
        schema.append(f'ALTER TABLE {name} ENABLE ROW LEVEL SECURITY;')
    if table['rls_forced']:
        schema.append(f'ALTER TABLE {name} FORCE ROW LEVEL SECURITY;')
for s in m['schemas']:
    schema.append(f'REVOKE ALL ON SCHEMA {ident(s["name"])} FROM PUBLIC;')
    for item in (s['acl'] or '').strip('{}').split(','):
        who, permissions = item.split('=', 1)
        permissions = permissions.split('/', 1)[0]
        grantee = ident(who) if who else 'PUBLIC'
        for privilege, grantable in re.findall(r'([UC])(\*?)', permissions):
            word = {'U': 'USAGE', 'C': 'CREATE'}[privilege]
            option = ' WITH GRANT OPTION' if grantable else ''
            schema.append(f'GRANT {word} ON SCHEMA {ident(s["name"])} TO {grantee}{option};')
for grant in m['table_grants']:
    target = qualified(grant['table_schema'], grant['table_name'])
    grantee = 'PUBLIC' if grant['grantee'] == 'PUBLIC' else ident(grant['grantee'])
    option = ' WITH GRANT OPTION' if grant['is_grantable'] == 'YES' else ''
    schema.append(f'GRANT {grant["privilege_type"]} ON TABLE {target} TO {grantee}{option};')
for p in m['policies']:
    schema.append(policy_sql(p))
for tr in m['triggers']:
    schema.append(tr['definition'] + ';')
    state = {'D': 'DISABLE', 'A': 'ENABLE ALWAYS', 'R': 'ENABLE REPLICA', 'O': 'ENABLE'}[tr['enabled']]
    schema.append(f'ALTER TABLE {qualified(tr["schema_name"], tr["table_name"])} {state} TRIGGER {ident(tr["name"])};')
for fn in m['functions']:
    schema.extend(function_restore(fn)[1:])

data = ['-- EMPTY DISPOSABLE DATABASE ONLY. Contains private Auth/user data.',
        'BEGIN;', "SET LOCAL session_replication_role = 'replica';",
        'CREATE TEMP TABLE release_snapshot(payload jsonb) ON COMMIT DROP;',
        'INSERT INTO release_snapshot VALUES (' + literal((root / 'data.json').read_text()) + '::jsonb);']
for table in m['tables']:
    name = qualified(table['schema_name'], table['table_name'])
    key = table['schema_name'] + '.' + table['table_name']
    rows = snapshot['data'][key]
    if not rows:
        continue
    cols = [ident(c['column_name']) for c in m['columns']
            if (c['schema_name'], c['table_name']) == (table['schema_name'], table['table_name']) and not c['generated']]
    data.append(f'INSERT INTO {name} (' + ','.join(cols) + ') SELECT '
                + ','.join('j.' + c for c in cols)
                + f" FROM jsonb_populate_recordset(NULL::{name}, (SELECT payload->'data'->{literal(key)} FROM release_snapshot)) AS j;")
for seq in m['sequences'] or []:
    if seq['last_value'] is not None:
        data.append(f'SELECT setval({literal(qualified(seq["schemaname"], seq["sequencename"]))}, {seq["last_value"]}, true);')
data.append('COMMIT;')

affected = {'profiles', 'clients_info', 'client_coaches', 'assignments', 'subscription_plans',
            'content_library', 'daily_completions', 'notification_rules', 'board_posts',
            'notification_sent_log', 'daily_alert_sent_log'}
rollback = ['-- Restore configuration on the ORIGINAL project only; never overwrite user data.',
            '-- Verify the source snapshot and deployment being rolled back before execution.',
            'BEGIN;', "SET LOCAL lock_timeout = '2s';", "SET LOCAL statement_timeout = '30s';"]
triggers = [('public', 'profiles', 'profiles_guard_role'),
            ('public', 'clients_info', 'clients_info_guard_identity'),
            ('public', 'assignments', 'assignments_guard_client_update'),
            ('public', 'notification_rules', 'notification_rules_guard_relationship'),
            ('auth', 'users', 'on_auth_user_created')]
for s, t, n in triggers:
    rollback.append(f'DROP TRIGGER IF EXISTS {ident(n)} ON {qualified(s, t)};')
rollback.append("""DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT * FROM pg_policies WHERE schemaname='public' AND tablename=ANY(ARRAY["""
                + ','.join(literal(t) for t in sorted(affected)) + """]::text[]) LOOP
 EXECUTE format('DROP POLICY %I ON %I.%I',p.policyname,p.schemaname,p.tablename);
 END LOOP; END $$;""")
for n in ['security_media_coach_insert', 'security_media_coach_update', 'security_media_coach_delete']:
    rollback.append(f'DROP POLICY IF EXISTS {ident(n)} ON storage.objects;')
existing_functions = {'is_admin', 'is_coach', 'is_coach_of_client', 'handle_new_user', 'create_client_user', 'create_coach_user'}
for fn in m['functions']:
    if fn['schema_name'] == 'public' and fn['name'] in existing_functions:
        rollback.extend(function_restore(fn))
for p in m['policies']:
    if p['schemaname'] == 'public' and p['tablename'] in affected:
        rollback.append(policy_sql(p))
for tr in m['triggers']:
    if (tr['schema_name'], tr['table_name'], tr['name']) in triggers:
        rollback.append(tr['definition'] + ';')
        if tr['enabled'] != 'O':
            raise ValueError('Unexpected prior trigger state; review rollback manually')
for table in m['tables']:
    if table['schema_name'] == 'public' and table['table_name'] in affected:
        name = qualified('public', table['table_name'])
        rollback.append(f'ALTER TABLE {name} ' + ('ENABLE' if table['rls_enabled'] else 'DISABLE') + ' ROW LEVEL SECURITY;')
        rollback.append(f'ALTER TABLE {name} ' + ('FORCE' if table['rls_forced'] else 'NO FORCE') + ' ROW LEVEL SECURITY;')
for table in ['notification_sent_log', 'daily_alert_sent_log']:
    rollback.append(f'REVOKE ALL ON TABLE public.{ident(table)} FROM PUBLIC, anon, authenticated, service_role;')
    for g in m['table_grants']:
        if g['table_schema'] == 'public' and g['table_name'] == table:
            who = 'PUBLIC' if g['grantee'] == 'PUBLIC' else ident(g['grantee'])
            option = ' WITH GRANT OPTION' if g['is_grantable'] == 'YES' else ''
            rollback.append(f'GRANT {g["privilege_type"]} ON TABLE public.{ident(table)} TO {who}{option};')
rollback.append('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;')
for c in m['constraints']:
    if c['schema_name'] == 'public' and c['table_name'] == 'profiles' and c['name'] == 'profiles_role_check':
        rollback.append('ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check ' + c['definition'] + ';')
for fn in ['guard_profile_role()', 'guard_client_info_identity()', 'guard_client_assignment_update()',
           'guard_notification_rule_relationship()', 'can_read_profile(uuid)', 'can_manage_shared_media()',
           'is_client_of_coach(uuid)', 'can_manage_client(uuid)', 'is_admin_actor()', 'is_coach_actor()',
           'is_trusted_maintenance_actor()']:
    rollback.append('DROP FUNCTION IF EXISTS public.' + fn + ' RESTRICT;')
rollback.extend(['-- Keep push_delivery_receipts and its claim RPC: additive data must survive rollback.', 'COMMIT;'])
for name, lines in [('schema.sql', schema), ('data.sql', data), ('rollback-security.sql', rollback)]:
    write_private(root / name, '\n'.join(lines) + '\n')
print('Generated private isolated restore SQL and configuration-only rollback. No remote operation performed.')
