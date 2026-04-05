---
title: "API: Template CRUD Endpoints"
type: feat
status: active
date: 2026-04-05
linear: CAR-93
parent: CAR-89
---

# API: Template CRUD Endpoints

## Overview

Hono API endpoints for chart note template management. This is a **supporting subdomain** (chart-note-templating) using the **active record pattern** — routes call Drizzle directly, no separate domain commands.

These endpoints power the template management UI and replace the hardcoded mock in `packages/clinical/src/services/resolve-chart-note-template.ts`.

## Problem Statement / Motivation

The clinical session flow needs real chart note templates from the database. Currently, `resolveChartNoteTemplate()` returns hardcoded mock data. CAR-93 provides the CRUD surface for practitioners to create, version, and manage templates, and for the session-start flow to resolve the correct default template.

## Proposed Solution

Seven endpoints mounted at `/api/clinical/templates`:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/templates` | Create new template |
| `GET` | `/templates` | List templates (filterable) |
| `GET` | `/templates/:id` | Get template by ID |
| `GET` | `/templates/default` | Get default template for discipline+appointmentType |
| `PUT` | `/templates/:id` | Edit template (creates new version) |
| `PATCH` | `/templates/:id/set-default` | Reassign default to this template |
| `DELETE` | `/templates/:id` | Soft-delete (archive) |

### Versioning Logic (PUT)

All steps within a single `db.transaction()`:

1. Fetch current template — 404 if not found, 409 if archived
2. Determine `rootTemplateId`: if current has `parentTemplateId`, use it; otherwise use current's `id`
3. Find the latest version number for this root (query max version where `parentTemplateId = rootTemplateId` OR `id = rootTemplateId`)
4. If current template was default: mark it `isDefault = false`
5. Insert new row: `parentTemplateId = rootTemplateId`, `version = latestVersion + 1`, inherit `isDefault` from old row
6. Return new version

### Default Reassignment (PATCH /set-default)

All steps within a single `db.transaction()`:

1. Fetch target template — 404 if not found, 409 if archived
2. Find current default for same `(discipline, appointmentType)` — unset its `isDefault`
3. Set target template's `isDefault = true`
4. Return updated template

### parentTemplateId Strategy

**Flat chain (root pointer):** All versions point to the version-1 template's ID. Version 1 has `parentTemplateId = null`. Versions 2, 3, ... all have `parentTemplateId = version1.id`. This makes "get all versions" a simple `WHERE parentTemplateId = :rootId OR id = :rootId`.

## Technical Considerations

### New Files

| File | Purpose |
|------|---------|
| `apps/api/src/routes/clinical.ts` | Route handlers, mounted as `/api/clinical` |
| `packages/api-contract/src/clinical/validation.ts` | Zod schemas for template CRUD |
| `packages/api-contract/src/clinical/types.ts` | TypeScript interfaces for request/response |
| `packages/api-contract/src/common/errors.ts` | New DomainError subclasses (extend existing file) |

### Modified Files

| File | Change |
|------|--------|
| `apps/api/src/index.ts` | Mount `clinicalRoutes` at `/api/clinical` |
| `packages/api-contract/src/index.ts` | Re-export clinical schemas and types |

### Zod Schemas (packages/api-contract/src/clinical/validation.ts)

```typescript
// packages/api-contract/src/clinical/validation.ts
import { z } from 'zod/v4'

const disciplineEnum = z.enum(['physiotherapy', 'ergotherapy'])

const templateContentSchema = z.object({
  sections: z.array(z.string()).min(1),
})

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  discipline: disciplineEnum,
  appointmentType: z.enum(['initial', 'follow_up']),
  content: templateContentSchema,
  isDefault: z.boolean().optional().default(false),
})

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  content: templateContentSchema.optional(),
})

export const listTemplatesQuerySchema = z.object({
  discipline: disciplineEnum.optional(),
  appointmentType: z.enum(['initial', 'follow_up']).optional(),
  isArchived: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional()
    .default('false'),
})

export const defaultTemplateQuerySchema = z.object({
  discipline: disciplineEnum,
  appointmentType: z.enum(['initial', 'follow_up']),
})
```

### DomainError Subclasses

```typescript
// Added to packages/api-contract/src/common/errors.ts
export class TemplateNotFoundError extends DomainError { /* 404 */ }
export class DefaultTemplateNotFoundError extends DomainError { /* 404 */ }
export class CannotArchiveDefaultTemplateError extends DomainError { /* 409 */ }
export class TemplateArchivedError extends DomainError { /* 409 */ }
export class DefaultAlreadyExistsError extends DomainError { /* 409 */ }
```

### Route Handler Pattern

Following the existing pattern in `apps/api/src/routes/scheduling.ts`:

```typescript
// apps/api/src/routes/clinical.ts
import { Hono } from 'hono'
import { db } from '@careos/db'
import { chartNoteTemplates } from '@careos/db'
import { createTemplateSchema, listTemplatesQuerySchema, ... } from '@careos/api-contract'
import { TemplateNotFoundError, ... } from '@careos/api-contract'
import { eq, and } from 'drizzle-orm'

const HARDCODED_PRACTITIONER_ID = '...' // same as scheduling.ts

export const clinicalRoutes = new Hono()

// POST /templates
clinicalRoutes.post('/templates', async (c) => {
  const input = createTemplateSchema.parse(await c.req.json())

  // If isDefault=true, check for existing default → 409
  // Insert new template with version=1, parentTemplateId=null
  // Return 201 { data: template }
})

// GET /templates
clinicalRoutes.get('/templates', async (c) => {
  const query = listTemplatesQuerySchema.parse(c.req.query())
  // Build dynamic WHERE clause from filters
  // Default: isArchived=false
  // Return { data: templates }
})

