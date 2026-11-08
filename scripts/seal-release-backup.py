"""Encrypt and verify a private release backup; never uploads it or prints its key."""
import hashlib
import json
import os
import secrets
import subprocess
import sys
import tarfile
from pathlib import Path

if len(sys.argv) != 2:
    raise SystemExit('Usage: python3 scripts/seal-release-backup.py PRIVATE_BACKUP_DIRECTORY')
os.umask(0o077)
root = Path(sys.argv[1]).resolve()
if root.is_symlink() or root.parent.name != '.security-backups':
    raise SystemExit('Expected a private .security-backups directory')
for name in ['restore-test-result.json', 'auth-test-result.json', 'flows-test-result.json']:
    if not (root / name).is_file():
        raise SystemExit('Restore/Auth verification results must exist before sealing')
restore = json.loads((root / 'restore-test-result.json').read_text())
auth = json.loads((root / 'auth-test-result.json').read_text())
flows = json.loads((root / 'flows-test-result.json').read_text())
if not all(restore.get(k) for k in ['exact_data_match', 'rollback_configuration_match', 'new_user_activity_preserved']):
    raise SystemExit('Restore/rollback verification did not pass')
if not all(auth.get(k) for k in ['login_refresh_before_after_rollback', 'coach_rpc_client_login_before_after_rollback',
                                 'admin_rpc_coach_login_before_after_rollback', 'production_auth_version_verified']):
    raise SystemExit('Auth continuity verification did not pass')
if not flows.get('baseline_rows_preserved') or not flows.get('rollback_results_identical'):
    raise SystemExit('Application access verification did not pass')
snapshot = json.loads((root / 'data.json').read_text())
storage = json.loads((root / 'storage-manifest.json').read_text())
if len(storage) != len(snapshot['data']['storage.objects']):
    raise SystemExit('Incomplete storage backup')
expected_objects = {(x['bucket_id'], x['name']): x for x in snapshot['data']['storage.objects']}
if set(expected_objects) != {(x['bucket_id'], x['name']) for x in storage}:
    raise SystemExit('Storage paths differ from the database snapshot')
for obj in storage:
    data = (root / obj['file']).read_bytes()
    if len(data) != obj['bytes'] or hashlib.sha256(data).hexdigest() != obj['sha256']:
        raise SystemExit('Storage backup integrity failure')
    expected = expected_objects[(obj['bucket_id'], obj['name'])]['metadata'].get('size')
    if expected is not None and int(expected) != len(data):
        raise SystemExit('Storage size differs from the database snapshot')
files = sorted(p for p in root.rglob('*') if p.is_file() and p.name != 'archive-manifest.json')
if any(p.is_symlink() for p in files):
    raise SystemExit('Unexpected symlink in private backup')
manifest = {p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
(root / 'archive-manifest.json').write_text(json.dumps(manifest, indent=2))
archive = root.with_suffix('.tar.gz.enc')
key = root.with_suffix('.archive.key')
if key.exists() or archive.exists():
    raise SystemExit('Refusing to overwrite an existing sealed archive/key')
key.write_text(secrets.token_hex(32) + '\n')
key.chmod(0o600)
command = ['openssl', 'enc', '-aes-256-cbc', '-salt', '-pbkdf2', '-iter', '300000',
           '-md', 'sha256', '-pass', 'file:' + str(key)]
with archive.open('wb') as output:
    process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=output, stderr=subprocess.PIPE)
    try:
        with tarfile.open(fileobj=process.stdin, mode='w|gz') as tar:
            for p in files + [root / 'archive-manifest.json']:
                tar.add(p, arcname=p.relative_to(root).as_posix(), recursive=False)
    finally:
        process.stdin.close()
    error = process.stderr.read()
    if process.wait() != 0:
        raise SystemExit('Backup encryption failed')
archive.chmod(0o600)
process = subprocess.Popen(command + ['-d', '-in', str(archive)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
verified = {}
with tarfile.open(fileobj=process.stdout, mode='r|gz') as tar:
    for member in tar:
        if not member.isfile():
            raise SystemExit('Unexpected archive member')
        data = tar.extractfile(member).read()
        if member.name != 'archive-manifest.json':
            verified[member.name] = hashlib.sha256(data).hexdigest()
process.stdout.close()
if process.wait() != 0 or verified != manifest:
    raise SystemExit('Encrypted backup verification failed')
summary = {'archive': archive.name, 'archive_sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
           'files_verified': len(verified), 'storage_objects': len(storage),
           'cipher': 'AES-256-CBC / PBKDF2-SHA256 / 300000 iterations',
           'key_file': key.name, 'uploaded': False}
root.with_suffix('.sealed.json').write_text(json.dumps(summary, indent=2))
print(f'Encrypted archive verified by decryption: {len(verified)} files, {len(storage)} media objects. Key retained separately; nothing uploaded.')
