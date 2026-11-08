"""Restore private snapshot, apply candidate, roll back configuration, compare fingerprints.

Only operates in a Docker container named lifehabits-restore-* with networking
disabled. Never connects to Supabase. No private rows are printed on failures.
"""
import hashlib
from decimal import Decimal
import json
import os
import subprocess
import sys
from pathlib import Path

os.umask(0o077)
if len(sys.argv) != 3:
    raise SystemExit('Usage: python3 scripts/test-release-restore.py PRIVATE_BACKUP_DIRECTORY CONTAINER')
root = Path(sys.argv[1]).resolve()
container = sys.argv[2]
if not container.startswith('lifehabits-restore-'):
    raise SystemExit('Refusing an unexpected container')
inspection = json.loads(subprocess.check_output(['docker', 'inspect', container]))[0]
if inspection['HostConfig']['NetworkMode'] != 'none' or inspection['HostConfig'].get('PortBindings'):
    raise SystemExit('Restore test requires no network and no published ports')
m = json.loads((root / 'metadata.json').read_text())
snapshot = json.loads((root / 'data.json').read_text(), parse_float=Decimal)
project = Path(__file__).resolve().parents[1]
db_name = 'release_restore_validation'


def execute(sql, label, database=db_name):
    result = subprocess.run(['docker', 'exec', '-i', container, 'psql', '-X', '-U', 'postgres',
                             '-d', database, '-v', 'ON_ERROR_STOP=1', '-Atq'],
                            input=sql, capture_output=True, text=True)
    log = root / (label + '.log')
    log.write_text(result.stderr)
    log.chmod(0o600)
    if result.returncode:
        raise RuntimeError(f'{label} failed; inspect its private log locally (rows are not printed)')
    return result.stdout


def literal(value):
    return "'" + value.replace("'", "''") + "'"


def ident(value):
    return '"' + value.replace('"', '""') + '"'


def data_fingerprints(label):
    queries = []
    for table in m['tables']:
        name = table['schema_name'] + '.' + table['table_name']
        target = ident(table['schema_name']) + '.' + ident(table['table_name'])
        queries.append(f"SELECT {literal(name)} AS name,coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) AS rows FROM {target} t")
    rows = json.loads(execute('SELECT jsonb_object_agg(name,rows) FROM (' + ' UNION ALL '.join(queries) + ') q;', label), parse_float=Decimal)
    return fingerprints(rows)


def fingerprints(tables):
    return {key: hashlib.sha256('\n'.join(sorted(json.dumps(row, sort_keys=True, separators=(',', ':'), default=lambda d: {'__decimal__': str(d)})
                                                for row in rows)).encode()).hexdigest()
            for key, rows in tables.items() if key != 'cron.job'}


function_names = ','.join(literal(fn['name']) for fn in m['functions'])
metadata_sql = f"""SELECT jsonb_build_object(
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY schemaname,tablename,policyname) FROM pg_policies p WHERE schemaname IN ('public','auth','storage') AND tablename<>'push_delivery_receipts'),
 'tables',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'rls',c.relrowsecurity,'force',c.relforcerowsecurity) ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname IN ('public','auth','storage') AND c.relname<>'push_delivery_receipts'),
 'functions',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),
   'acl',(SELECT jsonb_agg(jsonb_build_object('grantee',a.grantee,'grantor',a.grantor,'privilege',a.privilege_type,'grantable',a.is_grantable) ORDER BY a.grantee,a.privilege_type,a.is_grantable) FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a)) ORDER BY n.nspname,p.proname,p.oid::regprocedure::text)
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','auth','storage') AND p.prokind='f' AND p.proname IN ({function_names})),
 'grants',(SELECT jsonb_agg(to_jsonb(g) ORDER BY table_schema,table_name,grantee,privilege_type) FROM information_schema.table_privileges g WHERE table_schema IN ('public','auth','storage') AND table_name<>'push_delivery_receipts'),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('table',c.oid::regclass::text,'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) ORDER BY c.oid::regclass::text,t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND n.nspname IN ('public','auth','storage')),
 'role_check',(SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.profiles'::regclass AND conname='profiles_role_check')
);"""

try:
    execute(f'DROP DATABASE IF EXISTS {db_name};', 'reset_database', 'postgres')
    execute(f'CREATE DATABASE {db_name};', 'create_database', 'postgres')
    execute((root / 'schema.sql').read_text(), 'schema_restore')
    execute((root / 'data.sql').read_text(), 'data_restore')
    expected = fingerprints(snapshot['data'])
    restored = data_fingerprints('verify_data_restore')
    if restored != expected:
        changed = [k for k in expected if restored.get(k) != expected[k]]
        raise RuntimeError('Restored data differs in tables: ' + ', '.join(changed))
    baseline = json.loads(execute(metadata_sql, 'baseline_metadata'))
    print(f'Restored {len(expected)} tables: exact row fingerprints match, including Auth hashes, identities and sessions.')
    execute((project / 'src/database/security/prepare_push_delivery_candidate.sql').read_text(), 'prepare_delivery')
    execute((project / 'src/database/security/apply_security_fixes_candidate.sql').read_text(), 'apply_candidate')
    execute("""INSERT INTO auth.users(id,email,raw_user_meta_data)
      VALUES('99999999-9999-4999-8999-999999999999','release-restore@example.test','{"full_name":"Restore continuity test"}');
      UPDATE public.profiles SET full_name='Activity after candidate deployment'
      WHERE id='99999999-9999-4999-8999-999999999999';""", 'simulate_new_activity')
    before_rollback = data_fingerprints('before_rollback')
    execute((root / 'rollback-security.sql').read_text(), 'rollback_candidate')
    after_rollback = data_fingerprints('after_rollback')
    if after_rollback != before_rollback:
        raise RuntimeError('Rollback changed user/Auth data')
    rolled_back = json.loads(execute(metadata_sql, 'rolled_back_metadata'))
    if rolled_back != baseline:
        changed = [k for k in baseline if baseline[k] != rolled_back[k]]
        raise RuntimeError('Rollback metadata differs in: ' + ', '.join(changed))
    result = {'project_ref': m['project_ref'], 'snapshot_at': snapshot['captured_at'],
              'tables_restored': len(expected), 'exact_data_match': True,
              'candidate_applied': True, 'rollback_configuration_match': True,
              'new_user_activity_preserved': True, 'production_modified': False,
              'auth_service_login_tested': False, 'storage_upload_service_tested': False}
    (root / 'restore-test-result.json').write_text(json.dumps(result, indent=2))
    print('Candidate and configuration rollback verified. New activity, all original rows and active-session records survived.')
except Exception as error:
    print(str(error), file=sys.stderr)
    raise SystemExit(1)