// ... etc
```

### Database Migration

A new unique index is needed to prevent duplicate version numbers from concurrent PUT requests:

```sql
CREATE UNIQUE INDEX chart_note_templates_version_idx
  ON chart_note_templates (parent_template_id, version)
  WHERE parent_template_id IS NOT NULL;
```

This requires a new Drizzle migration in `packages/db/src/migrations/`.

### Transaction Boundaries

**PUT /templates/:id** and **PATCH /templates/:id/set-default** MUST wrap all DB operations in `db.transaction()` to prevent:
- Window where no default exists during swap
- Duplicate version numbers from concurrent writes
- Inconsistent state from partial failures

### Performance

- The existing `chart_note_templates_lookup_idx` on `(discipline, appointmentType, isArchived)` covers GET /templates list queries
- The existing `chart_note_templates_default_idx` partial unique index covers GET /templates/default
- The new version unique index covers PUT version conflict detection

### Security

- `createdBy` uses `HARDCODED_PRACTITIONER_ID` (no auth yet, per CLAUDE.md)
- All input validated via Zod at route boundary
- No raw SQL — Drizzle ORM only
- ESLint enforces `.where()` on all `.update()` and `.delete()` calls

## System-Wide Impact

- **Interaction graph**: Routes validate → call Drizzle → return response. No Inngest events needed for basic CRUD. The session-start Inngest function (`packages/inngest/src/functions/clinical/session/session.started.ts`) will eventually call GET /templates/default instead of the mock `resolveChartNoteTemplate()`, but that is a separate task.
- **Error propagation**: DomainErrors thrown in routes are caught by the global `onError` handler in `apps/api/src/index.ts`. Zod validation errors also handled globally. Transaction failures rollback automatically.
- **State lifecycle risks**: PUT versioning creates new rows and mutates old ones — all within a transaction. If the transaction fails, no state changes persist. The partial unique index on `(discipline, appointmentType) WHERE isDefault = true` is the DB-level safety net.
- **API surface parity**: This is new surface area. No existing endpoints overlap.
- **Integration test scenarios**: (1) PUT versioning preserves old row and creates new version correctly; (2) PATCH set-default atomically swaps default; (3) DELETE rejects archiving a default template; (4) Concurrent PUT requests on same template handled by version unique index.

## Acceptance Criteria

- [ ] `POST /templates` creates a template with version=1, returns 201
- [ ] `POST /templates` with `isDefault=true` returns 409 if default already exists for that discipline+appointmentType
- [ ] `GET /templates` returns filtered list, defaults to `isArchived=false`
- [ ] `GET /templates/:id` returns template (including archived), 404 if not found
- [ ] `GET /templates/default?discipline=X&appointmentType=Y` returns the default template, 404 if none
- [ ] `PUT /templates/:id` creates new version row with incremented version number, preserves old row
- [ ] `PUT /templates/:id` transfers `isDefault` from old version to new version atomically
- [ ] `PUT /templates/:id` returns 404 if not found, 409 if archived
- [ ] `PUT /templates/:id` only allowed on the latest version of a template chain
- [ ] `PATCH /templates/:id/set-default` atomically swaps default for the discipline+appointmentType
- [ ] `DELETE /templates/:id` sets `isArchived=true`, returns 409 if template is default
- [ ] All write operations wrapped in `db.transaction()`
- [ ] Zod schemas validate all inputs at route boundary
- [ ] DomainError subclasses return proper HTTP status codes
- [ ] New unique index on `(parentTemplateId, version)` prevents duplicate versions
- [ ] Route mounted at `/api/clinical` in `apps/api/src/index.ts`
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm format:check` pass

## Success Metrics

- All seven endpoints respond correctly for happy path and error cases
- Versioning creates proper chain with parentTemplateId pointing to root
- Default template lookup works for all seeded discipline+appointmentType combinations
- No 500 errors from unhandled constraint violations

## Dependencies & Risks

- **DB migration required**: New unique index on `(parentTemplateId, version)`. Must run `pnpm db:migrate` + `pnpm db:migrate:apply`.
- **Discipline values**: Seed data uses lowercase (`'physiotherapy'`), clinical package mock uses uppercase enums (`'PHYSICAL_THERAPY'`). This plan validates against lowercase values matching the DB. Alignment with the clinical package is a follow-up task.
- **Content schema is minimal**: `{ sections: string[] }` — may need refinement as the clinical session flow matures.
- **No Inngest events**: Basic CRUD doesn't need background jobs. If template creation should trigger notifications or indexing, that is a follow-up.

## Sources & References

- Linear issue: [CAR-93](https://linear.app/careos/issue/CAR-93/api-template-crud-endpoints)
- Existing route pattern: [apps/api/src/routes/scheduling.ts](apps/api/src/routes/scheduling.ts)
- DB schema: [packages/db/src/schema/clinical.ts:38-68](packages/db/src/schema/clinical.ts#L38-L68)
- Error classes: [packages/api-contract/src/common/errors.ts](packages/api-contract/src/common/errors.ts)
- Validation pattern: [packages/api-contract/src/scheduling/validation.ts](packages/api-contract/src/scheduling/validation.ts)
- Mock to replace: [packages/clinical/src/services/resolve-chart-note-template.ts](packages/clinical/src/services/resolve-chart-note-template.ts)
- Seed data: [packages/db/src/seed.ts:91-131](packages/db/src/seed.ts#L91-L131)
- Global error handler: [apps/api/src/index.ts:13-28](apps/api/src/index.ts#L13-L28)
