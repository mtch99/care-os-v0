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

# Database
pnpm start:postgres                   # Docker PostgreSQL on :5432 (password: careos)
pnpm stop:postgres                    # stop + remove container
pnpm --filter @careos/db migrate      # generate migrations (drizzle-kit generate)
pnpm --filter @careos/db migrate:apply # apply migrations (drizzle-kit migrate)
pnpm --filter @careos/db seed         # seed database (tsx)

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
  clinical/         → Clinical domain services (chart note template resolution)
  db/               → Drizzle schemas, migrations, DB client, seed script (@careos/db)
  inngest/          → Inngest client, event definitions, background functions (@careos/inngest)
  scheduling/       → Domain commands (startSession) — pure business logic (@careos/scheduling)
```

### Dependency Direction

- `apps/api` → imports from all `packages/*`
- `packages/scheduling` → `db`, `api-contract`
- `packages/inngest` → `clinical`
- `packages/api-contract` → standalone, no internal deps
- `packages/clinical` → standalone
- `packages/db` → standalone

Do not introduce circular dependencies between packages.

## Architecture Patterns

- Business logic lives in `packages/scheduling` as domain commands (pure functions taking `DrizzleDB`)
- Domain commands will be refactored to accept repository interfaces (ports) — do not create mocks for `DrizzleDB` directly
- Routes in `apps/api/src/routes/` handle HTTP only: validate input → execute domain command → emit Inngest events → respond
- Domain errors extend `DomainError` from `api-contract` — caught by Hono's `app.onError()` handler
- Background jobs are Inngest event-driven functions in `packages/inngest`
- All validation uses Zod schemas from `api-contract` at route boundaries

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
- **`.env` files are gitignored** — no `.env.example` files exist. Required vars: `DATABASE_URL` (packages/db), `PORT` (apps/api, optional, defaults 3000).

## Security Rules

- NEVER hardcode credentials, API keys, tokens, or secrets in source files
- NEVER commit `.env` files (gitignored)
- All secrets via environment variables only
- Database credentials only via `DATABASE_URL`
- When adding new secrets, add them to the relevant `env.ts` Zod schema

## Near-Term Intent (Do Not Contradict)

- **Repository interfaces (ports)** will be introduced in `packages/scheduling` before tests are written — do not create test mocks for `DrizzleDB` directly
- **Test pyramid**: domain unit tests (pure functions) → adapter integration tests (real DB) → route tests (`app.request()`) — do not create E2E tests with HTTP clients
- **`@careos/fixtures` package** is planned for shared test data — do not create per-package fixture files
- **Inngest Dev Server** for manual debugging of background functions — `pnpm --filter @careos/inngest dev`

## CI/CD

- **Quality Gate** (blocking): build → typecheck → lint → format:check
- **Tests** (non-blocking): run and report, never block merge — will become blocking once meaningful baseline exists
- **Pre-push hooks** (Lefthook): typecheck + lint + format:check in parallel
