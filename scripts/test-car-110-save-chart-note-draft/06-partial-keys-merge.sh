#!/usr/bin/env bash
# Test 6: Save draft with partial keys -- only submitted keys change, others retained.
# Usage: ./06-partial-keys-merge.sh <chart_note_id> [version]

set -euo pipefail
BASE_URL="http://localhost:3000"
CHART_NOTE_ID="${1:?Usage: $0 <chart_note_id> [version]}"
VERSION="${2:-3}"
PRACTITIONER_ID="0323c4a0-28e8-48cd-aed0-d57bf170a948"

echo "=== Test: Partial keys merge ==="
echo "Sending only pain_scale -- chief_complaint should be unchanged from previous save."
resp=$(curl -s -w '\n%{http_code}' -X PATCH "${BASE_URL}/api/clinical/chart-notes/${CHART_NOTE_ID}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"fieldValues\": {
      \"pain_scale\": 7
    },
    \"version\": ${VERSION},
    \"practitionerId\": \"${PRACTITIONER_ID}\"
  }")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
echo ""
echo "Expected: HTTP 200, pain_scale=7, chief_complaint unchanged from previous state"
