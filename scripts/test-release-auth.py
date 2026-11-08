"""Exercise GoTrue HTTP login/refresh against the private Docker restore only.

Requires test-release-restore.py first and a GoTrue container sharing the network
namespace of the network-disabled PostgreSQL test container. Never contacts users.
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import subprocess
import sys
import time
from pathlib import Path

os.umask(0o077)
if len(sys.argv) != 3:
    raise SystemExit('Usage: python3 scripts/test-release-auth.py PRIVATE_BACKUP_DIRECTORY POSTGRES_CONTAINER')
root = Path(sys.argv[1]).resolve()
container = sys.argv[2]
if not container.startswith('lifehabits-restore-'):
    raise SystemExit('Unexpected container')
inspection = json.loads(subprocess.check_output(['docker', 'inspect', container]))[0]
if inspection['HostConfig']['NetworkMode'] != 'none' or inspection['HostConfig'].get('PortBindings'):
    raise SystemExit('Auth tests require an isolated network with no published ports')
settings = dict(line.split('=', 1) for line in (root / 'auth-test.env').read_text().splitlines() if '=' in line)
project = Path(__file__).resolve().parents[1]


def sql(query, stage):
    result = subprocess.run(['docker', 'exec', '-i', container, 'psql', '-X', '-U', 'postgres',
                             '-d', 'release_restore_validation', '-v', 'ON_ERROR_STOP=1', '-Atq'],
                            input=query, text=True, capture_output=True)
    (root / ('auth-' + stage + '.log')).write_text(result.stderr)
    if result.returncode:
        raise RuntimeError(stage + ' failed; inspect the private log')
    return result.stdout.strip()


def http(method, path, payload=None, token=None):
    body = json.dumps(payload).encode() if payload is not None else b''
    headers = [f'{method} {path} HTTP/1.0', 'Host: 127.0.0.1:9999', 'Content-Type: application/json',
               'Connection: close', f'Content-Length: {len(body)}']
    if token:
        headers.append('Authorization: Bearer ' + token)
    request = '\r\n'.join(headers).encode() + b'\r\n\r\n' + body
    result = subprocess.run(['docker', 'exec', '-i', container, 'bash', '-c',
                             'exec 3<>/dev/tcp/127.0.0.1/9999; cat >&3; cat <&3'],
                            input=request, capture_output=True, timeout=20)
    if result.returncode:
        raise RuntimeError('Local Auth HTTP transport failed')
    head, content = result.stdout.split(b'\r\n\r\n', 1)
    status = int(head.splitlines()[0].split()[1])
    response = json.loads(content)
    if status != 200:
        # Record privately: a failed Auth response may include identity information.
        (root / 'auth-http-error.json').write_text(json.dumps(response))
        raise RuntimeError(f'Local Auth HTTP {status} for {method} {path}; details retained privately')
    return response


def b64(data):
    return base64.urlsafe_b64encode(data).rstrip(b'=')


header = b64(b'{"alg":"HS256","typ":"JWT"}')
claims = b64(json.dumps({'role': 'service_role', 'iss': 'supabase', 'exp': int(time.time()) + 3600}).encode())
message = header + b'.' + claims
admin_token = (message + b'.' + b64(hmac.new(settings['GOTRUE_JWT_SECRET'].encode(), message, hashlib.sha256).digest())).decode()
password = secrets.token_urlsafe(24)
suffix = secrets.token_hex(4)
sessions = {}


def login(email):
    return http('POST', '/token?grant_type=password', {'email': email, 'password': password})


def check_sessions(stage):
    for role, session in sessions.items():
        user = http('GET', '/user', token=session['access_token'])
        if user['id'] != session['user']['id']:
            raise RuntimeError('Session identity changed during ' + stage)
        refreshed = http('POST', '/token?grant_type=refresh_token', {'refresh_token': session['refresh_token']})
        if refreshed['user']['id'] != user['id']:
            raise RuntimeError('Refresh identity changed during ' + stage)
        sessions[role] = refreshed
    print('Isolated Auth HTTP: existing client/coach/admin sessions and refresh work ' + stage + '.')


def provision_client(stage):
    email = f'rpc-{stage}-{suffix}@example.test'
    actor = sessions['coach']['user']['id']
    claims = json.dumps({'role': 'authenticated', 'sub': actor})
    sql("BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '" + claims
        + "', true); SELECT public.create_client_user('" + email + "','" + password
        + "','Isolated RPC client'); COMMIT;", 'rpc_' + stage)
    session = login(email)
    if not session.get('access_token'):
        raise RuntimeError('RPC-created client cannot log in during ' + stage)
    print('Isolated Auth HTTP: client provisioned by coach RPC logs in ' + stage + '.')


def provision_coach(stage):
    email = f'rpc-coach-{stage}-{suffix}@example.test'
    actor = sessions['admin']['user']['id']
    claims = json.dumps({'role': 'authenticated', 'sub': actor})
    sql("BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '" + claims
        + "', true); SELECT public.create_coach_user('" + email + "','" + password
        + "','Isolated RPC coach'); COMMIT;", 'rpc_coach_' + stage)
    session = login(email)
    role = sql("SELECT role FROM public.profiles WHERE id='" + session['user']['id'] + "';", 'read_coach_' + stage)
    if role != 'coach':
        raise RuntimeError('Admin-provisioned coach has an incorrect role during ' + stage)
    print('Isolated Auth HTTP: coach provisioned by admin RPC logs in ' + stage + '.')


try:
    health = http('GET', '/health')
    for role in ['client', 'coach', 'admin']:
        email = f'continuity-{role}-{suffix}@example.test'
        user = http('POST', '/admin/users', {'email': email, 'password': password, 'email_confirm': True,
                    'user_metadata': {'full_name': 'Isolated continuity account'}}, admin_token)
        sql(f"UPDATE public.profiles SET role='{role}' WHERE id='{user['id']}';", 'set_test_role_' + role)
        sessions[role] = login(email)
    check_sessions('before candidate')
    provision_client('before')
    provision_coach('before')
    sql((project / 'src/database/security/prepare_push_delivery_candidate.sql').read_text(), 'prepare_delivery')
    sql((project / 'src/database/security/apply_security_fixes_candidate.sql').read_text(), 'apply_candidate')
    check_sessions('after candidate')
    provision_client('after')
    provision_coach('after')
    sql((root / 'rollback-security.sql').read_text(), 'rollback')
    check_sessions('after rollback')
    provision_client('rollback')
    provision_coach('rollback')
    result = {'isolated': True, 'auth_image': 'supabase/gotrue:v2.197.0', 'health': health,
              'roles': list(sessions), 'login_refresh_before_after_rollback': True,
              'coach_rpc_client_login_before_after_rollback': True,
              'admin_rpc_coach_login_before_after_rollback': True,
              'production_modified': False,
              'production_auth_version_verified': (root / 'production-auth-health.json').exists()
              and json.loads((root / 'production-auth-health.json').read_text()).get('version') == health.get('version')}
    (root / 'auth-test-result.json').write_text(json.dumps(result, indent=2))
except Exception as error:
    print(str(error), file=sys.stderr)
    raise SystemExit(1)
