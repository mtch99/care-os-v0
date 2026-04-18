---
title: 'feat: Chart Note Field-Value Validation Against Template'
type: feat
status: active
date: 2026-04-18
origin: docs/brainstorms/2026-04-18-chart-note-field-value-validation-requirements.md
---

# feat: Chart Note Field-Value Validation Against Template

## Overview

Today, `saveDraft` on a chart note only checks that incoming field **keys** exist in the template version. Field **values** are accepted as-is — a `pain_scale: "seven and a half"` against a 0..10 numeric `scale` field is persisted without complaint. This plan adds a per-field-type value validator in `@careos/clinical`, wires it into the chart-note aggregate, widens `FieldValue` to admit array shapes (forced by `repeaterTable` rows), and extends the API error contract to surface a structured per-field error list.

The validator is built once and reused later by AI-fill (`acceptAiDraft`, currently bypasses both the aggregate and the existing key check). This iteration ships only the validator + `saveDraft` wiring + the supporting type & error work; AI-fill wiring is a follow-up.

## Problem Frame

(see origin: docs/brainstorms/2026-04-18-chart-note-field-value-validation-requirements.md)

Chart-note JSONB blobs accumulate garbage values that downstream consumers (PDF, signed-note display, the future signature gate, AI-fill round-trips) must each defend against independently. The template version already declares everything needed to validate (`scale.min/max`, `select.options`, `repeaterTable.columns`, etc. in [packages/api-contract/src/clinical/field-configs.ts](packages/api-contract/src/clinical/field-configs.ts)) — the validation logic just isn't being called.

## Requirements Trace

**Validation Capability (R1–R5)**

- R1. New validation capability in `@careos/clinical` accepting `(templateContent, fieldValuesPayload)` → Units 3, 4
- R2. Covers all 14 field types with full constraint depth → Unit 3
- R3. Per-type validation honours declared config (scale range, select options, repeater rows, etc.) → Unit 3
- R4. API does not assume a chart-note caller (reusable by AI-fill later) → Unit 3
- R5. Does not validate `required`-ness (deferred to future signature workflow) → Unit 3

**SaveDraft Integration & Error Handling (R6–R10)**

- R6. `saveDraft` validates the **incoming patch** and rejects atomically → Units 4, 5
- R7. Two failure classes (unknown-key 422, value-invalid 422), never combined; value-invalid carries per-field error list → Units 1, 4, 6
- R8. New value-validation `DomainError` subclass distinct from `UnknownFieldIdError` → Unit 1
- R9. Precondition order: chart-note-found → session-owner → status → version → key → value → Unit 4
- R10. Validates only the incoming payload's keys; no migration of stale data → Unit 4

**Type System (R11)**

- R11. Widen `FieldValue` to admit array-shaped values → Unit 2

## Scope Boundaries

(carried from origin)

- Required-ness not enforced — drafts may be incomplete by design.
- No migration of existing JSONB invalids.
- AI-fill (`acceptAiDraft`) and `initialize` are not wired — separate follow-up issues.
- No frontend / client work.
- No re-validation of merged result.
- No DB-level immutability enforcement on templates (treated as immutable by convention).

### Deferred to Separate Tasks

- Wire validator into `acceptAiDraft` AND add the field-key existence check that path bypasses today: separate Linear issue.
- Stale-data audit/report capability: separate Linear issue.
- Template content immutability enforcement (DB constraint or app-layer guard): separate Linear issue.
- "Ready for signature" workflow that adds required-ness validation: not yet on roadmap.

## Context & Research

### Relevant Code and Patterns

- **`TemplateSchema` two-pass shape** ([packages/clinical/src/template-schema/index.ts](packages/clinical/src/template-schema/index.ts), [validate.ts](packages/clinical/src/template-schema/validate.ts)) — mirror exactly: `index.ts` exposes a frozen object with `schema` / `parse` / `validate`; `validate.ts` is a pure function that walks structure, accumulates errors, throws once at the end. The new validator follows the same module shape.
- **`DomainError` base + multi-error precedent** ([packages/api-contract/src/common/errors.ts](packages/api-contract/src/common/errors.ts)) — every semantic-validation error uses HTTP 422. `TemplateValidationError` accepts `details: string[]` and exposes `details` as a public readonly. `NoDefaultTemplateError` is the better precedent for our case: it carries a structured payload (`availableTemplates`) and the Hono handler has a dedicated branch that forwards the structured field. We mirror that.
- **Hono `app.onError`** ([apps/api/src/index.ts](apps/api/src/index.ts) lines 15-42) — three branches today: `NoDefaultTemplateError` (special-cased), generic `DomainError` (drops `details`), `ZodError` (always 400). Add a fourth branch for `FieldValueValidationError` so the per-field array reaches the client.
- **Aggregate test pattern** ([packages/scheduling/src/chart-note/save-draft.test.ts](packages/scheduling/src/chart-note/save-draft.test.ts)) — top-of-file constants + `TEMPLATE_CONTENT` + `makeDraftChartNote(overrides)` + `makeInput(overrides)` + `beforeEach` reseeding fakes from `testing.ts`. Flat `describe / it` style. Reuse the existing fakes in [testing.ts](packages/scheduling/src/chart-note/testing.ts).
- **Aggregate self-defending precedent** ([docs/solutions/integration-issues/drizzle-error-wrapping-domain-isolation.md](docs/solutions/integration-issues/drizzle-error-wrapping-domain-isolation.md)) — the aggregate owns invariant checks; infrastructure error shapes never leak in. The validator throws its own typed `DomainError`, never lets `ZodError` bubble.
- **Save-draft route + request schema** ([apps/api/src/routes/clinical.ts](apps/api/src/routes/clinical.ts) PATCH `/chart-notes/:id`, [packages/api-contract/src/clinical/validation.ts](packages/api-contract/src/clinical/validation.ts) `saveDraftSchema`) — the route casts `Record<string, unknown>` to `Record<string, FieldValue>`. The widening in Unit 2 keeps that cast valid.

