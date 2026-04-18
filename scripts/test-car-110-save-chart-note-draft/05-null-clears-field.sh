#!/usr/bin/env bash
# Test 5: Save draft with null value to clear a field -- expect 200, field set to null.
# Usage: ./05-null-clears-field.sh <chart_note_id> [version]

set -euo pipefail
BASE_URL="http://localhost:3000"
CHART_NOTE_ID="${1:?Usage: $0 <chart_note_id> [version]}"
VERSION="${2:-2}"
PRACTITIONER_ID="0323c4a0-28e8-48cd-aed0-d57bf170a948"

echo "=== Test: Null clears a field ==="
resp=$(curl -s -w '\n%{http_code}' -X PATCH "${BASE_URL}/api/clinical/chart-notes/${CHART_NOTE_ID}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"fieldValues\": {
      \"chief_complaint\": null
    },
    \"version\": ${VERSION},
    \"practitionerId\": \"${PRACTITIONER_ID}\"
  }")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
echo ""
echo "Expected: HTTP 200, chief_complaint=null, version bumped"
