#!/usr/bin/env bash
# Get default template for physiotherapy + initial — should return v0.1 seed (isDefault: true)
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "==> GET /api/clinical/templates/default?discipline=physiotherapy&appointmentType=initial"
resp=$(curl -s -w '\n%{http_code}' "$BASE_URL/api/clinical/templates/default?discipline=physiotherapy&appointmentType=initial")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
