#!/usr/bin/env bash
# Test 2: Save draft with stale version -- expect 409 VERSION_CONFLICT.
# Run after 01 (which bumps version to 2). This sends version=1.
# Usage: ./02-stale-version.sh <chart_note_id>

set -euo pipefail
BASE_URL="http://localhost:3000"
CHART_NOTE_ID="${1:?Usage: $0 <chart_note_id>}"
PRACTITIONER_ID="0323c4a0-28e8-48cd-aed0-d57bf170a948"

echo "=== Test: Stale version ==="
resp=$(curl -s -w '\n%{http_code}' -X PATCH "${BASE_URL}/api/clinical/chart-notes/${CHART_NOTE_ID}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"fieldValues\": {
      \"pain_scale\": 7
    },
    \"version\": 1,
    \"practitionerId\": \"${PRACTITIONER_ID}\"
  }")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
echo ""
echo "Expected: HTTP 409, code=VERSION_CONFLICT"
