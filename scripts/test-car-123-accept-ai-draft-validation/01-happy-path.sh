#!/usr/bin/env bash
# Happy path: seed a pending AI draft with a valid payload, accept, expect 200.
#
# Seeds the draft directly via psql (rather than via POST /ai-draft which
# calls the real LLM) so the test is deterministic.
#
# Expected: HTTP 200. The chart note's fieldValues reflect the draft payload
# (overwrite semantics), version bumps from 1 to 2, and the draft status
# transitions to 'accepted'.

set -euo pipefail
source "$(dirname "$0")/../_lib/load-env.sh"

CHART_NOTE_ID="${1:?Usage: $0 <chart_note_id>}"
BASE_URL="http://localhost:3000"
DRAFT_ID="d1aaaaaa-1111-4111-aaaa-aaaaaaaaaaaa"

echo "=== Seeding pending AI draft with VALID fieldValues ==="
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
DELETE FROM ai_chart_note_drafts
WHERE chart_note_id = '${CHART_NOTE_ID}';

INSERT INTO ai_chart_note_drafts (id, chart_note_id, raw_notes, field_values, status)
VALUES (
  '${DRAFT_ID}',
  '${CHART_NOTE_ID}',
  'back pain 6/10, worse with flexion',
  '{"pain_intensity": 6}'::jsonb,
  'pending'
);

SELECT id, status, field_values FROM ai_chart_note_drafts WHERE id = '${DRAFT_ID}';
SQL

echo ""
echo "=== POST /chart-notes/${CHART_NOTE_ID}/ai-draft/${DRAFT_ID}/accept ==="
resp=$(curl -s -w '\n%{http_code}' -X POST \
  "${BASE_URL}/api/charting/chart-notes/${CHART_NOTE_ID}/ai-draft/${DRAFT_ID}/accept")
code=${resp##*$'\n'}
body=${resp%$'\n'*}
echo "$body" | jq .
echo "HTTP $code"

echo ""
echo "=== DB state after accept ==="
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
SELECT id, status, version, field_values
FROM chart_notes
WHERE id = '${CHART_NOTE_ID}';

SELECT id, status, field_values
FROM ai_chart_note_drafts
WHERE id = '${DRAFT_ID}';
SQL
