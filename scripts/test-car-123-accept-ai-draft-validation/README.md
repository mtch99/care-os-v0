# CAR-123 — Accept AI Draft: field-value validation + key-existence check

Manual smoke scripts for the refactor that promotes `acceptAiDraft` to an
aggregate-driven command. The aggregate now enforces the same invariants
`saveDraft` already enforces (status, key existence, per-field value
validation). An AI draft with an unknown key or an invalid value is rejected
with 422, and the chart-note state is rolled back atomically.

## Prerequisites

1. API running: `pnpm dev` in another terminal
2. Fresh DB state: `pnpm db:nuke && pnpm db:up && pnpm db:migrate:apply && pnpm db:seed`
3. `jq` and `psql` on `PATH`

## Run order

```bash
# Start a session + initialize a draft chart note. Prints CHART_NOTE_ID.
./00-setup.sh

# Substitute the CHART_NOTE_ID printed by 00-setup.sh:
./01-happy-path.sh <chart_note_id>
./04-verify-rollback.sh <chart_note_id>   # confirms chart_note.version=2, draft.status=accepted

# Reset chart note to draft status (re-run setup, OR re-initialize — see note below)
# Rejection scripts require a chart note still in 'draft' status.

./02-reject-unknown-field-key.sh <chart_note_id>
./04-verify-rollback.sh <chart_note_id>   # confirms chart_note.version unchanged, draft.status still pending

./03-reject-invalid-value.sh <chart_note_id>
./04-verify-rollback.sh <chart_note_id>   # confirms chart_note.version unchanged, draft.status still pending
```

**Note on ordering:** `01-happy-path.sh` mutates the chart note (version goes
to 2, fieldValues populated). The rejection scripts (02, 03) still work against
that state because the aggregate's status check is the only precondition they
care about, and status is still `'draft'`. Each rejection script also deletes
the old draft and seeds a new one, so drafts don't accumulate.

If you want a clean state between cases, re-run the setup flow (nuke + seed +
`00-setup.sh`).

## Test matrix

| Script | Scenario | Expected status | Expected error code | Mutates chart note? |
|--------|----------|-----------------|---------------------|---------------------|
| `00-setup.sh` | Start session + initialize chart note | 201 (init) | — | Yes (creates chart note at version 1) |
| `01-happy-path.sh` | Seed valid draft `{pain_intensity: 6}`, accept | 200 | — | Yes (version → 2, fieldValues overwritten, draft → accepted) |
| `02-reject-unknown-field-key.sh` | Seed draft `{pan_intensity: 6}` (typo), accept | 422 | `UNKNOWN_FIELD_ID` | No (rollback) |
| `03-reject-invalid-value.sh` | Seed draft `{pain_intensity: 42}` (out of 0..10), accept | 422 | `FIELD_VALUE_VALIDATION_ERROR` with `errors[0].path = ["pain_intensity"]`, `code = "OUT_OF_RANGE"` | No (rollback) |
| `04-verify-rollback.sh` | Query chart_notes + ai_chart_note_drafts for this chart note | — | — | Read-only |

## SQL verification queries

Run these in a DB explorer (or via `psql $DATABASE_URL`) to confirm the invariants:

```sql
-- After 01-happy-path: chart note should be at version 2 with pain_intensity=6.
SELECT id, status, version, field_values
FROM chart_notes
WHERE id = '<chart_note_id>';

-- After 01-happy-path: the accepted draft should show status='accepted'.
SELECT id, status, field_values
FROM ai_chart_note_drafts
WHERE chart_note_id = '<chart_note_id>'
ORDER BY created_at;

-- After 02- or 03- (rejection): the chart note must be UNCHANGED from its
-- pre-call state, and the draft must still be 'pending' (the transaction
-- rolled back the draft-status update together with the chart-note update).
SELECT id, status, version, updated_at
FROM chart_notes
WHERE id = '<chart_note_id>';

SELECT id, status
FROM ai_chart_note_drafts
WHERE chart_note_id = '<chart_note_id>'
ORDER BY created_at;
```

## Why the scripts seed drafts via SQL

`POST /api/charting/chart-notes/:id/ai-draft` calls the real Anthropic LLM,
which (by design) produces payloads that match the template schema. To
exercise the *rejection* paths deterministically, the test scripts bypass the
LLM and insert pending drafts directly via `psql` with the exact bad shape we
want to test (unknown key, out-of-range scale). The accept endpoint then
treats them the same as any other draft — which is exactly the contract
CAR-123 introduces.
