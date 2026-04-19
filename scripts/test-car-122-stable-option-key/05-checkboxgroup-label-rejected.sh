#!/usr/bin/env bash
# checkboxGroup with a mix of a key and a localized label — element 1
# (the label 'Burning') is rejected at its element index.
# Expected: 422, errors[0].code = NOT_IN_OPTIONS, path = ["pain_type", 1].

set -euo pipefail
BASE_URL="http://localhost:3000"
CHART_NOTE_ID="${1:?Usage: ./05-checkboxgroup-label-rejected.sh <chart_note_id> [version]}"
VERSION="${2:-1}"
PRACTITIONER_ID="0323c4a0-28e8-48cd-aed0-d57bf170a948"

echo "=== pain_type: ['sharp', 'Burning'] (element[1] is the EN label, not a key) ==="
resp=$(curl -s -w '\n%{http_code}' -X PATCH "${BASE_URL}/api/clinical/chart-notes/${CHART_NOTE_ID}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"version\": ${VERSION},
    \"practitionerId\": \"${PRACTITIONER_ID}\",
    \"fieldValues\": { \"pain_type\": [\"sharp\", \"Burning\"] }
  }")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
