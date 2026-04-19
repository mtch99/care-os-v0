#!/usr/bin/env bash
# Multi-row payload where one row is valid and another has a label-shaped
# value. Proves error accumulation: the path pinpoints the offending row
# by index, and other rows do not contaminate the error list.
# Expected: 422 with exactly one NOT_IN_OPTIONS error at rom_table[1].movement.

set -euo pipefail
BASE_URL="http://localhost:3000"
CHART_NOTE_ID="${1:?Usage: ./05-repeater-multi-row-mixed-errors.sh <chart_note_id> [version]}"
VERSION="${2:-1}"
PRACTITIONER_ID="0323c4a0-28e8-48cd-aed0-d57bf170a948"

echo "=== rom_table: [{movement: 'flexion' (key, ok)}, {movement: 'Extension' (label, fail)}] ==="
resp=$(curl -s -w '\n%{http_code}' -X PATCH "${BASE_URL}/api/clinical/chart-notes/${CHART_NOTE_ID}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"version\": ${VERSION},
    \"practitionerId\": \"${PRACTITIONER_ID}\",
    \"fieldValues\": {
      \"rom_table\": [
        { \"joint\": \"Shoulder\", \"movement\": \"flexion\" },
        { \"joint\": \"Elbow\", \"movement\": \"Extension\" }
      ]
    }
  }")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
