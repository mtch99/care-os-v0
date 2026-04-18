#!/bin/bash
# POST /api/templates/ai-generate — happy path.
# Generates an AI template draft for physiotherapy follow-up.
# Expect 201 with { data: { draftId, status: "pending", content: {...}, expiresAt } }
#
# NOTE: hits the real Anthropic API. Requires ANTHROPIC_API_KEY in apps/api/.env.
PRACTITIONER_ID="${1:-0323c4a0-28e8-48cd-aed0-d57bf170a948}"

resp=$(curl -s -w '\n%{http_code}' -X POST \
  "http://localhost:3000/api/templates/ai-generate" \
  -H 'Content-Type: application/json' \
  -d "{
    \"discipline\": \"physiotherapy\",
    \"appointmentType\": \"follow_up\",
    \"preferences\": \"Include ROM star diagram for cervical region, body diagram front view, signature block\",
    \"locale\": [\"fr\", \"en\"],
    \"practitionerId\": \"${PRACTITIONER_ID}\"
  }")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
echo ""
echo "Capture draftId from the response for scripts 03 and 04."
