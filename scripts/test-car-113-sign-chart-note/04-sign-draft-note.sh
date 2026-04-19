#!/bin/bash
# POST /chart-notes/:id/sign -- attempt to sign a draft note.
# Resets note to draft at version 1, then tries to sign.
# Expect 409 with code CHART_NOTE_NOT_READY_FOR_SIGNATURE.
set -e

source "$(dirname "$0")/../_lib/load-env.sh"

CHART_NOTE_ID="${1:-22222222-2222-2222-2222-222222222222}"

# Reset to draft at version 1
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q <<SQL
UPDATE chart_notes
SET status = 'draft', version = 1, signed_at = NULL, signed_by = NULL, updated_at = NOW()
WHERE id = '${CHART_NOTE_ID}';
SQL

resp=$(curl -s -w '\n%{http_code}' -X POST \
  "http://localhost:3000/api/charting/chart-notes/${CHART_NOTE_ID}/sign" \
  -H 'Content-Type: application/json' \
  -d '{ "version": 1 }')
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