### Institutional Learnings

- [docs/solutions/integration-issues/drizzle-error-wrapping-domain-isolation.md](docs/solutions/integration-issues/drizzle-error-wrapping-domain-isolation.md) — adapter (not domain) translates infra-shaped errors. Validator must throw typed `DomainError` directly, not pass `ZodError` upward. Smart-fakes principle applies to validator tests: build invalid payloads against real fixtures, do not mock the validator out.

### External References

None — this is internal pattern work.

## Key Technical Decisions

- **Validator shape**: sibling module `packages/clinical/src/field-values/` exposing `FieldValueSchema` (frozen object with `parse(payload, content)` and `validate(payload, content)`). Mirrors `TemplateSchema` exactly. Resolves the deferred Q "method on TemplateSchema vs sibling" — sibling is cleaner because `TemplateSchema.parse(content)` and `FieldValueSchema.parse(payload, content)` have different identities; co-locating them in a single namespace would muddle that.
- **Validator call site: inside the aggregate** (resolves R9 deferred Q). The aggregate already owns the unknown-key invariant via `UnknownFieldIdError`; the value invariant belongs there too. Cost: widen `ChartNote.saveDraft`'s parameter from `templateFieldIds: string[]` to `templateContent: TemplateContentV2`. Worth it for self-defending symmetry. `initialize` keeps `fieldKeys: string[]` for now (it doesn't need value validation).
- **Error contract — path-based per-leaf errors.** `FieldValueValidationError` carries `errors: Array<{ path: (string | number)[], code: string, message: string }>`. Path mirrors Zod's `ZodIssue.path`. Enables a future client to highlight the exact offending cell inside a `repeaterTable` row, not just the top-level field.
- **HTTP 422 for both error classes.** Aligns with the precedent set by `TemplateValidationError` and `UnknownFieldIdError`, which both use 422 for semantic-validation failures (other `DomainError` subclasses use 409 for state conflicts, 404 for not-found, etc., so 422 is specifically the validation status). The two are distinguished by `DomainError` subclass + `code`, not by status.
- **`scale.step` is enforced strictly.** Every existing fixture declares `step: 1` so all current values are integers; strict alignment is a tighter contract from day one. If a future template author wants `step` as a hint, they can omit it from the config.
- **`FieldValue` widened to a narrow union, not `unknown`.** Add `unknown[]` (or per-type array variants) to the union explicitly. Preserves the static contract for callers like `acceptAiDraft` once it's wired.
- **`extractFieldKeys` is not retired in this iteration.** It still serves `initialize`. The aggregate's key check (which currently calls `extractFieldKeys` from the handler-derived list) and the new value validator both walk the template structure — a small redundancy. The key check stays separate from the value validator because they enforce different invariants (key existence is an aggregate-level invariant, value shape is a domain-validation rule). Folding them together would tangle two concerns. Once `initialize` is fully migrated to value-aware semantics in a future iteration, both `extractFieldKeys` and the duplicate traversal become candidates for removal.
- **Cost of validator-in-aggregate.** Pulling `TemplateContentV2` into `ChartNote.saveDraft`'s parameter type pulls a `@careos/api-contract` clinical type into the domain layer. Future template-schema versions (v0.3+) will force aggregate-signature changes. Accepted as the price of self-defending invariants; if this becomes painful later, refactor to a port-shaped `TemplatePredicate` interface that hides the schema type from the aggregate.
- **One PR per Unit boundary not enforced strictly** — Units 1-7 are reviewable as one PR, since the validator and its wiring are interdependent (you cannot land Unit 4 without Unit 1 and Unit 3). Unit 8 (the `docs/solutions/` writeup) lands in the same PR or as an immediate follow-up so the documentation doesn't get forgotten.

## Open Questions

### Resolved During Planning

