#!/usr/bin/env bash
# Re-initialize same session — expect 200, created: false, same chart note returned.
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
SESSION_ID="${1:?Usage: $0 <sessionId>}"

echo "==> POST /api/clinical/chart-notes/initialize (idempotent, sessionId: $SESSION_ID)"
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

created=$(echo "$body" | jq -r '.created // empty')
echo ""
echo "created: $created (expect: false)"
echo "HTTP code: $code (expect: 200)"
