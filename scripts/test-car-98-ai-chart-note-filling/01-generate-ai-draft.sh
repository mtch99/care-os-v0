#!/bin/bash
# POST /chart-notes/:id/ai-draft — happy path.
# Generates an AI draft from raw session notes. Persists a pending draft.
# Expect 201 with { data: { draftId, chartNoteId, status: "pending", fieldValues: {...} } }
#
# NOTE: hits the real Anthropic API. Requires ANTHROPIC_API_KEY in apps/api/.env.
CHART_NOTE_ID="${1:-22222222-2222-2222-2222-222222222222}"

resp=$(curl -s -w '\n%{http_code}' -X POST \
  "http://localhost:3000/api/charting/chart-notes/${CHART_NOTE_ID}/ai-draft" \
  -H 'Content-Type: application/json' \
  -d '{
    "rawNotes": "Patient reports cervical pain 7/10, limited ROM on right rotation. No radicular signs. Worse in mornings, improves with movement. Pain onset 2 weeks ago after prolonged desk work. Cervical flexion 40 degrees, extension 30 degrees, right rotation 45 degrees, left rotation 70 degrees. Palpation reveals tenderness over right C5-C6 facet."
  }')
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
echo ""
echo "Capture draftId from the response for scripts 05 and 06."
