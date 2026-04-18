#!/bin/bash
# POST /chart-notes/:id/reopen -- idempotent: already draft.
# After script 01, the chart note is draft at version 3.
# Expect 200 with { data: { alreadyDraft: true } }, no event emitted.
CHART_NOTE_ID="${1:-22222222-2222-2222-2222-222222222222}"

resp=$(curl -s -w '\n%{http_code}' -X POST \
  "http://localhost:3000/api/charting/chart-notes/${CHART_NOTE_ID}/reopen" \
  -H 'Content-Type: application/json' \
  -d '{ "version": 3 }')
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
