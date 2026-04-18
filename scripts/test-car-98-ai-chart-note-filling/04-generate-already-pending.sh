#!/bin/bash
# POST /chart-notes/:id/ai-draft again, while a draft from script 01 is still pending.
# Tests the one-pending-draft invariant.
# Expect 409 AI_DRAFT_ALREADY_PENDING.
#
# Precondition: run 01 first (and do NOT accept/reject yet).
CHART_NOTE_ID="${1:-22222222-2222-2222-2222-222222222222}"

resp=$(curl -s -w '\n%{http_code}' -X POST \
  "http://localhost:3000/api/charting/chart-notes/${CHART_NOTE_ID}/ai-draft" \
  -H 'Content-Type: application/json' \
  -d '{ "rawNotes": "Different notes for second draft attempt." }')
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
