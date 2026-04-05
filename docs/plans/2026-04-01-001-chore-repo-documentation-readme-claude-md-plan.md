---
title: "chore: Add README.md and CLAUDE.md repository documentation"
type: chore
status: completed
date: 2026-04-01
origin: docs/brainstorms/2026-04-01-documentation-brainstorm.md
---

# chore: Add README.md and CLAUDE.md Repository Documentation

## Overview

Create two independent, self-contained documentation files at the repo root — `README.md` for human developers/stakeholders and `CLAUDE.md` for AI agents. The repo currently has zero root-level documentation. Both files acknowledge the v0 state and include near-term architectural intent so readers don't work against the roadmap.

## Problem Statement

The careOS v0 monorepo has no `README.md` or `CLAUDE.md`. This means:

- **New developers** have no single entry point — they must reverse-engineer the project from `package.json`, schema files, and route handlers
- **AI agents** lack constraint awareness — they can't know about import-time server boot in `apps/api/src/index.ts`, eager env parsing, the hardcoded practitioner ID, or the planned hexagonal refactor without reading multiple files
- **Stakeholders** have no high-level overview of what the project does or where it's headed
- **Security posture** is implicit — there's no documented rule against committing `.env` files or hardcoding secrets

## Proposed Solution

Two files at repo root, each self-contained for its audience (see brainstorm: `docs/brainstorms/2026-04-01-documentation-brainstorm.md`):

1. **`README.md`** — narrative prose, welcoming tone, takes a developer from zero to running
2. **`CLAUDE.md`** — terse imperative bullets, rules over explanations, actionable constraints

Overlap between the two is intentional and acceptable — DRY is the wrong goal when audiences differ.

## Technical Approach

### Architecture

No code changes. Two new markdown files at the repo root. Content derived from existing codebase analysis.

### Implementation Phases

#### Phase 1: README.md

Create `README.md` with the following sections in order:

**1. Header & badge area**
- Project name: `careOS v0`
- One-line description: Healthcare operations platform — appointment lifecycle and clinical session management
- Status disclaimer: `> ⚠️ v0 — actively evolving. APIs, schema, and patterns will change.`

**2. What is careOS?**
- 2-3 sentence description: what it does, who it's for, what domain it covers
- Core domain: appointments transitioning through a state machine (`scheduled` → `in_session` → `awaiting_completion` → `completed` / `canceled` / `no_show`), with sessions created alongside transitions

**3. Tech Stack** (table format)

| Concern | Technology |
|---|---|
| Runtime | Node.js 22, TypeScript 6.0 |
| HTTP | Hono + @hono/node-server |
| Database | PostgreSQL, Drizzle ORM |
| Background jobs | Inngest |
| Validation | Zod v4 |
| Monorepo | pnpm 10 + Turborepo |
| Linting | ESLint v10 (strict type-checked) |
| Formatting | Prettier |
| Git hooks | Lefthook (pre-push) |
| Testing | Vitest v4 (infra only — no tests yet) |
| CI | GitHub Actions |

**4. Prerequisites**
- Node.js 22
- pnpm 10.12.4+
- Docker (for PostgreSQL)

**5. Quick Start**

```bash
pnpm install
pnpm start:postgres          # Docker PostgreSQL on :5432
cp packages/db/.env.example packages/db/.env  # if .env.example exists, otherwise document required vars
cp apps/api/.env.example apps/api/.env
pnpm dev
```

Document required environment variables:
- `packages/db`: `DATABASE_URL` (required), `DB_POOL_MAX`, `DB_IDLE_TIMEOUT`, `DB_CONNECT_TIMEOUT`, `DB_SSL` (all optional)
- `apps/api`: `PORT` (optional, defaults to 3000)

**6. Monorepo Structure**

```
apps/
  api/              → Hono HTTP server, routes, Inngest webhook endpoint

packages/
  api-contract/     → Zod request schemas, response types, domain error classes
  clinical/         → Clinical domain services (e.g. chart note templates)
  db/               → Drizzle ORM schemas, migrations, DB client, seed script
  inngest/          → Inngest client + event-driven background functions
  scheduling/       → Domain commands (e.g. startSession) — pure business logic
```

Brief description of dependency direction: `apps/api` → `packages/*`, packages reference each other where needed (e.g., `scheduling` → `db`, `api-contract`).

**7. Domain Model**

Appointment state machine diagram (text or mermaid):

```
scheduled → in_session → awaiting_completion → completed
    ↓                                            
 canceled / no_show
```

Entities: clinics, practitioners, patients, appointments, sessions.

**8. Available Scripts**

| Command | Description |
|---|---|
| `pnpm dev` | Start all apps in dev mode |
| `pnpm build` | Build all packages |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format code with Prettier |
| `pnpm format:check` | Check formatting (CI) |
| `pnpm test` | Run Vitest |
| `pnpm start:postgres` | Start PostgreSQL Docker container |
| `pnpm stop:postgres` | Stop and remove PostgreSQL container |

