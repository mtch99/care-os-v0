# Brainstorm: TemplateSchema v0.2 — Value Object & Seed Data

**Date:** 2026-04-05
**Linear:** [CAR-92](https://linear.app/careos/issue/CAR-92) | Parent: [CAR-89](https://linear.app/careos/issue/CAR-89) | Related: [CAR-102](https://linear.app/careos/issue/CAR-102)
**Status:** Implemented (PR #7)

## What We're Building

The TemplateSchema v0.2 value object — a Zod-based validation layer for the `chart_note_templates.content` JSONB column. This supports a 4-level hierarchy (page > section > row > field), 14 component types, bilingual labels, and typed config per field type.

Also: rich seed templates (physio initial eval + SOAP follow-up), cleanup of enum inconsistencies in `packages/clinical/`, and DX prep (Zod dependency, exports).

## Why This Approach

**Location: `packages/clinical/`**
- Already exists as the clinical domain package (standalone, no DB deps)
- TemplateSchema is domain logic (semantic validation), not just input validation
- `api-contract` keeps request/response boundary schemas; clinical owns domain invariants
- Dependency direction works: `api routes -> clinical -> (no deps)`

**Validation: Zod v4, two-pass, fail fast**
- Consistent with the rest of the codebase (Zod everywhere)
- Pass 1: Zod schema validates structure (hierarchy shape, field types, config shapes)
- Pass 2: Domain function validates semantics (unique field keys across entire template, locale completeness against the template's locale array)
- Structural errors fail fast — semantic checks only run on valid structure
- Easier to test each layer independently

**Config strictness: Strict (strip unknown keys)**
- Each of the 14 FieldType configs gets a typed Zod schema
- Unknown keys are stripped (not rejected) — catches typos, doesn't break on minor additions
- Strict now, can relax later if needed

**Error format: Throw DomainError**
- Semantic validation throws a `TemplateValidationError` (extending DomainError from api-contract)
- Consistent with existing pattern (e.g., `startSession` throws domain errors)
- Single error on first violation found

**Schema ownership: Single source in api-contract**
- `packages/api-contract/` owns the structural Zod schema (`templateContentSchemaV2`) — defining content shape IS the contract layer's job
- `packages/clinical/` imports the schema from api-contract and adds semantic validation on top
- `clinical → api-contract` is a valid dependency (same direction as `scheduling → api-contract`)
- No duplication, no drift risk

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Value object location | `packages/clinical/` | Domain logic, not boundary validation |
| Validation library | Zod v4 | Codebase consistency |
| Validation strategy | Two-pass (Zod structure + domain semantics) | Testable layers, clean separation |
| Error flow | Fail fast (structural before semantic) | Simpler, avoids cascading errors |
| Error format | Throw DomainError | Consistent with startSession pattern |
| Config strictness | Strict, strip unknown keys | Catch errors early, 14 typed schemas |
| Public API | Namespace: `TemplateSchema.{ parse, validate, schema }` | Exposes schema for reuse, full parse for domain use |
| Schema ownership | Single schema in api-contract, clinical imports + extends | No duplication, no drift, valid dep direction |
| Seed data | Add v0.2 templates alongside existing v0.1 seeds | Both shapes coexist for testing |
| Seed file location | Separate `.ts` fixtures in `packages/db/src/fixtures/` | Type-checked, keeps seed.ts readable |
| Enum cleanup | Align `packages/clinical/` stubs now | Prevent confusion, small scope |

## DX Prerequisites

- Add `@careos/api-contract` as runtime dependency to `@careos/clinical` package.json (brings zod transitively, but add zod directly too for explicitness)
- Add ESLint config to `packages/clinical/` (if other packages have one)
- Update `packages/clinical/package.json` exports to expose the new value object module
- Update `packages/clinical/src/index.ts` barrel export

## Scope

### In scope (CAR-92 remaining)
- DX prep (zod dep, exports, eslint config)
- TemplateSchema v0.2 Zod structural schema in `packages/api-contract/`
- Semantic validation (unique keys, locale completeness) in `packages/clinical/`, importing schema from api-contract
- Semantic validation function (unique keys, locale completeness)
- 14 FieldType config schemas (strict, strip unknown)
- `TemplateSchema` namespace: `{ parse, validate, schema }`
- `TemplateValidationError` domain error in api-contract
- Physio initial evaluation seed (50+ fields, 4 pages, bilingual fr/en) as `.ts` fixture
- Physio follow-up SOAP note seed as `.ts` fixture
- Align discipline enum values in `packages/clinical/` with `api-contract` canonical values

### Out of scope
- Transaction scripts (CAR-104–107) — downstream of CAR-102/103
- Template CRUD route changes — already scaffolded in PR #3
- Route-layer integration (calling TemplateSchema.parse on write paths)

## Open Questions

None — all design decisions resolved during brainstorm.
