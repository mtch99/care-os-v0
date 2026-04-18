#!/usr/bin/env bash
# A rejected value-validation save must NOT bump the chart note's version
# and must NOT persist the bad value — atomic failure. Verifies by reading
# the chart note's persisted field_values + version from the DB directly.
#
# Sequence:
#   1. Read current version + pain_intensity from DB
#   2. Attempt save with an out-of-range scale (expect 422)
#   3. Re-read DB — version and pain_intensity must be unchanged

set -euo pipefail
source "$(dirname "$0")/../_lib/load-env.sh"

BASE_URL="http://localhost:3000"
CHART_NOTE_ID="${1:?Usage: ./13-rejected-save-leaves-state-intact.sh <chart_note_id> [version]}"
VERSION="${2:-1}"
PRACTITIONER_ID="0323c4a0-28e8-48cd-aed0-d57bf170a948"

echo "=== Step 1: snapshot DB before the rejected save ==="
before=$(psql "$DATABASE_URL" -tA -c \
  "SELECT version || '|' || COALESCE(field_values->>'pain_intensity', 'null') FROM chart_notes WHERE id = '${CHART_NOTE_ID}';")
echo "before: ${before}"

echo ""
echo "=== Step 2: attempt invalid save (pain_intensity: 99) ==="
resp=$(curl -s -w '\n%{http_code}' -X PATCH "${BASE_URL}/api/clinical/chart-notes/${CHART_NOTE_ID}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"version\": ${VERSION},
    \"practitionerId\": \"${PRACTITIONER_ID}\",
    \"fieldValues\": { \"pain_intensity\": 99 }
  }")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code (expected: 422)"

echo ""
echo "=== Step 3: snapshot DB after the rejected save ==="
after=$(psql "$DATABASE_URL" -tA -c \
  "SELECT version || '|' || COALESCE(field_values->>'pain_intensity', 'null') FROM chart_notes WHERE id = '${CHART_NOTE_ID}';")
echo "after:  ${after}"

echo ""
if [ "${before}" = "${after}" ]; then
  echo "PASS: chart note state unchanged after rejected save."
else
  echo "FAIL: chart note state changed."
  exit 1
fi
