#!/bin/bash
# POST /chart-notes/:id/mark-ready-for-signature — auto-reject pending AI draft.
# Seeds a pending AI draft, then marks ready. Draft should be auto-rejected.
# Run 00-setup.sh first to reset to draft state.
# Expect 200 with transition to readyForSignature.
set -e

: "${DATABASE_URL:=postgresql://postgres:careos@localhost:5432/careos}"
CHART_NOTE_ID="${1:-22222222-2222-2222-2222-222222222222}"

echo "=== Inserting a pending AI draft ==="
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO ai_chart_note_drafts (id, chart_note_id, raw_notes, field_values, status)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  'Patient has knee pain',
  '{"chief_complaint": "Knee pain"}',
  'pending'
)
ON CONFLICT DO NOTHING;

SELECT id, chart_note_id, status FROM ai_chart_note_drafts
WHERE chart_note_id = '22222222-2222-2222-2222-222222222222';
SQL

echo ""
echo "=== Marking chart note ready for signature ==="
resp=$(curl -s -w '\n%{http_code}' -X POST \
  "http://localhost:3000/api/charting/chart-notes/${CHART_NOTE_ID}/mark-ready-for-signature" \
  -H 'Content-Type: application/json' \
  -d '{ "version": 1 }')
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"

echo ""
echo "=== Verify draft was auto-rejected ==="
psql "$DATABASE_URL" -c "SELECT id, status FROM ai_chart_note_drafts WHERE chart_note_id = '22222222-2222-2222-2222-222222222222';"
