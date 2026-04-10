# /worktree — Git Flow Entry Point

Single entry point for branch setup and worktree isolation. Agents and humans call `/worktree CAR-96` (Linear issue) or `/worktree chore/my-thing` (manual branch name).

> **This is a project-specific skill.** The `compound-engineering:git-worktree` plugin skill provides a generic worktree manager. This skill adds Linear integration, blocker verification, dynamic base-branch resolution, and env file copying specific to this repo.

---

## Input

One argument — either a **Linear issue ID** (e.g., `CAR-96`) or a **manual branch name** (e.g., `chore/my-thing`).

---

## Flow A: Linear Issue ID

1. **Read the Linear issue** — extract `gitBranchName`, parent issue, and `blockedBy` list.
2. **Sanitize `gitBranchName`** — validate against `/^[a-zA-Z0-9._\/-]{1,200}$/`. If it contains unexpected characters, report the invalid name and **stop**.
3. **Verify blockers are merged.** For each issue in `blockedBy`, check `git log origin/master` (or the appropriate trunk). Every blocker must be merged. If any are not, list the unmerged blockers and **stop**.
4. **Determine base branch:**
   - If the issue has a parent epic with a trunk branch → base = that epic trunk (e.g., `feature/car-90-...`)
   - Otherwise → base = `master`
5. **`git fetch origin`** — ensure remote-tracking branches are current.
6. **Verify base branch exists on origin.** If `origin/<base>` does not exist (e.g., epic trunk not pushed), report: _"Base branch `<base>` has not been pushed to origin. Push it first."_ and **stop**.
7. **Idempotency check.** If `.claude/worktrees/<branch-name>` already exists and is on the correct base, `cd` into it and skip to step 10.
8. **Create worktree:** `git worktree add .claude/worktrees/<branch-name> -b <gitBranchName> origin/<base>`
9. **Copy `.env` files** into the worktree:
   - `apps/api/.env`
   - `packages/db/.env`
10. **Install dependencies.** If `node_modules/` is missing in the worktree, run `pnpm install --frozen-lockfile`.

---

## Flow B: Manual Branch Name

1. **Sanitize branch name** — same regex: `/^[a-zA-Z0-9._\/-]{1,200}$/`. Reject and **stop** if invalid.
2. Base = `master`.
3. **`git fetch origin`**.
4. **Idempotency check.** If `.claude/worktrees/<branch-name>` already exists, `cd` into it and skip to step 7.
5. **Create worktree:** `git worktree add .claude/worktrees/<branch-name> -b <branch-name> origin/master`
6. **Copy `.env` files** (same hardcoded list as Flow A).
7. **Install dependencies.** If `node_modules/` is missing, run `pnpm install --frozen-lockfile`.

---

## Security

- **Always validate branch names** before interpolating into shell commands. The regex rejects shell metacharacters, spaces, and control characters.
- **Always quote branch name variables** in shell commands: `"$branch_name"`, never bare `$branch_name`.

## Edge Cases

| Scenario | Handling |
|---|---|
| Branch name has shell metacharacters | Regex rejects it — stop with error |
| Worktree already exists for this branch | Re-enter it (idempotency) |
| Remote-tracking branch is stale | `git fetch origin` runs before creation |
| Epic trunk not pushed to origin | Detect and report clear error |
| `pnpm install` fails | Fail with clear error — do not proceed with stale dependencies |

## Cleanup

After a PR is merged, remove the worktree:

```bash
git worktree remove .claude/worktrees/<branch-name>
```

Keep active worktrees to ~3 to avoid clutter.
