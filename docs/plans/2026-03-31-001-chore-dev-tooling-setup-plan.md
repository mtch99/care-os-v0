---
title: Setup Dev Tooling (ESLint, Prettier, Lefthook, Vitest, GitHub Actions CI)
type: chore
status: completed
date: 2026-03-31
origin: docs/brainstorms/2026-03-31-dev-tooling-brainstorm.md
---

# Setup Dev Tooling

## Overview

Wire up the full developer tooling layer for the careOS v0 monorepo: ESLint + Prettier for code quality and formatting, Lefthook for pre-push enforcement, Vitest with workspace config for test infrastructure, and GitHub Actions CI for automated quality gates. This is a greenfield setup — none of these tools exist yet.

Implemented in 5 phases. Each phase is self-contained and mergeable.

---

## Problem Statement

The repo is a clean pnpm + Turborepo scaffold with TypeScript configured but zero tooling beyond the build pipeline. Without linting, formatting, type-checking gates, and CI:

- Inconsistent code style between AI-generated and human-written code
- No automated prevention of type errors or ORM misuse (e.g., unbounded `DELETE` queries)
- No barrier to pushing broken code to the main branch
- Tests cannot be written because the framework isn't installed

---

## Proposed Solution

Five phases, each independently shippable:

1. **Foundation fixes + Turbo pipeline** — fix a pre-existing typo bug, add missing Turbo tasks, add per-package scripts
2. **ESLint + Prettier** — install and configure linting and formatting
3. **Lefthook** — pre-push hook enforcement
4. **Vitest** — test framework scaffolding (no tests yet, just infrastructure)
5. **GitHub Actions CI** — automated quality gate and soft test check

One manual post-setup step: enable GitHub branch protection on `master`.

---

## Technical Approach

### Phase 1 — Foundation Fixes + Turbo Pipeline

**Files to change:**

#### Fix pre-existing bug

`packages/clinical/package.json` has a typo (`"typechext"` instead of `"typecheck"`) that silently causes `@careos/clinical` to be skipped by `turbo run typecheck`. Fix this first so the typecheck baseline is accurate before adding more gates.

```diff
- "typechext": "tsc --noEmit",
+ "typecheck": "tsc --noEmit",
```

#### Add Turbo tasks (`turbo.json`)

Add four new tasks. Key design constraint: **`lint` must `dependsOn: ["^build"]`** because `typescript-eslint` type-aware rules resolve types from workspace packages' emitted `dist/` declaration files. Without building first, `@careos/db`, `@careos/api-contract`, etc. won't have types resolvable and linting will error.

```json
"lint": {
  "dependsOn": ["^build"],
  "outputs": []
},
"format": {
  "outputs": []
},
"format:check": {
  "outputs": []
},
"test": {
  "dependsOn": ["^build"],
  "outputs": ["coverage/**"],
  "cache": true
}
```

#### Add per-package scripts

Every package (`apps/api`, `packages/api-contract`, `packages/clinical`, `packages/db`, `packages/inngest`, `packages/scheduling`) needs these four scripts added to its `package.json`:

```json
"lint": "eslint src",
"format": "prettier --write src",
"format:check": "prettier --check src",
"test": "vitest run"
```

---

### Phase 2 — ESLint + Prettier

#### Root devDependencies to install

```
eslint
@eslint/js
typescript-eslint
eslint-plugin-drizzle
eslint-plugin-react
eslint-plugin-react-hooks
@next/eslint-plugin-next
eslint-config-prettier
prettier
```

#### `eslint.config.ts` (root)

Use ESLint v9 flat config format. Key design decisions (see brainstorm: `docs/brainstorms/2026-03-31-dev-tooling-brainstorm.md`):

- `typescript-eslint` strict type-checked rules
- `parserOptions.projectService: true` — uses TypeScript Language Service API (faster than `project: true`, supported in typescript-eslint v8)
- **Do NOT use `parserOptions.project` with `node16` — the repo uses `moduleResolution: "bundler"`.** Using `projectService` avoids false-positive import errors that arise from moduleResolution mismatch
- `eslint-plugin-drizzle` scoped globally (all packages use Drizzle or may in future)
- React/Next.js rules scoped to `apps/**/*.tsx` files only — not applied to backend packages
- `eslint-config-prettier` as the final config entry to disable all formatting rules (Prettier owns those)

Structure:

```
eslint.config.ts                  ← root flat config
packages/db/src/
packages/api-contract/src/
... (no per-package eslint configs needed initially)
```

#### `.prettierrc` (root)

