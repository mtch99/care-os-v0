#!/usr/bin/env bash
# Get v0.2 physio follow-up SOAP note template by ID — expect 200 with rich content
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
TEMPLATE_V2_SOAP_ID="c4d2e8f3-6a5b-4b90-ad23-e9f7f3b2c4d5"

echo "==> GET /api/clinical/templates/$TEMPLATE_V2_SOAP_ID"
resp=$(curl -s -w '\n%{http_code}' "$BASE_URL/api/clinical/templates/$TEMPLATE_V2_SOAP_ID")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
