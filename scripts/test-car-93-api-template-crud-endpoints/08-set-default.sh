#!/bin/bash
# PATCH /templates/:id/set-default — Reassign default to this template
# Usage: ./08-set-default.sh <template-id>
TEMPLATE_ID="${1:?Usage: $0 <template-id>}"
resp=$(curl -s -w '\n%{http_code}' -X PATCH "http://localhost:3000/api/clinical/templates/$TEMPLATE_ID/set-default")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
