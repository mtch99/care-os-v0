# Test Scripts -- CAR-96 Chart Note Initialization

Manual curl tests for the `POST /api/clinical/chart-notes/initialize` endpoint.

## Prerequisites

1. PostgreSQL running: `pnpm db:up`
2. Migrations applied: `pnpm db:migrate:apply`
3. Database seeded: `pnpm db:seed`
4. API server running: `pnpm dev` (or `pnpm --filter @careos/api dev`)
5. `jq` installed for JSON formatting

## Scripts

| #   | Script                       | Method | Endpoint                                | Expected | What it tests                                                  |
| --- | ---------------------------- | ------ | --------------------------------------- | -------- | -------------------------------------------------------------- |
| 00  | start-session.sh             | POST   | /api/scheduling/sessions                | 200      | Creates a session (prerequisite for chart note init)            |
| 01  | initialize-chart-note.sh     | POST   | /api/clinical/chart-notes/initialize    | 201      | Happy path: draft status, created: true, fieldValues empty map |
| 02  | idempotent-return.sh         | POST   | /api/clinical/chart-notes/initialize    | 200      | Same session returns created: false, identical chart note       |
| 03  | session-not-found.sh         | POST   | /api/clinical/chart-notes/initialize    | 404      | SESSION_NOT_FOUND for nonexistent session                      |
| 04  | no-default-template.sh       | POST   | /api/clinical/chart-notes/initialize    | 409      | NO_DEFAULT_TEMPLATE with availableTemplates (destructive)      |
| 05  | validation-error.sh          | POST   | /api/clinical/chart-notes/initialize    | 400      | VALIDATION_ERROR for missing sessionId                         |
| 06  | concurrent-double-tap.sh     | POST   | /api/clinical/chart-notes/initialize    | 200/201  | Two concurrent requests return the same chart note             |

## Usage

Run scripts 00-03, 05 sequentially (they build on each other):

```bash
cd scripts/test-car-96-chart-note-initialization

# 1. Start a session (prints session ID)
./00-start-session.sh

# 2. Initialize chart note (pass session ID from step 1)
./01-initialize-chart-note.sh <session-id>

# 3. Idempotent return (same session ID)
./02-idempotent-return.sh <session-id>

# 4. Session not found (uses a fake UUID)
./03-session-not-found.sh

# 5. Validation error (no args needed)
./05-validation-error.sh
```

Script 04 is destructive (archives a seed template). Run it last and re-seed afterwards:

```bash
./04-no-default-template.sh <session-id>
pnpm db:seed  # re-seed after destructive test
```

Script 06 requires a fresh session (no chart note yet). Start a new session first:

```bash
# Use APPT_2_ID for a different appointment
./00-start-session.sh 37d6720e-6b0b-4930-88e6-b4f545142558
./06-concurrent-double-tap.sh <new-session-id>
```

Override base URL:

```bash
BASE_URL=http://localhost:4000 ./01-initialize-chart-note.sh <session-id>
```

## SQL Verification Queries

Run these in your DB explorer (`psql`, TablePlus, etc.) after testing:

```sql
-- List all chart notes
SELECT id, session_id, template_version_id, status, field_values,
       pre_populated_from_intake_id, version, created_at
FROM chart_notes
ORDER BY created_at;

-- Verify UNIQUE constraint on session_id
SELECT session_id, count(*) AS note_count
FROM chart_notes
GROUP BY session_id
HAVING count(*) > 1;
-- (should return 0 rows)

-- Check field_values are empty map with correct keys
SELECT id, field_values
FROM chart_notes
WHERE field_values IS NOT NULL;

-- Verify template version reference
SELECT cn.id AS chart_note_id, cn.template_version_id,
       t.name AS template_name, t.discipline, t.appointment_type
FROM chart_notes cn
JOIN chart_note_templates t ON cn.template_version_id = t.id;
```
