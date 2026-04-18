# CAR-97: AI-Assisted Template Creation — Test Scripts

## Prerequisites

- PostgreSQL running: `pnpm db:up`
- Migrations applied: `pnpm db:migrate:apply`
- Seed data loaded: `pnpm db:seed`
- API running: `pnpm --filter @careos/api dev`
- `ANTHROPIC_API_KEY` set in `apps/api/.env`

## Scripts

| # | Script | Tests | Expected HTTP |
|---|--------|-------|---------------|
| 01 | `01-generate-draft.sh` | Generate AI template draft (happy path) | 201 |
| 02 | `02-generate-second-draft.sh` | Multiple pending drafts coexist | 201 |
| 03 | `03-accept-draft.sh <draftId>` | Accept draft → creates template | 201 |
| 04 | `04-reject-draft.sh <draftId>` | Reject a pending draft | 200 |
| 05 | `05-accept-already-resolved.sh <draftId>` | Accept an already-resolved draft | 409 |
| 06 | `06-reject-already-resolved.sh <draftId>` | Reject an already-resolved draft | 409 |
| 07 | `07-accept-not-found.sh` | Accept non-existent draft | 404 |
| 08 | `08-generate-validation-error.sh` | Missing required fields | 400 |
| 09 | `09-verify-db.sh` | DB state verification | n/a |

## Sequence

```bash
# 1. Generate two drafts (captures draftIds from output)
./01-generate-draft.sh
./02-generate-second-draft.sh

# 2. Accept one draft (use draftId from step 1)
./03-accept-draft.sh <draftId-from-01>

# 3. Reject the other (use draftId from step 2)
./04-reject-draft.sh <draftId-from-02>

# 4. Error cases (use either resolved draftId)
./05-accept-already-resolved.sh <draftId-from-01>
./06-reject-already-resolved.sh <draftId-from-02>
./07-accept-not-found.sh
./08-generate-validation-error.sh

# 5. Verify DB state
./09-verify-db.sh
```

## SQL Verification Queries

```sql
-- All AI template drafts with status
SELECT id, discipline, appointment_type, status, accepted_template_id, expires_at
FROM ai_template_drafts
ORDER BY created_at DESC;

-- Templates created from accepted drafts
SELECT t.id, t.name, t.discipline, t.appointment_type, t.is_default
FROM chart_note_templates t
INNER JOIN ai_template_drafts d ON d.accepted_template_id = t.id;

-- Draft acceptance rate
SELECT
  COUNT(*) FILTER (WHERE status = 'accepted') AS accepted,
  COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
  COUNT(*) FILTER (WHERE status = 'expired') AS expired,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending,
  COUNT(*) AS total
FROM ai_template_drafts;
```
