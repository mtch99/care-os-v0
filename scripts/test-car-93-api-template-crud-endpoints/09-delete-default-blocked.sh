#!/bin/bash
# DELETE /templates/:id — Try to archive a default template (should return 409)
# Usage: ./09-delete-default-blocked.sh <default-template-id>
TEMPLATE_ID="${1:?Usage: $0 <default-template-id>}"
resp=$(curl -s -w '\n%{http_code}' -X DELETE "http://localhost:3000/api/clinical/templates/$TEMPLATE_ID")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
