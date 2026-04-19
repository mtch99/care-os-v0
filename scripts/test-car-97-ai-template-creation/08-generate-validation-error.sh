#!/bin/bash
# POST /api/templates/ai-generate — Zod validation error.
# Missing required fields. Expect 400 VALIDATION_ERROR.

resp=$(curl -s -w '\n%{http_code}' -X POST \
  "http://localhost:3000/api/templates/ai-generate" \
  -H 'Content-Type: application/json' \
  -d '{
    "discipline": "physiotherapy"
  }')
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
