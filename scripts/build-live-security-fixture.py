"""Build disposable PostgreSQL test DDL from metadata exports; never connects to a DB.

Storage engine internals and auth.users are supplied by the existing test harness.
Only policies actually exported are included, so this is not a full Supabase clone.
"""
import csv
import json
import sys
from pathlib import Path


def identifier(value):
    return '"' + value.replace('"', '""') + '"'


root = Path(__file__).resolve().parents[1]
if len(sys.argv) not in (2, 3):
    raise SystemExit('Usage: python3 scripts/build-live-security-fixture.py /tmp/lifehabits-live-schema.sql [schema-metadata.json]')
context_dir = root / 'project_docs/live-context'
if len(sys.argv) == 3:
    context = json.loads(Path(sys.argv[2]).read_text())
    policies = context['policies']
else:
    with (context_dir / 'Supabase Snippet Untitled query (5).csv').open() as stream:
        context = json.loads(next(csv.DictReader(stream))['live_context'])
    with (context_dir / 'Supabase Snippet Untitled query.csv').open() as stream:
        policies = list(csv.DictReader(stream))

statements = ['-- Synthetic test fixture only; never apply this file to a live project.']
tables = [table for table in context['tables'] if table['schema_name'] == 'public']
for table in tables:
    name = table['table_name']
    columns = []
    for column in sorted(context['columns'], key=lambda item: item['position']):
        if column['schema_name'] != 'public' or column['table_name'] != name:
            continue
        sql = identifier(column['column_name']) + ' ' + column['data_type']
        if column['default_expression'] is not None:
            sql += ' DEFAULT ' + column['default_expression']
        if column['not_null']:
            sql += ' NOT NULL'
        columns.append(sql)
    statements.append(f'CREATE TABLE public.{identifier(name)} (' + ', '.join(columns) + ');')

# Keys must exist before foreign keys referring to them are created.
constraints = [item for item in context['constraints'] if item['schema_name'] == 'public']
for constraint in sorted(constraints, key=lambda item: item['definition'].startswith('FOREIGN KEY')):
    statements.append(
        f'ALTER TABLE public.{identifier(constraint["table_name"])} '
        f'ADD CONSTRAINT {identifier(constraint["constraint_name"])} {constraint["definition"]};'
    )
for table in tables:
    if table['rls_enabled']:
        statements.append(f'ALTER TABLE public.{identifier(table["table_name"])} ENABLE ROW LEVEL SECURITY;')
    if table['rls_forced']:
        statements.append(f'ALTER TABLE public.{identifier(table["table_name"])} FORCE ROW LEVEL SECURITY;')

for routine in context['functions']:
    statements.append(routine['definition'].rstrip().rstrip(';') + ';')
for trigger in context['triggers']:
    if trigger['schema_name'] != 'storage':
        statements.append(trigger['definition'].rstrip().rstrip(';') + ';')

for policy in policies:
    assert policy['cmd'] in {'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL'}
    assert policy['permissive'] in {'PERMISSIVE', 'RESTRICTIVE'}
    roles = policy['roles'] if isinstance(policy['roles'], list) else policy['roles'].strip('{}').split(',')
    assert set(roles) <= {'public', 'anon', 'authenticated', 'service_role'}
    to_roles = ', '.join('PUBLIC' if role == 'public' else identifier(role) for role in roles)
    sql = (
        f'CREATE POLICY {identifier(policy["policyname"])} ON '
        f'{identifier(policy["schemaname"])}.{identifier(policy["tablename"])} '
        f'AS {policy["permissive"]} FOR {policy["cmd"]} TO {to_roles}'
    )
    if policy['qual'] not in {'', 'null', None}:
        sql += f' USING ({policy["qual"]})'
    if policy['with_check'] not in {'', 'null', None}:
        sql += f' WITH CHECK ({policy["with_check"]})'
    statements.append(sql + ';')

destination = Path(sys.argv[1])
destination.write_text('\n'.join(statements) + '\n')
print(f'Test-only fixture: {len(tables)} public tables, {len(constraints)} constraints, '
      f'{len(context["functions"])} functions and {len(policies)} exported policies -> {destination}')
