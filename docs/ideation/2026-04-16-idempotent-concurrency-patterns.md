# Idempotent Concurrency Patterns for DDD + Ports & Adapters

**Date:** 2026-04-16
**Focus:** Improving concurrency handling across the architecture, triggered by a race condition in chart note initialization (CAR-96)
**Status:** Selected — all 6 survivors moving to brainstorming

## Trigger

Two concurrent `POST /api/clinical/chart-notes/initialize` requests for the same session: one gets 201, the other gets 500 instead of 200. Root cause: `isUniqueViolation` checks `error.code` but Drizzle wraps the Postgres error in `.cause`. The test fake sets `code` directly on the error, so unit tests pass while production fails.

The `domain-model` agent authored this code autonomously. Its testing rules say "use fakes, not real infra" — so the error shape mismatch is structurally invisible to the agent's workflow.

## Grounding

- **Architecture:** TypeScript monorepo, DDD + Ports & Adapters. Domain commands in `packages/scheduling/` accept port interfaces. Drizzle adapters wired in `apps/api/`.
- **Existing patterns:** Typed domain errors (`SessionNotFoundError`, `NoDefaultTemplateError`), but conflict handling bypasses the pattern entirely with raw error duck-typing.
- **Agent workflow:** `domain-model.md` runs autonomously — plan, implement, test with fakes, commit. No integration verification before PR.
- **No institutional knowledge:** `docs/solutions/` doesn't exist. No recorded patterns for idempotent writes or error translation.

## Survivors

### 1. Result-type port contracts with idempotent writes

Change `ChartNoteRepository.insert()` from `Promise<ChartNoteRow>` (throws on conflict) to `Promise<{ row: ChartNoteRow; created: boolean }>`. The Drizzle adapter uses `INSERT ... ON CONFLICT DO NOTHING` + fallback SELECT. The domain command pattern-matches on `created` — no try/catch, no `isUniqueViolation`, no error duck-typing.

**Why this survives:** This eliminates the entire bug category. The domain never sees infrastructure errors. The adapter handles what it should handle. Every future aggregate with uniqueness invariants reuses the pattern. The current command shrinks from 182 lines to ~100 by removing ~60 lines of dual idempotency/conflict handling.

**Evidence:** `initialize-chart-note.ts:125-157` — 32 lines of try/catch for one race condition. `ports.ts` declares `Promise<ChartNoteRow>` with no conflict signal. `seed.ts` already uses `.onConflictDoNothing()` five times. `domain-model.md:34` says "error translation at the HTTP boundary, not in the aggregate" — but `isUniqueViolation` translates errors inside the domain.

**Rejected alternatives:**
- *Fix `isUniqueViolation` to check `.cause.code`*: Two-line fix, but leaves infra error duck-typing in domain code. The next Drizzle version can change the wrapping again. Treats the symptom.
- *Typed `ConflictError extends DomainError`*: Better than raw duck-typing, but still exception-based. If insert returns a result, there's no error to type.
- *Centralized error detection in `@careos/db`*: Moves the check to a better location but doesn't eliminate the pattern.

---

### 2. Smart fakes that enforce real invariants

Replace flag-based `simulateUniqueViolationOnNextInsert()` with fakes that check their in-memory store for duplicates and return the conflict result naturally. If the port returns `{ row, created }` (Idea 1), the fake checks its `Map` for an existing `sessionId` and returns `{ row: existing, created: false }` — no error simulation at all.

**Why this survives:** The triggering bug originated in the fake. `testing.ts:36-39` throws `new Error()` with `code` set directly — divergent from Drizzle's wrapping. Smart fakes that mirror real semantics (duplicate detection) can't diverge on error shapes because there are no errors. Every future aggregate's fake inherits this pattern.

**Evidence:** `testing.ts:21` already has `private store: ChartNoteRow[]` — duplicate detection is trivial. `testing.ts:62` exposes `simulateUniqueViolationOnNextInsert()`, a testing backdoor named after a Postgres concept that shouldn't exist in domain tests.

**Rejected alternative:**
- *Generate fakes from port interfaces*: Premature automation with only 2 aggregates. Hand-written fakes with good patterns are sufficient at this scale.

---

### 3. Update `domain-model` agent instructions for concurrency patterns

Add to `domain-model.md`: (a) use result-type port returns for insert-or-conflict, (b) never inspect raw DB errors in domain code, (c) fakes must never simulate infrastructure error shapes — test conflict paths through natural invariant enforcement.

