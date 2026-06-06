#!/usr/bin/env bash
# Run before any apex deploy. Aborts if a locked file's SHA256 has drifted
# without the lock being updated. Born from the 2026-05-17 /artifacts clobber.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
LOCKS="$DIR/.canonical-locks.json"
[ -f "$LOCKS" ] || { echo "no .canonical-locks.json found"; exit 0; }
FAIL=0
python3 -c "
import json, hashlib, sys, os
d = json.load(open('$LOCKS'))
for f, expected in d.get('locks', {}).items():
    p = os.path.join('$DIR', f)
    if not os.path.exists(p):
        print('MISSING', f); sys.exit(2)
    h = hashlib.sha256(open(p, 'rb').read()).hexdigest()
    if h != expected:
        print('DRIFT', f, 'expected', expected[:12], 'got', h[:12]); sys.exit(3)
    else:
        print('ok    ', f)
"
