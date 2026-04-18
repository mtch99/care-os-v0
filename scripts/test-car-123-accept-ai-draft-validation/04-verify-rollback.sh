#!/usr/bin/env bash
# Verify that the last failing accept (02 or 03) did NOT mutate chart-note
# state and did NOT mark the draft accepted — both writes must roll back
# together since the invariant throws inside the same db.transaction that
# wraps both mutations.
#
# Run after 02- or 03- to confirm rollback. After 01- (happy path), expect
# chart_notes.version = 2 and the corresponding draft.status = 'accepted'.

set -euo pipefail
source "$(dirname "$0")/../_lib/load-env.sh"

CHART_NOTE_ID="${1:?Usage: $0 <chart_note_id>}"

echo "=== chart_notes state ==="
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
SELECT id, status, version, field_values, updated_at
FROM chart_notes
WHERE id = '${CHART_NOTE_ID}';
SQL

echo ""
echo "=== ai_chart_note_drafts for this chart note ==="
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
SELECT id, status, field_values
FROM ai_chart_note_drafts
WHERE chart_note_id = '${CHART_NOTE_ID}'
ORDER BY created_at;
SQL
