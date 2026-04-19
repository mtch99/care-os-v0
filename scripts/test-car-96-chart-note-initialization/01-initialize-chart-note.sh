#!/usr/bin/env bash
# Initialize a chart note for a session — expect 201, created: true, status: draft.
# Uses discipline=physiotherapy, appointmentType=initial (matches seed default template).
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
SESSION_ID="${1:?Usage: $0 <sessionId>}"

echo "==> POST /api/clinical/chart-notes/initialize (sessionId: $SESSION_ID)"
resp=$(curl -s -w '\n%{http_code}' \
  -X POST \
  -H 'Content-Type: application/json' \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"discipline\": \"physiotherapy\",
    \"appointmentType\": \"initial\"
  }" \
  "$BASE_URL/api/clinical/chart-notes/initialize")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"

# Verify key response fields
created=$(echo "$body" | jq -r '.created // empty')
status=$(echo "$body" | jq -r '.chartNote.status // empty')
echo ""
echo "created: $created (expect: true)"
echo "status: $status (expect: draft)"
