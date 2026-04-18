#!/bin/bash
# POST /api/templates/ai-generate/:draftId/reject — happy path.
# Rejects a pending draft. Expect 200 with { data: { draftId, status: "rejected" } }.
DRAFT_ID="${1:?Usage: $0 <draftId>}"

resp=$(curl -s -w '\n%{http_code}' -X POST \
  "http://localhost:3000/api/templates/ai-generate/${DRAFT_ID}/reject" \
  -H 'Content-Type: application/json')
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
