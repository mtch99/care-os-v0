#!/bin/bash
# POST /api/templates/ai-generate/:draftId/accept — draft not found.
# Uses a non-existent UUID. Expect 404 DRAFT_NOT_FOUND.
DRAFT_ID="${1:-00000000-0000-0000-0000-000000000000}"
PRACTITIONER_ID="${2:-0323c4a0-28e8-48cd-aed0-d57bf170a948}"

resp=$(curl -s -w '\n%{http_code}' -X POST \
  "http://localhost:3000/api/templates/ai-generate/${DRAFT_ID}/accept" \
  -H 'Content-Type: application/json' \
  -d "{
    \"name\": \"Should fail\",
    \"isDefault\": false,
    \"practitionerId\": \"${PRACTITIONER_ID}\"
  }")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
