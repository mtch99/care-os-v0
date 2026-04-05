# careOS v0

Healthcare operations platform — appointment lifecycle and clinical session management for practitioners seeing patients at clinics.

> **v0** — actively evolving. APIs, schema, and patterns will change.

## What is careOS?

careOS manages the core workflow of a clinical visit: scheduling appointments, transitioning them through a state machine, creating sessions when a practitioner starts seeing a patient, and capturing chart notes. It is a backend API and background job processing layer — there is no UI in this repo.

## Tech Stack

| Concern         | Technology                                     |
| --------------- | ---------------------------------------------- |
| Runtime         | Node.js 22, TypeScript 6.0                     |
| HTTP            | Hono + @hono/node-server                       |
| Database        | PostgreSQL, Drizzle ORM                        |
| Background jobs | Inngest (event-driven)                         |
| Validation      | Zod v4                                         |
| Monorepo        | pnpm 10 + Turborepo                            |
| Linting         | ESLint v10 (strict type-checked)               |
| Formatting      | Prettier                                       |
| Git hooks       | Lefthook (pre-push)                            |
| Testing         | Vitest v4                                      |
| CI              | GitHub Actions                                 |

## Prerequisites

- [Node.js](https://nodejs.org/) 22 (auto-selected if you use nvm, fnm, or mise — see `.node-version`)
- [pnpm](https://pnpm.io/) 10.12.4+
- [Docker](https://www.docker.com/) (for PostgreSQL via Docker Compose)

## Quick Start

```bash
# 1. Copy environment files (defaults work with the Docker Compose Postgres)
cp packages/db/.env.example packages/db/.env
cp apps/api/.env.example apps/api/.env

# 2. Install deps, start Postgres, run migrations, and seed
pnpm bootstrap

# 3. Start the dev server
pnpm dev
```

The API runs at `http://localhost:3000`. Verify with:

```bash
curl http://localhost:3000/health
# → {"status":"ok"}
```

### Environment Variables

See `packages/db/.env.example` and `apps/api/.env.example` for defaults. Copy them to `.env` and adjust as needed.

**`packages/db/.env`** (required)

| Variable             | Required | Default | Description                  |
| -------------------- | -------- | ------- | ---------------------------- |
| `DATABASE_URL`       | Yes      | —       | PostgreSQL connection string |
| `DB_POOL_MAX`        | No       | —       | Max pool connections         |
| `DB_IDLE_TIMEOUT`    | No       | —       | Idle connection timeout (ms) |
| `DB_CONNECT_TIMEOUT` | No       | —       | Connection timeout (ms)      |
| `DB_SSL`             | No       | —       | Enable SSL (`true`/`false`)  |

**`apps/api/.env`** (optional)

| Variable | Required | Default | Description      |
| -------- | -------- | ------- | ---------------- |
| `PORT`   | No       | 3000    | HTTP server port |

## Monorepo Structure

```
apps/
  api/                → Hono HTTP server, routes, Inngest webhook endpoint

packages/
  api-contract/       → Zod request schemas, response types, domain error classes
  clinical/           → TemplateSchema value object, semantic validation
  db/                 → Drizzle ORM schemas, migrations, DB client, seed script
  inngest/            → Inngest client + event-driven background functions
  scheduling/         → Domain commands (e.g. startSession) — pure business logic
```

`apps/api` imports from all packages. Packages reference each other where needed (e.g., `scheduling` imports from `db` and `api-contract`).

## Domain Model

### Appointment State Machine

```
scheduled ──→ in_session ──→ awaiting_completion ──→ completed
    │
    ├──→ canceled
    └──→ no_show
```

### Entities

- **Clinics** — healthcare facilities
- **Practitioners** — clinicians belonging to a clinic
- **Patients** — individuals receiving care
- **Appointments** — scheduled visits with status tracking
- **Sessions** — active clinical encounters (created when an appointment transitions to `in_session`)
- **Chart Notes** — clinical documentation attached to sessions, using templates

## Available Scripts

| Command                | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `pnpm bootstrap`           | Full bootstrap: install, start Postgres, migrate, seed |
| `pnpm dev`             | Start all apps in dev mode                        |
| `pnpm build`           | Build all packages                                |
| `pnpm typecheck`       | Run TypeScript type checking                      |
| `pnpm lint`            | Run ESLint across all packages                    |
| `pnpm format`          | Format code with Prettier                         |
| `pnpm format:check`    | Check formatting without modifying files          |
| `pnpm test`            | Run Vitest test suite                             |
| `pnpm db:up`           | Start PostgreSQL via Docker Compose               |
| `pnpm db:down`         | Stop PostgreSQL (data persisted in volume)        |
| `pnpm db:nuke`         | Stop PostgreSQL and delete all data               |
| `pnpm db:migrate`      | Generate new migration (drizzle-kit generate)     |
| `pnpm db:migrate:apply` | Apply pending migrations (drizzle-kit migrate)   |
| `pnpm db:seed`         | Seed the database                                 |

Run a command for a specific package:

```bash
pnpm --filter @careos/api dev
pnpm --filter @careos/db typecheck
```

## Background Jobs (Inngest)

careOS uses [Inngest](https://www.inngest.com/) for event-driven background processing. When a domain action occurs (e.g., a session starts), the API emits an Inngest event, and background functions in `packages/inngest` handle side effects asynchronously.

The API starts an Inngest webhook endpoint on port `9376` automatically in dev mode (`INNGEST_DEV=1` is set by the dev script). To inspect and debug background functions locally, run the Inngest Dev Server:

```bash
pnpm --filter @careos/inngest dev
```

This opens a local dashboard where you can see events, function runs, and replay failures.

## Near-Term Roadmap

- **Hexagonal architecture refactor** — introduce repository interfaces (ports) in `packages/scheduling` to decouple domain logic from Drizzle
- **Test suite** — domain unit tests → adapter integration tests → route tests, following a test pyramid
- **Authentication** — replace the hardcoded practitioner ID with real auth
- **`@careos/fixtures` package** — shared test data for consistent testing across packages

## Editor Setup (VS Code)

Open the repo in VS Code and accept the recommended extensions prompt (ESLint + Prettier). Workspace settings enable format-on-save and ESLint auto-fix, so your code always matches the CI quality gate.

## Contributing

### Commit Messages

This project uses [conventional commits](https://www.conventionalcommits.org/):

```
feat(scheduling): add appointment cancellation
fix(db): correct migration ordering
chore(tooling): update ESLint config
```

### Pre-Push Hooks

[Lefthook](https://github.com/evilmartians/lefthook) runs these checks in parallel before each push:

- `pnpm turbo typecheck`
- `pnpm turbo lint`
- `pnpm turbo format:check`

All three must pass before code can be pushed.

### CI Pipeline

- **Quality Gate** (blocking): build → typecheck → lint → format:check
- **Tests** (blocking): runs `pnpm turbo test` — fails the pipeline on test failures
