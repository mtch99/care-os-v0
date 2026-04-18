# CAR-98 — AI Chart Note Filling Test Scripts

Manual curl scripts for the `/api/charting/chart-notes/:id/ai-draft` endpoints.

## Prerequisites

- API server running: `pnpm --filter @careos/api dev`
- Database up & seeded: `pnpm db:up && pnpm db:migrate:apply && pnpm db:seed`
- `ANTHROPIC_API_KEY` set in `apps/api/.env` — scripts 01 and 07 hit the real Anthropic API
- `psql` and `jq` installed

## Why there's a SQL setup step

The charting endpoints operate on an existing `chart_notes` row. At the time of
writing there is no HTTP endpoint that creates one — the Inngest
`clinical/session.started` function that would create it is still a stub. So
`00-setup.sh` seeds a deterministic test session + chart_note directly via
`psql`. Fixed IDs:

| ID                                     | What                    |
| -------------------------------------- | ----------------------- |
| `11111111-1111-1111-1111-111111111111` | test session            |
| `22222222-2222-2222-2222-222222222222` | test chart_note (draft) |

Setup is idempotent — re-running resets the chart note state.

## Make scripts executable

```bash
chmod +x scripts/test-car-98-ai-chart-note-filling/*.sh
```

## Test flow

Run in order. Scripts 05, 06, and 08 take a `<draft_id>` captured from the
previous generate call.

| #   | Script                                | Expected                       | Notes                                |
| --- | ------------------------------------- | ------------------------------ | ------------------------------------ |
| 00  | `./00-setup.sh`                       | —                              | Seeds session + chart_note           |
| 01  | `./01-generate-ai-draft.sh`           | 201 — pending draft            | Save `draftId` from response (= A)   |
| 02  | `./02-generate-validation-empty.sh`   | 400 — VALIDATION_ERROR         | Empty `rawNotes` fails Zod `min(1)`  |
| 03  | `./03-generate-not-found.sh`          | 404 — CHART_NOTE_NOT_FOUND     | Bogus chart_note id                  |
| 04  | `./04-generate-already-pending.sh`    | 409 — AI_DRAFT_ALREADY_PENDING | Draft A still pending                |
| 05  | `./05-accept-draft.sh <A>`            | 200 — chart_note version = 2   | Copies A.fieldValues into chart_note |
| 06  | `./06-accept-already-resolved.sh <A>` | 409 — DRAFT_ALREADY_RESOLVED   | A was accepted in 05                 |
| 07  | `./07-generate-second-draft.sh`       | 201 — pending draft            | Save `draftId` from response (= B)   |
| 08  | `./08-reject-draft.sh <B>`            | 200 — draft status = rejected  | Chart note unchanged                 |
| 99  | `./99-cleanup.sh`                     | —                              | Removes test session + chart_note    |

## What's intentionally not tested here

- **502 AI_GENERATION_FAILED** — happens when the Anthropic call throws. Hard to
  trigger from curl deterministically; covered by unit tests in `packages/charting`.
- **409 CHART_NOTE_NOT_DRAFT** — requires moving the chart note to
  `readyForSignature`/`signed`; no HTTP endpoint does that yet. Covered by unit tests.
- **404 DRAFT_NOT_FOUND on reject** — same failure shape as accept-not-found;
  not repeating it.

## DB verification queries

After running the full suite, run these to confirm state:

```sql
-- Chart note: should be version=2, status=draft, fieldValues populated from draft A
SELECT id, status, version, field_values
FROM chart_notes
WHERE id = '22222222-2222-2222-2222-222222222222';

-- Drafts: A should be 'accepted', B should be 'rejected'
SELECT id, status, raw_notes, created_at
FROM ai_chart_note_drafts
WHERE chart_note_id = '22222222-2222-2222-2222-222222222222'
ORDER BY created_at;

-- No pending drafts remain
SELECT count(*) AS pending_count
FROM ai_chart_note_drafts
WHERE chart_note_id = '22222222-2222-2222-2222-222222222222'
  AND status = 'pending';
```
