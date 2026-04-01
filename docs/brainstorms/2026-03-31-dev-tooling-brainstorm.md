# Dev Tooling Setup — Brainstorm

**Date:** 2026-03-31
**Status:** Ready for Planning
**Scope:** Linting, formatting, type-checking gates, CI, and test infrastructure (dev/debugging is a separate thread)

---

## What We're Building

A complete developer tooling layer for the careOS v0 monorepo that enforces code quality for both human and AI agents. This covers: lint + format enforcement, pre-push type-checking gates, branch protection, GitHub Actions CI pipeline, and test framework scaffolding.

---

## Why This Approach

The repo is a clean slate (pnpm + Turborepo, TypeScript configured, nothing else). This is the right moment to put all tooling in place before complexity accumulates. The goal is a setup that's strict enough to catch real issues but not so strict it creates friction — particularly for AI agents who benefit from deterministic, fast feedback loops.

---

## Key Decisions

### 1. Linting + Formatting: ESLint + Prettier

- **ESLint** with the flat config format (`eslint.config.ts` at root) using `typescript-eslint` strict type-checked rules
- **Prettier** with a root `.prettierrc` (shared across all packages)
- Single shared ESLint config at the root; packages may extend for package-specific rules but must not override shared rules
- Rationale: broader plugin ecosystem (e.g. `eslint-plugin-drizzle` for query safety rules), well-understood by AI agents, industry standard

### 2. Git Hooks: Lefthook

- Pre-push hook runs `typecheck` + `lint` + `format:check` in parallel via Turbo
- Push to `master` is blocked at the GitHub level (branch protection), not just hooks — hooks can be bypassed with `--no-verify` in emergencies
- Lefthook chosen for: zero-dependency install, monorepo-native, parallel execution, single `lefthook.yml` at root

### 3. Type-checking Gate: Hard on push, hard on CI

- Pre-push: `pnpm turbo typecheck` (blocks the push)
- On CI (PR): `typecheck` is a required status check — PRs cannot merge without it passing
- TypeScript 6.0.2 is already configured with `strict: true` across all packages

### 4. CI Platform: GitHub Actions

Two jobs on every PR:
1. **Quality** (blocking): lint + typecheck + format:check
2. **Tests** (non-blocking / soft check): runs Vitest but never blocks merge

On deploy pipelines, the same quality job is required (hard gate). Tests are soft — they run and report but won't block a deploy if failing.

### 5. Test Framework: Vitest

- Vitest installed and configured (root `vitest.config.ts` or shared workspace config)
- Test scripts wired into Turbo pipeline
- No tests written yet — this is infrastructure scaffolding only
- Non-blocking on CI for now; expected to become a required check once a meaningful baseline of tests exists (decision deferred to a later brainstorm)

---

## Open Questions

None.

---

## Resolved Questions

- **Lint tool**: ESLint + Prettier (not Biome) — plugin ecosystem and AI familiarity wins
- **Hook manager**: Lefthook — monorepo-native, parallel, fast
- **Test bypass strategy**: Soft check (non-blocking) — tests always run but never block merges
- **CI platform**: GitHub Actions
- **Test framework**: Vitest — native ESM, TypeScript-first, fast watch mode, compatible with Turbo's task pipeline; no separate Babel/Jest transform config needed
- **Drizzle lint plugin**: `eslint-plugin-drizzle` included from the start — already using Drizzle heavily, catches destructive query bugs
- **Frontend ESLint rules**: React + Next.js rules pre-included — Next.js app is planned and the one-time setup cost is negligible; deferring would mean revisiting a working ESLint config later
- **Prettier integration**: Separate tools (not as ESLint plugin) — ESLint for code rules, Prettier for formatting, run independently via Turbo
- **Vitest config structure**: `vitest.workspace.ts` at root referencing per-package configs — monorepo isolation, idiomatic Vitest setup

---

## Scope Boundary

Dev environment + debugging/manual-testing tooling is intentionally excluded — that will be its own brainstorm thread.
