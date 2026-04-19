# CAR-120 — Chart note field-value validation smoke tests

Manual curl scripts that exercise `PATCH /api/clinical/chart-notes/:id` against the CAR-120 validator. Each script runs independently (it accepts `chart_note_id` + `version` as arguments), but a natural progression lets you run them in order and keep track of the bumping version.

See the PR: [#31](https://github.com/mtch99/care-os-v0/pull/31). Pattern writeup: [`docs/solutions/best-practices/field-value-validation-mirrors-template-schema.md`](../../docs/solutions/best-practices/field-value-validation-mirrors-template-schema.md).

## Prerequisites

- API running on `http://localhost:3000` (`pnpm dev`)
- Fresh seed: `pnpm db:nuke && pnpm db:up && pnpm db:migrate:apply && pnpm db:seed` (safest if you've run other test-car-* suites against the same database — session-start collisions otherwise)
- `jq` and `psql` on PATH (`13-rejected-save-leaves-state-intact.sh` reads the DB directly)

## Scripts

Setup first. Capture `CHART_NOTE_ID` and the starting `VERSION` from its output.

| # | Script | Expected | What it proves |
|---|---|---|---|
| 00 | `00-setup.sh` | 201 / 200 (session + chart note) | Prints `CHART_NOTE_ID` + `VERSION` for the rest |
| 01 | `01-happy-path.sh <id> <v>` | **200** | Valid payload across `text`, `scale`, `select`, `date`, `narrative` → 200, version bumps. `mechanism_of_injury: "traumatic"` (key-shape post CAR-122). Baseline sanity check |
| 02 | `02-scale-out-of-range.sh <id> <v>` | **422** `OUT_OF_RANGE` | `pain_intensity: 42` against a 0..10 scale is rejected; `path: ["pain_intensity"]` |
| 03 | `03-scale-fractional-not-aligned.sh <id> <v>` | **422** `NOT_ALIGNED_TO_STEP` | `pain_intensity: 7.5` against `step: 1` — the step enforcement that shipped strict from day one |
| 04 | `04-wrong-type.sh <id> <v>` | **422** `WRONG_TYPE` | `referring_md: 123` (text field, number given) |
| 05 | `05-select-not-in-options.sh <id> <v>` | **422** `NOT_IN_OPTIONS` | `mechanism_of_injury: "Unicorn"` doesn't match any declared option key |
| 07 | `07-checkbox-group-duplicate.sh <id> <v>` | **422** `DUPLICATE` | `pain_type: ["sharp", "sharp"]`; path includes the element index (`["pain_type", 1]`) |
| 08 | `08-invalid-date.sh <id> <v>` | **422** `INVALID_DATE` | `referral_date: "not a date"` |
| 09 | `09-multiple-errors-collected.sh <id> <v>` | **422**, `errors.length === 3` | Three invalid fields in one payload, one error response collecting all three — the whole point of the accumulator pattern |
| 10 | `10-repeater-nested-path.sh <id> <v>` | **422** `NOT_IN_OPTIONS`, `path: ["rom_table", 0, "movement"]` | `rom_table` row-0 `movement` cell path carries `rowIndex` and `columnKey` so a client can highlight the exact offending cell |
| 11 | `11-unknown-key-short-circuits.sh <id> <v>` | **422** `UNKNOWN_FIELD_ID` | Key check runs before value check; user sees the key error, not `FIELD_VALUE_VALIDATION_ERROR` |
| 12 | `12-null-accepted.sh <id> <v>` | **200** | `null` is accepted for any field — drafts are incomplete by design. Version bumps |
| 13 | `13-rejected-save-leaves-state-intact.sh <id> <v>` | **422** + DB snapshot match | Atomicity: a rejected save must not bump version or persist the bad value. Reads `chart_notes` directly before/after |

Error scripts (02–05, 07–11) do NOT bump the version, so you can run them in any order using the same `<v>`.

The two that bump (01, 12) should be run sequentially with the new version from the previous step. Each script echoes `Next VERSION=…` on success.

## Quick sequence for a complete smoke

```bash
# From the repo root with the API running on :3000.
cd scripts/test-car-120-field-value-validation
./00-setup.sh                              # capture CHART_NOTE_ID and VERSION from output
CN=<paste-chart-note-id>
V=1

./01-happy-path.sh $CN $V && V=2            # bumps to 2
./02-scale-out-of-range.sh $CN $V           # 422, V stays at 2
./03-scale-fractional-not-aligned.sh $CN $V
./04-wrong-type.sh $CN $V
./05-select-not-in-options.sh $CN $V
./07-checkbox-group-duplicate.sh $CN $V
./08-invalid-date.sh $CN $V
./09-multiple-errors-collected.sh $CN $V
./10-repeater-nested-path.sh $CN $V
./11-unknown-key-short-circuits.sh $CN $V
./12-null-accepted.sh $CN $V && V=3
./13-rejected-save-leaves-state-intact.sh $CN $V
```

## SQL verification queries

Run after the sequence. The DB connection is already in the shared env loader — these work in any worktree.

```bash
source ./../_lib/load-env.sh
```

**Final state of the test chart note** — version should match the last successful bump; `pain_intensity` should be `null` (happy path set it to 7, script 12 nulled it back). Every value in the JSONB is either a valid template value or `null`:

```sql
SELECT id, version, status, jsonb_pretty(field_values) AS field_values
FROM chart_notes
WHERE id = '<CHART_NOTE_ID>';
```

**No garbage persisted** — every saved scale is within `[0, 10]`, every select value is one of the declared `option.key`s (post CAR-122):

```sql
SELECT
  key,
  value
FROM chart_notes, jsonb_each(field_values)
WHERE id = '<CHART_NOTE_ID>' AND value IS NOT NULL AND value != 'null'::jsonb;
```

**Event audit** — `chartNote.saved` events fired only for the two successful saves (01, 12). If you have an event log table, query it; if events are Inngest-only, check the Inngest dev server UI at `http://localhost:9376`.

## Notes

- `APPT_1_ID` = `988930cb-8255-4883-9899-cc2b0c5e44c4` (physio initial, scheduled) — same appointment the `test-car-110-save-chart-note-draft` suite uses. If you've already run that suite against the current seed, a fresh `pnpm db:nuke` reset is the cleanest way to re-run this suite
- The `fieldValues` payload is a patch — only the listed keys are touched. Fields not in the payload keep their stored value
- Script 13 is the only one that reads the DB directly; the rest hit the HTTP API only
- None of these scripts are committed (per `scripts/test-<branch>/` convention — local smoke tests only)
