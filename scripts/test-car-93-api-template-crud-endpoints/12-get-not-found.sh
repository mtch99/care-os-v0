#!/bin/bash
# GET /templates/:id — Request a non-existent ID (should return 404)
resp=$(curl -s -w '\n%{http_code}' "http://localhost:3000/api/clinical/templates/00000000-0000-0000-0000-000000000000")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
