#!/bin/bash
# POST /templates with isDefault=true — Should return 409 since seed data already has a default
resp=$(curl -s -w '\n%{http_code}' -X POST http://localhost:3000/api/clinical/templates \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Conflicting Default",
    "discipline": "physiotherapy",
    "appointmentType": "follow_up",
    "content": { "sections": ["subjective"] },
    "isDefault": true
  }')
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
