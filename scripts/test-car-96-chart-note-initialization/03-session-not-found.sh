#!/usr/bin/env bash
# Initialize with a nonexistent session — expect 404 SESSION_NOT_FOUND.
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
FAKE_SESSION_ID="00000000-0000-0000-0000-000000000000"

echo "==> POST /api/clinical/chart-notes/initialize (nonexistent session)"
resp=$(curl -s -w '\n%{http_code}' \
  -X POST \
  -H 'Content-Type: application/json' \
  -d "{
    \"sessionId\": \"$FAKE_SESSION_ID\",
    \"discipline\": \"physiotherapy\",
    \"appointmentType\": \"initial\"
  }" \
  "$BASE_URL/api/clinical/chart-notes/initialize")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"

error_code=$(echo "$body" | jq -r '.error.code // empty')
echo ""
echo "error.code: $error_code (expect: SESSION_NOT_FOUND)"
echo "HTTP code: $code (expect: 404)"
