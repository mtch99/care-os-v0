#!/usr/bin/env bash
# Sending the EN localized label as a repeater select cell value is now
# rejected with NOT_IN_OPTIONS — parity with top-level select (CAR-122).
# Before CAR-121 this would have been accepted because repeater options
# were plain strings.
# Expected: 422, path includes row index and column key.

set -euo pipefail
BASE_URL="http://localhost:3000"
CHART_NOTE_ID="${1:?Usage: ./02-repeater-select-en-label-rejected.sh <chart_note_id> [version]}"
VERSION="${2:-1}"
PRACTITIONER_ID="0323c4a0-28e8-48cd-aed0-d57bf170a948"

echo "=== rom_table row with movement: 'Flexion' (EN label — should fail) ==="
resp=$(curl -s -w '\n%{http_code}' -X PATCH "${BASE_URL}/api/clinical/chart-notes/${CHART_NOTE_ID}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"version\": ${VERSION},
    \"practitionerId\": \"${PRACTITIONER_ID}\",
    \"fieldValues\": {
      \"rom_table\": [
        { \"joint\": \"Shoulder\", \"movement\": \"Flexion\", \"active\": \"160\", \"passive\": \"170\" }
      ]
    }
  }")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
