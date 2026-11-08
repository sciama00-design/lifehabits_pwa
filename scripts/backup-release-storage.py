"""Download every object in a private release snapshot; public buckets only, GET only."""
import concurrent.futures
import hashlib
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

if len(sys.argv) != 2:
    raise SystemExit('Usage: python3 scripts/backup-release-storage.py PRIVATE_BACKUP_DIRECTORY')
os.umask(0o077)
root = Path(sys.argv[1]).resolve()
snapshot = json.loads((root / 'data.json').read_text())
if snapshot['project_ref'] != 'gkbxiyzmtrxukpoaqdqn':
    raise SystemExit('Unexpected source project')
buckets = {b['id']: b for b in snapshot['data']['storage.buckets']}
objects = snapshot['data']['storage.objects']
destination = root / 'objects'
destination.mkdir(mode=0o700, exist_ok=True)


def download(index_object):
    index, obj = index_object
    if not buckets[obj['bucket_id']]['public']:
        raise ValueError(f'Object {index}: private bucket requires an authenticated backup transport')
    key = obj['bucket_id'] + '/' + obj['name']
    filename = hashlib.sha256(key.encode()).hexdigest()
    url = ('https://gkbxiyzmtrxukpoaqdqn.supabase.co/storage/v1/object/public/'
           + urllib.parse.quote(key, safe='/'))
    with urllib.request.urlopen(url, timeout=60) as response:
        if response.status != 200:
            raise ValueError(f'Object {index}: unsuccessful HTTP response')
        content = response.read()
    expected = obj['metadata'].get('size')
    if expected is not None and len(content) != int(expected):
        raise ValueError(f'Object {index}: size differs from snapshot')
    etag = str(obj['metadata'].get('eTag', '')).strip('"')
    if re.fullmatch('[a-fA-F0-9]{32}', etag) and hashlib.md5(content, usedforsecurity=False).hexdigest() != etag.lower():
        raise ValueError(f'Object {index}: ETag differs from snapshot')
    path = destination / filename
    path.write_bytes(content)
    path.chmod(0o600)
    return {'bucket_id': obj['bucket_id'], 'name': obj['name'], 'file': 'objects/' + filename,
            'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest()}


with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    manifest = list(pool.map(download, enumerate(objects)))
path = root / 'storage-manifest.json'
path.write_text(json.dumps(manifest, indent=2))
path.chmod(0o600)
print(f'Backed up {len(manifest)} objects, {sum(x["bytes"] for x in manifest)} bytes; sizes/checksums verified.')