Shared across all packages — no per-package overrides.

```json
{
  "singleQuote": true,
  "semi": false,
  "printWidth": 100,
  "trailingComma": "all"
}
```

#### `.prettierignore` (root)

```
**/dist/**
**/node_modules/**
**/coverage/**
pnpm-lock.yaml
```

#### Add `format` script to root `package.json`

```json
"format": "turbo run format",
"format:check": "turbo run format:check"
```

---

### Phase 3 — Lefthook

#### Root devDependency

```
lefthook
```

After install, run `pnpm lefthook install` to register the hooks in `.git/hooks/`.

#### `lefthook.yml` (root)

Pre-push hook runs all three checks in parallel via Turbo. Push is blocked if any fail. Hooks can be bypassed with `--no-verify` for emergencies (branch protection on GitHub is the hard backstop).

```yaml
pre-push:
  parallel: true
  commands:
    typecheck:
      run: pnpm turbo typecheck
    lint:
      run: pnpm turbo lint
    format-check:
      run: pnpm turbo format:check
```

#### `.gitignore` addition

Add `.lefthook-local.yml` so developers can locally override hook behavior without committing changes.

---

### Phase 4 — Vitest

#### Root devDependency

```
vitest
@vitest/coverage-v8  (for optional coverage reports)
```

Vitest is also a devDependency in each package that will have tests (all packages, wired up now even though no tests exist yet).

#### `vitest.workspace.ts` (root)

```typescript
import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  'apps/*/vitest.config.ts',
  'packages/*/vitest.config.ts',
])
```

#### Per-package `vitest.config.ts` (minimal)

Each package gets a `vitest.config.ts`. Most are identical:

```typescript
// e.g. packages/api-contract/vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
  },
})
```

#### ⚠️ Env var setup files — required for packages with eager env parsing

`packages/db/src/env.ts` and `apps/api/src/env.ts` both call `schema.parse(process.env)` at module load time. Any test that imports these modules (directly or transitively) will throw unless the required vars are present.

**Affected packages:**
- `packages/db` — requires `DATABASE_URL`
- `apps/api` — requires `PORT` (has a default, so less critical), transitively imports `@careos/db`

Each affected package needs a `src/test/setup.ts`:

```typescript
// packages/db/src/test/setup.ts
process.env.DATABASE_URL = 'postgres://localhost:5432/careos_test'
```

And its `vitest.config.ts` references it:

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

#### ⚠️ `apps/api` test constraint — never import `index.ts`

`apps/api/src/index.ts` calls `serve()` at the module top level, which starts two HTTP servers on import. Tests in `apps/api` **must import route modules directly** (e.g. `import { schedulingRoutes } from './routes/scheduling'`) and test them with Hono's `app.request()` method — never import `index.ts`.

Document this constraint in a comment at the top of `apps/api/vitest.config.ts`.

---

### Phase 5 — GitHub Actions CI

#### `.github/workflows/ci.yml`

Two jobs:

1. **`quality`** — blocking required status check: build → typecheck → lint → format:check
2. **`tests`** — non-blocking (`continue-on-error: true`, not listed as required in branch protection): build → test

```yaml
name: CI

on:
  pull_request:
    branches: [master]
  push:
    branches: [master]

jobs:
  quality:
    name: Quality Gate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: '10.12.4'
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - name: Cache Turbo
        uses: actions/cache@v4
        with:
          path: .turbo
          key: turbo-${{ runner.os }}-${{ github.sha }}
          restore-keys: turbo-${{ runner.os }}-
      - run: pnpm turbo build
      - run: pnpm turbo typecheck
      - run: pnpm turbo lint
      - run: pnpm turbo format:check

  tests:
    name: Tests
    runs-on: ubuntu-latest
    continue-on-error: true        # non-blocking — see brainstorm decision
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: '10.12.4'
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo build
      - run: pnpm turbo test
```

---

### Manual Step — GitHub Branch Protection

After the CI workflow is live, enable branch protection on `master` via GitHub repository settings:

- Require PR before merging (no direct push)
- Required status checks: `Quality Gate` (the `quality` job)
- Do NOT add `Tests` as a required check
- Allow force-push: disabled
- Allow deletions: disabled

This is a one-time GitHub UI change — it cannot be codified in the repo.

---

## System-Wide Impact

### Interaction Graph

`pnpm push` → Lefthook pre-push → `turbo typecheck + lint + format:check` → if any fail, push is blocked → CI mirrors the same checks on GitHub → Quality Gate status check must pass before PR can merge → GitHub branch protection prevents direct push to `master`.

