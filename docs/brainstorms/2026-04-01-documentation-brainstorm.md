---
title: Repository Documentation (README + CLAUDE.md)
type: brainstorm
status: complete
date: 2026-04-01
---

# Repository Documentation: README + CLAUDE.md

## What We're Building

Two independent, self-contained documentation files for the careOS v0 monorepo:

1. **`README.md`** — Human-facing: project overview, local setup, architecture tour, contribution guide, and near-term roadmap
2. **`CLAUDE.md`** — Agent-facing: commands cheatsheet, architecture patterns, code conventions, known constraints, security rules, and "never do X" guidance

Both docs acknowledge the v0/early state of the project and include near-term intent so readers (human or agent) don't work against the roadmap.

---

## Why This Approach

### Two independent docs (Approach A)

Each doc serves a distinct audience and stands alone — no cross-referencing required. Some overlap is intentional and acceptable.

**README.md for humans:**
- Developers joining the project need a single place to go from zero to running
- Stakeholders benefit from a high-level intro before diving into code
- Contributes to open-source conventions (expected file at repo root)

**CLAUDE.md for agents:**
- Agents need terse, actionable rules — not narrative prose
- Critical constraints (env var pitfalls, test import rules, security) are easy to miss from code alone
- Near-term architecture intent (hexagonal ports, test pyramid) prevents agents from implementing patterns that will be refactored away

**Why not DRY the two docs?**
- README and CLAUDE.md have different optimal formats (narrative vs. bullets/rules)
- Agents benefit from redundancy — restating constraints in CLAUDE.md even if covered in README
- Maintenance burden is low given the v0 scope

---

## Key Decisions

### README.md structure
- **Opening**: One-paragraph project description (what, why, for whom)
- **Status badge / disclaimer**: v0, actively evolving
- **Prerequisites**: Node 22, pnpm 10, Docker
- **Quick Start**: `pnpm install` → `docker compose up` → `pnpm dev`
- **Architecture overview**: Monorepo map (apps/api, packages/*), domain model (appointment state machine), tech stack table
- **Near-term roadmap**: Hexagonal arch refactor, test suite, auth
- **Contributing**: Branch naming, commit style, pre-push hooks (Lefthook), PR conventions

### CLAUDE.md structure
- **Commands**: dev, build, typecheck, lint, format, test (with per-package scoping)
- **Monorepo layout**: What each package owns, dependency direction rules
- **Architecture patterns**: Hexagonal intent, where business logic lives (`packages/scheduling`), what `apps/api` is allowed to do
- **Code conventions**: TypeScript strict, Zod v4 for validation, Drizzle for DB, no raw SQL
- **Known constraints / gotchas**:
  - `apps/api/src/index.ts` starts HTTP server at import time — never import in tests
  - `packages/db` and `apps/api` parse env vars eagerly — test setup must stub `DATABASE_URL` etc.
  - `HARDCODED_PRACTITIONER_ID` is a placeholder — auth is not implemented yet
- **Security rules**:
  - Never hardcode credentials, tokens, or secrets in source files
  - Never commit `.env` files
  - All secrets via environment variables only
- **Near-term intent**:
  - Repository interfaces (ports) will be introduced before tests are written
  - Test pyramid: domain unit → adapter integration → route E2E
  - `@careos/fixtures` package planned for shared test data

### Tone and format
- README: narrative prose with code blocks where helpful, welcoming tone
- CLAUDE.md: terse, imperative bullets — rules over explanations

---

## Open Questions

_None — all major decisions resolved through dialogue._

---

## Resolved Questions

| Question | Decision |
|---|---|
| README audience? | Contributors primarily, but layered with high-level intro for stakeholders |
| How to handle WIP state? | Include near-term intent explicitly — don't pretend the codebase is finished |
| One doc or two? | Two independent docs — each self-contained for its audience |
| CLAUDE.md scope? | Architecture patterns, code style, workflow commands, security rules |
