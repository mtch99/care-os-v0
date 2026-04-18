#!/bin/bash
# POST /api/templates/ai-generate/:draftId/reject — already resolved.
# Tries to reject a draft that was already accepted or rejected.
# Expect 409 DRAFT_ALREADY_RESOLVED.
DRAFT_ID="${1:?Usage: $0 <draftId>  (use an already accepted or rejected draft ID)}"

resp=$(curl -s -w '\n%{http_code}' -X POST \
  "http://localhost:3000/api/templates/ai-generate/${DRAFT_ID}/reject" \
  -H 'Content-Type: application/json')
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
