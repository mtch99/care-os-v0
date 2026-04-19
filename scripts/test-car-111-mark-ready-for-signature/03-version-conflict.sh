#!/bin/bash
# POST /chart-notes/:id/mark-ready-for-signature — version conflict.
# Run 00-setup.sh first to reset chart note to version 1, then call with wrong version.
# Expect 409 with error code VERSION_CONFLICT.
CHART_NOTE_ID="${1:-22222222-2222-2222-2222-222222222222}"

resp=$(curl -s -w '\n%{http_code}' -X POST \
  "http://localhost:3000/api/charting/chart-notes/${CHART_NOTE_ID}/mark-ready-for-signature" \
  -H 'Content-Type: application/json' \
  -d '{ "version": 99 }')
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
