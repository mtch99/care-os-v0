#!/usr/bin/env bash
# Start a session for a seeded appointment — needed before chart note initialization.
# Uses APPT_1_ID (Alice, physiotherapy, initial) from seed data.
# Prints the session ID for use in subsequent scripts.
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
APPT_ID="${1:-988930cb-8255-4883-9899-cc2b0c5e44c4}"

echo "==> POST /api/scheduling/sessions (appointmentId: $APPT_ID)"
resp=$(curl -s -w '\n%{http_code}' \
  -X POST \
  -H 'Content-Type: application/json' \
  -d "{\"appointmentId\": \"$APPT_ID\"}" \
  "$BASE_URL/api/scheduling/sessions")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"

session_id=$(echo "$body" | jq -r '.data.sessionId // empty')
if [ -n "$session_id" ]; then
  echo ""
  echo "Session ID: $session_id"
  echo "Use this ID with subsequent scripts:"
  echo "  ./01-initialize-chart-note.sh $session_id"
  echo "  ./02-idempotent-return.sh $session_id"
fi
