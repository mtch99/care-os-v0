#!/bin/bash
# Remove the test chart_note and session created by 00-setup.sh.
# Leaves seed data intact.
set -e

: "${DATABASE_URL:=postgresql://postgres:careos@localhost:5432/careos}"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DELETE FROM ai_chart_note_drafts
WHERE chart_note_id = '22222222-2222-2222-2222-222222222222';

DELETE FROM chart_notes
WHERE id = '22222222-2222-2222-2222-222222222222';

DELETE FROM sessions
WHERE id = '11111111-1111-1111-1111-111111111111';
SQL

echo "Cleanup complete."
