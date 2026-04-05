#!/bin/bash
# POST /templates — Create a new non-default template
resp=$(curl -s -w '\n%{http_code}' -X POST http://localhost:3000/api/clinical/templates \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Test SOAP Template",
    "discipline": "physiotherapy",
    "appointmentType": "follow_up",
    "content": { "sections": ["subjective", "objective", "assessment", "plan"] },
    "isDefault": false
  }')
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
