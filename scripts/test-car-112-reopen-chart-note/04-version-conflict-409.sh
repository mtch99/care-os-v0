#!/bin/bash
# POST /chart-notes/:id/reopen -- version conflict.
# Reset chart note to readyForSignature at version 2, then send version 1.
# Expect 409 with { error: { code: "VERSION_CONFLICT" } }

: "${DATABASE_URL:=postgresql://postgres:careos@localhost:5432/careos}"
CHART_NOTE_ID="${1:-22222222-2222-2222-2222-222222222222}"

# Reset to readyForSignature at version 2
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
UPDATE chart_notes
SET status = 'readyForSignature', version = 2, signed_at = NULL, signed_by = NULL, updated_at = NOW()
WHERE id = '${CHART_NOTE_ID}';
SQL

resp=$(curl -s -w '\n%{http_code}' -X POST \
  "http://localhost:3000/api/charting/chart-notes/${CHART_NOTE_ID}/reopen" \
  -H 'Content-Type: application/json' \
  -d '{ "version": 1 }')
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
