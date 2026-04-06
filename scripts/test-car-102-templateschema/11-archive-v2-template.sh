#!/usr/bin/env bash
# Archive (soft-delete) a non-default v0.2 template — expect 200
# Uses the v0.2 initial eval seed by default, or pass a custom ID
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
TEMPLATE_ID="${1:-b3a1c7d2-5e4f-4a89-9c12-d8f6e2a1b3c4}"

echo "==> DELETE /api/clinical/templates/$TEMPLATE_ID (archive)"
resp=$(curl -s -w '\n%{http_code}' \
  -X DELETE \
  "$BASE_URL/api/clinical/templates/$TEMPLATE_ID")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
