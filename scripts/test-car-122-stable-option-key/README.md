# CAR-122 — Stable `key` on select/radio/checkboxGroup option configs

Manual curl scripts proving the atomic cut from locale-permissive matching (`option.fr || option.en`) to key-only matching (`option.key`) for select, radio, and checkboxGroup fields.

Companion to the CAR-120 suite (`../test-car-120-field-value-validation/`) which tests the underlying validator with the new contract.

## Prerequisites

- API running on `http://localhost:3000` (`pnpm dev`)
- Fresh seed: `pnpm db:nuke && pnpm db:up && pnpm db:migrate:apply && pnpm db:seed` — templates must carry `schemaVersion: '0.3'` with keyed options
- `jq` on PATH

## Scripts

Run `00-setup.sh` first to capture `CHART_NOTE_ID` and starting `VERSION`.

| # | Script | Expected | What it proves |
|---|---|---|---|
| 00 | `00-setup.sh` | 201 / 200 | Prints `CHART_NOTE_ID` + `VERSION` for the rest |
| 01 | `01-select-key-accepted.sh <id> <v>` | **200** | `mechanism_of_injury: "traumatic"` (option.key) — the new happy path. Version bumps |
| 02 | `02-select-en-label-rejected.sh <id> <v>` | **422** `NOT_IN_OPTIONS` | `mechanism_of_injury: "Traumatic"` (EN label) — regression guard proving the old locale-permissive behavior is gone |
| 03 | `03-select-fr-label-rejected.sh <id> <v>` | **422** `NOT_IN_OPTIONS` | `mechanism_of_injury: "Traumatique"` (FR label) — symmetry with EN |
| 04 | `04-checkboxgroup-keys-accepted.sh <id> <v>` | **200** | `pain_type: ["sharp", "burning"]` (array of option.key) — bulk-select happy path. Version bumps |
| 05 | `05-checkboxgroup-label-rejected.sh <id> <v>` | **422** `NOT_IN_OPTIONS`, `path: ["pain_type", 1]` | Mixed array with one key + one label — error path pinpoints the offending element by index |

Error scripts (02, 03, 05) do NOT bump the version. The two that bump (01, 04) should run sequentially with the new version from the previous step.

## Quick sequence for a complete smoke

```bash
cd scripts/test-car-122-stable-option-key
./00-setup.sh                                  # capture CHART_NOTE_ID, VERSION
CN=<paste-chart-note-id>
V=1

./01-select-key-accepted.sh $CN $V && V=2      # bumps to 2
./02-select-en-label-rejected.sh $CN $V        # 422, V stays at 2
./03-select-fr-label-rejected.sh $CN $V        # 422, V stays at 2
./04-checkboxgroup-keys-accepted.sh $CN $V && V=3
./05-checkboxgroup-label-rejected.sh $CN $V    # 422, V stays at 3
```

## Notes

- Uses the same appointment (`988930cb-…`) and practitioner (`0323c4a0-…`) as the CAR-120 and CAR-110 suites. If you've run those against the same DB since the last seed, re-nuke + re-seed to avoid session-collision errors on `00-setup.sh`.
- The one-off JSONB backfill at `../backfill/car-122-options-label-to-key.ts` rewrites pre-existing label-shape chart-note values. Run it after re-seed if your dev DB has historical chart notes; otherwise re-seed alone covers the templates and this suite exercises fresh-chart-note behavior.
- Payload shape is unchanged — clients still send `string` for select/radio and `string[]` for checkboxGroup. Only the accepted value space changes (key, not label).
