---
title: Debugging & Testing Strategy (Manual + Automated)
type: brainstorm
status: complete
date: 2026-04-01
---

# Debugging & Testing Strategy

## What We're Building

A layered testing and debugging infrastructure for the careOS v0 monorepo that serves both human developers and AI agents. This covers automated unit/integration tests, a smart fixtures package for seeding, and manual debugging workflows for the API and Inngest functions.

---

## Context

The repo already has:
- Vitest infrastructure scaffolded (Phase 4 of the dev tooling plan) — no tests written yet
- A `seed.ts` in `packages/db` with fixed IDs and `onConflictDoNothing()` inserts
- Domain commands (e.g. `startSession`) that accept `DrizzleDB` directly as a dependency

The gap: no test strategy, no repository abstractions, no fixtures infrastructure, no manual debugging workflow.

---

## Key Decisions

### 1. Add repository interfaces (ports) before writing tests

The current architecture injects `DrizzleDB` directly into domain commands. Before writing tests, introduce repository interfaces as ports:

- `AppointmentRepository` — `findById`, `updateStatus`
- `SessionRepository` — `findByAppointmentId`, `create`

Commands take these interfaces, not the raw Drizzle handle. This enables:
- **Domain tests**: pure JS, inject a fake repository implementation
- **Adapter tests**: test the Drizzle implementation against real Postgres

This is the hexagonal architecture separation the codebase already implies but hasn't fully formalized.

### 2. Test pyramid — three layers, distinct concerns

| Layer | What it tests | DB needed | Tool |
|---|---|---|---|
| **Domain command tests** | Orchestration logic, business rules | No | Vitest + fake repo |
| **Repository adapter tests** | Drizzle query correctness, constraints | Yes (Postgres) | Vitest + real DB |
| **API route tests** | HTTP contract, status codes, error shapes | No | Vitest + `app.request()` |

**Priority: domain command tests first.** They cover the most business-critical paths (state transitions, guard clauses) with zero infrastructure.

### 3. Test only meaningful logic — no CRUD tests

A rule for what deserves a test:
- ✅ Conditional flows (4 guard clauses in `startSession`)
- ✅ Multi-step orchestration with side effects
- ✅ Domain invariants (state machine transitions)
- ❌ Simple DB reads/writes with no conditions
- ❌ Framework behavior (validation libraries, ORM internals)

### 4. `@careos/fixtures` — a smart, layered fixtures package

A dedicated package (or a `packages/fixtures` workspace package) that replaces the standalone `seed.ts` and serves both automated tests and manual dev seeding.

#### Two-layer seeding strategy

**Layer 1 — Reference/base data** (direct DB inserts, idempotent):
- Clinics, practitioners, patients, chart note templates
- Fixed deterministic UUIDs — the same IDs used in manual API calls and curl commands
- `upsert` semantics (`onConflictDoUpdate`) so they're always in a known state

**Layer 2 — Transactional/state data** (via domain commands):
- Appointment status transitions (e.g. `'scheduled'` → `'in_session'`) go through `startSession()` etc.
- Guarantees referential and domain integrity — seed data is always in a valid state
- Seeding exercises the real command logic (implicit smoke test)

#### Key concepts

- **Factories**: programmatic builders with sensible defaults. `buildAppointment({ status: 'scheduled' })`. Used in automated tests for isolated, per-test data.
- **Scenarios**: named starting states composed from factories. `scenario('session-in-progress')` assembles clinic + practitioner + patient + appointment + session in one call. Used for manual dev testing and DB resets.

#### Reset workflow

`pnpm db:reset` → truncate all tables → run base data inserts → optionally apply a named scenario.

### 5. Inngest — dev server as the primary debugging tool

Use `inngest dev` alongside the API for manual testing and debugging of event-driven flows:
- UI for replaying events
- Inspect step outputs and function run history
- Zero extra test code for manual debugging

Unit tests for Inngest functions: only when the handler contains real logic (conditional branching, data transformation). Skip if the function is just a DB read + event emit.

### 6. AI agent ergonomics

The testing infrastructure must work for AI agents, not just humans:
- Automated tests: deterministic, clear failure messages, no flakiness
- Seed scenarios: AI agents should be able to call `pnpm db:reset --scenario=<name>` to reach a known starting state, then make API calls to explore or reproduce bugs
- Fixtures package exports: typed, discoverable (e.g. `SEED_IDS.PHYSIO_ID`)

---

## What This Is NOT

- No end-to-end (browser/UI) tests — not in scope for v0
- No load/performance testing
- No Inngest mocking via SDK internals — too fragile

---

## Open Questions

*(none — all resolved during brainstorm)*

---

## Resolved Questions

- **DB faking strategy?** → In-memory fake repositories (not Drizzle stubs, not SQLite) — possible because we're introducing port interfaces
- **Seed via commands or direct inserts?** → Layered: base data via direct inserts, transactional state via domain commands
- **When to test Inngest functions?** → Only when there's real conditional logic; manual testing via Inngest Dev Server is the base
