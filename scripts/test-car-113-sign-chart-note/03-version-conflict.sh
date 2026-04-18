#!/bin/bash
# POST /chart-notes/:id/sign -- version conflict.
# Resets note to readyForSignature at version 2, then signs with wrong version.
# Expect 409 with code VERSION_CONFLICT.
set -e

source "$(dirname "$0")/../_lib/load-env.sh"

CHART_NOTE_ID="${1:-22222222-2222-2222-2222-222222222222}"

# Reset to readyForSignature at version 2
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q <<SQL
UPDATE chart_notes
SET status = 'readyForSignature', version = 2, signed_at = NULL, signed_by = NULL, updated_at = NOW()
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
