---
title: "Field-value validation mirrors TemplateSchema — sibling module shape and aggregate-level enforcement"
category: best-practices
date: 2026-04-18
tags:
  - validation
  - domain-model
  - aggregate-invariants
  - zod
  - path-based-errors
  - self-defending-aggregate
severity: medium
component: packages/clinical, packages/scheduling, apps/api
symptoms:
  - "Garbage values persisted in chart_notes.field_values JSONB"
  - "pain_scale: 'seven and a half' silently accepted against a numeric scale"
  - "Downstream consumers (PDF, signed-note display) each defend against invalid values independently"
---

# Field-value validation mirrors TemplateSchema

## Problem

Two invariants live on chart-note saves. **Key existence** — "every incoming field key must be declared in the template" — was already enforced. **Value shape** — "every incoming value must match its template-declared type and per-type constraints" — was not. `saveDraft` accepted `pain_scale: "seven and a half"` against a 0..10 numeric `scale` without complaint. The JSONB blob accumulated garbage that every downstream consumer (PDF, signed-note display, the future signature gate, AI round-trips) had to defend against independently.

The template version already declared everything needed to validate (`scale.min/max`, `select.options`, `repeaterTable.columns`, etc. in [packages/api-contract/src/clinical/field-configs.ts](../../../packages/api-contract/src/clinical/field-configs.ts)). The validation logic just wasn't being called.

## Pattern: sibling module mirroring `TemplateSchema`

When a package already owns one validation capability and a second, related capability needs to land in the same package, **mirror the existing module shape** rather than inventing a new one.

`@careos/clinical` already exposes `TemplateSchema` — a frozen object with `schema`, `parse(raw)`, and `validate(content)`. The new field-value validator exposes `FieldValueSchema` — a frozen object with `parse(payload, content)` and `validate(payload, content)`. Same directory convention, same test layout, same two-pass discipline.

```
packages/clinical/src/
  template-schema/
    index.ts              ← frozen { schema, parse, validate }
    validate.ts           ← pure function, walks structure, throws once
    __tests__/validate.test.ts
  field-values/
    index.ts              ← frozen { parse, validate }
    validate.ts           ← pure function, walks payload, throws once
    __tests__/validate.test.ts
```

**Why sibling, not method on `TemplateSchema`.** `TemplateSchema.parse(content)` and `FieldValueSchema.parse(payload, content)` have different identities — different inputs, different failure modes, different consumers. Co-locating them as `TemplateSchema.validate` + `TemplateSchema.validateFieldValues` would muddle that. A sibling module keeps the two capabilities independently discoverable and testable.

## Pattern: path-based per-leaf error accumulation

The validator collects every per-field violation before throwing, so a client can surface all invalid fields in one response instead of the fix-one-discover-another loop. Each error carries a `path` modelled after Zod's `ZodIssue.path`:

```typescript
interface FieldValueError {
  readonly path: ReadonlyArray<string | number>  // ['pain_scale'] or ['rom_log', 2, 'col_b']
  readonly code: string                           // WRONG_TYPE, OUT_OF_RANGE, NOT_IN_OPTIONS, …
  readonly message: string
}
```

Leaf errors are `[fieldKey]`. Nested errors inside a repeater row are `[fieldKey, rowIndex, columnKey]`. The array is preserved verbatim through the Hono error handler, so a future client can highlight the exact offending cell inside a `repeaterTable` — not just the top-level field.

The error class `FieldValueValidationError` exposes `errors: ReadonlyArray<FieldValueError>` and rejects an empty array in its constructor:

```typescript
constructor(public readonly errors: ReadonlyArray<FieldValueError>) {
  if (errors.length === 0) {
    throw new Error('FieldValueValidationError constructed with no errors — this is a caller bug')
  }
  super('FIELD_VALUE_VALIDATION_ERROR', `${errors.length} field value(s) failed validation`, 422)
}
```

Empty-array construction is a caller bug — a validator that throws with nothing wrong should fail loudly rather than surface a nonsense response to a client.

## Pattern: self-defending aggregate — enforce the invariant where it belongs

The `ChartNote` aggregate already owned the unknown-key invariant via `UnknownFieldIdError`. The value invariant belongs in the same place, for the same reason: the aggregate is where chart-note rules are enforced, and keeping rules in one place means every caller (the current `saveDraft` handler, the future AI-fill wiring) gets them for free.