**9. Near-Term Roadmap**
- Hexagonal architecture refactor: repository interfaces (ports) for domain commands
- Test suite: domain unit → adapter integration → route E2E
- Authentication: replace `HARDCODED_PRACTITIONER_ID`
- `@careos/fixtures` package for shared test data

**10. Contributing**
- Branch naming convention (if established — check git log)
- Commit message style: conventional commits (`feat:`, `fix:`, `chore:`)
- Pre-push hooks via Lefthook: typecheck + lint + format:check run in parallel
- CI: Quality Gate (blocking) + Tests (non-blocking until baseline exists)

- **Estimated effort:** ~30 min
- **Success criteria:** A new developer can go from clone to running dev server using only README instructions

---

#### Phase 2: CLAUDE.md

Create `CLAUDE.md` with the following sections in order:

**1. Project overview** (2-3 lines max)
- Healthcare ops platform, appointment lifecycle, clinical sessions
- Backend only — no UI in this repo
- v0 — patterns and APIs will change

**2. Commands**

```
# Development
pnpm dev              # all apps in dev mode
pnpm build            # build all packages
pnpm typecheck        # TypeScript checking
pnpm lint             # ESLint
pnpm format           # Prettier format
pnpm format:check     # Prettier check (CI)
pnpm test             # Vitest

# Database
pnpm start:postgres   # Docker PostgreSQL :5432
pnpm stop:postgres    # stop + remove container

# Per-package
pnpm --filter @careos/api dev
pnpm --filter @careos/db typecheck
```

**3. Monorepo layout**

List each package with a one-line purpose and its key exports. Include dependency direction rules:
- `apps/api` → imports from all `packages/*`
- `packages/scheduling` → imports from `db`, `api-contract`
- `packages/inngest` → imports from `db`
- `packages/api-contract` → standalone, no internal deps
- `packages/clinical` → standalone
- `packages/db` → standalone (exposes schema, client, types)

**4. Architecture patterns**

- Business logic lives in `packages/scheduling` as pure domain commands
- Domain commands accept `DrizzleDB` as a parameter (will be replaced with repository interfaces/ports)
- Routes in `apps/api/src/routes/` handle HTTP concerns only: validate → execute domain command → emit events → respond
- Error handling: domain errors extend `DomainError` from `api-contract`, caught by Hono error handler
- Background jobs: Inngest event-driven functions in `packages/inngest`
- Validation: Zod schemas in `api-contract`, used at route boundaries

**5. Code conventions**

- TypeScript 6.0 with `strict: true` (via `tseslint.configs.strictTypeChecked`)
- Prettier: single quotes, no semicolons, 100 char width, trailing commas
- ESLint: `drizzle/enforce-delete-with-where` and `drizzle/enforce-update-with-where` are errors — every `.update()` and `.delete()` must have `.where()`
- Zod v4 for all validation — no manual type guards
- Drizzle ORM for all DB access — no raw SQL
- Env vars parsed with Zod schemas at module load time (`env.ts` files)

**6. Known constraints / gotchas**

- **NEVER import `apps/api/src/index.ts` in tests** — it calls `serve()` at module load time, starting HTTP servers. Import route modules directly and use `app.request()`.
- **`packages/db/src/index.ts` creates a DB connection at import time** — tests must stub `DATABASE_URL` in setup files before importing.
- **`apps/api/src/env.ts` parses `PORT` eagerly** — test setup must provide env vars before import.
- **`HARDCODED_PRACTITIONER_ID`** in `apps/api/src/routes/scheduling.ts` — auth is not implemented. Do not build auth flows yet.
- **No `.env.example` files may exist** — check and document required vars inline.

**7. Security rules**

- NEVER hardcode credentials, API keys, tokens, or secrets in source files
- NEVER commit `.env` files (already in `.gitignore`)
- All secrets must be provided via environment variables
- Database credentials only via `DATABASE_URL`
- When adding new secrets, add them to the relevant `env.ts` Zod schema

**8. Near-term intent (do not contradict)**

- **Repository interfaces (ports)** will be introduced in `packages/scheduling` before tests are written — do not create test mocks for `DrizzleDB` directly
- **Test pyramid**: domain unit tests (pure functions) → adapter integration tests (real DB) → route tests (`app.request()`) — do not create E2E tests with HTTP clients
- **`@careos/fixtures` package** is planned for shared test data — do not create per-package fixture files
- **Inngest Dev Server** is used for manual debugging of background functions — `INNGEST_DEV=1`
- **`apps/api/src/index.ts` must never be imported in tests** — test setup uses `app.request()` on route modules

**9. CI/CD**

- Quality Gate (blocking): build → typecheck → lint → format:check
- Tests (non-blocking): run and report, never block merge — will become blocking once meaningful test baseline exists
- Pre-push hooks (Lefthook): typecheck + lint + format:check in parallel

- **Estimated effort:** ~30 min
- **Success criteria:** An AI agent can read CLAUDE.md and correctly avoid all known pitfalls without additional context

---

#### Phase 3: Validation & Polish

- Verify README quick start works end-to-end (clone → install → start → health check)
- Verify all commands listed actually work
- Check `.env` files — if no `.env.example` exists, create them or document required vars in README
- Cross-check CLAUDE.md constraints against actual code (file paths, import patterns)
- Ensure both docs are internally consistent with each other and with the codebase

