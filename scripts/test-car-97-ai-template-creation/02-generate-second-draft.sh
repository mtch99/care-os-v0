#!/bin/bash
# POST /api/templates/ai-generate — generate second draft for same discipline x appointmentType.
# Verifies that multiple pending drafts can coexist (no uniqueness constraint).
# Expect 201 with a different draftId from script 01.
PRACTITIONER_ID="${1:-0323c4a0-28e8-48cd-aed0-d57bf170a948}"

resp=$(curl -s -w '\n%{http_code}' -X POST \
  "http://localhost:3000/api/templates/ai-generate" \
  -H 'Content-Type: application/json' \
  -d "{
    \"discipline\": \"physiotherapy\",
    \"appointmentType\": \"follow_up\",
    \"preferences\": \"Focus on SOAP format with subjective, objective, assessment, plan sections. Include pain scale and functional outcome measures.\",
    \"locale\": [\"fr\", \"en\"],
    \"practitionerId\": \"${PRACTITIONER_ID}\"
  }")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
echo ""
echo "Both drafts should be pending — no conflict."
