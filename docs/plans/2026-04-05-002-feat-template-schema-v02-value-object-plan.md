---
title: "feat: TemplateSchema v0.2 value object, config validation & seed fixtures"
type: feat
status: active
date: 2026-04-05
origin: docs/brainstorms/2026-04-05-template-schema-v02-brainstorm.md
---

# feat: TemplateSchema v0.2 value object, config validation & seed fixtures

## Overview

Implement the TemplateSchema v0.2 value object in `packages/clinical/` — a Zod-based validation layer for the `chart_note_templates.content` JSONB column. This includes structural validation (4-level hierarchy, 14 field types, bilingual labels), semantic validation (unique keys, locale completeness), typed config schemas per field type, and rich seed templates.

This is the remaining work for [CAR-92](https://linear.app/careos/issue/CAR-92) and overlaps with [CAR-102](https://linear.app/careos/issue/CAR-102) (TemplateSchema value object — validation logic). CAR-102 blocks all downstream write transaction scripts (CAR-104, CAR-105) and read queries (CAR-103).

## Problem Statement / Motivation

The current `templateContentSchema` in api-contract is `{ sections: string[] }` (v0.1) — a flat placeholder with no structural or semantic validation. The real template structure is a 4-level hierarchy with 14 component types, bilingual labels, and typed config per field type. Without proper validation, invalid content can reach the database. Without seed data, there's nothing to test the CRUD endpoints against.

## Proposed Solution

(see brainstorm: `docs/brainstorms/2026-04-05-template-schema-v02-brainstorm.md`)

### Architecture

```
packages/api-contract/
  src/
    common/errors.ts              ← + TemplateValidationError
    clinical/
      template-content-schema.ts  ← NEW: templateContentSchemaV2 (Zod structural schema)
      field-configs.ts            ← NEW: 14 FieldType config Zod schemas
      types.ts                    ← Updated: v0.2 content types via z.infer<>
      validation.ts               ← Updated: createTemplateSchema uses v0.2 content schema

packages/clinical/
  src/
    template-schema/
      index.ts              ← TemplateSchema namespace { parse, validate, schema }
      validate.ts           ← Semantic validation (unique keys, locale completeness)
    services/
      resolve-chart-note-template.ts  ← Cleaned up (enum alignment)
    index.ts                ← Updated barrel export

packages/db/
  src/
    fixtures/
      physio-initial-eval.ts   ← 50+ fields, 4 pages, bilingual
      physio-follow-up-soap.ts ← SOAP note template
      index.ts                 ← Re-exports all fixtures
    seed.ts                    ← Imports and inserts v0.2 fixtures
```

### Dependency Direction

```
apps/api → packages/clinical (for TemplateSchema.parse on write paths — future)
packages/clinical → api-contract (new dep, same direction as scheduling → api-contract)
packages/clinical → zod (new runtime dep)
packages/db → no new deps (fixtures export plain typed objects, not parse calls)
packages/api-contract → standalone (still no internal deps — it's imported FROM, never imports)
```

### Two-Pass Validation Flow

```
TemplateSchema.parse(raw: unknown)
  │
  ├── Pass 1: templateContentSchemaV2.parse(raw)  ← from @careos/api-contract
  │   └── Zod structural validation
  │       ├── 4-level hierarchy: pages[] → sections[] → rows[] → fields[]
  │       ���── Field type must be one of 14 FieldType values
  │       ├── Config must match typed shape per FieldType (strict, strip unknown)
  │       ├── LocalizedString must have { fr, en } keys
  │       └── On failure: throws ZodError (caught by global handler as 400)
  │
  ���── Pass 2: TemplateSchema.validate(parsed)
  │   └── Domain semantic validation
  │       ├── All field keys globally unique across entire template
  │       ├── All LocalizedString values have keys matching template's locale array
  │       └── On failure: throws TemplateValidationError (DomainError, 422)
  │
  └── Returns: validated TemplateSchema (typed via z.infer<>)
```

`parse` calls `validate` internally — single entry point. Callers get either a fully validated object or an exception.

### 14 FieldType Config Schemas

(from [CAR-92](https://linear.app/careos/issue/CAR-92) spec)

| Type | Required Config Keys |
|---|---|
| `narrative` | `{ placeholder?: LocalizedString }` |
| `text` | `{ placeholder?: LocalizedString }` |
| `scale` | `{ min: number, max: number, step?: number, unit?: string }` |
| `select` | `{ options: LocalizedString[] }` |
| `checkboxGroup` | `{ options: LocalizedString[] }` |
| `checkboxWithText` | `{ items: { key: string, label: LocalizedString }[], columns?: number }` |
| `radio` | `{ options: LocalizedString[] }` |
| `date` | `{}` |
| `repeaterTable` | `{ columns: { key: string, label: LocalizedString, type: "text"\|"select"\|"narrative", options?: string[] }[] }` |
| `table` | `{ columns: string[], rows?: string[] }` |
| `legend` | `{ content: LocalizedString }` |
| `bodyDiagram` | `{ view: "front"\|"back"\|"side"\|"hands"\|"feet" }` |
| `romDiagram` | `{ region: "cervical"\|"thoracic"\|"lumbar" }` |
| `signature` | `{}` |

All schemas use `.strip()` — unknown keys are silently removed, not rejected.

## Technical Considerations

### Seed Coexistence Strategy (v0.1 + v0.2)

The DB has a partial unique index: one default per `(discipline, appointmentType)`. The existing v0.1 seeds are `isDefault: true` for all 4 combinations. New v0.2 physio seeds cannot also be `isDefault: true` without violating the constraint.

**Solution:** Insert v0.2 physio seeds with `isDefault: false`. They are retrievable via `GET /templates` (list) and `GET /templates/:id` (by ID). The "retrievable via existing CRUD endpoints" acceptance criterion is satisfied without the `GetDefault` endpoint.

New v0.2 seed UUIDs are added as hardcoded constants at the top of `seed.ts`, following the existing pattern.

### Fixture File Design

Fixture `.ts` files in `packages/db/src/fixtures/` export plain typed objects — they do NOT call `TemplateSchema.parse` at import time. This preserves `packages/db` as standalone (no dep on `@careos/clinical`).

The objects use TypeScript types derived from `z.infer<typeof templateContentSchemaV2>` exported from `@careos/api-contract` — this is a **type-only import** (erased at runtime), which does not create a new runtime dependency since `@careos/db` could depend on `@careos/api-contract` for types.

The seed script can optionally call `TemplateSchema.parse` on fixtures before insert as a runtime safety net, but this would require `@careos/clinical` as a runtime dep of `@careos/db`. **Defer this to a future iteration** — rely on TypeScript type checking for now.

### Enum Cleanup

Replace the entire stub in `packages/clinical/src/services/resolve-chart-note-template.ts`:
- Remove local `ChartNoteTemplateDiscipline`, `ChartNoteTemplateType`, `PhysicalTherapyChartNoteTemplateType` enums
- Remove local `ChartNoteTemplate` type (conflicts with Drizzle-inferred type from `@careos/db`)
- Replace with a stub that uses string literals matching api-contract canonical values (`'physiotherapy'`, `'ergotherapy'`, `'initial'`, `'follow_up'`)
- Or: mark the file as deprecated with a TODO pointing to the real implementation (CAR-103)

### TemplateValidationError

New DomainError subclass in `packages/api-contract/src/common/errors.ts`:

```typescript
export class TemplateValidationError extends DomainError {
  constructor(public readonly details: string[]) {
    super('TEMPLATE_VALIDATION_ERROR', `Template content validation failed: ${details.join('; ')}`, 422)
  }
}
```

- HTTP 422 (Unprocessable Entity) — semantic validation failure, not structural
- `details` array carries specific messages like `"Duplicate field key 'pain_level' found in page 'eval_pg_1', section 'subjective'"`
- Follows existing pattern: one class, context in constructor, hardcoded HTTP status

### What's Explicitly Out of Scope

- Route-layer integration (calling `TemplateSchema.parse` on write paths)
- Transaction scripts (CAR-104–107)
- Deep config validation beyond basic shape checks

These are intentional deferments. The value object is built and tested in isolation first. Route integration happens when the transaction scripts land.

Note: `templateContentSchema` in api-contract IS updated to v0.2 as part of this work (single source of truth). `createTemplateSchema` and `updateTemplateSchema` will reference the v0.2 schema. `TemplateResponse.content` type will be updated from `unknown` to the v0.2 inferred type.

## System-Wide Impact

- **No API behavior changes** — existing endpoints continue to work with v0.1 content
- **No migration needed** — `content` column is `jsonb`, shape is unconstrained at DB level
- **New package dependencies** — `@careos/api-contract` + `zod` added to `@careos/clinical` (runtime deps)
- **Seed script** — adds 2 new rows, does not modify existing 4 rows
- **Type-only cross-package reference** — fixture files import types from `@careos/api-contract` (erased at runtime)

## Acceptance Criteria

- [x] `templateContentSchemaV2` in api-contract — Zod schema validates v0.2 structure (pages > sections > rows > fields, 14 field types, bilingual labels)
- [x] `createTemplateSchema` and `updateTemplateSchema` updated to use v0.2 content schema
- [x] `TemplateResponse.content` typed to v0.2 shape (no longer `unknown`)
- [x] `TemplateSchema.validate` — checks unique field keys across template, locale completeness
- [x] `TemplateSchema.parse` — combines schema + validate, returns typed object or throws
- [x] 14 FieldType config schemas (strict shape, strip unknown — Zod v4 default)
- [x] `TemplateValidationError` domain error in api-contract (422, details array)
- [x] Physio initial evaluation fixture (50+ fields, 4 pages, bilingual fr/en)
- [x] Physio follow-up SOAP note fixture
- [x] Both v0.2 seeds inserted by `pnpm db:seed` (as `isDefault: false`)
- [ ] Both seeded templates retrievable via `GET /templates` and `GET /templates/:id`
- [x] `@careos/api-contract` + `zod` added as runtime dependencies to `@careos/clinical`
- [x] Enum values in `packages/clinical/` aligned with api-contract (`physiotherapy`, `ergotherapy`)
- [x] `packages/clinical/` barrel export updated to expose `TemplateSchema` namespace
- [ ] All existing tests and type checks pass (`pnpm typecheck && pnpm test`)

## Implementation Phases

### Phase 1: DX Prep

1. Add `@careos/api-contract` and `zod` to `@careos/clinical` dependencies
2. Add `TemplateValidationError` to `packages/api-contract/src/common/errors.ts`
3. Export it from `packages/api-contract/src/index.ts`

**Files modified:**
- `packages/clinical/package.json`
- `packages/api-contract/src/common/errors.ts`
- `packages/api-contract/src/index.ts` (if not already re-exporting errors)

### Phase 2: Structural Schema (in api-contract)

1. Create `packages/api-contract/src/clinical/field-configs.ts` — 14 Zod schemas, one per FieldType
2. Create `packages/api-contract/src/clinical/template-content-schema.ts` — full v0.2 Zod schema composing field configs, exported as `templateContentSchemaV2`
3. Update `packages/api-contract/src/clinical/types.ts` — replace hand-written content types with `z.infer<>` derived from v0.2 schema
4. Update `packages/api-contract/src/clinical/validation.ts` — `createTemplateSchema` and `updateTemplateSchema` reference v0.2 content schema
5. Export new schemas from `packages/api-contract/src/index.ts`

**Files created:**
- `packages/api-contract/src/clinical/field-configs.ts`
- `packages/api-contract/src/clinical/template-content-schema.ts`

**Files modified:**
- `packages/api-contract/src/clinical/types.ts`
- `packages/api-contract/src/clinical/validation.ts`
- `packages/api-contract/src/index.ts`

### Phase 3: Semantic Validation (in clinical)

1. Create `packages/clinical/src/template-schema/` directory
2. Create `packages/clinical/src/template-schema/validate.ts` — unique keys check, locale completeness check (imports types from `@careos/api-contract`)
3. Create `packages/clinical/src/template-schema/index.ts` — `TemplateSchema` namespace wiring `{ parse, validate, schema }` (schema re-exported from api-contract)
4. Update `packages/clinical/src/index.ts` to export the new module

**Files created:**
- `packages/clinical/src/template-schema/validate.ts`
- `packages/clinical/src/template-schema/index.ts`

**Files modified:**
- `packages/clinical/src/index.ts`

### Phase 4: Seed Fixtures

1. Create `packages/db/src/fixtures/` directory
2. Create `packages/db/src/fixtures/physio-initial-eval.ts` — 50+ fields, 4 pages, bilingual (type-only import from `@careos/api-contract` for content type)
3. Create `packages/db/src/fixtures/physio-follow-up-soap.ts`
4. Create `packages/db/src/fixtures/index.ts` — re-exports
5. Update `packages/db/src/seed.ts` — add v0.2 UUID constants, import fixtures, insert with `onConflictDoNothing()`

**Files created:**
- `packages/db/src/fixtures/physio-initial-eval.ts`
- `packages/db/src/fixtures/physio-follow-up-soap.ts`
- `packages/db/src/fixtures/index.ts`

**Files modified:**
- `packages/db/src/seed.ts`

### Phase 5: Enum Cleanup

1. Update `packages/clinical/src/services/resolve-chart-note-template.ts` — replace local enums with canonical string values from api-contract

**Files modified:**
- `packages/clinical/src/services/resolve-chart-note-template.ts`

### Phase 6: Verify

1. `pnpm typecheck` — all packages pass
2. `pnpm lint` — no new lint errors
3. `pnpm build` — all packages build
4. `pnpm db:nuke && pnpm db:up && pnpm db:migrate:apply && pnpm db:seed` — seed runs clean
5. `pnpm dev` then `curl http://localhost:3000/api/templates` — both v0.1 and v0.2 templates returned
6. `curl http://localhost:3000/api/templates/<v0.2-uuid>` — v0.2 template retrieved by ID

## Dependencies & Risks

| Risk | Mitigation |
|---|---|
| Fixture files are large (50+ fields) and error-prone | Type-only imports from clinical ensure compile-time validation |
| `packages/db` type-only import from `@careos/api-contract` | Verify with `pnpm build` that no runtime dep is created |

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-04-05-template-schema-v02-brainstorm.md](docs/brainstorms/2026-04-05-template-schema-v02-brainstorm.md) — Key decisions: structural schema in api-contract, semantic validation in clinical, Zod v4 two-pass, strict config, DomainError on failure, namespace API

### Internal References

- Existing DomainError pattern: `packages/api-contract/src/common/errors.ts`
- Current template validation: `packages/api-contract/src/clinical/validation.ts:7` (`templateContentSchema`)
- Drizzle schema: `packages/db/src/schema/clinical.ts`
- Seed script: `packages/db/src/seed.ts`
- Clinical stub: `packages/clinical/src/services/resolve-chart-note-template.ts`
- Domain command pattern: `packages/scheduling/src/commands/start-session.ts`

### Linear Issues

- [CAR-92](https://linear.app/careos/issue/CAR-92) — Drizzle schema: chart_note_templates table (this work)
- [CAR-102](https://linear.app/careos/issue/CAR-102) — TemplateSchema value object — validation logic (overlapping scope)
- [CAR-89](https://linear.app/careos/issue/CAR-89) — Chart Note Templating (backend) (parent)
- [CAR-93](https://linear.app/careos/issue/CAR-93) — API: Template CRUD endpoints (sibling)
