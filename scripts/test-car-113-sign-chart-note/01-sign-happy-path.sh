#!/bin/bash
# POST /chart-notes/:id/sign -- happy path.
# Chart note is readyForSignature at version 2. Transitions to signed.
# Expect 200 with { data: { chartNote: { status: "signed", version: 3 }, alreadySigned: false } }
CHART_NOTE_ID="${1:-22222222-2222-2222-2222-222222222222}"

resp=$(curl -s -w '\n%{http_code}' -X POST \
  "http://localhost:3000/api/charting/chart-notes/${CHART_NOTE_ID}/sign" \
  -H 'Content-Type: application/json' \
  -d '{ "version": 2 }')
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
