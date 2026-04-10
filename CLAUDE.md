# CLAUDE.md

Healthcare ops platform — appointment lifecycle, clinical sessions, chart notes. Backend only, no UI. v0 — patterns and APIs will change.

## Commands

```bash
# Development
pnpm dev                # all apps in dev mode
pnpm build              # build all packages
pnpm typecheck          # TypeScript checking
pnpm lint               # ESLint
pnpm format             # Prettier format
pnpm format:check       # Prettier check (CI)
pnpm test               # Vitest

# Database (Docker Compose)
pnpm db:up             # start PostgreSQL (docker compose, port 5432)
pnpm db:down           # stop PostgreSQL (data persisted)
pnpm db:nuke           # stop + delete volume (fresh start)
pnpm db:migrate        # generate migrations (drizzle-kit generate)
pnpm db:migrate:apply  # apply migrations (drizzle-kit migrate)
pnpm db:seed           # seed database (tsx)

# Lifecycle
pnpm start                 # bootstrap + dev (all-in-one)
pnpm stop                  # stop dev services + PostgreSQL
pnpm bootstrap             # install → db:up → db:migrate:apply → db:seed
pnpm teardown              # nuke DB + remove all node_modules

# Per-package scoping
pnpm --filter @careos/api dev
pnpm --filter @careos/db typecheck
pnpm --filter @careos/scheduling lint
```

## Monorepo Layout

```
apps/
  api/              → Hono HTTP server, routes, Inngest webhook (@careos/api)

packages/
  api-contract/     → Zod request schemas, response types, DomainError classes
  clinical/         → TemplateSchema value object, semantic validation (@careos/clinical)
  db/               → Drizzle schemas, migrations, DB client, seed script (@careos/db)
  inngest/          → Inngest client, event definitions, background functions (@careos/inngest)
  scheduling/       → Domain commands (startSession) — pure business logic (@careos/scheduling)
```

### Dependency Direction

- `apps/api` → imports from all `packages/*`
- `packages/scheduling` → `db`, `api-contract`
- `packages/clinical` → `api-contract`, `zod`
- `packages/inngest` → `clinical`
- `packages/api-contract` → standalone, no internal deps
- `packages/db` → standalone (type-only import from `api-contract` for fixture types)

Do not introduce circular dependencies between packages.

## Architecture Patterns

- Business logic lives in `packages/scheduling` as domain commands (pure functions taking `DrizzleDB`)
- Domain commands will be refactored to accept repository interfaces (ports) — do not create mocks for `DrizzleDB` directly
- Routes in `apps/api/src/routes/` handle HTTP only: validate input → execute domain command → emit Inngest events → respond
- Domain errors extend `DomainError` from `api-contract` — caught by Hono's `app.onError()` handler
- Background jobs are Inngest event-driven functions in `packages/inngest`
- Validation is two-pass: Zod structural schemas from `api-contract` at route boundaries (Pass 1), then `TemplateSchema.validate` from `clinical` for domain semantics like unique field keys and locale completeness (Pass 2)

## Code Conventions

- TypeScript 6.0, `strict: true` (via `tseslint.configs.strictTypeChecked`)
- Prettier: single quotes, no semicolons, 100 char width, trailing commas
- ESLint enforces `drizzle/enforce-delete-with-where` and `drizzle/enforce-update-with-where` as errors — every `.update()` and `.delete()` MUST have `.where()`
- Zod v4 for all validation — no manual type guards
- Drizzle ORM for all DB access — no raw SQL
- Env vars parsed with Zod schemas at module load time (see `env.ts` files)
- Conventional commits: `feat(scope):`, `fix(scope):`, `chore(scope):`

## Known Constraints

- **NEVER import `apps/api/src/index.ts` in tests** — it calls `serve()` at module load time, starting two HTTP servers (API on PORT, Inngest on 9376). Import route modules directly and use `app.request()`.
- **`packages/db/src/index.ts` creates a DB connection at import time** — tests must set `DATABASE_URL` in env before importing.
- **`apps/api/src/env.ts` parses `PORT` eagerly** — test setup must provide env vars before importing.
- **`HARDCODED_PRACTITIONER_ID`** in `apps/api/src/routes/scheduling.ts` — auth is not implemented. Do not build auth flows yet.
- **`.env` files are gitignored** — `.env.example` files exist in `packages/db/` and `apps/api/`. Copy to `.env` before running. Defaults work with the Docker Compose Postgres.

## Security Rules

- NEVER hardcode credentials, API keys, tokens, or secrets in source files
- NEVER commit `.env` files (gitignored)
- All secrets via environment variables only
- Database credentials only via `DATABASE_URL`
- When adding new secrets, add them to the relevant `env.ts` Zod schema

## Scripts

Manual curl test scripts live in `scripts/test-<branch>/`. They are committed with the executable bit (`chmod +x`) so every dev can run them directly after cloning — no extra setup needed.

```bash
# Run a single script
./scripts/test-car-102-templateschema/01-list-all-templates.sh

# Run all scripts in a test directory sequentially
for f in scripts/test-<branch>/*.sh; do bash "$f"; done
```

When generating new scripts, `chmod +x` before committing. Git tracks the executable bit via `core.fileMode`.

### Related Commands & Agents

- **`/generate-test-scripts`** — reads the current branch's route, schema, and seed changes, then generates a numbered set of curl scripts under `scripts/test-<branch>/` with a README
- **`integration-verifier` agent** — reads a phase spec or Linear issue, plans verification, then writes scripts + `CHECKLIST.md` covering happy paths, concurrency, idempotency, immutability guards, and more. It writes scripts only — the human runs them

## Near-Term Intent (Do Not Contradict)

- **Repository interfaces (ports)** will be introduced in `packages/scheduling` before tests are written — do not create test mocks for `DrizzleDB` directly
- **Test pyramid**: domain unit tests (pure functions) → adapter integration tests (real DB) → route tests (`app.request()`) — do not create E2E tests with HTTP clients
- **`@careos/fixtures` package** is planned for shared test data — `packages/db/src/fixtures/` exists as an interim location for seed fixtures (typed objects, no runtime deps on `clinical`). Migrate these to `@careos/fixtures` when that package is created
- **Inngest Dev Server** for manual debugging of background functions — `pnpm --filter @careos/inngest dev`

## CI/CD

- **Quality Gate** (blocking): build → typecheck → lint → format:check
- **Tests** (blocking): `pnpm turbo test` — fails the pipeline on test failures
- **Pre-push hooks** (Lefthook): typecheck + lint + format:check in parallel