- HTTP status for value-validation error → 422 (aligned to convention).
- Error path shape → path-based per-leaf, mirroring `ZodIssue.path`.
- Validator location → sibling module `packages/clinical/src/field-values/`.
- Validator call site → inside the aggregate; widen the signature.
- `scale.step` strictness → strict, with float-safe comparison; stale-data risk explicitly accepted.
- `extractFieldKeys` retirement → out of scope; key check stays separate from value validator (different invariants).
- Hono handler extension → required (Unit 6).
- `CLAUDE.md` dependency-direction update → required (Unit 7).
- **Option matching** (select/radio/checkboxGroup) → match value against `option.fr` OR `option.en`. Schema today has no stable key; this is the pragmatic contract until the schema grows one (potential follow-up).
- **Opaque blob types** (bodyDiagram/romDiagram/signature) → accept null + passthrough any non-null value. No runtime value contract exists yet; tighten when a frontend defines one.
- **`null` on collection types** → clears the field (matches existing aggregate merge). Documented as part of the contract; clients send `[]` to clear-but-preserve-as-collection.
- **Documentation entry tracked as Unit 8** → not an aspirational note.

### Deferred to Implementation

- Exact per-type Zod schemas inside the validator — to be derived from `field-configs.ts` during implementation; the shape of each type's payload (e.g., what a `bodyDiagram` blob looks like at runtime) is best confirmed by reading the schema and existing fixtures rather than spec'd in advance.
- Whether the `FieldValue` widening introduces a typed array variant (`Array<FieldValue>`) or stays at `unknown[]` — choose during Unit 2 implementation based on which keeps `ports.ts` and `aggregate.ts` cleanest.
- Final error-code enum (`NOT_IN_OPTIONS`, `OUT_OF_RANGE`, `WRONG_TYPE`, etc.) — pick during Unit 3 implementation to match what the per-type validators naturally produce.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
PATCH /chart-notes/:id
  ↓
Hono route handler
  ↓
saveDraft (handler in packages/scheduling/src/chart-note/save-draft.ts)
  ↓ load chart note  → ChartNoteNotFoundError if missing
  ↓ load session     → NotSessionOwnerError if not owner
  ↓ load template    → (must exist; FK guarantees this)
  ↓
ChartNote.fromRow(row).saveDraft({
    incomingFieldValues,
    templateContent,        // ← widened from templateFieldIds: string[]
    editedBy, editedAt, incomingVersion,
  })
    ↓ status check     → ChartNoteNotDraftError
    ↓ version check    → VersionConflictError
    ↓ key check        → UnknownFieldIdError (existing; throws on first)
    ↓ value check      → FieldValueValidationError (new; collects all per-field errors)
    │     uses FieldValueSchema.validate(incomingFieldValues, templateContent)
    │       walks the template, dispatches per field.type to a Zod schema,
    │       accumulates path-based errors, throws once at the end
    ↓
  merge & emit chartNote.saved event

repository.updateFieldValues(...)  → optimistic-lock check, persist
  ↓
Hono app.onError
  - FieldValueValidationError → 422 with { code, message, errors: [{path, code, message}] }
  - UnknownFieldIdError       → 422 with { code, message } (existing generic branch;
                                  surfacing unknownKeys in the body is a separate
                                  decision, not in scope for this plan)
  - other DomainError         → existing branch
