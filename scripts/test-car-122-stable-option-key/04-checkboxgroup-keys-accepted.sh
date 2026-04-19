#!/usr/bin/env bash
# checkboxGroup value as an array of option.key values is accepted.
# Expected: 200, version bumps.

set -euo pipefail
BASE_URL="http://localhost:3000"
CHART_NOTE_ID="${1:?Usage: ./04-checkboxgroup-keys-accepted.sh <chart_note_id> [version]}"
VERSION="${2:-1}"
PRACTITIONER_ID="0323c4a0-28e8-48cd-aed0-d57bf170a948"

echo "=== pain_type: ['sharp', 'burning'] (option.key array) ==="
resp=$(curl -s -w '\n%{http_code}' -X PATCH "${BASE_URL}/api/clinical/chart-notes/${CHART_NOTE_ID}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"version\": ${VERSION},
    \"practitionerId\": \"${PRACTITIONER_ID}\",
    \"fieldValues\": { \"pain_type\": [\"sharp\", \"burning\"] }
  }")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
NEW_VERSION=$(echo "$body" | jq -r '.chartNote.version // empty')
if [ -n "${NEW_VERSION}" ]; then
  echo ""
  echo "Next VERSION=${NEW_VERSION}"
fi
