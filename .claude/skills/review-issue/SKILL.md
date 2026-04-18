---
name: review-issue
description: "Post-implementation review of a completed Linear issue. Compares the DDD spec to the actual code, posts a structured review comment on Linear with compliance table, deviations, learnings, and process improvements. Use after merging a feature PR, when closing an issue, or when reviewing what an agent built against its spec."
argument-hint: "<CAR-96>"
disable-model-invocation: false
---

# Review Issue

Compare what was specified in a Linear issue to what was actually implemented. Post the review as a structured comment on the issue.

## Argument

`$ARGUMENTS` must be a Linear issue ID matching `/^CAR-\d+$/i`. If missing or invalid, stop with: "Usage: /review-issue CAR-96"

## Workflow

### Step 1: Gather the spec

Fetch the Linear issue using `mcp__linear-server__get_issue` with `includeRelations: true`.

Extract from the issue description:

| Spec element | Where to find it |
|---|---|
| Pattern | Frontmatter block (`> **Pattern:**`) |
| Agent latitude | Frontmatter block (`> **Agent latitude:**`) |
| Endpoints | `**Endpoint:**` lines or `## Endpoints` section |
| Input schema | `**Input:**` blocks |
| Ports | `**Ports used:**` list or aggregate spec |
| Invariants | Bulleted list under aggregate spec |
| State machine | `**State machine:**` line |
| Error contract | `## Error Contract` or `## Error contract` table |
| Domain events | `## Domain Events` section |
| Response shape | `## Response` section |
| Preconditions | `## Preconditions` section |
| Manual test script | `## Manual test script` section |

Build a checklist of spec items. Each item becomes a row in the compliance table.

### Step 2: Find the implementation

Determine which code to review:

1. Check the issue's `gitBranchName`. Run `git log --oneline origin/master..HEAD` to see if we're on that branch or it's been merged.
2. If on a different branch, check if the branch was merged into the current branch: `git log --oneline --all --grep="$gitBranchName"`.
3. Look for the PR: `gh pr list --search "$issueId" --state all --json number,title,url,mergedAt`.

Find changed files by diffing against master: `git diff --name-only origin/master...HEAD` (or the relevant commit range).

### Step 3: Analyze compliance

For each spec item, verify the implementation. Use the Explore agent for thorough code analysis when the spec has more than 5 checkable items.

Dispatch an Explore agent with a prompt that includes:
- The full spec checklist from Step 1
- The list of changed files from Step 2
- Instructions to read each relevant file and verify each spec item

Check these categories:

**Endpoints** — route path, HTTP method, status codes match spec.

**Input schema** — field names, types, and validation match spec.

**Ports** — every port in spec is defined as an interface. No infrastructure imports in domain code.

**Invariants** — each invariant is enforced in the aggregate or command, not in handlers or SQL.

**Error contract** — every error code, HTTP status, and payload shape from spec exists in `api-contract`.

**Domain events** — every event name and payload shape from spec is emitted. No PHI in payloads.

**Preconditions** — each precondition in spec has a corresponding guard that throws a typed error.

**Response shape** — matches spec (field names, nesting, status codes).

**State machine** — transitions match spec. Blocked transitions are enforced.

### Step 4: Gather test evidence

Run `pnpm test 2>&1 | grep -E "Test Files|Tests"` to get current test counts.

Check quality gate: `pnpm typecheck && pnpm lint && pnpm format:check`. Report pass/fail for each.

### Step 5: Identify learnings

Scan for things worth capturing:

- **Solution docs created**: check `git diff --name-only origin/master...HEAD -- docs/solutions/` for new entries.
- **Agent instruction changes**: check `git diff --name-only origin/master...HEAD -- .claude/agents/` for updates.
- **Skill and command changes**: check `git diff --name-only origin/master...HEAD -- .claude/skills/ .claude/commands/` for new or modified skills.
- **Architectural decisions**: look for new packages, bounded context extractions, or pattern deviations in the diff.
- **Existing comments**: fetch with `mcp__linear-server__list_comments` to avoid duplicating prior review content.

### Step 6: Post the review comment

Post a comment on the Linear issue using `mcp__linear-server__save_comment` with the structure defined in [review-template.md](review-template.md).

Rules:
- Calculate compliance % as: (matching items / total checkable items) * 100, rounded to nearest integer.
- Mark items as ✅ Match, ⚠️ Deviation, or ❌ Missing.
- For deviations, note whether they fall within agent latitude or are true spec violations.
- In Learnings, focus on what's **transferable** to future issues — not issue-specific details.
- In Process Improvements, be specific: name the file to update, the section to add, or the pattern to document.
- **Do NOT auto-close the issue.** End with a recommendation and justification.

### Step 7: Report to user

Print a summary:
```
Review posted on <issue-id>: <issue-title>
Compliance: X% (Y/Z items)
Deviations: N
Recommendation: <Done | Needs work>
Link: <linear-url>
```
