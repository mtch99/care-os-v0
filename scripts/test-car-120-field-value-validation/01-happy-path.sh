#!/usr/bin/env bash
# Happy path: payload with a valid value for every exercised field type.
# Expected: 200 OK, version bumps by 1. Records the new version for downstream tests.

set -euo pipefail
BASE_URL="http://localhost:3000"
CHART_NOTE_ID="${1:?Usage: ./01-happy-path.sh <chart_note_id> [version]}"
VERSION="${2:-1}"
PRACTITIONER_ID="0323c4a0-28e8-48cd-aed0-d57bf170a948"

echo "=== Save valid values across text / scale / select / date / narrative ==="
resp=$(curl -s -w '\n%{http_code}' -X PATCH "${BASE_URL}/api/clinical/chart-notes/${CHART_NOTE_ID}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"version\": ${VERSION},
    \"practitionerId\": \"${PRACTITIONER_ID}\",
    \"fieldValues\": {
      \"referring_md\": \"Dr. Martin\",
      \"pain_intensity\": 7,
      \"mechanism_of_injury\": \"traumatic\",
      \"referral_date\": \"2026-04-10\",
      \"referral_reason\": \"Chronic low back pain, 6-week onset.\"
    }
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
