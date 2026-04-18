#!/bin/bash
# POST /chart-notes/:id/sign -- chart note not found.
# Uses a random UUID that does not exist.
# Expect 404 with code CHART_NOTE_NOT_FOUND.

resp=$(curl -s -w '\n%{http_code}' -X POST \
  "http://localhost:3000/api/charting/chart-notes/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/sign" \
  -H 'Content-Type: application/json' \
  -d '{ "version": 1 }')
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
