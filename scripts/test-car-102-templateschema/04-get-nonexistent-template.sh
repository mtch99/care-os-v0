#!/usr/bin/env bash
# Get template with non-existent UUID — expect 404
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
FAKE_ID="00000000-0000-0000-0000-000000000000"

echo "==> GET /api/clinical/templates/$FAKE_ID (should be 404)"
resp=$(curl -s -w '\n%{http_code}' "$BASE_URL/api/clinical/templates/$FAKE_ID")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
