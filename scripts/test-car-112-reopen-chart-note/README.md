# CAR-112: Reopen Chart Note for Edit -- Manual Test Scripts

## Prerequisites

- API server running: `pnpm dev`
- Database seeded: `pnpm db:seed`
- `psql` available for setup scripts

## Scripts

| Script | Expected HTTP | What it tests |
|--------|---------------|---------------|
| `00-setup.sh` | N/A | Resets chart note to `readyForSignature` at version 2 with field values |
| `01-reopen-happy-path.sh` | 200 | Reopens a `readyForSignature` note -- transitions to `draft`, bumps version, preserves `fieldValues` |
| `02-idempotent-already-draft.sh` | 200 | Reopening an already-draft note returns `alreadyDraft: true`, no event emitted |
| `03-reopen-signed-409.sh` | 409 | Attempting to reopen a `signed` note returns `CHART_NOTE_ALREADY_SIGNED` |
| `04-version-conflict-409.sh` | 409 | Sending a stale version returns `VERSION_CONFLICT` |
| `05-not-found-404.sh` | 404 | Reopening a nonexistent chart note returns `CHART_NOTE_NOT_FOUND` |

## Run All

```bash
./scripts/test-car-112-reopen-chart-note/00-setup.sh
for f in scripts/test-car-112-reopen-chart-note/0[1-5]*.sh; do echo "--- $f ---"; bash "$f"; echo; done
```

## SQL Verification

```sql
-- Check chart note status and version after reopen
SELECT id, status, version, field_values, updated_at
FROM chart_notes
WHERE id = '22222222-2222-2222-2222-222222222222';
```
