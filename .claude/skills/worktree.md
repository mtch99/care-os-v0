---
name: worktree
description: Create an isolated git worktree for a Linear issue or manual branch. Adds Linear blocker verification, epic-aware base branch resolution, and env file copying specific to this repo. Use when starting work on a Linear issue, creating feature branches, or setting up isolated development environments.
argument-hint: <CAR-96 | chore/my-thing>
---

# Worktree — Git Flow Entry Point

This is a project-specific skill. The `compound-engineering:git-worktree` plugin provides a generic worktree manager. This skill adds Linear integration, blocker verification, dynamic base-branch resolution, and `.env` file copying for the CareOS monorepo.

## Quick Start

Determine which flow to use based on the argument:

- Argument matches `/^CAR-\d+$/i` --> Flow A (Linear issue)
- Anything else --> Flow B (manual branch name)

Both flows end with a ready-to-use worktree at `.claude/worktrees/<branch-name>/`.

## Flow A: Linear Issue ID

1. **Fetch the Linear issue** using `mcp__linear-server__get_issue` with `includeRelations: true`. Extract `gitBranchName`, parent issue, and `blockedBy` relations.
2. **Validate `gitBranchName`** against `/^[a-zA-Z0-9._\/-]{1,200}$/`. If invalid, report the exact name and stop.
3. **Verify blockers are merged.** For each issue in `blockedBy`, check whether its `gitBranchName` appears in `git log --oneline origin/master`. If any blocker is not merged, list every unmerged blocker with its issue ID and title, then stop.
4. **Determine base branch:**
   - If the issue has a parent epic whose `gitBranchName` exists as a remote branch, base = that epic branch (e.g., `feature/car-90-...`).
   - Otherwise, base = `master`.
5. **Fetch remote:** `git fetch origin`
6. **Verify base branch exists on origin.** If `origin/<base>` does not exist, report: "Base branch `<base>` has not been pushed to origin. Push it first." and stop.
7. **Idempotency check.** If `.claude/worktrees/<slug>` already exists and its HEAD is on the correct base, `cd` into it and skip to step 10. The slug is `gitBranchName` with `/` replaced by `-` (e.g., `feature/car-96-foo` becomes `feature-car-96-foo`).
8. **Create worktree:**
   ```bash
   git worktree add ".claude/worktrees/<slug>" -b "<gitBranchName>" "origin/<base>"
   ```
9. **Copy `.env` files** from the main working tree into the worktree:
   - `apps/api/.env`
   - `packages/db/.env`
   If a source `.env` does not exist, skip it silently (the user may not have created it yet).
10. **Install dependencies.** If `node_modules/` is missing in the worktree root, run `pnpm install --frozen-lockfile`. If install fails, report the error and stop -- do not proceed with missing dependencies.

## Flow B: Manual Branch Name

1. **Validate branch name** against `/^[a-zA-Z0-9._\/-]{1,200}$/`. If invalid, report the exact name and stop.
2. Base = `master`.
3. **Fetch remote:** `git fetch origin`
4. **Idempotency check.** If `.claude/worktrees/<slug>` already exists, `cd` into it and skip to step 7. Slug uses the same `/` to `-` replacement as Flow A.
5. **Create worktree:**
   ```bash
   git worktree add ".claude/worktrees/<slug>" -b "<branch-name>" "origin/master"
   ```
6. **Copy `.env` files** (same list and same skip-if-missing behavior as Flow A step 9).
7. **Install dependencies** (same as Flow A step 10).

## Security

- **Always validate branch names** before interpolating into shell commands. The regex rejects shell metacharacters, spaces, and control characters.
- **Always quote variables** in shell commands: `"$branch_name"`, never bare `$branch_name`.
- Never pass unsanitized user input to `git worktree add` or any shell command.

## Edge Cases

| Scenario | Action |
|---|---|
| Branch name contains shell metacharacters | Regex rejects it -- stop with a clear error message. |
| Worktree already exists for this branch | Re-enter it (idempotent). Do not recreate. |
| Remote-tracking branch is stale | `git fetch origin` runs before worktree creation. |
| Epic trunk not pushed to origin | Detect via `git branch -r` and report a clear error. |
| `pnpm install` fails | Stop with the install error. Do not proceed. |
| Source `.env` file does not exist | Skip silently. Log which files were skipped. |
| Linear issue has no `gitBranchName` | Report: "Issue <ID> has no git branch name set in Linear. Set one and retry." Stop. |
| Argument is empty or missing | Report: "Usage: /worktree <CAR-96 or branch-name>" and stop. |

## Cleanup

After a PR is merged, remove the worktree:

```bash
git worktree remove .claude/worktrees/<slug>
```

Keep active worktrees to three or fewer to avoid clutter.

## Success Criteria

Worktree setup is complete when:

- [ ] Worktree directory exists at `.claude/worktrees/<slug>/`
- [ ] Branch is checked out and tracking the correct base
- [ ] `.env` files are present (or source did not exist)
- [ ] `node_modules/` exists and `pnpm install` succeeded
- [ ] Current working directory is inside the worktree
