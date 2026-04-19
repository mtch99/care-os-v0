#!/bin/bash
# POST /chart-notes/:id/mark-ready-for-signature — chart note not found.
# Expect 404 with error code CHART_NOTE_NOT_FOUND.

resp=$(curl -s -w '\n%{http_code}' -X POST \
  "http://localhost:3000/api/charting/chart-notes/00000000-0000-0000-0000-000000000000/mark-ready-for-signature" \
  -H 'Content-Type: application/json' \
  -d '{ "version": 1 }')
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
