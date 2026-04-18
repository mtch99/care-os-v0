#!/usr/bin/env bash
# Unknown field key: seed a pending AI draft whose fieldValues contain a key
# the template does not declare (e.g. AI hallucinated `pan_intensity` instead
# of `pain_intensity`). Expect the accept to throw UnknownFieldIdError.
#
# Expected: HTTP 422 with error.code = "UNKNOWN_FIELD_ID".
# Post-conditions (verified by 04-verify-rollback.sh):
#   - chart_notes.version and field_values unchanged
#   - ai_chart_note_drafts.status still 'pending'

set -euo pipefail
source "$(dirname "$0")/../_lib/load-env.sh"

CHART_NOTE_ID="${1:?Usage: $0 <chart_note_id>}"
BASE_URL="http://localhost:3000"
DRAFT_ID="d2bbbbbb-2222-4222-bbbb-bbbbbbbbbbbb"

echo "=== Seeding pending AI draft with UNKNOWN field key (pan_intensity) ==="
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
DELETE FROM ai_chart_note_drafts
WHERE chart_note_id = '${CHART_NOTE_ID}';

INSERT INTO ai_chart_note_drafts (id, chart_note_id, raw_notes, field_values, status)
VALUES (
  '${DRAFT_ID}',
  '${CHART_NOTE_ID}',
  'hallucinated field key scenario',
  '{"pan_intensity": 6}'::jsonb,
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
