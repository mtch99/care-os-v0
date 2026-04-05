#!/bin/bash
# DELETE /templates/:id — Archive a non-default template (should succeed)
# Usage: ./10-delete-archive.sh <non-default-template-id>
TEMPLATE_ID="${1:?Usage: $0 <non-default-template-id>}"
resp=$(curl -s -w '\n%{http_code}' -X DELETE "http://localhost:3000/api/clinical/templates/$TEMPLATE_ID")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
