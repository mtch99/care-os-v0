#!/usr/bin/env bash
# Send invalid input (missing required fields) — expect 400 VALIDATION_ERROR.
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "==> POST /api/clinical/chart-notes/initialize (missing sessionId)"
resp=$(curl -s -w '\n%{http_code}' \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{
    "discipline": "physiotherapy",
    "appointmentType": "initial"
  }' \
  "$BASE_URL/api/clinical/chart-notes/initialize")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"

error_code=$(echo "$body" | jq -r '.error.code // empty')
echo ""
echo "error.code: $error_code (expect: VALIDATION_ERROR)"
echo "HTTP code: $code (expect: 400)"
