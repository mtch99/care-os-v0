#!/bin/bash
# POST /chart-notes/:id/mark-ready-for-signature — happy path.
# Chart note is draft at version 1. Transitions to readyForSignature.
# Expect 200 with { data: { chartNote: { status: "readyForSignature", version: 2 }, alreadyReady: false } }
CHART_NOTE_ID="${1:-22222222-2222-2222-2222-222222222222}"

resp=$(curl -s -w '\n%{http_code}' -X POST \
  "http://localhost:3000/api/charting/chart-notes/${CHART_NOTE_ID}/mark-ready-for-signature" \
  -H 'Content-Type: application/json' \
  -d '{ "version": 1 }')
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"
