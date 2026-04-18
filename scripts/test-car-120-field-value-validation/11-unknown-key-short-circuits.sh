#!/usr/bin/env bash
# Unknown field key + invalid value: the key check runs FIRST, so the user
# sees UNKNOWN_FIELD_ID — not FIELD_VALUE_VALIDATION_ERROR.
# Expected: 422 with error.code = UNKNOWN_FIELD_ID.

set -euo pipefail
BASE_URL="http://localhost:3000"
CHART_NOTE_ID="${1:?Usage: ./11-unknown-key-short-circuits.sh <chart_note_id> [version]}"
VERSION="${2:-1}"
PRACTITIONER_ID="0323c4a0-28e8-48cd-aed0-d57bf170a948"

echo "=== Unknown key 'not_a_field' AND invalid scale in same payload ==="
resp=$(curl -s -w '\n%{http_code}' -X PATCH "${BASE_URL}/api/clinical/chart-notes/${CHART_NOTE_ID}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"version\": ${VERSION},
    \"practitionerId\": \"${PRACTITIONER_ID}\",
    \"fieldValues\": {
      \"not_a_field\": \"anything\",
      \"pain_intensity\": 99
    }
  }")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"

echo ""
echo "error.code: $(echo "$body" | jq -r '.error.code') (expected: UNKNOWN_FIELD_ID)"
