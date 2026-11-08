"""Verify the deployed service-only receipt RPC, without sending any notification.

Creates one uniquely named diagnostic receipt and deletes that exact receipt.
The cron credential stays in the private input file and is never printed.
"""
import json
import re
import urllib.request
import uuid
from pathlib import Path

project = Path(__file__).resolve().parents[1]
command = json.loads((project / '.security-backups/deploy-cron-20261108.json').read_text())['command']
match = re.search(r'Bearer\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)', command)
if not match:
    raise SystemExit('Cannot resolve the existing cron credential safely')
token = match[1]
key = 'release-receipt-check:' + str(uuid.uuid4())
origin = 'https://gkbxiyzmtrxukpoaqdqn.supabase.co'
headers = {'apikey': token, 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'}
request = urllib.request.Request(origin + '/rest/v1/rpc/claim_push_delivery',
    data=json.dumps({'delivery_key': key}).encode(), headers=headers, method='POST')
with urllib.request.urlopen(request, timeout=30) as response:
    claim = json.load(response)
if not isinstance(claim, str) or str(uuid.UUID(claim)) != claim:
    raise SystemExit('Receipt RPC did not return a valid claim')
request = urllib.request.Request(origin + '/rest/v1/push_delivery_receipts?delivery_key=eq.' + key
    + '&claim_token=eq.' + claim, headers={**headers, 'Prefer': 'return=representation'}, method='DELETE')
with urllib.request.urlopen(request, timeout=30) as response:
    removed = json.load(response)
if len(removed) != 1 or removed[0]['delivery_key'] != key:
    raise SystemExit('Diagnostic receipt cleanup was not confirmed')
print('Live receipt RPC and service credential accepted; exact diagnostic receipt removed; no push sent.')
