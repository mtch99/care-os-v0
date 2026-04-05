#!/bin/bash
# GET /templates — List all non-archived templates
resp=$(curl -s -w '\n%{http_code}' 'http://localhost:3000/api/clinical/templates')
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
