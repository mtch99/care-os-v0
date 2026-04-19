#!/bin/bash
# Helper: generate a second AI draft so 08-reject-draft.sh has a pending draft
# to operate on. (The draft from 01 was accepted in 05.)
# Expect 201 — capture the new draftId for script 08.
CHART_NOTE_ID="${1:-22222222-2222-2222-2222-222222222222}"

resp=$(curl -s -w '\n%{http_code}' -X POST \
  "http://localhost:3000/api/charting/chart-notes/${CHART_NOTE_ID}/ai-draft" \
  -H 'Content-Type: application/json' \
  -d '{
    "rawNotes": "Follow-up session. Pain reduced to 4/10. Cervical ROM improved: right rotation now 60 degrees. Patient compliant with home exercises. No new complaints."
  }')
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
echo ""
echo "Capture draftId from the response for script 08."
