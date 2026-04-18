#!/bin/bash
# Reset the test chart_note to draft status at version 1 and clear AI drafts.
# Reuses the same session + chart note from the CAR-98 suite.
#
# Fixed IDs:
#   TEST_SESSION_ID             = 11111111-1111-1111-1111-111111111111
#   TEST_CHART_NOTE_ID          = 22222222-2222-2222-2222-222222222222
#   TEMPLATE_PHYSIO_INITIAL_ID  = 29187424-4563-4ebd-b2ee-c710ce251c70 (seeded)
set -e

: "${DATABASE_URL:=postgresql://postgres:careos@localhost:5432/careos}"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
-- Insert test session if not exists
INSERT INTO sessions (id, appointment_id, practitioner_id, status, started_at)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  '988930cb-8255-4883-9899-cc2b0c5e44c4',
  '0323c4a0-28e8-48cd-aed0-d57bf170a948',
  'active',
  NOW()
)
ON CONFLICT (appointment_id) DO NOTHING;

DO $$
DECLARE
  v_session_id UUID;
BEGIN
  SELECT id INTO v_session_id
  FROM sessions
  WHERE appointment_id = '988930cb-8255-4883-9899-cc2b0c5e44c4';

  -- Clear any leftover AI drafts
  DELETE FROM ai_chart_note_drafts
  WHERE chart_note_id = '22222222-2222-2222-2222-222222222222';

  -- Reset chart note to draft at version 1
  INSERT INTO chart_notes (id, session_id, template_version_id, status, field_values, version)
  VALUES (
    '22222222-2222-2222-2222-222222222222',
    v_session_id,
    '29187424-4563-4ebd-b2ee-c710ce251c70',
    'draft',
    NULL,
    1
  )
  ON CONFLICT (id) DO UPDATE
    SET status = 'draft', field_values = NULL, version = 1, updated_at = NOW();
END $$;

SELECT id, status, version FROM chart_notes
WHERE id = '22222222-2222-2222-2222-222222222222';
SQL

echo ""
echo "Setup complete. Chart note is draft at version 1."
