#!/bin/bash
# Seed a deterministic session + draft chart_note via psql so the AI-draft
# endpoints have something to operate on. Idempotent — safe to re-run.
#
# Fixed IDs used throughout the suite:
#   TEST_SESSION_ID    = 11111111-1111-1111-1111-111111111111
#   TEST_CHART_NOTE_ID = 22222222-2222-2222-2222-222222222222
#
# Pre-existing seed IDs reused here:
#   APPT_1_ID              = 988930cb-8255-4883-9899-cc2b0c5e44c4 (scheduled)
#   PHYSIO_ID              = 0323c4a0-28e8-48cd-aed0-d57bf170a948
#   TEMPLATE_V2_INITIAL_ID = b3a1c7d2-5e4f-4a89-9c12-d8f6e2a1b3c4 (v0.2 schema — matches LLM tool schema)
set -e

: "${DATABASE_URL:=postgresql://postgres:careos@localhost:5432/careos}"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
-- Insert test session for APPT_1_ID if none exists (session.appointment_id is UNIQUE).
INSERT INTO sessions (id, appointment_id, practitioner_id, status, started_at)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  '988930cb-8255-4883-9899-cc2b0c5e44c4',
  '0323c4a0-28e8-48cd-aed0-d57bf170a948',
  'active',
  NOW()
)
ON CONFLICT (appointment_id) DO NOTHING;

-- Resolve the actual session_id (ours or a pre-existing one for APPT_1_ID),
-- then reset the chart_note and clear any leftover AI drafts so tests start clean.
DO $$
DECLARE
  v_session_id UUID;
BEGIN
  SELECT id INTO v_session_id
  FROM sessions
  WHERE appointment_id = '988930cb-8255-4883-9899-cc2b0c5e44c4';

  DELETE FROM ai_chart_note_drafts
  WHERE chart_note_id = '22222222-2222-2222-2222-222222222222';

  INSERT INTO chart_notes (id, session_id, template_version_id, status, field_values, version)
  VALUES (
    '22222222-2222-2222-2222-222222222222',
    v_session_id,
    'b3a1c7d2-5e4f-4a89-9c12-d8f6e2a1b3c4',
    'draft',
    NULL,
    1
  )
  ON CONFLICT (id) DO UPDATE
    SET status = 'draft', field_values = NULL, version = 1, updated_at = NOW();
END $$;

SELECT id, status, version, field_values
FROM chart_notes
WHERE id = '22222222-2222-2222-2222-222222222222';
SQL

echo ""
echo "Setup complete. Test chart_note_id: 22222222-2222-2222-2222-222222222222"