```

## Implementation Units

- [x] **Unit 1: Add `FieldValueValidationError` to `@careos/api-contract`**

**Goal:** Define the new `DomainError` subclass that carries the per-field error list.

**Requirements:** R7, R8

**Dependencies:** None.

**Files:**
- Modify: `packages/api-contract/src/common/errors.ts`
- Test: `packages/api-contract/src/common/__tests__/errors.test.ts` (extend if it exists; otherwise add cases for the new class)

**Approach:**
- Add class `FieldValueValidationError extends DomainError` with `httpStatus: 422`, `code: 'FIELD_VALUE_VALIDATION_ERROR'` (or similar), and a public readonly `errors: ReadonlyArray<{ path: (string | number)[], code: string, message: string }>`.
- Constructor takes the `errors` array and synthesizes a human-readable `message` (e.g., `"3 field value(s) failed validation"`).
- Export from the package barrel.

**Patterns to follow:**
- `TemplateValidationError` (lines 89-97) for the multi-error constructor pattern.
- `NoDefaultTemplateError` (lines 105-118) for exposing a structured public readonly field that the Hono handler will forward.

**Test scenarios:**
- Happy path: construct with a single-element `errors` array; `httpStatus` is 422; `code` matches; `errors` is preserved as a readonly array.
- Happy path: construct with multiple errors; `message` summarizes the count; `errors.length` matches input.
- Edge case: construct with an empty `errors` array — decide and assert: either rejected (throw in constructor) or accepted with a "no errors" message. Implementer's call; pick the safer one and lock it.
- Edge case: `errors` array with nested paths (e.g., `['painLog', 2, 'col_b']`) — preserved verbatim, not flattened.

**Verification:**
- The class is importable from `@careos/api-contract`, instances pass an `instanceof DomainError` check, and `httpStatus` is 422.

---

- [x] **Unit 2: Widen `FieldValue` to admit array-shaped values**

**Goal:** Make the static type expressive enough that the validator can declare its inputs without `as` casts.

**Requirements:** R11

**Dependencies:** None.

**Files:**
- Modify: `packages/scheduling/src/chart-note/ports.ts`
- Test: `packages/scheduling/src/chart-note/ports.types.test-d.ts` (or co-located type-check; use `vitest`'s `test-d` if already present, otherwise inline assertions are acceptable). The chart-note subdirectory predates the project's `__tests__/` convention — match the existing co-located pattern.

**Approach:**
- Widen the union from `string | number | boolean | null | Record<string, unknown>` to also include `unknown[]` (and/or `Array<{ key: string; checked: boolean; text?: string }>` if a more specific variant keeps `aggregate.ts` cleanest).
- Confirm the existing route-boundary cast (`apps/api/src/routes/clinical.ts` line 283) still typechecks — `unknown` is assignable to the widened union.
- No runtime change.

**Test scenarios:**
- Test expectation: none -- pure type change. If type assertions are added, verify a `repeaterTable`-shaped value (`[{ a: 'x' }, { a: 'y' }]`) typechecks against `Record<string, FieldValue>`.

**Verification:**
- `pnpm typecheck` passes for `@careos/scheduling`, `@careos/api-contract` consumers, and `apps/api`.
- The cast at `apps/api/src/composition/clinical-ports.ts` (around line 22, where `row.fieldValues` is cast to `Record<string, FieldValue>`) still typechecks against the widened union.

---

- [x] **Unit 3: Build the field-value validator in `@careos/clinical`**

**Goal:** A pure, reusable capability that takes `(payload, templateContent)` and either returns a typed payload (parse) or throws `FieldValueValidationError` with all per-field errors collected.

**Requirements:** R1, R2, R3, R4, R5

**Dependencies:** Unit 1 (the error class).

**Files:**
- Create: `packages/clinical/src/field-values/index.ts`
- Create: `packages/clinical/src/field-values/validate.ts`
- Create: `packages/clinical/src/field-values/__tests__/validate.test.ts`
- Modify: `packages/clinical/src/index.ts` (export `FieldValueSchema`)
- Modify: `packages/clinical/package.json` (add `@careos/api-contract` dep if not already present — it is)

**Approach:**
- `index.ts` exports a frozen `FieldValueSchema` with `parse(payload, content)` and `validate(payload, content)`. Mirrors `TemplateSchema`.
- `validate.ts` walks the template's pages → sections → rows → columns. For each column where `payload[column.key]` is present (and not `null`), dispatch on `column.type` to a per-type validator. Accumulate errors with their `path` (e.g., `[column.key]` for leaf types; `[column.key, rowIndex, subColumnKey]` for `repeaterTable` cells). Throw `FieldValueValidationError` once at the end if `errors.length > 0`.
- Per-type rules (verified against `packages/api-contract/src/clinical/field-configs.ts`):
  - **narrative, text** — value is `string`. No further config constraints (only optional `placeholder`, which doesn't constrain the value).
  - **scale** — value is `number`; check `min ≤ v ≤ max`; if `step` declared, check that `(v - min)` is a multiple of `step` using a float-safe comparison: `Math.abs((v - min) / step - Math.round((v - min) / step)) < 1e-9`. **Stale-data risk:** if any pre-existing draft holds a fractional value (e.g., `7.5` against `step: 1`), the next save touching that field will fail — by design (R10 only excludes UNTOUCHED fields). Surface in the API error so the practitioner knows what changed.
  - **select, radio** — value is a single `string`; check it matches `option.fr` OR `option.en` for one of the declared `options`. Resolves the schema gap: option config is `Array<{fr, en}>` with no stable key, so values are matched against either localized string. Cost: pins persisted values to whichever locale the client emitted (`'Traumatic'` vs `'Traumatique'`); downstream comparisons must allow for both.
  - **date** — value is a string parseable by `Date.parse` to a finite timestamp (or use Zod's `iso.date()` if available in v4).
  - **checkboxGroup** — value is `string[]`; each element matches `option.fr` OR `option.en` for one of the declared `options` (same matching rule as `select`); no duplicates (reject duplicates).
  - **checkboxWithText** — value is `Array<{ key: string; checked: boolean; text?: string }>`; each `key` matches one of `items[].key`; `text` accepted optionally regardless of `checked` (do not enforce text-when-unchecked rules — keep validator structural).
  - **repeaterTable** — value is `Array<Record<string, unknown>>`. Each row's keys must be a subset of declared `columns[].key`. Each cell value validates per its column's `type`, which is restricted by schema to `'text' | 'select' | 'narrative'` only (NOT the full 14 types). For a `select` column, the cell value matches one of the column's `options: Array<string>` (plain strings, not `LocalizedString` — distinct shape from top-level select). For `text` and `narrative` columns, the cell is a string with no further constraints.
  - **table** — value shape per `tableConfig`. The config declares `columns: string[]` (header labels) and optional `rows: string[]` (row labels). The runtime value is `Record<rowKey, Record<columnKey, string>>` per the AI adapter convention. Validate that keys are within declared rows/columns (when rows present) and cells are strings.
  - **legend** — display-only field. Reject any non-null value (legend has no user input).
  - **bodyDiagram, romDiagram, signature** — accept `null` OR any non-null value as **passthrough** (no value-shape validation). The schemas in `field-configs.ts` describe display config (which view/region), not runtime value shape, and no frontend has defined a value contract yet. Document as a known gap; tighten in a follow-up issue once a frontend or AI emits real values for these types.
- `null` is always valid for any field (R5 — drafts are incomplete).
- **`null` on collection types clears the field.** Sending `{ rom_table: null }` for a `repeaterTable` discards every existing row (matches the aggregate's existing `mergedFieldValues[key] = value` merge in `chart-note.aggregate.ts:142-145`). Document explicitly in the API contract; clients must send an empty array `[]` if they want to clear visually but preserve the field-as-collection. This is a known foot-gun — surface it in the System-Wide Impact section.
- Use Zod schemas internally where it pays for itself (especially structural shapes); convert any caught `ZodError` into the validator's own `errors` accumulator with proper paths. Never let a `ZodError` escape.
- **Exhaustiveness check:** the validator must cover every variant of `fieldTypeEnum` in `field-configs.ts`. Add a TypeScript `assertNever` style check in the dispatch so a future field-type addition fails to compile rather than silently passes through.

**Patterns to follow:**
- `packages/clinical/src/template-schema/validate.ts` — error accumulator pattern, throw-once-at-end.
- `packages/clinical/src/template-schema/__tests__/validate.test.ts` — fixture builder + flat `describe / it`.

**Test scenarios:**
- Happy path: valid payload across multiple field types in one template; validator returns the typed payload (parse) or returns void without throwing (validate).
- Happy path: payload with `null` for any field — accepted regardless of type.
- Happy path: payload covering only some of the template's fields (patch semantics) — only present fields are validated.
- Per-type happy + error pairs (one each):
  - `text` accepted with a string; rejected when given a number (`code: WRONG_TYPE`).
  - `scale` accepted at min and max; rejected below min, above max, and not aligned to step (e.g., `step: 1, value: 7.5`); accepted at a step-aligned fractional value (e.g., `step: 0.5, value: 1.5`).
  - `select` accepted when value matches `option.en` (e.g., `'Traumatic'`); accepted when value matches `option.fr` (e.g., `'Traumatique'`); rejected when value matches neither locale.
  - `radio` parallel to `select`.
  - `date` accepted with `'2026-04-18'`; rejected with `'not a date'`.
  - `checkboxGroup` accepted with subset of declared options matching either locale; rejected with an unknown value; rejected when given a non-array; rejected on duplicates within the array.
  - `checkboxWithText` accepted with valid items; rejected when an item's `key` isn't in the declared `items`; rejected when shape is wrong (e.g., missing `checked`).
  - `repeaterTable` accepted with valid rows; rejected when a row contains an unknown column key; rejected when a `select`-typed cell's value isn't in that column's `options: string[]`; error path includes `[fieldKey, rowIndex, columnKey]`.
  - `table` accepted with `{ rowKey: { columnKey: 'cellValue' } }`; rejected when a row key isn't in declared `rows` (when declared); rejected when a column key isn't in declared `columns`; rejected when a cell isn't a string.
  - `narrative` accepted with a string; rejected with non-string.
  - `legend` rejected with any non-null value.
  - `bodyDiagram`, `romDiagram`, `signature` — accepted with `null`; accepted with arbitrary non-null shapes (passthrough by design until value contract is defined).
- Error collection: payload with three invalid fields (one `scale` out of range, one `select` unknown option, one `repeaterTable` cell wrong type) — single `FieldValueValidationError` thrown with `errors.length === 3` and paths reflecting the violations.
- Edge case: payload field whose key is not declared in the template — silently ignored by the validator (key-existence is a separate aggregate concern).
- Edge case: template with zero fields, payload empty — validator passes.

**Verification:**
- `pnpm --filter @careos/clinical test` passes the new file. The validator is importable from `@careos/clinical`.

---

- [x] **Unit 4: Wire validator into `ChartNote.saveDraft` aggregate**

**Goal:** The aggregate enforces value validation as part of its precondition chain, after the unknown-key check.

**Requirements:** R6, R7, R9, R10

**Dependencies:** Units 1, 2, 3.

**Files:**
- Modify: `packages/scheduling/src/chart-note/chart-note.aggregate.ts`
- Modify: `packages/scheduling/src/chart-note/save-draft.test.ts` (this file exercises the aggregate via the handler — there is no separate `chart-note.aggregate.test.ts`. Add the new value-validation cases here. The chart-note subdirectory's test colocation predates the project's `__tests__/` convention.)
- Modify: `packages/scheduling/package.json` (add `@careos/clinical` to `dependencies`)

**Approach:**
- Widen the parameter type on `ChartNote.saveDraft` from `templateFieldIds: string[]` to `templateContent: TemplateContentV2` (or accept BOTH for one release if a careful migration is wanted — but since this is v0 and the only caller is updated in Unit 5, swap directly).
- Inside the method:
  - Status check (existing).
  - Version check (existing).
  - Key check: derive `templateFieldIds` from `templateContent` (use `extractFieldKeys` or inline; either works) and run the existing `UnknownFieldIdError` check.
  - Value check (new): call `FieldValueSchema.validate(params.incomingFieldValues, templateContent)`. The validator throws `FieldValueValidationError` if any value fails — propagate.
- Patch-only: only the keys present in `incomingFieldValues` are validated (R10). The validator already follows this contract (it iterates payload keys, not template keys).

**Patterns to follow:**
- The existing precondition order in `chart-note.aggregate.ts` lines 122-139.
- Error throwing matches existing style — let the typed `DomainError` propagate; do not wrap.

**Test scenarios:**
- Happy path: payload with valid value for an existing field — saves, version bumps, `chartNote.saved` event emitted.
- Error path: payload with a `scale` value out of range — throws `FieldValueValidationError`; chart note state and version unchanged; no event emitted.
- Error path: payload with an unknown field key — throws `UnknownFieldIdError` (existing behavior); value validator never runs.
- Error path: payload with both an unknown key AND an invalid value — `UnknownFieldIdError` short-circuits (key check runs first per R9); the user sees the key error first.
- Error path: payload with multiple invalid values — single `FieldValueValidationError` with all errors collected; verify `errors.length` and paths.
- Error path: chart note not in `draft` status — throws `ChartNoteNotDraftError`; value validator never runs.
- Error path: version mismatch — throws `VersionConflictError`; value validator never runs.
- Edge case: payload with `null` value for any field — accepted (R5).
- Edge case: payload omits some template fields — accepted (patch semantics).
- Edge case: `repeaterTable` payload with row 1 col B invalid — error path includes `[fieldKey, 1, 'col_b']`.

**Verification:**
- `pnpm --filter @careos/scheduling test` passes save-draft tests including the new value-validation cases. Existing tests still pass (key-check, status, version).

---

- [x] **Unit 5: Update `save-draft` handler to pass `templateContent`**

**Goal:** Match the aggregate's new signature.

**Requirements:** R6

**Dependencies:** Unit 4.

**Files:**
- Modify: `packages/scheduling/src/chart-note/save-draft.ts`

**Approach:**
- Replace the existing `extractFieldKeys` call (lines 80-94) with passing `template.content as TemplateContentV2` directly to `chartNote.saveDraft`.
- Remove the inline structural type cast (lines 84-92) since the aggregate now requires the typed `TemplateContentV2`.
- The defensive `template ? extractFieldKeys(...) : []` fallback can collapse — `template` must exist (FK guarantee). If the codebase's defensive style is preferred, replace with `if (!template) throw new ChartNoteTemplateNotFoundError(...)` or let it fall through (downstream will fail loudly).

**Patterns to follow:**
- The handler stays a thin orchestrator: load → call aggregate → persist → emit events (existing comment block at lines 47-60).

**Test scenarios:**
- Test expectation: handler-level behavior is exercised by the Unit 4 aggregate tests + existing handler tests. Add no new test cases unless the handler now has logic worth covering on its own (the FK-defensive path is a candidate; otherwise none).

**Verification:**
- All existing save-draft tests pass.
- `pnpm typecheck` passes.

---

- [x] **Unit 6: Extend Hono `app.onError` to surface `FieldValueValidationError.errors`**

**Goal:** The structured per-field array reaches the client; without this, the generic `DomainError` branch drops it.

**Requirements:** R7

**Dependencies:** Unit 1.

**Files:**
- Modify: `apps/api/src/index.ts`
- Test: `apps/api/src/__tests__/error-handler.test.ts` (extend if exists; otherwise create or co-locate with route tests)

**Approach:**
- Add a new branch alongside the `NoDefaultTemplateError` branch (lines 16-27): if `err instanceof FieldValueValidationError`, return `c.json({ error: { code: err.code, message: err.message, errors: err.errors } }, err.httpStatus)`.
- The generic `DomainError` branch stays as the fallback (unchanged).

**Patterns to follow:**
- The `NoDefaultTemplateError` branch is the exact precedent.

**Test scenarios:**
- Integration: PATCH `/chart-notes/:id` with a payload containing one invalid value → 422 response, body has `error.code === 'FIELD_VALUE_VALIDATION_ERROR'`, `error.errors.length === 1`, `error.errors[0].path` is correct.
- Integration: PATCH with multiple invalid values → 422, `error.errors.length` matches.
- Integration: PATCH with an unknown field key → 422, `error.code === 'UNKNOWN_FIELD_ID'` (existing behavior unchanged).
- Integration: a non-`FieldValueValidationError` `DomainError` (specifically `ChartNoteNotDraftError`, e.g., by attempting to save against a chart note in `signed` status) still serializes via the generic branch with `{ code, message }` shape (regression test for the unchanged generic path).

**Verification:**
- The route returns the expected JSON shape end-to-end. Check via `app.request()` in a test (per `apps/api` test patterns; do not boot the server).

---

- [x] **Unit 7: Add the new package edge to dependencies and update `CLAUDE.md`**

**Goal:** Make the new dependency direction explicit so future contributors don't think it's a mistake.

**Requirements:** Implicit from Key Decisions (validator location).

**Dependencies:** Unit 4 (the dep is added there; this unit just documents it).

**Files:**
- Modify: `CLAUDE.md` — Dependency Direction section
- Verify: `packages/scheduling/package.json` — already updated in Unit 4

**Approach:**
- Update the `Dependency Direction` line for scheduling to:
  ```
  packages/scheduling → db, api-contract, clinical
  ```
- Add a one-line note explaining the new edge (e.g., `// scheduling depends on clinical for FieldValueSchema`).

