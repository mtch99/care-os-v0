#!/usr/bin/env bash
# Fire two concurrent chart note initialization requests for the same session.
# Both should return the same chart note. Only one should have created: true.
# Requires: a session that has NOT yet had a chart note initialized.
#
# Usage: First start a fresh session with script 00, then run this with that session ID.
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
SESSION_ID="${1:?Usage: $0 <sessionId>  (use a session with no chart note yet)}"

echo "==> Firing 2 concurrent POST /api/clinical/chart-notes/initialize"
echo "    Session: $SESSION_ID"
echo ""

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# Fire both requests in background
curl -s -w '\n%{http_code}' \
  -X POST \
  -H 'Content-Type: application/json' \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"discipline\": \"physiotherapy\",
    \"appointmentType\": \"initial\"
  }" \
  "$BASE_URL/api/clinical/chart-notes/initialize" > "$TMPDIR/resp1" &
PID1=$!

curl -s -w '\n%{http_code}' \
  -X POST \
  -H 'Content-Type: application/json' \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"discipline\": \"physiotherapy\",
    \"appointmentType\": \"initial\"
  }" \
  "$BASE_URL/api/clinical/chart-notes/initialize" > "$TMPDIR/resp2" &
PID2=$!

wait $PID1 $PID2

echo "--- Response 1 ---"
resp1=$(cat "$TMPDIR/resp1")
code1=${resp1##*$'\n'}
body1=${resp1%$'\n'*}
echo "$body1" | jq .
echo "HTTP $code1"

echo ""
echo "--- Response 2 ---"
resp2=$(cat "$TMPDIR/resp2")
code2=${resp2##*$'\n'}
body2=${resp2%$'\n'*}
echo "$body2" | jq .
echo "HTTP $code2"

# Verify both returned the same chart note
id1=$(echo "$body1" | jq -r '.chartNote.id // empty')
id2=$(echo "$body2" | jq -r '.chartNote.id // empty')
created1=$(echo "$body1" | jq -r '.created // empty')
created2=$(echo "$body2" | jq -r '.created // empty')

echo ""
echo "Chart note IDs match: $([ "$id1" = "$id2" ] && echo 'YES' || echo 'NO') ($id1 vs $id2)"
echo "Created flags: $created1, $created2 (expect exactly one 'true' and one 'false')"
echo "HTTP codes: $code1, $code2 (expect one 201 and one 200)"
