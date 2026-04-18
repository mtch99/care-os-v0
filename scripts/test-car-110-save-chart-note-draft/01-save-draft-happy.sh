#!/usr/bin/env bash
# Test 1: Save draft with valid field values -- expect 200 with bumped version.
# Usage: ./01-save-draft-happy.sh <chart_note_id>

set -euo pipefail
BASE_URL="http://localhost:3000"
CHART_NOTE_ID="${1:?Usage: $0 <chart_note_id>}"
PRACTITIONER_ID="0323c4a0-28e8-48cd-aed0-d57bf170a948"

echo "=== Test: Save draft (happy path) ==="
resp=$(curl -s -w '\n%{http_code}' -X PATCH "${BASE_URL}/api/clinical/chart-notes/${CHART_NOTE_ID}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"fieldValues\": {
      \"chief_complaint\": \"Lower back pain radiating to left leg\"
    },
    \"version\": 1,
    \"practitionerId\": \"${PRACTITIONER_ID}\"
  }")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
echo ""
echo "Expected: HTTP 200, version=2, chief_complaint set"
