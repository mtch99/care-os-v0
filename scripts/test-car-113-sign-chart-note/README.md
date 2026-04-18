# CAR-113: Sign Chart Note -- Manual Test Scripts

## Prerequisites

- API running: `pnpm dev` (from repo root)
- Database seeded: `pnpm db:seed`
- `jq` installed for JSON formatting
- `psql` available for setup/reset scripts

## Test Scripts

| Script | Endpoint | Expected HTTP | What it tests |
|--------|----------|---------------|---------------|
| `00-setup.sh` | (psql) | -- | Reset chart note to readyForSignature at version 2 |
| `01-sign-happy-path.sh` | `POST /chart-notes/:id/sign` | 200 | Sign a readyForSignature note; status -> signed, signedAt/signedBy populated |
| `02-idempotent-already-signed.sh` | `POST /chart-notes/:id/sign` | 200 | Re-sign an already-signed note; alreadySigned: true, no duplicate event |
| `03-version-conflict.sh` | `POST /chart-notes/:id/sign` | 409 | Sign with wrong version; VERSION_CONFLICT |
| `04-sign-draft-note.sh` | `POST /chart-notes/:id/sign` | 409 | Sign a draft note; CHART_NOTE_NOT_READY_FOR_SIGNATURE |
| `05-not-found.sh` | `POST /chart-notes/:id/sign` | 404 | Sign a nonexistent chart note; CHART_NOTE_NOT_FOUND |
| `06-patch-signed-note.sh` | `PATCH /chart-notes/:id` | 409 | Save draft on a signed note; CHART_NOTE_NOT_DRAFT |
| `07-reopen-signed-note.sh` | `POST /chart-notes/:id/reopen` | 409 | Reopen a signed note; CHART_NOTE_ALREADY_SIGNED |
| `08-invalid-body.sh` | `POST /chart-notes/:id/sign` | 400 | Missing version in body; VALIDATION_ERROR |

## Run all scripts sequentially

```bash
for f in scripts/test-car-113-sign-chart-note/*.sh; do
  echo "=== $(basename "$f") ==="
  bash "$f"
  echo ""
done
```

## SQL verification

```sql
-- Check the chart note state after signing
SELECT id, status, version, signed_at, signed_by
FROM chart_notes
WHERE id = '22222222-2222-2222-2222-222222222222';
```
