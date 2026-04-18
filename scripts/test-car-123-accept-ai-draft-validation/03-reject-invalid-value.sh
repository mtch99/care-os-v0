#!/usr/bin/env bash
# Invalid value: seed a pending AI draft whose `pain_intensity` is 42 (out of
# the template's declared 0..10 range). Expect the accept to throw
# FieldValueValidationError with per-leaf errors[].
#
# Expected: HTTP 422 with error.code = "FIELD_VALUE_VALIDATION_ERROR" and
# error.errors[0].path = ["pain_intensity"], error.errors[0].code = "OUT_OF_RANGE".
# Post-conditions (verified by 04-verify-rollback.sh):
#   - chart_notes.version and field_values unchanged
#   - ai_chart_note_drafts.status still 'pending'

set -euo pipefail
source "$(dirname "$0")/../_lib/load-env.sh"

CHART_NOTE_ID="${1:?Usage: $0 <chart_note_id>}"
BASE_URL="http://localhost:3000"
DRAFT_ID="d3cccccc-3333-4333-cccc-cccccccccccc"

echo "=== Seeding pending AI draft with INVALID scale value (pain_intensity=42) ==="
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
DELETE FROM ai_chart_note_drafts
WHERE chart_note_id = '${CHART_NOTE_ID}';

INSERT INTO ai_chart_note_drafts (id, chart_note_id, raw_notes, field_values, status)
VALUES (
  '${DRAFT_ID}',
  '${CHART_NOTE_ID}',
  'invalid scale value scenario',
  '{"pain_intensity": 42}'::jsonb,
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
