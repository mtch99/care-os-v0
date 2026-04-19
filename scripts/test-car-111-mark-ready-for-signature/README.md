# Test Scripts: CAR-111 Mark Chart Note Ready for Signature

## Prerequisites

- API server running: `pnpm dev`
- PostgreSQL running: `pnpm db:up`
- Database seeded: `pnpm db:seed`

## Scripts

| Script | Expected HTTP | What it tests |
|--------|--------------|---------------|
| `00-setup.sh` | n/a (SQL) | Reset chart note to draft at version 1, clear AI drafts |
| `01-mark-ready-happy-path.sh` | 200 | Draft -> readyForSignature transition, version bumped to 2 |
| `02-idempotent-already-ready.sh` | 200 | Already readyForSignature returns alreadyReady: true |
| `03-version-conflict.sh` | 409 | Wrong version returns VERSION_CONFLICT |
| `04-not-found.sh` | 404 | Nonexistent chart note returns CHART_NOTE_NOT_FOUND |
| `05-auto-reject-pending-draft.sh` | 200 | Pending AI draft is auto-rejected on transition |

## Running

```bash
# Full sequential run (reset + all tests)
./scripts/test-car-111-mark-ready-for-signature/00-setup.sh
./scripts/test-car-111-mark-ready-for-signature/01-mark-ready-happy-path.sh
./scripts/test-car-111-mark-ready-for-signature/02-idempotent-already-ready.sh

# Reset and run version conflict test
./scripts/test-car-111-mark-ready-for-signature/00-setup.sh
./scripts/test-car-111-mark-ready-for-signature/03-version-conflict.sh

# Not found (no setup needed)
./scripts/test-car-111-mark-ready-for-signature/04-not-found.sh

# Auto-reject test (needs reset first)
./scripts/test-car-111-mark-ready-for-signature/00-setup.sh
./scripts/test-car-111-mark-ready-for-signature/05-auto-reject-pending-draft.sh
```

## SQL Verification

```sql
-- Check chart note status and version
SELECT id, status, version, updated_at FROM chart_notes
WHERE id = '22222222-2222-2222-2222-222222222222';

-- Check AI draft status
SELECT id, chart_note_id, status FROM ai_chart_note_drafts
WHERE chart_note_id = '22222222-2222-2222-2222-222222222222';
```
