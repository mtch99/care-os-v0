#!/bin/bash
# POST /chart-notes/:id/ai-draft/:draftId/reject — happy path.
# Marks the draft rejected without touching the chart note.
# Expect 200 with { data: { draftId, status: "rejected" } }.
DRAFT_ID="${1:?Usage: $0 <draft_id> [chart_note_id]}"
CHART_NOTE_ID="${2:-22222222-2222-2222-2222-222222222222}"

resp=$(curl -s -w '\n%{http_code}' -X POST \
  "http://localhost:3000/api/charting/chart-notes/${CHART_NOTE_ID}/ai-draft/${DRAFT_ID}/reject")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
