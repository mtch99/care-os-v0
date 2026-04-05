#!/bin/bash
# GET /templates/default — Get default template for a discipline+appointmentType combo
# Usage: ./06-get-default.sh [discipline] [appointmentType]
DISCIPLINE="${1:-physiotherapy}"
APPT_TYPE="${2:-follow_up}"
resp=$(curl -s -w '\n%{http_code}' "http://localhost:3000/api/clinical/templates/default?discipline=$DISCIPLINE&appointmentType=$APPT_TYPE")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
