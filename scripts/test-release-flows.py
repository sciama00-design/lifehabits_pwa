"""Check legitimate application reads for the original roster on the isolated restore.

Uses real restored relationships and authenticated PostgreSQL roles, not live
credentials. New access restrictions are tested separately by test:security.
"""
import json
import os
import subprocess
import sys
from pathlib import Path

os.umask(0o077)
root = Path(sys.argv[1]).resolve()
container = sys.argv[2]
if not container.startswith('lifehabits-restore-'):
    raise SystemExit('Unexpected container')
inspection = json.loads(subprocess.check_output(['docker', 'inspect', container]))[0]
if inspection['HostConfig']['NetworkMode'] != 'none' or inspection['HostConfig'].get('PortBindings'):
    raise SystemExit('Expected a network-disabled isolated container')
data = json.loads((root / 'data.json').read_text())['data']
project = Path(__file__).resolve().parents[1]
links = {(r['coach_id'], r['client_id']) for r in data['public.client_coaches']}
links |= {(r['coach_id'], r['id']) for r in data['public.clients_info']}


def literal(value):
    return "'" + value.replace("'", "''") + "'"


def id_list(values):
    return ','.join(literal(value) for value in sorted(values)) or 'NULL'


def rows(table, condition):
    return f"(SELECT coalesce(jsonb_agg(id::text ORDER BY id),'[]'::jsonb) FROM public.{table} WHERE {condition})"


def run(sql, stage):
    result = subprocess.run(['docker', 'exec', '-i', container, 'psql', '-X', '-U', 'postgres',
                             '-d', 'release_restore_validation', '-Atq', '-v', 'ON_ERROR_STOP=1'],
                            input=sql, text=True, capture_output=True)
    (root / ('flows-' + stage + '.log')).write_text(result.stderr)
    if result.returncode:
        raise RuntimeError('Isolated application flows failed during ' + stage + '; inspect private log')
    return result.stdout


queries = []
for actor in data['public.profiles']:
    actor_id = actor['id']
    role = actor['role']
    clients = {client for coach, client in links if coach == actor_id}
    coaches = {coach for coach, client in links if client == actor_id}
    if role == 'coach':
        subject = 'client_id IN (' + id_list(clients) + ')'
        profile_filter = 'id IN (' + id_list(clients | {actor_id}) + ") OR role='coach'"
        board_filter = 'coach_id=' + literal(actor_id)
        rule_filter = board_filter
    elif role == 'admin':
        subject = profile_filter = board_filter = rule_filter = 'true'
    else:
        subject = 'client_id=' + literal(actor_id)
        profile_filter = 'id IN (' + id_list(coaches | {actor_id}) + ')'
        board_filter = 'coach_id IN (' + id_list(coaches) + ')'
        rule_filter = '(' + subject + ') OR (client_id IS NULL AND ' + board_filter + ')'
    flows = {
        'profiles': rows('profiles', profile_filter),
        'plans': rows('subscription_plans', subject),
        'assignments': rows('assignments', subject),
        'appointments': rows('appointments', subject),
        'board': rows('board_posts', board_filter),
        'notification_rules': rows('notification_rules', rule_filter),
        'own_push_subscriptions': rows('push_subscriptions', 'user_id=' + literal(actor_id)),
        'own_alert_preferences': rows('alert_settings', 'user_id=' + literal(actor_id)),
    }
    if role in ['coach', 'admin']:
        flows['content_library'] = rows('content_library', 'true')
    pairs = ','.join(literal(key) + ',' + query for key, query in flows.items())
    claims = json.dumps({'role': 'authenticated', 'sub': actor_id})
    queries.append('BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims='
                   + literal(claims) + '; SELECT jsonb_build_object(\'actor\',' + literal(actor_id)
                   + ',\'flows\',jsonb_build_object(' + pairs + ')); ROLLBACK;')


def capture(stage):
    return {row['actor']: row['flows'] for row in map(json.loads, run('\n'.join(queries), stage).splitlines())}


try:
    before = capture('before')
    run((project / 'src/database/security/prepare_push_delivery_candidate.sql').read_text(), 'prepare')
    run((project / 'src/database/security/apply_security_fixes_candidate.sql').read_text(), 'candidate')
    after = capture('after')
    missing = []
    for actor, flows in before.items():
        for name, ids in flows.items():
            if not set(ids) <= set(after[actor][name]):
                missing.append(name)
    run((root / 'rollback-security.sql').read_text(), 'rollback')
    rolled_back = capture('rolled_back')
    if before != rolled_back:
        raise RuntimeError('Application read results differ after configuration rollback')
    if missing:
        raise RuntimeError('Candidate removes previously legitimate scoped reads in: ' + ','.join(sorted(set(missing))))
    checks = sum(len(flows) for flows in before.values())
    result = {'actors': len(before), 'scoped_read_checks': checks,
              'baseline_rows_preserved': True, 'rollback_results_identical': True,
              'full_browser_interaction_tested': False, 'production_modified': False}
    (root / 'flows-test-result.json').write_text(json.dumps(result, indent=2))
    print(f'Isolated application reads: {checks} scoped checks across {len(before)} original profiles preserve baseline access; rollback results match.')
except Exception as error:
    print(str(error), file=sys.stderr)
    raise SystemExit(1)