```typescript
// packages/scheduling/src/chart-note/chart-note.aggregate.ts
saveDraft(params: {
  incomingFieldValues: Record<string, FieldValue>
  templateContent: TemplateContentV2  // widened from templateFieldIds: string[]
  editedBy: string
  editedAt: Date
  incomingVersion: number
}): ChartNote {
  if (this.status !== 'draft') throw new ChartNoteNotDraftError()
  if (params.incomingVersion !== this.version) {
    throw new VersionConflictError(this.id, params.incomingVersion, this.version)
  }

  // Key check BEFORE value check: "field doesn't exist" is the more
  // fundamental error; a value error against an unknown key is meaningless.
  const unknownKeys = Object.keys(params.incomingFieldValues)
    .filter((k) => !collectFieldKeys(params.templateContent).has(k))
  if (unknownKeys.length > 0) throw new UnknownFieldIdError(unknownKeys)

  // Value check — throws FieldValueValidationError with all per-field
  // errors collected; propagates unchanged.
  FieldValueSchema.validate(params.incomingFieldValues, params.templateContent)

  // … merge, bump version, emit chartNote.saved …
}
```

**Cost.** Widening the aggregate's parameter from `templateFieldIds: string[]` to `templateContent: TemplateContentV2` pulls a `@careos/api-contract` clinical type into the domain layer. Future template-schema versions (v0.3+) will force aggregate-signature changes. Accepted as the price of self-defending invariants. If this becomes painful, refactor to a port-shaped `TemplatePredicate` interface that hides the schema type from the aggregate.

## Pattern: `z.infer` for config types keeps the validator in lockstep

The `TemplateContentV2` Zod schema is a discriminated union at runtime, but the static inference widens `config` into the union of all per-type configs — narrowing on `field.type` does not narrow `field.config` in TypeScript. Rather than hand-rolling local config types (which silently drift from the Zod schemas), derive them via `z.infer`:

```typescript
import { fieldConfigByType } from '@careos/api-contract'
import type { z } from 'zod'

type ScaleConfig = z.infer<(typeof fieldConfigByType)['scale']>
type SelectConfig = z.infer<(typeof fieldConfigByType)['select']>
type RepeaterConfig = z.infer<(typeof fieldConfigByType)['repeaterTable']>
// …
```

Any change to the Zod schemas in `field-configs.ts` — a new constraint, a renamed key — is picked up at compile time. The cast inside the switch (`field.config as ScaleConfig`) stays safe at runtime because any `TemplateContentV2` reaching the validator has already passed the structural Zod schema.

## Pattern: exhaustive switch with `assertNever`

The dispatcher uses an exhaustive switch on `fieldTypeEnum` with `assertNever` as the default arm. Adding a new field type to the schema forces a new case to compile — TypeScript refuses to narrow `type` to `never` if any variant is missing:

```typescript
switch (field.type) {
  case 'text':
  case 'narrative': validateString(value, path, errors); return
  case 'scale': validateScale(value, field.config as ScaleConfig, path, errors); return
  // … 14 total …
  default: assertNever(field.type)
}

function assertNever(x: never): never {
  throw new Error(`Unreachable: unexpected field variant ${JSON.stringify(x)}`)
}
```

A future contributor adding a new field type can't silently ship it without validator coverage — the build breaks first.

## The `scheduling → clinical` package edge

The aggregate now imports `FieldValueSchema` from `@careos/clinical`. [CLAUDE.md](../../../CLAUDE.md) records this: `packages/scheduling → db, api-contract, clinical`. The direction is safe — `clinical` depends on `api-contract` only, no circular risk. Future contributors who see the import and suspect a mistake can check the dependency-direction section in CLAUDE.md to confirm it's intentional.

## Pattern: stable `key` on option configs — match persisted values on identity, not label

`select`, `radio`, and `checkboxGroup` options carry a stable `key: string` alongside the localized `fr` / `en` labels. The validator matches incoming values against `option.key` only — never against the localized label. This is the contract CAR-122 shipped, replacing the earlier locale-permissive OR-match that pinned persisted values to whichever locale the client emitted.

```typescript
// packages/api-contract/src/clinical/field-configs.ts
const keyedLocalizedOption = z.object({
  key: z.string().min(1),  // stable snake_case slug — contract once written
  fr: z.string(),
  en: z.string(),
})
```

**Key naming convention:** snake_case slug of the English label (`'Traumatic'` → `'traumatic'`, `'Post-surgical'` → `'post_surgical'`, `'Sit to Stand'` → `'sit_to_stand'`). Once written, the key is contract — a later label edit does NOT rename the key. Within a single field's options array, keys must be unique; across fields the same key (e.g., `'normal'`) can appear in multiple fields and is scoped to its containing field's options at lookup time.

### Three `key` namespaces inside a single template

A `TemplateContentV2` tree uses the identifier `key` at three different scopes with different semantics. Spelled out to prevent confusion:

| Namespace | Where | What it identifies | Persistence role |
|---|---|---|---|
| **field.key** | Every `column` node | Identifies a field inside the template (`mechanism_of_injury`, `onset_date`) | Top-level object key under `chart_notes.field_values` |
| **item.key** | `checkboxWithTextConfig.items[]` | Identifies a checkbox row inside a `checkboxWithText` field | Nested object key inside the field's stored array |
| **option.key** | `selectConfig` / `radioConfig` / `checkboxGroupConfig` `.options[]` | Identifies a selectable value inside one of those field types (new in CAR-122) | The scalar (select/radio) or element (checkboxGroup) stored in `field_values[field.key]` |

