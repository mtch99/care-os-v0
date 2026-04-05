#!/usr/bin/env bash
# List physiotherapy templates — should return v0.1 defaults + v0.2 seeds (4 total)
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "==> GET /api/clinical/templates?discipline=physiotherapy"
resp=$(curl -s -w '\n%{http_code}' "$BASE_URL/api/clinical/templates?discipline=physiotherapy")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
