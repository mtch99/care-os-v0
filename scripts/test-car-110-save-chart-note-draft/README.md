# CAR-110: Save Chart Note Draft (Human Edits) -- Manual Test Scripts

## Prerequisites

- PostgreSQL running: `pnpm db:up`
- Database seeded: `pnpm db:seed`
- API running: `pnpm --filter @careos/api dev`

## Scripts

| Script | Expected HTTP | What it tests |
|--------|--------------|---------------|
| `00-setup.sh` | 200/201 | Starts a session and initializes a chart note. Outputs CHART_NOTE_ID. |
| `01-save-draft-happy.sh <id>` | 200 | Saves field values to a draft chart note. Version bumps to 2. |
| `02-stale-version.sh <id>` | 409 | Sends stale version=1 after 01 bumped to 2. VERSION_CONFLICT. |
| `03-unknown-field-id.sh <id> [ver]` | 422 | Sends a field ID not in the template. UNKNOWN_FIELD_ID. |
| `04-not-session-owner.sh <id> [ver]` | 403 | Sends with wrong practitioner. NOT_SESSION_OWNER. |
| `05-null-clears-field.sh <id> [ver]` | 200 | Sets a field to null (clear). Value becomes null. |
| `06-partial-keys-merge.sh <id> [ver]` | 200 | Sends only one key. Other keys unchanged. |
| `07-not-found.sh` | 404 | Non-existent chart note ID. CHART_NOTE_NOT_FOUND. |

## Run sequence

```bash
# 1. Setup (get chart note ID)
./00-setup.sh
# Copy the CHART_NOTE_ID from output

# 2. Happy path save (version 1 -> 2)
./01-save-draft-happy.sh <CHART_NOTE_ID>

# 3. Stale version (still sends version=1, but current is 2)
./02-stale-version.sh <CHART_NOTE_ID>

# 4. Unknown field (use current version=2)
./03-unknown-field-id.sh <CHART_NOTE_ID> 2

# 5. Wrong practitioner (use current version=2)
./04-not-session-owner.sh <CHART_NOTE_ID> 2

# 6. Null clears field (use current version=2)
./05-null-clears-field.sh <CHART_NOTE_ID> 2

# 7. Partial merge (use current version=3 after null clear)
./06-partial-keys-merge.sh <CHART_NOTE_ID> 3

# 8. Not found (no arguments needed)
./07-not-found.sh
```

## SQL Verification

```sql
-- Check chart note state
SELECT id, session_id, status, field_values, version, updated_at
FROM chart_notes
WHERE id = '<CHART_NOTE_ID>';

-- Check AI drafts are unaffected by manual saves
SELECT id, chart_note_id, status
FROM ai_chart_note_drafts
WHERE chart_note_id = '<CHART_NOTE_ID>';
```
