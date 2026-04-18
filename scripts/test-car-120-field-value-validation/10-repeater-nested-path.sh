#!/usr/bin/env bash
# repeaterTable cell path surfaces rowIndex and columnKey in the error.
# Expected: 422 with errors[0].path = ["rom_table", 0, "movement"] (rom_table
# has a select column "movement" whose options do NOT include "Unknown").

set -euo pipefail
BASE_URL="http://localhost:3000"
CHART_NOTE_ID="${1:?Usage: ./10-repeater-nested-path.sh <chart_note_id> [version]}"
VERSION="${2:-1}"
PRACTITIONER_ID="0323c4a0-28e8-48cd-aed0-d57bf170a948"

echo "=== rom_table row 0, movement: 'Unknown' (select cell not in options) ==="
resp=$(curl -s -w '\n%{http_code}' -X PATCH "${BASE_URL}/api/clinical/chart-notes/${CHART_NOTE_ID}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"version\": ${VERSION},
    \"practitionerId\": \"${PRACTITIONER_ID}\",
    \"fieldValues\": {
      \"rom_table\": [
        { \"joint\": \"Shoulder\", \"movement\": \"Unknown\", \"active\": \"90\" }
      ]
    }
  }")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"

echo ""
echo "Error path: $(echo "$body" | jq -c '.error.errors[0].path')"
