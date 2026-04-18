#!/usr/bin/env bash
# Setup: start a session on APPT_1_ID (physio initial) and initialize a draft
# chart note. Prints CHART_NOTE_ID + VERSION + SESSION_ID for subsequent scripts.
#
# Requires: API running (`pnpm dev` in another terminal) against a fresh seed
# (`pnpm db:nuke && pnpm db:up && pnpm db:migrate:apply && pnpm db:seed`).
#
# The physiotherapy initial template (ID 29187424-...-c710ce251c70) declares
# `pain_intensity` as a scale field (min: 0, max: 10, step: 1). The test
# scripts exercise that field for both the valid and invalid payloads.

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
echo "  ./01-happy-path.sh ${CHART_NOTE_ID}"
echo "  ./02-reject-unknown-field-key.sh ${CHART_NOTE_ID}"
echo "  ./03-reject-invalid-value.sh ${CHART_NOTE_ID}"
echo "  ./04-verify-rollback.sh ${CHART_NOTE_ID}"
