#!/usr/bin/env bash
# Test NO_DEFAULT_TEMPLATE scenario — expect 409 with availableTemplates.
# Strategy: first archive the default template for ergotherapy/follow_up,
# start a session for that appointment type, then try to initialize.
#
# This is a destructive test — it modifies the seed data template.
# Run last or re-seed afterwards (pnpm db:seed).
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

# Seed IDs
ERGO_FOLLOW_UP_TEMPLATE_ID="f720c816-4907-4ee8-8d3f-ee0b04a1ae63"  # SOAP Note — Ergotherapy (default)
APPT_2_ID="37d6720e-6b0b-4930-88e6-b4f545142558"  # Bob, ergotherapy, follow_up

echo "==> Step 1: Remove default from ergotherapy/follow_up template"
resp=$(curl -s -w '\n%{http_code}' \
  -X DELETE \
  "$BASE_URL/api/clinical/templates/$ERGO_FOLLOW_UP_TEMPLATE_ID")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "Archive result: HTTP $code"
echo ""

echo "==> Step 2: Start session for Bob's ergotherapy/follow_up appointment"
resp=$(curl -s -w '\n%{http_code}' \
  -X POST \
  -H 'Content-Type: application/json' \
  -d "{\"appointmentId\": \"$APPT_2_ID\"}" \
  "$BASE_URL/api/scheduling/sessions")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
session_id=$(echo "$body" | jq -r '.data.sessionId // empty')
echo "Session created: HTTP $code, sessionId: $session_id"
echo ""

if [ -z "$session_id" ]; then
  echo "ERROR: Could not create session. Skipping chart note test."
  exit 1
fi

echo "==> Step 3: Try to initialize chart note — should get 409 NO_DEFAULT_TEMPLATE"
resp=$(curl -s -w '\n%{http_code}' \
  -X POST \
  -H 'Content-Type: application/json' \
  -d "{
    \"sessionId\": \"$session_id\",
    \"discipline\": \"ergotherapy\",
    \"appointmentType\": \"follow_up\"
  }" \
  "$BASE_URL/api/clinical/chart-notes/initialize")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"

error_code=$(echo "$body" | jq -r '.error.code // empty')
echo ""
echo "error.code: $error_code (expect: NO_DEFAULT_TEMPLATE)"
echo "HTTP code: $code (expect: 409)"
echo ""
echo "NOTE: Re-seed the database after running this test (pnpm db:seed)"
