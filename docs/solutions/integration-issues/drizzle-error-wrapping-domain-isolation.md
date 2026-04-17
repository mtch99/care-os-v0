---
title: "Race condition in chart note initialization — Drizzle error wrapping breaks domain error detection"
category: integration-issues
date: 2026-04-16
tags:
  - race-condition
  - idempotency
  - drizzle-orm
  - error-wrapping
  - port-boundary
  - on-conflict-do-nothing
severity: high
component: packages/scheduling, apps/api
symptoms:
  - "HTTP 500 on concurrent POST /api/clinical/chart-notes/initialize"
  - "Postgres unique constraint violation (23505) in logs with 'cause:' prefix"
  - "Concurrent requests return 201 + 500 instead of 201 + 200"
---

# Race condition: Drizzle error wrapping breaks domain error detection

## Problem

Two concurrent `POST /api/clinical/chart-notes/initialize` requests for the same session: one gets 201, the other gets 500. Subsequent calls return 200 for both (the pre-insert idempotency check catches the existing row).

**Error in logs:**
```
cause: PostgresError: duplicate key value violates unique constraint "chart_notes_session_id_unique"
    code: '23505',
```

The `cause:` prefix is the clue — the error code lives on `.cause`, not the top-level error.

## Root Cause

Drizzle ORM's `queryWithCache` wraps every database error in a `DrizzleQueryError`, storing the original Postgres error as `.cause`. The domain command's `isUniqueViolation` helper checked `error.code === '23505'` on the top-level error — always `undefined`.

The test fake at `testing.ts:36-39` created `new Error()` with `code` set directly, matching what the helper expected but not what Drizzle actually throws. Unit tests passed; production failed.

**Deeper issue:** Infrastructure error handling (Postgres error codes) lived in domain code, violating the port boundary. The domain was coupled to an error shape it didn't control.

## Solution: Idempotent writes via ON CONFLICT DO NOTHING

Instead of catching and classifying Postgres errors, redesign the port contract so duplicate inserts are a normal outcome:

### 1. Port contract returns `{ row, created }`

```typescript
// packages/scheduling/src/chart-note/ports.ts
interface ChartNoteRepository {
  findBySessionId(sessionId: string): Promise<ChartNoteRow | null>
  insert(data: { ... }): Promise<{ row: ChartNoteRow; created: boolean }>
}
```

### 2. Adapter uses ON CONFLICT DO NOTHING + fallback SELECT

```typescript
// apps/api/src/composition/clinical-ports.ts
async insert(data) {
  const [row] = await db
    .insert(chartNotes)
    .values({ ... })
    .onConflictDoNothing({ target: chartNotes.sessionId })
    .returning()

  if (row) return { row: toChartNoteRow(row), created: true }

  // Conflict: fetch the winner's row
  const existing = await db.query.chartNotes.findFirst({
    where: eq(chartNotes.sessionId, data.sessionId),
  })
  return { row: toChartNoteRow(existing!), created: false }
}
```

### 3. Domain command — straight-line, no try/catch

```typescript
// packages/scheduling/src/chart-note/initialize-chart-note.ts
const { row: inserted, created } = await chartNoteRepo.insert({ ... })

if (!created) {
  return { chartNote: toResult(ChartNote.fromRow(inserted)), created: false }
}

for (const event of chartNote.getUncommittedEvents()) {
  eventPublisher.publish(event)
}
return { chartNote: toResult(ChartNote.fromRow(inserted)), created: true }
```

`isUniqueViolation` deleted entirely. No infrastructure error codes in domain code.

### 4. Smart fake enforces uniqueness naturally

```typescript
// packages/scheduling/src/chart-note/testing.ts
async insert(data) {
  const existing = this.store.find((r) => r.sessionId === data.sessionId)
  if (existing) return { row: existing, created: false }

  const row: ChartNoteRow = { id: data.id, ...data, /* defaults */ }
  this.store.push(row)
  return { row, created: true }
}
```

No `simulateUniqueViolationOnNextInsert()`. No error simulation. The fake can't diverge on error shapes because there are no errors.

## Prevention

### When to use result-type returns vs exceptions

| Use result types | Use exceptions |
|---|---|
| Outcome is domain-significant (created vs already existed) | Precondition failures (session not found, template missing) |
| Idempotent operations (safe to retry) | Impossible state transitions (signing already-signed note) |
| Concurrency-prone scenarios | Bugs and corrupt invariants |

### Red flags in code review

1. **Domain code with `error.code === '23505'`** — infrastructure error handling leaked past the port boundary
2. **Test fake throws `new Error()` with DB error codes** — fake will diverge from real adapter's error wrapping
3. **`try/catch` around `insert()` in domain code** — conflict handling should be in the adapter's return type
4. **Port interface importing from `drizzle-orm`** — port must use domain-only types

### For the domain-model agent

When generating commands with uniqueness invariants:
- Use `{ row, created }` return type on the insert port — not exceptions
- Never inspect raw DB errors in domain code
- Fakes enforce invariants via store checks, not error simulation
- Events fire only when `created === true`

## Related

- [Ideation](../../ideation/2026-04-16-idempotent-concurrency-patterns.md) — full analysis of 6 survivor ideas
- [Brainstorm](../../brainstorms/2026-04-16-idempotent-concurrency-patterns-brainstorm.md) — key decisions on port design
- [Implementation plan](../../plans/2026-04-16-001-refactor-idempotent-concurrency-patterns-plan.md) — 6-phase PR1 plan
- `packages/db/src/seed.ts` — precedent: uses `.onConflictDoNothing()` five times
- `scripts/test-car-96-chart-note-initialization/06-concurrent-double-tap.sh` — manual verification script
