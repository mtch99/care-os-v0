#!/bin/bash
# GET /templates/:id — Get a template by ID
# Usage: ./05-get-by-id.sh <template-id>
TEMPLATE_ID="${1:?Usage: $0 <template-id>}"
resp=$(curl -s -w '\n%{http_code}' "http://localhost:3000/api/clinical/templates/$TEMPLATE_ID")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
