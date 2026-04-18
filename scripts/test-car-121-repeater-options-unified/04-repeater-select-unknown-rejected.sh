#!/usr/bin/env bash
# Unknown value (neither key nor label) in a repeater select cell is
# rejected with NOT_IN_OPTIONS at the nested path.
# Expected: 422, error path = ["rom_table", 0, "movement"].

set -euo pipefail
BASE_URL="http://localhost:3000"
CHART_NOTE_ID="${1:?Usage: ./04-repeater-select-unknown-rejected.sh <chart_note_id> [version]}"
VERSION="${2:-1}"
PRACTITIONER_ID="0323c4a0-28e8-48cd-aed0-d57bf170a948"

echo "=== rom_table row with movement: 'mystery' (unknown — should fail) ==="
resp=$(curl -s -w '\n%{http_code}' -X PATCH "${BASE_URL}/api/clinical/chart-notes/${CHART_NOTE_ID}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"version\": ${VERSION},
    \"practitionerId\": \"${PRACTITIONER_ID}\",
    \"fieldValues\": {
      \"rom_table\": [
        { \"joint\": \"Knee\", \"movement\": \"mystery\", \"active\": \"120\", \"passive\": \"130\" }
      ]
    }
  }")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
