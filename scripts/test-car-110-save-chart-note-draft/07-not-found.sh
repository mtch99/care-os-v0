#!/usr/bin/env bash
# Test 7: Save draft for a non-existent chart note -- expect 404 CHART_NOTE_NOT_FOUND.

set -euo pipefail
BASE_URL="http://localhost:3000"
PRACTITIONER_ID="0323c4a0-28e8-48cd-aed0-d57bf170a948"
FAKE_ID="00000000-0000-0000-0000-000000000000"

echo "=== Test: Chart note not found ==="
resp=$(curl -s -w '\n%{http_code}' -X PATCH "${BASE_URL}/api/clinical/chart-notes/${FAKE_ID}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"fieldValues\": {
      \"chief_complaint\": \"test\"
    },
    \"version\": 1,
    \"practitionerId\": \"${PRACTITIONER_ID}\"
  }")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
echo ""
echo "Expected: HTTP 404, code=CHART_NOTE_NOT_FOUND"
