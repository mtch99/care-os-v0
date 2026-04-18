#!/bin/bash
# POST /chart-notes/:id/reopen -- attempt to reopen a signed note.
# Per CAR-112 spec, reopening a signed note throws ChartNoteAlreadySignedError.
# Expect 409 with code CHART_NOTE_ALREADY_SIGNED.
set -e

source "$(dirname "$0")/../_lib/load-env.sh"

CHART_NOTE_ID="${1:-22222222-2222-2222-2222-222222222222}"

# Ensure the note is signed at version 3
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q <<SQL
UPDATE chart_notes
SET status = 'signed',
    version = 3,
    signed_at = NOW(),
    signed_by = '0323c4a0-28e8-48cd-aed0-d57bf170a948',
    updated_at = NOW()
WHERE id = '${CHART_NOTE_ID}';
SQL

resp=$(curl -s -w '\n%{http_code}' -X POST \
  "http://localhost:3000/api/charting/chart-notes/${CHART_NOTE_ID}/reopen" \
  -H 'Content-Type: application/json' \
  -d '{ "version": 3 }')
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