### Locale-pinned option matching (RESOLVED by CAR-122)

Previously: options were `Array<LocalizedString>` with no stable identifier, so persisted values were whichever localized string the client emitted (`'Traumatic'` vs `'Traumatique'`). Downstream consumers had to branch on both locales to compare. **Resolved** in CAR-122 — the schema now requires `option.key`, the validator matches on `option.key` only, and a one-time backfill at `scripts/backfill/car-122-options-label-to-key.ts` rewrote pre-existing chart-note values from label-shape to key-shape.

## Known schema gaps (tracked)

Contract-level decisions documented at landing time rather than papered over:

### Repeater `select` vs top-level `select` shape divergence

`repeaterTable` column `select` options are `string[]` (plain strings), distinct from top-level select's `LocalizedString[]`. The validator handles both on separate code paths. Tracked: **[CAR-121](https://linear.app/careos/issue/CAR-121)** — Medium priority.

### `null` on collection fields clears the collection

Sending `{ rom_table: null }` for a `repeaterTable` field discards every existing row. This matches the aggregate's existing merge semantics (`mergedFieldValues[key] = value`) — the validator does not reject `null`. Backward compat wins over foot-gun protection. Clients that want to "clear visually but preserve as a collection" must send `[]` (for array-typed fields) or `{}` (for `table`). Documented here as part of the API contract.

### Opaque blob passthrough

`bodyDiagram`, `romDiagram`, and `signature` accept any non-null value because no frontend has defined a runtime value contract yet. The per-type schemas in `field-configs.ts` describe display config (which view/region), not runtime value shape. Tighten when a real value shape emerges.

## Prevention

### When to reach for this pattern

| Apply the pattern | Don't |
|---|---|
| A second validation capability in a package that already owns a first one — mirror the existing module shape | New package entirely — design the shape on its own merits |
| Errors where a client wants to highlight the exact failing location — path-based per-leaf accumulation | Errors where only the existence of a failure matters — a single summary message is simpler |
| Invariants on an aggregate that already enforces related invariants — enforce in the aggregate | Infrastructure-level errors (Postgres unique violation, network timeout) — those belong in the adapter ([drizzle-error-wrapping-domain-isolation.md](../integration-issues/drizzle-error-wrapping-domain-isolation.md)) |
| A fixed enum of variants where missing cases should fail loudly — exhaustive switch with `assertNever` | Open-ended dispatch where new variants are legitimately allowed to pass through |

### Red flags in code review

1. **Hand-rolled config types shadowing Zod schemas** — use `z.infer<(typeof schemaByType)[T]>` so the validator stays lockstep with the schema source of truth.
2. **Validator catches errors internally but re-throws `ZodError`** — convert to the validator's own typed error with path accumulation; don't leak infrastructure shapes past the port boundary. Same principle as [drizzle-error-wrapping-domain-isolation.md](../integration-issues/drizzle-error-wrapping-domain-isolation.md).
3. **Precondition-chain order that runs value check before key check** — value errors against unknown keys are meaningless; the fundamental error wins.
4. **Validator walks the template instead of the payload** — loses PATCH semantics (every template field would be "missing" on a partial update); walk the payload and let templates declare what the payload might contain.
5. **Error accumulator throws on first failure** — defeats the "one round trip, all errors" contract; accumulate before throwing.
6. **`FieldValueValidationError` constructed with `errors.length === 0`** — a validator that throws with nothing wrong is a caller bug; the constructor should reject it rather than surface an empty "validation failed" response.
7. **Missing Hono `onError` branch for a `DomainError` subclass that carries structured fields** — the generic branch serializes `{ code, message }` only and silently drops anything else. Specific branches go ABOVE the generic one.

## Related

- [Plan](../../plans/2026-04-18-001-feat-chart-note-field-value-validation-plan.md) — Units 1-8, full design trace
- [Origin brainstorm](../../brainstorms/2026-04-18-chart-note-field-value-validation-requirements.md) — requirements and scope boundaries
- [TemplateSchema source](../../../packages/clinical/src/template-schema/) — the sibling pattern this mirrors
- [Field-config schemas](../../../packages/api-contract/src/clinical/field-configs.ts) — the Zod source of truth
- [Drizzle error-wrapping domain isolation](../integration-issues/drizzle-error-wrapping-domain-isolation.md) — the "infrastructure error shapes don't cross the port boundary" precedent this builds on
- [CAR-122 plan](../../plans/2026-04-18-002-feat-stable-option-key-select-radio-checkboxgroup-plan.md) — adding the stable `option.key` covered in this doc
- CAR-121 — schema gap follow-up: unify repeater vs top-level select option shapes