The `lint` task depends on `^build`, which means linting a package triggers builds of all its workspace dependencies first. A change to `@careos/api-contract` will cause `@careos/api`, `@careos/scheduling` to rebuild before their lint runs.

### State Lifecycle Risks

- If `lefthook install` is not run after `pnpm install`, the pre-push hook won't be registered. Consider adding `lefthook install` to the root `package.json` `postinstall` script.
- The Turbo `lint` task's dependency on `^build` means the first lint run is slow (full build of all deps). Subsequent runs are cached. Document this for AI agents so they don't assume lint is always fast.

### Integration Test Scenarios

- A new developer clones the repo, runs `pnpm install` → hooks should auto-register via postinstall
- A developer pushes with `--no-verify` → CI still catches quality issues on the PR
- A PR fails `tests` but passes `quality` → PR is mergeable (soft check behavior)
- A PR fails `quality` (e.g. lint error) → PR cannot merge (required status check)

---

## Acceptance Criteria

### Phase 1
- [x] `packages/clinical/package.json` has `"typecheck"` (not `"typechext"`)
- [x] `pnpm turbo typecheck` runs all 6 packages including `@careos/clinical`
- [x] `turbo.json` has `lint`, `format`, `format:check`, `test` tasks
- [x] All 6 packages have `lint`, `format`, `format:check`, `test` scripts in their `package.json`

### Phase 2
- [x] `pnpm turbo lint` runs without errors on the current codebase
- [x] `pnpm turbo format:check` runs without errors on the current codebase
- [x] `eslint-plugin-drizzle` rules are active (verify by temporarily removing a `.where()` clause and confirming a lint error)
- [x] React/Next.js rules only apply to `apps/web/**` files (scoped away from backend packages)
- [x] Prettier format is consistent across all packages

### Phase 3
- [x] `lefthook install` registers hooks in `.git/hooks/pre-push`
- [x] Pushing with a lint error is blocked
- [x] `git push --no-verify` bypasses the hook (emergency escape hatch works)
- [x] `.lefthook-local.yml` is in `.gitignore`

### Phase 4
- [x] `pnpm turbo test` completes without error (all packages report 0 tests, not errors)
- [x] `packages/db` and `apps/api` test configs have setup files that stub required env vars
- [x] `apps/api/vitest.config.ts` has a comment warning against importing `index.ts` in tests

### Phase 5
- [x] `.github/workflows/ci.yml` exists
- [x] On a PR with a lint error, `quality` job fails and blocks merge
- [x] On a PR with a failing test (once tests exist), `tests` job fails but PR remains mergeable
- [x] `pnpm` version in CI matches `packageManager` field (`10.12.4`)

### Manual
- [ ] `master` branch has protection enabled with `Quality Gate` as required status check

---

## Dependencies & Risks

| Risk | Mitigation |
|---|---|
| `typescript-eslint` v8 compatibility with TypeScript 6.0.2 | As of early 2026 typescript-eslint v8 supports TS 6.x; pin to latest v8 and verify on install |
| `parserOptions.projectService` causing slow lint on large files | Acceptable at current codebase size; revisit if lint time exceeds 30s |
| `eslint-plugin-react` flat config API differences | Use `react.configs.flat.recommended` (v8+ API), not `react.configs.recommended` (legacy) |
| Lefthook hooks not auto-installing for new developers | Add `"postinstall": "lefthook install"` to root `package.json` |
| Turbo lint cache becoming stale after ESLint config changes | Turbo hashes config files; changing `eslint.config.ts` invalidates cache correctly |

---

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-03-31-dev-tooling-brainstorm.md](../brainstorms/2026-03-31-dev-tooling-brainstorm.md)
  - Key decisions carried forward: ESLint + Prettier (not Biome), Lefthook (not Husky), tests as soft check (non-blocking), `vitest.workspace.ts` for monorepo isolation

### Internal References

- Root TypeScript config: [tsconfig.base.json](../../tsconfig.base.json)
- Turbo pipeline: [turbo.json](../../turbo.json)
- Workspace definition: [pnpm-workspace.yaml](../../pnpm-workspace.yaml)
- Bug to fix: `packages/clinical/package.json` — `"typechext"` typo on the `typecheck` script
- Env validation pattern: [apps/api/src/env.ts](../../apps/api/src/env.ts), [packages/db/src/env.ts](../../packages/db/src/env.ts)
- Top-level server start (must not be imported in tests): [apps/api/src/index.ts](../../apps/api/src/index.ts)
