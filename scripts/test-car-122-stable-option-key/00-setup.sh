#!/usr/bin/env bash
# Setup: Start a session and initialize a chart note so CAR-122 scripts have
# an id + version to target. Appointment 988930cb-... is the physio initial
# appointment the save-draft / CAR-120 suites also use.

set -euo pipefail
BASE_URL="http://localhost:3000"

APPT_ID="988930cb-8255-4883-9899-cc2b0c5e44c4"
PRACTITIONER_ID="0323c4a0-28e8-48cd-aed0-d57bf170a948"

echo "=== Step 1: Start session ==="
resp=$(curl -s -w '\n%{http_code}' "${BASE_URL}/api/scheduling/sessions" \
  -H 'Content-Type: application/json' \
  -d "{\"appointmentId\": \"${APPT_ID}\", \"practitionerId\": \"${PRACTITIONER_ID}\"}")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"

SESSION_ID=$(echo "$body" | jq -r '.data.sessionId')
echo ""
echo "SESSION_ID=${SESSION_ID}"

echo ""
echo "=== Step 2: Initialize chart note ==="
resp=$(curl -s -w '\n%{http_code}' "${BASE_URL}/api/clinical/chart-notes/initialize" \
  -H 'Content-Type: application/json' \
  -d "{\"sessionId\": \"${SESSION_ID}\", \"discipline\": \"physiotherapy\", \"appointmentType\": \"initial\"}")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"

CHART_NOTE_ID=$(echo "$body" | jq -r '.chartNote.id')
VERSION=$(echo "$body" | jq -r '.chartNote.version')
echo ""
echo "CHART_NOTE_ID=${CHART_NOTE_ID}"
echo "VERSION=${VERSION}"
echo ""
echo "Use these values for subsequent scripts:"
echo "  ./01-select-key-accepted.sh ${CHART_NOTE_ID} ${VERSION}"
