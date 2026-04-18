#!/bin/bash
# Reset the test chart note to readyForSignature at version 2.
# This simulates a note that was drafted (v1) then marked ready (v2).
#
# Fixed IDs:
#   TEST_SESSION_ID             = 11111111-1111-1111-1111-111111111111
#   TEST_CHART_NOTE_ID          = 22222222-2222-2222-2222-222222222222
#   TEMPLATE_PHYSIO_INITIAL_ID  = 29187424-4563-4ebd-b2ee-c710ce251c70 (seeded)
set -e

source "$(dirname "$0")/../_lib/load-env.sh"

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

  -- Set chart note to readyForSignature at version 2 with field values
  INSERT INTO chart_notes (id, session_id, template_version_id, status, field_values, version)
  VALUES (
    '22222222-2222-2222-2222-222222222222',
    v_session_id,
    '29187424-4563-4ebd-b2ee-c710ce251c70',
    'readyForSignature',
    '{"chief_complaint": "lower back pain", "assessment": "lumbar strain"}'::jsonb,
    2
  )
  ON CONFLICT (id) DO UPDATE
    SET status = 'readyForSignature',
        field_values = '{"chief_complaint": "lower back pain", "assessment": "lumbar strain"}'::jsonb,
        version = 2,
        signed_at = NULL,
        signed_by = NULL,
        updated_at = NOW();
END $$;

SELECT id, status, version, field_values FROM chart_notes
WHERE id = '22222222-2222-2222-2222-222222222222';
SQL

echo ""
echo "Setup complete. Chart note is readyForSignature at version 2 with fieldValues."
