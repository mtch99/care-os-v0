#!/bin/bash
# POST /chart-notes/:id/reopen -- signed note cannot be reopened.
# First set the chart note to signed, then attempt reopen.
# Expect 409 with { error: { code: "CHART_NOTE_ALREADY_SIGNED" } }

source "$(dirname "$0")/../_lib/load-env.sh"
CHART_NOTE_ID="${1:-22222222-2222-2222-2222-222222222222}"

# Set chart note to signed status
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
UPDATE chart_notes
SET status = 'signed', version = 4, signed_at = NOW(), signed_by = '0323c4a0-28e8-48cd-aed0-d57bf170a948', updated_at = NOW()
WHERE id = '${CHART_NOTE_ID}';
SQL

resp=$(curl -s -w '\n%{http_code}' -X POST \
  "http://localhost:3000/api/charting/chart-notes/${CHART_NOTE_ID}/reopen" \
  -H 'Content-Type: application/json' \
  -d '{ "version": 4 }')
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
