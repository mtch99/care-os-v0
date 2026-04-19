#!/bin/bash
# POST /chart-notes/:id/ai-draft with a non-existent chart_note id.
# Expect 404 CHART_NOTE_NOT_FOUND.
resp=$(curl -s -w '\n%{http_code}' -X POST \
  "http://localhost:3000/api/charting/chart-notes/00000000-0000-0000-0000-000000000000/ai-draft" \
  -H 'Content-Type: application/json' \
  -d '{ "rawNotes": "Patient reports cervical pain 7/10." }')
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
