#!/bin/bash
# POST /chart-notes/:id/sign -- idempotent call.
# Chart note is already signed (from script 01).
# Expect 200 with { data: { chartNote: { status: "signed" }, alreadySigned: true } }
CHART_NOTE_ID="${1:-22222222-2222-2222-2222-222222222222}"

resp=$(curl -s -w '\n%{http_code}' -X POST \
  "http://localhost:3000/api/charting/chart-notes/${CHART_NOTE_ID}/sign" \
  -H 'Content-Type: application/json' \
  -d '{ "version": 2 }')
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
