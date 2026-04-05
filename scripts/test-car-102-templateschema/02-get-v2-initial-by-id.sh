#!/usr/bin/env bash
# Get v0.2 physio initial eval template by ID — expect 200 with rich content
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
TEMPLATE_V2_INITIAL_ID="b3a1c7d2-5e4f-4a89-9c12-d8f6e2a1b3c4"

echo "==> GET /api/clinical/templates/$TEMPLATE_V2_INITIAL_ID"
resp=$(curl -s -w '\n%{http_code}' "$BASE_URL/api/clinical/templates/$TEMPLATE_V2_INITIAL_ID")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
