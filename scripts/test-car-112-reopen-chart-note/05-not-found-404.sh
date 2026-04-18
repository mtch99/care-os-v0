#!/bin/bash
# POST /chart-notes/:id/reopen -- chart note not found.
# Expect 404 with { error: { code: "CHART_NOTE_NOT_FOUND" } }

resp=$(curl -s -w '\n%{http_code}' -X POST \
  "http://localhost:3000/api/charting/chart-notes/99999999-9999-9999-9999-999999999999/reopen" \
  -H 'Content-Type: application/json' \
  -d '{ "version": 1 }')
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