**Why this survives:** Highest compounding effect. The agent generates all future commands autonomously ("never prompt mid-run"). Without updated instructions, it will re-generate the `isUniqueViolation` anti-pattern on the next aggregate. Current instructions say "concurrency: version-mismatch test" (line 45) but give zero guidance on unique-violation handling.

**Evidence:** `domain-model.md:27` covers optimistic locking only. No rule addresses infrastructure-level concurrency or specifies that error detection is an adapter concern. The agent built `isUniqueViolation` as a local function because nothing told it otherwise.

---

### 4. Port contract test suites

Create a shared test suite per port interface that both the fake and the real Drizzle adapter must pass. The suite defines behavioral contracts like "insert with duplicate sessionId returns `{ created: false }`." Run fakes in unit tests (fast), real adapters in integration tests (slow, Docker Compose Postgres).

**Why this survives:** Safety net for fake/real divergence. Even with result-type ports and smart fakes, future ports may have subtle behavioral differences. Contract tests catch this at test time. `port-adapter.md` already instructs "define a shared test suite that any adapter must pass" — the instruction exists but was never followed.

**Evidence:** 162 lines of fakes in `testing.ts` with no verification they match real behavior. `CLAUDE.md` plans "adapter integration tests (real DB)" but the middle layer is completely missing.

---

### 5. Composition root for adapter wiring

Extract adapter implementations from route files into `apps/api/src/composition/`. Routes call `makeChartNotePorts()` instead of constructing adapters inline.

**Why this survives:** Structural prerequisite for clean port wiring. `clinical.ts` is 393 lines mixing HTTP routing with 106 lines of Drizzle adapter implementations. `domain-model.md:30` and CLAUDE.md both reference a "composition root" that doesn't exist. As aggregates multiply, inline adapter construction in routes becomes unmaintainable.

**Evidence:** `clinical.ts:262-368` — adapters inline in the route file. `domain-model.md:30`: "the composition root wires the adapter" — but no composition root exists.

---

### 6. `docs/solutions/` pattern library

Start `docs/solutions/` with decision records for recurring patterns: idempotent writes, optimistic locking, error translation at port boundaries, port contract testing.

**Why this survives:** Low effort, high compound return. Both humans and agents re-discover the same problems. A solution doc referenced from agent instructions prevents the re-discovery loop. The triggering bug would have been prevented by a doc saying "unique conflicts are handled at the adapter via ON CONFLICT DO NOTHING."

**Evidence:** No `docs/solutions/` exists. The agent reads CLAUDE.md and Linear issues but has no architectural pattern reference.

---

## Rejected ideas (with reasons)

| Idea | Why rejected |
|------|-------------|
| Agent-to-agent assumption handoff markers | Over-engineered for v0. Result-type ports eliminate the assumptions. Revisit with more agents. |
| CI integration smoke step (separate from contract tests) | Redundant with port contract test suites (Idea 4). |
| Generate fakes from port interfaces | Premature automation. 2 aggregates. Hand-written fakes with good patterns are fine. |
| Typed `ConflictError extends DomainError` | Superseded by result-type ports. No error to type if insert returns a result. |
| Pre-push integration check for conflict paths | Covered by port contract tests. Pre-push hooks should stay fast. |
| Migrate `startSession` to Ports & Adapters | Valid but out of scope for this ideation focus. |
| Typed error catalog with exhaustive switch | Valid improvement but orthogonal to concurrency. |
| Error boundaries at composition root | Safety net for a problem that shouldn't exist with result-type ports. |

## Cross-cutting synthesis

Ideas 1 + 2 + 3 form a **reinforcing triad**: result-type ports eliminate the bug class (1), smart fakes make it untestable-wrong (2), agent instructions prevent regeneration (3). Implementing any one alone leaves gaps; together they close the loop from runtime behavior to test fidelity to code generation.

Ideas 4 + 5 are **infrastructure investments** that compound: contract tests need adapters isolated from routes (composition root) to be testable independently.

Idea 6 is the **knowledge capture** that makes all other ideas stick across team and agent turnover.

## Session log

- 2026-04-16: Initial ideation triggered by CAR-96 race condition bug. 4 divergent agents, ~40 raw ideas, 15 distinct after dedupe, 6 survivors after adversarial filtering.
- 2026-04-16: User selected full stack (all 6 survivors) for brainstorming as one coherent initiative.
