#!/usr/bin/env bash
# Select value that is the FR label ('Traumatique') also rejects, same as EN.
# Post-CAR-122, only option.key is accepted.
# Expected: 422, NOT_IN_OPTIONS.

set -euo pipefail
BASE_URL="http://localhost:3000"
CHART_NOTE_ID="${1:?Usage: ./03-select-fr-label-rejected.sh <chart_note_id> [version]}"
VERSION="${2:-1}"
PRACTITIONER_ID="0323c4a0-28e8-48cd-aed0-d57bf170a948"

echo "=== mechanism_of_injury: 'Traumatique' (FR label — post-CAR-122 should reject) ==="
resp=$(curl -s -w '\n%{http_code}' -X PATCH "${BASE_URL}/api/clinical/chart-notes/${CHART_NOTE_ID}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"version\": ${VERSION},
    \"practitionerId\": \"${PRACTITIONER_ID}\",
    \"fieldValues\": { \"mechanism_of_injury\": \"Traumatique\" }
  }")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