**Patterns to follow:**
- Existing format of the section in `CLAUDE.md`.

**Test scenarios:**
- Test expectation: none -- documentation only.

**Verification:**
- `CLAUDE.md` reflects the new edge. No code-level verification.

---

- [ ] **Unit 8: Document the pattern in `docs/solutions/`**

**Goal:** Capture the validator pattern as the second-ever entry in `docs/solutions/`, establishing the bar for future writeups.

**Requirements:** Implicit (Documentation / Operational Notes).

**Dependencies:** Units 1-7 complete.

**Files:**
- Create: `docs/solutions/best-practices/field-value-validation-mirrors-template-schema.md`

**Approach:**
- Document: the `TemplateSchema` / `FieldValueSchema` parallel module shape; the per-field-type validator pattern with path-based error accumulation; the aggregate-self-defending precedent applied to value validation; the new package edge `scheduling → clinical`; the open schema-design questions (option matching, opaque blob value shapes) that remain.
- Land in the same PR as the implementation, OR file an immediate follow-up Linear issue at PR open time. Do not defer to "after this lands" — that's how the entry never gets written.

**Test scenarios:**
- Test expectation: none -- documentation.

**Verification:**
- File exists and follows the format of the existing `docs/solutions/integration-issues/drizzle-error-wrapping-domain-isolation.md`.

