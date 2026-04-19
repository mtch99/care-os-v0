#!/usr/bin/env bash
# Test 4: Save draft by a non-owner practitioner -- expect 403 NOT_SESSION_OWNER.
# Usage: ./04-not-session-owner.sh <chart_note_id> [version]

set -euo pipefail
BASE_URL="http://localhost:3000"
CHART_NOTE_ID="${1:?Usage: $0 <chart_note_id> [version]}"
VERSION="${2:-2}"
# Ergo practitioner is NOT the owner of the physio session
OTHER_PRACTITIONER_ID="01beaf78-bfde-4e6e-97bb-4a25f7ccc59c"

echo "=== Test: Not session owner ==="
resp=$(curl -s -w '\n%{http_code}' -X PATCH "${BASE_URL}/api/clinical/chart-notes/${CHART_NOTE_ID}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"fieldValues\": {
      \"chief_complaint\": \"Unauthorized edit\"
    },
    \"version\": ${VERSION},
    \"practitionerId\": \"${OTHER_PRACTITIONER_ID}\"
  }")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
echo ""
echo "Expected: HTTP 403, code=NOT_SESSION_OWNER"
