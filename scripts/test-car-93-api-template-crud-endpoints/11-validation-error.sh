#!/bin/bash
# POST /templates — Send invalid input to test Zod validation
resp=$(curl -s -w '\n%{http_code}' -X POST http://localhost:3000/api/clinical/templates \
  -H 'Content-Type: application/json' \
  -d '{ "name": "" }')
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