## System-Wide Impact

- **Interaction graph:** `@careos/scheduling` gains a runtime dependency on `@careos/clinical` (previously only `db`, `api-contract`). The Hono error handler in `apps/api` learns a new error class. No callbacks, middleware, or observers added.
- **Error propagation:** Validator throws typed `FieldValueValidationError` from inside the aggregate → propagates through `saveDraft` handler unchanged → caught by `app.onError` → serialized to 422 with the structured `errors` array.
- **State lifecycle risks:** `null` on collection-typed fields (`repeaterTable`, `checkboxGroup`, `checkboxWithText`, `table`) clears the entire collection — this matches the existing aggregate merge semantics (`mergedFieldValues[key] = value` at `chart-note.aggregate.ts:142-145`) and is now an explicit part of the contract. A naive autosave or AI-fill round-trip that emits `{ rom_table: null }` will discard every previously-saved row in that field. The plan does NOT add per-collection-type rejection of `null`; the existing merge semantics win for backward compatibility. Document this in the API contract (response shape, scenario list) so a future client knows to send `[]` instead of `null` when "clear visually but preserve as a collection" is the intent. Beyond this, `saveDraft` already had atomic semantics; the new check happens before the version bump and persistence, so a rejected save leaves the chart note untouched.
- **API surface parity:** The new validator capability is callable by AI-fill (`acceptAiDraft` in `@careos/charting`) and `initialize` in follow-up issues. This iteration does not wire either — they remain unprotected and that gap is acknowledged in Scope Boundaries.
- **Integration coverage:** The Unit 6 integration tests prove the end-to-end serialization. Unit 4 aggregate tests prove the precondition ordering. Unit 3 unit tests prove per-type validation depth.
- **Unchanged invariants:** `UnknownFieldIdError` (still thrown by the aggregate, still 422). `VersionConflictError`, `ChartNoteNotDraftError`, `NotSessionOwnerError`, `ChartNoteNotFoundError` — unchanged. Optimistic-locking via the version column — unchanged. The repository's `updateFieldValues` contract — unchanged. `initialize-chart-note.ts` and `extractFieldKeys` — unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Per-type schemas in Unit 3 drift from `field-configs.ts` over time. | The Unit 3 dispatcher uses an exhaustive switch on `fieldTypeEnum` with an `assertNever` default, so adding a new field type fails to compile rather than silently passes through. A comment near each per-type case noting `// mirror config.ts: <type>Config` reduces drift in the other direction (config grows new constraints). The Unit 8 `docs/solutions/` entry should call out this coupling explicitly. |
| Aggregate signature widening (Unit 4) breaks tests or callers we haven't found. | Run `pnpm typecheck` after Unit 4 lands locally — TS will surface every caller that passes the old shape. Verified during planning: only one caller exists (`save-draft.ts:98`), updated in Unit 5. |
| Hono error handler regression: changing the error-handler shape could affect existing routes. | Unit 6's regression test (using `ChartNoteNotDraftError`) exercises the unchanged generic branch. The new `FieldValueValidationError` branch is additive; the other three branches stay. |
| Zod `ZodError` leaking from inside the validator (per `docs/solutions/` learning). | Validator catches `ZodError` internally and converts to its own `errors[]` accumulator with proper paths. Test scenario "payload with invalid `scale` (string instead of number)" verifies a typed error is thrown, not a `ZodError`. |
| `repeaterTable` row validation cost on large payloads. | Out of scope to benchmark here. Validators are O(n) per row × O(m) per cell. If a future template has 100-row repeaters and saves are slow, profile then; do not optimize speculatively. |
| Drift between `FieldValue` static type and runtime payloads. | Unit 2 widens the union to admit arrays, but the route boundary continues to accept `Record<string, unknown>` and the validator narrows. The boundary cast in `apps/api/src/routes/clinical.ts` line 283 and the persistence boundary cast in `apps/api/src/composition/clinical-ports.ts` line 22 both stay valid. |
| Locale-pinned values (option.fr OR option.en) make downstream comparisons fragile. | Documented in Key Decisions as a known cost. Downstream consumers (PDF, signed-note display) must compare against both locales until the schema grows a stable `key` field. Filed as a follow-up issue at PR open time. |
| `null` on a collection field silently destroys saved data. | Documented in System-Wide Impact and Key Decisions. The validator does not reject — matches existing merge semantics. Surface the contract explicitly in the API response and in the Unit 8 docs entry so future clients send `[]` instead of `null`. |
| `bodyDiagram`/`romDiagram`/`signature` accept any non-null value (passthrough). | Documented in Key Decisions and Scope Boundaries as a known gap. No frontend writes these today; tighten when a real value contract emerges. |

