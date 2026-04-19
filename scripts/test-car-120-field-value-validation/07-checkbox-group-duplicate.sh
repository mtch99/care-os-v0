#!/usr/bin/env bash
# checkboxGroup rejects duplicate values (and flags the second occurrence by index).
# Expected: 422 with errors[0].code = DUPLICATE and path = ["pain_type", 1].

set -euo pipefail
BASE_URL="http://localhost:3000"
CHART_NOTE_ID="${1:?Usage: ./07-checkbox-group-duplicate.sh <chart_note_id> [version]}"
VERSION="${2:-1}"
PRACTITIONER_ID="0323c4a0-28e8-48cd-aed0-d57bf170a948"

echo "=== pain_type: ['sharp', 'sharp'] (two occurrences of the same option.key) ==="
resp=$(curl -s -w '\n%{http_code}' -X PATCH "${BASE_URL}/api/clinical/chart-notes/${CHART_NOTE_ID}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"version\": ${VERSION},
    \"practitionerId\": \"${PRACTITIONER_ID}\",
    \"fieldValues\": { \"pain_type\": [\"sharp\", \"sharp\"] }
  }")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
