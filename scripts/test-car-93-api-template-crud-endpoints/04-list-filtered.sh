#!/bin/bash
# GET /templates — Filter by discipline and appointmentType
resp=$(curl -s -w '\n%{http_code}' 'http://localhost:3000/api/clinical/templates?discipline=physiotherapy&appointmentType=follow_up')
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
