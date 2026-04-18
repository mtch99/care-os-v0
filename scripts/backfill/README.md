# One-Time Backfill Scripts

Scripts under this directory are **throwaway, one-time migrations** tied to a specific issue. They are committed for audit trail and pattern reference, not intended to be rerun against the same DB or adapted for unrelated future work without reading the new surface area first.

## Scripts

### `car-122-options-label-to-key.ts`

**Issue:** [CAR-122](https://linear.app/careos/issue/CAR-122) — rewrite `chart_notes.field_values` from localized-label shape (`'Traumatic'`) to stable-key shape (`'traumatic'`) for select / radio / checkboxGroup fields after the CAR-122 schema bump.

**When to run:**
- After pulling the CAR-122 branch
- After `pnpm db:nuke && pnpm db:seed` (templates must be re-seeded to schemaVersion `'0.3'` with keyed options — the script refuses to run against stale templates)
- **Before** starting the API (if your dev DB had pre-CAR-122 chart-note data you want to preserve instead of nuking entirely)

**How to run:**

```bash
# Ensure DATABASE_URL points at your dev DB. `pnpm db:up` writes the worktree-
# specific URL to apps/api/.env and packages/db/.env; source one:
export DATABASE_URL=$(grep '^DATABASE_URL=' packages/db/.env | cut -d= -f2-)

pnpm tsx scripts/backfill/car-122-options-label-to-key.ts
```

**What it does:**
- Reads every row in `chart_notes`, loads the referenced template, parses it under the current schema (aborts loudly if any template is still at `'0.2'`).
- For each `field_values` key:
  - `select` / `radio`: if the stored string matches `option.fr` or `option.en` but not `option.key`, rewrites to the matching `option.key`.
  - `checkboxGroup`: same rewrite element-wise on the array.
  - Everything else: untouched.
- Leaves values already matching `option.key` unchanged (idempotent).
- Logs warnings for values that match neither a key nor any localized label — those stay as-is so nothing is silently destroyed.

**Why throwaway:** This is the team's first JSONB content migration. It targets one specific shape change (labels → keys) for three specific field types (select / radio / checkboxGroup) using the specific field-config surface that exists today. The pattern is instructive; the code is not general. Subsequent migrations should be written from scratch against the schema at that point in time.

**Scope boundaries:** This script does NOT touch `markReadyForSignature` or `acceptAiDraft` stored-value validation gaps. Those are pre-existing runtime gaps noted in the CAR-122 plan and deferred to follow-up work under CAR-90.
