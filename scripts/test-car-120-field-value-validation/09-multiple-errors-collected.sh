#!/usr/bin/env bash
# Payload with three invalid fields is rejected with ONE error containing
# all three per-field violations — proves the collect-then-throw contract.
# Expected: 422, errors.length === 3.

set -euo pipefail
BASE_URL="http://localhost:3000"
CHART_NOTE_ID="${1:?Usage: ./09-multiple-errors-collected.sh <chart_note_id> [version]}"
VERSION="${2:-1}"
PRACTITIONER_ID="0323c4a0-28e8-48cd-aed0-d57bf170a948"

echo "=== Three invalid fields in one payload ==="
resp=$(curl -s -w '\n%{http_code}' -X PATCH "${BASE_URL}/api/clinical/chart-notes/${CHART_NOTE_ID}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"version\": ${VERSION},
    \"practitionerId\": \"${PRACTITIONER_ID}\",
    \"fieldValues\": {
      \"pain_intensity\": 99,
      \"referring_md\": 42,
      \"mechanism_of_injury\": \"Mystery\"
    }
  }")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"

echo ""
echo "Error count: $(echo "$body" | jq -r '.error.errors | length')"
echo "Error codes: $(echo "$body" | jq -r '[.error.errors[].code] | sort | join(",")')"
