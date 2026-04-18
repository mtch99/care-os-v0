#!/bin/bash
# POST /chart-notes/:id/ai-draft with empty rawNotes — Zod min(1) violation.
# Expect 400 VALIDATION_ERROR.
CHART_NOTE_ID="${1:-22222222-2222-2222-2222-222222222222}"

resp=$(curl -s -w '\n%{http_code}' -X POST \
  "http://localhost:3000/api/charting/chart-notes/${CHART_NOTE_ID}/ai-draft" \
  -H 'Content-Type: application/json' \
  -d '{ "rawNotes": "" }')
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
