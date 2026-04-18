#!/bin/bash
# Verify ai_template_drafts table state after running the test scripts.
# Shows all drafts with their statuses and linked template IDs.
set -e
source "$(dirname "$0")/../_lib/load-env.sh"

echo "=== AI Template Drafts ==="
psql "$DATABASE_URL" -c "
SELECT id, discipline, appointment_type, status, accepted_template_id, expires_at, created_at
FROM ai_template_drafts
ORDER BY created_at DESC;
"

echo ""
echo "=== Templates created from AI drafts ==="
psql "$DATABASE_URL" -c "
SELECT t.id, t.name, t.discipline, t.appointment_type, t.is_default, t.created_at
FROM chart_note_templates t
INNER JOIN ai_template_drafts d ON d.accepted_template_id = t.id
ORDER BY t.created_at DESC;
"
