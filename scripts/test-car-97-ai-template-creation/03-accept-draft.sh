#!/bin/bash
# POST /api/templates/ai-generate/:draftId/accept — happy path.
# Accepts a pending draft and creates a real template via CreateTemplate.
# Expect 201 with the persisted template (same shape as POST /templates response).
DRAFT_ID="${1:?Usage: $0 <draftId>}"
PRACTITIONER_ID="${2:-0323c4a0-28e8-48cd-aed0-d57bf170a948}"

resp=$(curl -s -w '\n%{http_code}' -X POST \
  "http://localhost:3000/api/templates/ai-generate/${DRAFT_ID}/accept" \
  -H 'Content-Type: application/json' \
  -d "{
    \"name\": \"SOAP Follow-Up — Physio (AI)\",
    \"isDefault\": false,
    \"practitionerId\": \"${PRACTITIONER_ID}\"
  }")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
