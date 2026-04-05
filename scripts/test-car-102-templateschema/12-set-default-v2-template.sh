#!/usr/bin/env bash
# Promote a v0.2 template to default — expect 200
# Uses the v0.2 SOAP seed by default, or pass a custom ID
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
TEMPLATE_ID="${1:-c4d2e8f3-6a5b-4b90-ad23-e9f7f3b2c4d5}"

echo "==> PATCH /api/clinical/templates/$TEMPLATE_ID/set-default"
resp=$(curl -s -w '\n%{http_code}' \
  -X PATCH \
  "$BASE_URL/api/clinical/templates/$TEMPLATE_ID/set-default")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