- **Estimated effort:** ~15 min
- **Success criteria:** Both docs are accurate, complete, and pass a fresh-eyes review

## Alternative Approaches Considered

| Approach | Verdict | Reason |
|---|---|---|
| **B: CLAUDE.md as single source** | Rejected | README serves a different audience (stakeholders) with different format needs (narrative) |
| **C: README-first, CLAUDE.md as delta** | Rejected | Agents benefit from self-contained docs — shouldn't need to read README first |

(see brainstorm: `docs/brainstorms/2026-04-01-documentation-brainstorm.md`)

## System-Wide Impact

### Interaction Graph

Documentation-only change. No runtime behavior affected.

### Error & Failure Propagation

N/A — no code changes.

### State Lifecycle Risks

N/A — no data mutations.

### API Surface Parity

N/A — no API changes.

### Integration Test Scenarios

1. **Fresh clone test**: Follow README from scratch — does `pnpm install` + `pnpm start:postgres` + env setup + `pnpm dev` result in a running server?
2. **Agent constraint test**: Does an AI agent reading only CLAUDE.md correctly avoid importing `apps/api/src/index.ts` in tests?
3. **Health check**: After quick start, does `curl localhost:3000/health` return `{"status":"ok"}`?

## Acceptance Criteria

### Functional Requirements

- [x] `README.md` exists at repo root with all sections from Phase 1
- [x] `CLAUDE.md` exists at repo root with all sections from Phase 2
- [ ] Quick start instructions in README produce a running dev server
- [x] All commands listed in both docs are accurate and functional
- [x] Environment variables documented match actual `env.ts` schemas
- [x] Monorepo structure matches actual directory layout
- [x] Domain model description matches DB schema

### Non-Functional Requirements

- [x] README uses welcoming narrative prose — not a bullet dump
- [x] CLAUDE.md uses terse imperative bullets — not prose
- [x] Both docs acknowledge v0 state explicitly
- [x] Near-term intent sections don't promise timelines — just direction
- [x] No stale references (all file paths verified against codebase)

### Quality Gates

- [ ] README quick start tested from scratch
- [x] CLAUDE.md constraints cross-checked against source files
- [x] Both files pass `pnpm format:check` (Prettier)

## Success Metrics

- A new developer can go from `git clone` to a running API in under 10 minutes using only the README
- An AI agent reading CLAUDE.md avoids all known pitfalls (server import, env parsing, auth placeholder) without additional prompting

## Dependencies & Prerequisites

- None — purely additive, no code changes required
- May need to create `.env.example` files if they don't exist (currently only `.env` files exist — check if they're gitignored)

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Docs become stale as codebase evolves | High | Medium | Keep docs minimal and structural — avoid documenting implementation details that change frequently |
| Quick start instructions fail on fresh machine | Medium | High | Test instructions end-to-end before merging |
| CLAUDE.md constraints become outdated | Medium | High | Review CLAUDE.md whenever architecture changes (e.g., hexagonal refactor, auth implementation) |

## Resource Requirements

- Single developer, ~1 hour total
- No infrastructure changes

## Future Considerations

- When auth is implemented: update both docs to remove hardcoded practitioner references
- When hexagonal refactor lands: update CLAUDE.md architecture section (ports pattern, testing approach)
- When test suite exists: update README contributing section and CLAUDE.md test commands
- Consider per-package `CLAUDE.md` files if packages grow complex enough to warrant their own agent guidance

## Documentation Plan

This plan _is_ the documentation plan — the deliverables are the docs themselves.

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-04-01-documentation-brainstorm.md](docs/brainstorms/2026-04-01-documentation-brainstorm.md) — Key decisions: two independent docs (Approach A), README leans contributor-focused, CLAUDE.md covers architecture + conventions + security + commands, near-term intent included explicitly

### Internal References

- Monorepo root config: [package.json](package.json), [turbo.json](turbo.json), [pnpm-workspace.yaml](pnpm-workspace.yaml)
- ESLint config: [eslint.config.ts](eslint.config.ts)
- Prettier config: [.prettierrc](.prettierrc)
- Git hooks: [lefthook.yml](lefthook.yml)
- API entry: [apps/api/src/index.ts](apps/api/src/index.ts)
- DB env schema: [packages/db/src/env.ts](packages/db/src/env.ts)
- API env schema: [apps/api/src/env.ts](apps/api/src/env.ts)
- Domain command example: [packages/scheduling/src/commands/start-session.ts](packages/scheduling/src/commands/start-session.ts)
- Route example: [apps/api/src/routes/scheduling.ts](apps/api/src/routes/scheduling.ts)
- DB schema: [packages/db/src/schema/scheduling.ts](packages/db/src/schema/scheduling.ts)
- CI workflow: [.github/workflows/ci.yml](.github/workflows/ci.yml)
- Testing brainstorm: [docs/brainstorms/2026-04-01-debugging-testing-brainstorm.md](docs/brainstorms/2026-04-01-debugging-testing-brainstorm.md)
