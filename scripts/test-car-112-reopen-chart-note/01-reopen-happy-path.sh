#!/bin/bash
# POST /chart-notes/:id/reopen -- happy path.
# Chart note is readyForSignature at version 2. Transitions to draft.
# Expect 200 with { data: { chartNote: { status: "draft", version: 3 }, alreadyDraft: false } }
# fieldValues should be preserved unchanged.
CHART_NOTE_ID="${1:-22222222-2222-2222-2222-222222222222}"

resp=$(curl -s -w '\n%{http_code}' -X POST \
  "http://localhost:3000/api/charting/chart-notes/${CHART_NOTE_ID}/reopen" \
  -H 'Content-Type: application/json' \
  -d '{ "version": 2 }')
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
