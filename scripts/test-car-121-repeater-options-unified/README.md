# CAR-121 — Unified option shape for repeater `select` columns

Manual curl scripts proving that `repeaterTable` column `select` options now share the same keyed-localized shape as top-level `select`/`radio`/`checkboxGroup`, and that the validator applies the same key-only matching rule to repeater cells (previously they accepted plain strings).

Companion to:
- `../test-car-120-field-value-validation/` — underlying validator contract
- `../test-car-122-stable-option-key/` — stable-key cut for top-level select

## Prerequisites

- API running on `http://localhost:3000` (`pnpm dev`)
- Fresh seed: `pnpm db:nuke && pnpm db:up && pnpm db:migrate:apply && pnpm db:seed` — the physio initial template (`schemaVersion: 0.3`) must carry the new `{key, fr, en}` options on `rom_table.movement`
- `jq` on PATH

## Scripts

Run `00-setup.sh` first to capture `CHART_NOTE_ID` and starting `VERSION`.

| # | Script | Expected | What it proves |
|---|---|---|---|
| 00 | `00-setup.sh` | 201 / 200 | Prints `CHART_NOTE_ID` + `VERSION` for the rest |
| 01 | `01-repeater-select-key-accepted.sh <id> <v>` | **200** | `rom_table[].movement: "flexion"` (option.key) — the new happy path. Version bumps |
| 02 | `02-repeater-select-en-label-rejected.sh <id> <v>` | **422** `NOT_IN_OPTIONS` | `movement: "Flexion"` (EN label) — regression guard proving the old plain-string behavior is gone |
| 03 | `03-repeater-select-fr-label-rejected.sh <id> <v>` | **422** `NOT_IN_OPTIONS` | `movement: "Rotation"` (FR label) — symmetric to 02 |
| 04 | `04-repeater-select-unknown-rejected.sh <id> <v>` | **422** `NOT_IN_OPTIONS`, path `["rom_table", 0, "movement"]` | Unknown value — path accumulation includes the nested row index |
| 05 | `05-repeater-multi-row-mixed-errors.sh <id> <v>` | **422** `NOT_IN_OPTIONS`, path `["rom_table", 1, "movement"]` | Valid row + invalid row — path pinpoints exactly the offending row |

Error scripts (02-05) do NOT bump the version. The one that bumps (01) runs first.

## Quick sequence

```bash
cd scripts/test-car-121-repeater-options-unified
./00-setup.sh                                       # capture CHART_NOTE_ID, VERSION
CN=<paste-chart-note-id>
V=1

./01-repeater-select-key-accepted.sh   $CN $V && V=2   # bumps to 2
./02-repeater-select-en-label-rejected.sh $CN $V        # 422, V stays at 2
./03-repeater-select-fr-label-rejected.sh $CN $V        # 422, V stays at 2
./04-repeater-select-unknown-rejected.sh  $CN $V        # 422, V stays at 2
./05-repeater-multi-row-mixed-errors.sh    $CN $V        # 422, V stays at 2
```

## Notes

- The one-off JSONB backfill at `../backfill/car-121-repeater-options-to-key.ts` rewrites pre-existing repeater-cell values from label-shape to key-shape. Run it after re-seed if your dev DB has historical chart notes referencing repeater selects; otherwise re-seed alone covers the templates and this suite exercises fresh-chart-note behavior.
- Uses the same physio initial appointment (`988930cb-…`) and practitioner (`0323c4a0-…`) as the other CAR- suites. If you've run those against the same DB since the last seed, re-nuke + re-seed to avoid session-collision errors on `00-setup.sh`.
- Payload shape is unchanged at the wire: clients still send `string` for each repeater select cell. Only the accepted value space changes — option.key, not the localized label.
