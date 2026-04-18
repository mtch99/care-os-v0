#!/usr/bin/env bash
# Select value that is the EN label ('Traumatic') no longer matches —
# CAR-122 removed the locale-permissive OR-match. Should fail with
# NOT_IN_OPTIONS. This is the regression test proving the old behavior
# is gone.
# Expected: 422, error.code = FIELD_VALUE_VALIDATION_ERROR,
#           errors[0].code = NOT_IN_OPTIONS, path = ["mechanism_of_injury"].

set -euo pipefail
BASE_URL="http://localhost:3000"
CHART_NOTE_ID="${1:?Usage: ./02-select-en-label-rejected.sh <chart_note_id> [version]}"
VERSION="${2:-1}"
PRACTITIONER_ID="0323c4a0-28e8-48cd-aed0-d57bf170a948"

echo "=== mechanism_of_injury: 'Traumatic' (EN label — post-CAR-122 should reject) ==="
resp=$(curl -s -w '\n%{http_code}' -X PATCH "${BASE_URL}/api/clinical/chart-notes/${CHART_NOTE_ID}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"version\": ${VERSION},
    \"practitionerId\": \"${PRACTITIONER_ID}\",
    \"fieldValues\": { \"mechanism_of_injury\": \"Traumatic\" }
  }")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
