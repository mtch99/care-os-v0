#!/usr/bin/env bash
# Symmetric to 02: sending the FR label as a repeater select cell is
# rejected with NOT_IN_OPTIONS. The FR and EN labels for the movement
# options happen to be the same word, but the test still proves the
# schema treats labels as non-matching — the key is what counts.
#
# Expected: 422, path includes row index and column key.

set -euo pipefail
BASE_URL="http://localhost:3000"
CHART_NOTE_ID="${1:?Usage: ./03-repeater-select-fr-label-rejected.sh <chart_note_id> [version]}"
VERSION="${2:-1}"
PRACTITIONER_ID="0323c4a0-28e8-48cd-aed0-d57bf170a948"

echo "=== rom_table row with movement: 'Rotation' (FR label — should fail) ==="
resp=$(curl -s -w '\n%{http_code}' -X PATCH "${BASE_URL}/api/clinical/chart-notes/${CHART_NOTE_ID}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"version\": ${VERSION},
    \"practitionerId\": \"${PRACTITIONER_ID}\",
    \"fieldValues\": {
      \"rom_table\": [
        { \"joint\": \"Hip\", \"movement\": \"Rotation\", \"active\": \"45\", \"passive\": \"50\" }
      ]
    }
  }")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