## Documentation / Operational Notes

- The `docs/solutions/` writeup is now tracked as Unit 8 (no longer an aspirational note).
- No rollout, monitoring, or migration concerns. `pnpm db:migrate` is not affected. No feature flag.
- Manual test scripts: generate a curl set under `scripts/test-car-<issue>/` once the Linear issue is filed (per CLAUDE.md convention). Cover the happy path + per-type rejection cases.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-18-chart-note-field-value-validation-requirements.md](docs/brainstorms/2026-04-18-chart-note-field-value-validation-requirements.md)
- Field-config schemas: [packages/api-contract/src/clinical/field-configs.ts](packages/api-contract/src/clinical/field-configs.ts)
- Template content schema: [packages/api-contract/src/clinical/template-content-schema.ts](packages/api-contract/src/clinical/template-content-schema.ts)
- TemplateSchema reference: [packages/clinical/src/template-schema/index.ts](packages/clinical/src/template-schema/index.ts), [packages/clinical/src/template-schema/validate.ts](packages/clinical/src/template-schema/validate.ts)
- DomainError base + precedents: [packages/api-contract/src/common/errors.ts](packages/api-contract/src/common/errors.ts)
- Save-draft handler + aggregate: [packages/scheduling/src/chart-note/save-draft.ts](packages/scheduling/src/chart-note/save-draft.ts), [packages/scheduling/src/chart-note/chart-note.aggregate.ts](packages/scheduling/src/chart-note/chart-note.aggregate.ts)
- Hono error handler: [apps/api/src/index.ts](apps/api/src/index.ts)
- AI-fill bypass (out-of-scope reference): [packages/charting/src/commands/accept-ai-draft.ts](packages/charting/src/commands/accept-ai-draft.ts)
- Institutional learning: [docs/solutions/integration-issues/drizzle-error-wrapping-domain-isolation.md](docs/solutions/integration-issues/drizzle-error-wrapping-domain-isolation.md)
- Related prior plan: [docs/plans/2026-04-05-002-feat-template-schema-v02-value-object-plan.md](docs/plans/2026-04-05-002-feat-template-schema-v02-value-object-plan.md)
