---
title: 'feat: Wire FieldValueSchema + field-key check into acceptAiDraft'
type: feat
status: active
date: 2026-04-18
deepened: 2026-04-18
linear: CAR-123
---

# feat: Wire FieldValueSchema + field-key check into acceptAiDraft

## Overview

`acceptAiDraft` currently writes AI-generated field values straight into `chart_notes.field_values` via Drizzle, bypassing the `ChartNote` aggregate. Two invariants the aggregate already enforces for `saveDraft` are therefore skipped on the AI path:

1. **Key existence** — an AI that hallucinates `pan_scale` instead of `pain_scale` lands as garbage.
2. **Per-field value shape** — an AI that emits `pain_scale: 42` against a 0..10 scale lands as garbage.

This plan closes the gap by promoting the AI-accept path to an aggregate-driven command: a new `ChartNote.acceptAiDraft(...)` method mirrors `saveDraft`'s invariant chain, and the existing charting handler is rewired to reconstitute the aggregate and delegate. The invariants propagate as typed `DomainError`s and are already serialized correctly by the Hono error handler shipped in [CAR-120](https://linear.app/careos/issue/CAR-120).

The refactor is deliberately narrow: the `acceptAiDraft` handler keeps its Transaction-Script shape (wraps two mutations in `db.transaction`) and continues to own AI-draft lifecycle concerns. Only the chart-note invariants move into the aggregate.

## Problem Frame

Today's `acceptAiDraft` lives in [packages/charting/src/commands/accept-ai-draft.ts](packages/charting/src/commands/accept-ai-draft.ts). It copies `draft.fieldValues` into `chart_notes.field_values` (overwrite strategy) and marks the draft `accepted`, all inside one `db.transaction`. There is no template load, no key check, no value check. The aggregate (`packages/scheduling/src/chart-note/chart-note.aggregate.ts`) is never touched on this path.

`saveDraft` already solved the same problem correctly ([CAR-120](https://linear.app/careos/issue/CAR-120)): load the template, reconstitute the aggregate, call the aggregate method, let `UnknownFieldIdError` / `FieldValueValidationError` propagate. The Hono error handler at [apps/api/src/error-handler.ts](apps/api/src/error-handler.ts) already serializes both to 422 with the correct shape. The only missing piece is the aggregate-side symmetry on the accept path.

## Requirements Trace

- R1. `acceptAiDraft` rejects payloads with unknown field keys → 422 `UnknownFieldIdError` → Units 1, 2
- R2. `acceptAiDraft` rejects payloads with invalid values → 422 `FieldValueValidationError` carrying the same per-leaf `errors[]` shape as `saveDraft` → Units 1, 2
- R3. Chart-note state unchanged on rejection — no partial writes, no events → Unit 1 (aggregate throws before returning a new instance); Unit 2 (handler keeps invariant check inside `db.transaction` so a throw rolls back both writes)
- R4. Existing `acceptAiDraft` tests continue to pass; new tests cover both rejection paths and the happy path → Units 3, 4
- R5. Invariants live on the aggregate, symmetric with `saveDraft` — consolidates the "where do chart-note rules live" answer → Unit 1

## Scope Boundaries

- **No change to the AI-draft lifecycle** — `DraftNotFoundError`, idempotent-return-on-already-accepted, `DraftAlreadyResolvedError` all keep their current semantics and stay in the handler.
- **No change to the overwrite-vs-merge decision** — the current doc-comment is explicit: AI drafts overwrite, not merge. The aggregate method continues that contract.
- **No response-shape changes on the API** — the existing 422 serialization from the Hono error handler (shipped in [CAR-120](https://linear.app/careos/issue/CAR-120)) already covers both error classes. No edits to [apps/api/src/error-handler.ts](apps/api/src/error-handler.ts).
- **No full port-ification of the charting handler** — `acceptAiDraft` keeps `db: DrizzleDB` as its injection seam and stays inside a `db.transaction`. The atomicity constraint (chart-note update + draft-status update must succeed together) makes the current Transaction-Script envelope the safer choice for this iteration.
- **No AI prompt tuning** — the validator is the last line of defence; improving upstream accuracy is a separate concern.
- **No required-ness enforcement** — still deferred to the signature workflow (same as [CAR-120](https://linear.app/careos/issue/CAR-120)).
- **No change to `initialize` invariants** — the unprotected `initialize` path is a separate follow-up.

### Deferred to Separate Tasks

- Full port-ification of charting handlers (`acceptAiDraft`, `generateAiDraft`, `rejectAiDraft`, `markReadyForSignature`, `reopenForEdit`, `signChartNote`) — a larger architectural sweep; file as a separate Linear issue if pursued.
- Wiring the same invariants into `initialize` — tracked for a future iteration.
- **Route-level `chartNoteSaved` Inngest emit on the accept path** — event-parity with the `saveDraft` route. The aggregate already emits the domain event (Unit 1) and the handler surfaces it in `AcceptAiDraftEvents` (Unit 2), but the route does NOT subscribe it to Inngest in this plan. Tracked as future parity work; today's consumers see only `aiChartDraft.accepted` from the accept path, as they do today. Orthogonal to CAR-123's validation goal.
- **`app.request()`-style route integration tests for both 422 paths** — no route-test harness exists in `apps/api/src/__tests__/` today (only `error-handler.test.ts`, which tests the handler in isolation). Building one is larger scope than CAR-123 warrants. Handler-level tests (Unit 2) plus the already-shipped error-handler tests provide adequate confidence for this iteration. File a separate Linear issue when the first route-integration harness gets built — that issue retrofits coverage for `saveDraft` and `acceptAiDraft` together.

## Context & Research

### Relevant Code and Patterns

- **The exact reference implementation**: [packages/scheduling/src/chart-note/chart-note.aggregate.ts](packages/scheduling/src/chart-note/chart-note.aggregate.ts) `saveDraft` method (lines 131–197). Precondition order: status → version → key-check (`collectFieldKeys` + `UnknownFieldIdError`) → value-check (`FieldValueSchema.validate` → `FieldValueValidationError`) → merge → bump version → emit `chartNote.saved`. Mirror this precondition order, omitting the optimistic-lock version check (accept-ai-draft never takes `version` from the client — the draft lifecycle is the concurrency guard).
- **`collectFieldKeys` helper** ([packages/scheduling/src/chart-note/chart-note.aggregate.ts:11-23](packages/scheduling/src/chart-note/chart-note.aggregate.ts)) — reuse as-is for the new method.
- **Charting handler pattern**: [packages/charting/src/commands/accept-ai-draft.ts](packages/charting/src/commands/accept-ai-draft.ts). Structure: `db.transaction(async (tx) => { ... })` with sequential `tx.query.*.findFirst` calls and `tx.update(...).set(...).where(...)`. All sibling charting commands (`sign-chart-note`, `reopen-for-edit`, `mark-ready-for-signature`, `generate-ai-draft`) follow this exact pattern.
- **Reconstitute-aggregate-from-row seam**: [packages/scheduling/src/chart-note/chart-note.aggregate.ts:203](packages/scheduling/src/chart-note/chart-note.aggregate.ts) `ChartNote.fromRow(row)`. Accepts the `ChartNoteRow` port shape. Works directly against the raw Drizzle row shape (with a tiny adaptation for `fieldValues` null handling — see Unit 2).
- **Template load pattern**: [packages/charting/src/commands/generate-ai-draft.ts:82-89](packages/charting/src/commands/generate-ai-draft.ts) already shows the exact shape — `tx.query.chartNoteTemplates.findFirst({ where: eq(chartNoteTemplates.id, chartNote.templateVersionId) })`. Template is an FK; missing template is a data-integrity failure — throw loudly.
- **Handler test pattern**: [packages/charting/src/commands/\_\_tests\_\_/accept-ai-draft.test.ts](packages/charting/src/commands/__tests__/accept-ai-draft.test.ts) uses [fakes.ts](packages/charting/src/commands/__tests__/fakes.ts). The fake already supports `template` in its `FakeDbConfig` and a `templateFindCalls` queue — enable it for the new cases.
- **Aggregate test pattern**: [packages/scheduling/src/chart-note/save-draft.test.ts](packages/scheduling/src/chart-note/save-draft.test.ts). Top-of-file constants + `TEMPLATE_CONTENT` + `makeDraftChartNote(overrides)` + flat `describe / it`. Reuse for Unit 3.
- **Inngest event already defined**: `chartNoteSaved` ([packages/inngest/src/client.ts:103](packages/inngest/src/client.ts)). The charting route can emit it alongside `aiChartDraft.accepted`, keeping parity with how [apps/api/src/routes/clinical.ts:276-287](apps/api/src/routes/clinical.ts) handles it for `saveDraft`.

### Institutional Learnings

- [docs/solutions/best-practices/field-value-validation-mirrors-template-schema.md](docs/solutions/best-practices/field-value-validation-mirrors-template-schema.md) — the full pattern writeup from [CAR-120](https://linear.app/careos/issue/CAR-120). Relevant sub-patterns for this plan: "self-defending aggregate — enforce the invariant where it belongs" (Unit 1); "precondition-chain order: key-check BEFORE value-check" (Unit 1); "Hono `onError` branch" (already shipped — this plan depends on it).
- [docs/solutions/integration-issues/drizzle-error-wrapping-domain-isolation.md](docs/solutions/integration-issues/drizzle-error-wrapping-domain-isolation.md) — adapter translates infra-shaped errors, never the domain. The new aggregate method must throw typed `DomainError`s only; no `ZodError` leakage from the validator (already guaranteed by the existing `FieldValueSchema` implementation from [CAR-120](https://linear.app/careos/issue/CAR-120), but verify in Unit 3 tests).

### External References

None — internal pattern work, fully grounded in the precedent shipped in [CAR-120](https://linear.app/careos/issue/CAR-120).

## Key Technical Decisions

- **Invariants move to the aggregate (Option 1 from the Linear issue).** Symmetric with `saveDraft`. Keeps the "where do chart-note rules live" answer consolidated in one place. The aggregate already owns the unknown-key invariant for `saveDraft`; giving it a second command (`acceptAiDraft`) that reuses the same helpers is cheaper than splintering the invariant across two layers. Resolves the issue's design question.
- **Handler stays a Transaction Script — no port-ification.** The handler's two mutations (chart-note update + draft-status update) must succeed together; `db.transaction` is the cheapest guarantee. Rewiring charting to use the full scheduling-style port pattern is a larger separate concern (all six charting commands share the Transaction-Script shape today). The aggregate is a pure in-memory value, so importing `ChartNote` from `@careos/scheduling` inside the transaction is a clean additive change — no port interface, no mock surface change.
- **Event emission: aggregate emits `chartNote.saved`; handler surfaces BOTH events but the route wires only `aiChartDraft.accepted` to Inngest for now.** Parity with `saveDraft`: the aggregate's responsibility is "chart note content changed" → `chartNote.saved`. The handler's additional responsibility is "AI draft lifecycle transitioned" → `aiChartDraft.accepted`. Both events are semantically correct; the handler surfaces both in `AcceptAiDraftEvents`. The `chartNoteSaved` Inngest event already exists ([packages/inngest/src/client.ts:103](packages/inngest/src/client.ts)), but wiring the route to emit it is event-parity work (out of scope — see "Deferred to Separate Tasks"). The handler return-type change is forward-compatible with that follow-up.
- **New aggregate input: `acceptedBy`.** The aggregate method needs an actor identity for the `chartNote.saved` event's `editedBy` field. Route layer supplies `HARDCODED_PRACTITIONER_ID` (same pattern as `sign`, `reopen`, `mark-ready-for-signature`). The handler signature grows `acceptedBy: string` as an input.
- **Overwrite semantics preserved.** Unlike `saveDraft` (patch / merge), `acceptAiDraft` replaces `fieldValues` wholesale. The aggregate method reflects this: `mergedFieldValues` is **not** computed from `this.fieldValues` — the new state's `fieldValues` IS `params.incomingFieldValues`. The existing handler comment explains why (AI emits the complete field set; merging with partial stale data risks inconsistency). Document this divergence clearly in the aggregate method's docblock.
- **`fieldIdsChanged` on the emitted event.** For parity with `saveDraft`, emit `Object.keys(incomingFieldValues)`. This is the set of fields the AI wrote, which matches user intent: "these are the fields that changed on accept." Even with overwrite semantics, only the keys the AI populated are in the payload.
- **Precondition order inside the aggregate.** Match `saveDraft`: status → key-check → value-check. No version check — the accept path has no client-supplied version (draft lifecycle is the concurrency guard). `ChartNoteNotDraftError` when status ≠ `draft`, same as `saveDraft`.
- **Typing seam for `fieldValues`.** The raw Drizzle row types `fieldValues` as `unknown`. The aggregate's `fromRow` accepts a `ChartNoteRow` port type with `fieldValues: Record<string, FieldValue> | null`. In the charting handler, cast `chartNote.fieldValues as Record<string, FieldValue> | null` at the reconstitution call-site, matching how `apps/api/src/composition/clinical-ports.ts:22` does it for `saveDraft`. No new port interfaces introduced.
- **Draft `fieldValues` type.** The draft's `fieldValues` is `unknown` (Drizzle JSONB). Cast to `Record<string, FieldValue>` at the aggregate boundary. The aggregate's key-check and value-check will reject anything that isn't actually a valid field-values shape, so the cast is safe — an AI emitting `fieldValues: 42` would fail the `Object.keys(...)` check or the value walk with a typed error.

## Open Questions

### Resolved During Planning

- **Option 1 vs Option 2 from the Linear issue?** → Option 1 (aggregate), hybrid form: aggregate owns invariants, handler stays Transaction Script for atomicity. Rationale: parity with `saveDraft`, minimal surface area, no port refactor churn.
- **Which event(s) to emit on accept?** → `chartNote.saved` (from the aggregate) + `aiChartDraft.accepted` (from the handler). Both are true; both have existing Inngest types.
- **Does the route need a request body to carry `acceptedBy`?** → No. `acceptedBy` is sourced from `HARDCODED_PRACTITIONER_ID` at the route layer (same as sibling endpoints). No schema change to the API.
- **Does the error-handler need new branches?** → No. `UnknownFieldIdError` flows through the generic `DomainError` branch (existing); `FieldValueValidationError` flows through its dedicated branch shipped in [CAR-120](https://linear.app/careos/issue/CAR-120). No changes to [apps/api/src/error-handler.ts](apps/api/src/error-handler.ts).
- **What about CLAUDE.md dep-direction?** → Already says `packages/scheduling → db, api-contract, clinical`. The charting handler already depends on `@careos/scheduling` AND `@careos/clinical` per [packages/charting/package.json](packages/charting/package.json). No new package edges; no CLAUDE.md edit required. (The CLAUDE.md dep-direction list does not include `packages/charting` today — out of scope to rectify here.)
- **Should the aggregate's accept method be named `acceptAiDraft` or more generic?** → Keep `acceptAiDraft` (matches the Linear issue and the handler). The method is distinct from `saveDraft` because of overwrite semantics and the absence of a version check; giving it a distinct name keeps the intent clear at call-sites.
- **Does the draft's `fieldValues` shape need its own validation wrapper?** → No. `FieldValueSchema.validate` already walks the payload and tolerates arbitrary top-level shapes defensively (the key-check fires first on unknown keys; a non-object top-level would fail the `Object.keys(...)` step with a typed error). The existing validator covers this.

### Deferred to Implementation

- Exact `ChartNoteTemplateNotFoundError` (or similar) to throw if the template FK dangles. Current handler re-uses `ChartNoteNotFoundError` for this case in `generate-ai-draft.ts:87-88` (a weak signal). Pick the most accurate existing error in `@careos/api-contract` at implementation time, or introduce a new one if none fits; defensive check only — FK guarantees the row exists.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
POST /chart-notes/:id/ai-draft/:draftId/accept
  ↓
Hono charting route
  acceptedBy = HARDCODED_PRACTITIONER_ID
  ↓
acceptAiDraft(db, { chartNoteId, draftId, acceptedBy })
  ↓
db.transaction(async (tx) => {
  1. load draft            → DraftNotFoundError
  2. status === 'accepted' → idempotent return (no events)
  3. status !== 'pending'  → DraftAlreadyResolvedError
  4. load chart note       → ChartNoteNotFoundError
  5. load template         → defensive (FK guaranteed)
     ↓
  6. reconstitute aggregate:
     ChartNote.fromRow(chartNote).acceptAiDraft({
         incomingFieldValues: draft.fieldValues,
         templateContent: template.content,
         acceptedAt: now,
         acceptedBy,
     })
         ↓ status === 'draft'?  → ChartNoteNotDraftError
         ↓ key-check            → UnknownFieldIdError (first)
         ↓ value-check          → FieldValueValidationError (with path-based errors)
         ↓ overwrite fieldValues, bump version
         ↓ emit chartNote.saved
     ↓
  7. tx.update(chartNotes).set({ fieldValues, updatedAt, version })
  8. tx.update(aiChartNoteDrafts).set({ status: 'accepted' })
})
  ↓
route:
  - inngest.send(aiChartDraftAccepted.create(...))   (existing, unchanged)
  - chartNote.saved surfaces on AcceptAiDraftEvents but is NOT sent to Inngest
    (deferred route-parity work — see Deferred to Separate Tasks)

error handler (no change):
  - UnknownFieldIdError       → 422 { code, message }  (existing generic DomainError branch)
  - FieldValueValidationError → 422 { code, message, errors[] }  (existing dedicated branch)
```

## Implementation Units

- [ ] **Unit 1: Add `ChartNote.acceptAiDraft` method to the aggregate**

**Goal:** A new aggregate command that enforces key + value invariants, overwrites `fieldValues`, bumps version, and emits `chartNote.saved`. Symmetric with `saveDraft` but with overwrite (not patch) semantics and no optimistic-lock version check.

**Requirements:** R1, R2, R3, R5

**Dependencies:** None — reuses `collectFieldKeys`, `FieldValueSchema`, `UnknownFieldIdError`, `FieldValueValidationError`, `ChartNoteNotDraftError` already shipped.

**Files:**
- Modify: `packages/scheduling/src/chart-note/chart-note.aggregate.ts`
- Modify: `packages/scheduling/src/chart-note/index.ts` (export nothing new — `ChartNote` is already exported)
- Test: `packages/scheduling/src/chart-note/accept-ai-draft.aggregate.test.ts` (new file, co-located per the existing chart-note subdirectory convention)

**Approach:**
- Add `acceptAiDraft(params: { incomingFieldValues: Record<string, FieldValue>; templateContent: TemplateContentV2; acceptedAt: Date; acceptedBy: string }): ChartNote` as an instance method on `ChartNote`.
- Precondition order:
  1. Status: throw `ChartNoteNotDraftError` if not `'draft'`.
  2. Key-check: derive `templateFieldSet` via `collectFieldKeys(params.templateContent)`; throw `UnknownFieldIdError(unknownKeys)` if `Object.keys(incomingFieldValues)` has any key not in the set.
  3. Value-check: `FieldValueSchema.validate(params.incomingFieldValues, params.templateContent)` — throws `FieldValueValidationError` on its own.
- Overwrite semantics: new state's `fieldValues = params.incomingFieldValues` (NOT merged with `this.fieldValues`). Document the divergence from `saveDraft` in a brief docblock.
- Bump version: `nextVersion = this.version + 1`.
- Emit `chartNote.saved` with payload `{ chartNoteId, editedBy: params.acceptedBy, editedAt: params.acceptedAt.toISOString(), fieldIdsChanged: Object.keys(params.incomingFieldValues) }`.
- Construct and return a new `ChartNote` via the private constructor, same pattern as `saveDraft` (lines 174-184).

**Patterns to follow:**
- `ChartNote.saveDraft` (lines 131-197) for the method body shape, precondition order, event emission, and return pattern.
- `collectFieldKeys` (lines 11-23) — reuse unchanged.

**Test scenarios:**
<!-- Aggregate-level tests; exercise the method as a pure function with real template fixtures. -->
- **Happy path:** valid payload overwrites `fieldValues` wholesale; returns a new `ChartNote` with bumped version; emits exactly one `chartNote.saved` event; original instance (`this`) is unchanged.
- **Happy path:** payload with only a subset of template fields — result's `fieldValues` contains exactly the payload's keys (overwrite, not merge). Contrast with `saveDraft`, which would keep prior keys.
- **Happy path:** `fieldIdsChanged` on the emitted event matches `Object.keys(incomingFieldValues)`.
- **Error path:** chart note status is `'readyForSignature'` → throws `ChartNoteNotDraftError`; no state mutation; no event emitted.
- **Error path:** chart note status is `'signed'` → throws `ChartNoteNotDraftError`; no state mutation; no event emitted.
- **Error path:** payload contains an unknown field key → throws `UnknownFieldIdError` with the offending keys; value-check never runs; no event.
- **Error path:** payload contains a `pain_scale: 42` against a 0..10 scale → throws `FieldValueValidationError` with `errors[0].path === ['pain_scale']`, `errors[0].code === 'OUT_OF_RANGE'` (or whatever the existing validator emits for scale violations — assert whatever `FieldValueSchema` actually produces); no event.
- **Error path:** payload contains both an unknown key AND an invalid value → `UnknownFieldIdError` wins (precondition order); `FieldValueValidationError` is not thrown. Regression lock on the order.
- **Error path:** payload contains a `checkboxGroup` with an unknown option → throws `FieldValueValidationError` with the correct path. Sanity-check of the full-depth validation coverage reused from CAR-120 — we don't re-test the validator exhaustively, just confirm one nested case propagates correctly.
- **Edge case:** payload with `null` for a field → accepted (matches `FieldValueSchema`'s null contract from CAR-120).
- **Edge case:** empty payload (`{}`) → accepted; `fieldIdsChanged: []`; `fieldValues` becomes `{}` (overwrite semantics — this wipes any prior values). Document this as a known side-effect of overwrite semantics; the caller (handler) is responsible for not passing `{}`, but the aggregate itself does not reject it.

**Verification:**
- `pnpm --filter @careos/scheduling test` passes with the new file. Existing `save-draft.test.ts` still passes.
- `pnpm --filter @careos/scheduling typecheck` passes.

---

- [ ] **Unit 2: Rewire `acceptAiDraft` handler to delegate to the aggregate; add `acceptedBy` end-to-end**

**Goal:** The handler loads the template, reconstitutes the aggregate, delegates invariant enforcement to `ChartNote.acceptAiDraft`, persists the result, and surfaces both the existing `aiChartDraft.accepted` and the new `chartNote.saved` events. Draft-lifecycle concerns (`DraftNotFoundError`, idempotent return, `DraftAlreadyResolvedError`, mark draft accepted) stay in the handler. The route passes `HARDCODED_PRACTITIONER_ID` as `acceptedBy`.

**Requirements:** R1, R2, R3, R4

**Dependencies:** Unit 1.

**Files:**
- Modify: `packages/charting/src/commands/accept-ai-draft.ts`
- Modify: `packages/charting/src/commands/__tests__/accept-ai-draft.test.ts`
- Modify: `packages/charting/src/commands/__tests__/fakes.ts` (if needed — the scaffolding for `template` in `FakeDbConfig` already exists; verify it's callable from the accept test path without changes)
- Modify: `apps/api/src/routes/charting.ts` (accept handler only — pass `acceptedBy`; relocate or duplicate `HARDCODED_PRACTITIONER_ID` so it's in scope)

**Approach:**
- Add `acceptedBy: string` to `AcceptAiDraftInput`. Propagate from the route (`HARDCODED_PRACTITIONER_ID`).
- Update `AcceptAiDraftEvents` interface to include `'chartNote.saved': { chartNoteId: string; editedBy: string; editedAt: string; fieldIdsChanged: string[] }` (in addition to the existing `'aiChartDraft.accepted'`). The return type already uses `Partial<AcceptAiDraftEvents>`, so the idempotent branch (already-accepted draft) naturally returns `{}` — no additional handling needed there.
- Inside the existing `db.transaction(async (tx) => { ... })` envelope:
  - Keep draft load + `DraftNotFoundError` (unchanged).
  - Keep idempotent-accepted branch (unchanged — returns current state, no events).
  - Keep `DraftAlreadyResolvedError` (unchanged).
  - Keep chart-note load + `ChartNoteNotFoundError` (unchanged).
  - **Remove** the inline `if (chartNote.status !== 'draft') throw new ChartNoteNotDraftError()` — the aggregate now enforces this.
  - **Add** template load: `const template = await tx.query.chartNoteTemplates.findFirst({ where: eq(chartNoteTemplates.id, chartNote.templateVersionId) })`. Defensive throw if missing (FK guarantee; pick the most accurate existing error — `generate-ai-draft.ts:87-88` uses `ChartNoteNotFoundError` today; reuse for consistency unless a narrower error fits).
  - **Add** aggregate reconstitution. The raw Drizzle row contains all fields `ChartNoteRow` requires (`signedAt`, `signedBy`, `prePopulatedFromIntakeId`, etc.) — spread directly:
    ```typescript
    const aggregate = ChartNote.fromRow({
      ...chartNote,
      fieldValues: chartNote.fieldValues as Record<string, FieldValue> | null,
    })
    const now = new Date()
    const updated = aggregate.acceptAiDraft({
      incomingFieldValues: draft.fieldValues as Record<string, FieldValue>,
      templateContent: template.content as TemplateContentV2,
      acceptedAt: now,
      acceptedBy: input.acceptedBy,
    })
    ```
    Verify against the Drizzle schema at implementation time that every `ChartNoteRow` field is present on the findFirst return (it should be by default; no column selection narrowing). Any invariant violation throws out of the transaction, rolling back all writes.
  - **Change** the chart-note update to persist the aggregate's new state: `fieldValues: updated.fieldValues`, `updatedAt: updated.updatedAt`, `version: updated.version`.
  - Keep the draft status update (unchanged).
- Surface the `chartNote.saved` event on the return value by pulling it from `updated.getUncommittedEvents()` (find the event with `type === 'chartNote.saved'`, cast payload). Include alongside the existing `aiChartDraft.accepted` in the returned `events`.
- In the route ([apps/api/src/routes/charting.ts](apps/api/src/routes/charting.ts) lines 60-77):
  - Pass `acceptedBy: HARDCODED_PRACTITIONER_ID` in the input.
  - Relocate `HARDCODED_PRACTITIONER_ID` (currently declared at line 101) above the accept handler so the scope is correct, OR duplicate-declare — pick whichever keeps the diff small.
  - **Do NOT** wire `chartNoteSaved` to `inngest.send(...)` — that's deferred (see Scope Boundaries).

**Patterns to follow:**
- Template load inside tx: exact shape at [packages/charting/src/commands/generate-ai-draft.ts:82-89](packages/charting/src/commands/generate-ai-draft.ts).
- Aggregate reconstitute + delegate (note: `save-draft.ts` uses port-based loading, NOT a raw Drizzle row — the adaptation here is to spread `chartNote` from `tx.query.chartNotes.findFirst` and cast `fieldValues`): [packages/scheduling/src/chart-note/save-draft.ts:88-96](packages/scheduling/src/chart-note/save-draft.ts).
- Event collection from aggregate: [packages/scheduling/src/chart-note/save-draft.ts:115-117](packages/scheduling/src/chart-note/save-draft.ts) (`updated.getUncommittedEvents()`).
- HARDCODED_PRACTITIONER_ID usage: [apps/api/src/routes/charting.ts:101-167](apps/api/src/routes/charting.ts) (existing sibling handlers).

**Test scenarios:**
<!-- Handler-level tests; exercise the full draft + chart-note lifecycle via the existing fake DB. -->
- **Happy path (existing tests migrate):** all 9 current test cases must still pass after the refactor. Migrate each test deliberately — pass a `template` to `createFakeDb` for every case that reaches the chart-note-exists branch, and update the fixture so its `content` declares the field keys each test uses (the existing `makeTemplate` default only declares `chief_complaint`; extend per test via overrides to add `pain_scale`, etc.). Tests that fire `DraftNotFoundError` early don't need a template.
- **Happy path (new):** with a valid draft and a template declaring `pain_scale` as a 0..10 `scale`, call accept with `fieldValues: { pain_scale: 6 }` → `result.chartNote.fieldValues` equals `{ pain_scale: 6 }` (overwrite); `events['chartNote.saved']` is present with `fieldIdsChanged: ['pain_scale']` and `editedBy` equal to the supplied `acceptedBy`; `events['aiChartDraft.accepted']` is also present.
- **Error path (new):** draft has `fieldValues: { pan_scale: 6 }` (typo — unknown key) against a template declaring `pain_scale` → throws `UnknownFieldIdError` with `['pan_scale']`. `mutations.updatedChartNotes` empty AND `mutations.updatedDrafts` empty. No events emitted.
- **Error path (new):** draft has `fieldValues: { pain_scale: 42 }` against a `scale` with `min: 0, max: 10` → throws `FieldValueValidationError` with `errors[0].path === ['pain_scale']`. `mutations.updatedChartNotes` empty; `mutations.updatedDrafts` empty.
- **Error path (existing, migrated):** chart note in `readyForSignature` — the aggregate now enforces status. Existing test still asserts `ChartNoteNotDraftError`; keep it. The template load fires first inside the handler (sequential loads); supply a template in the fixture.
- **Regression path:** idempotent return when draft already `'accepted'` → no template load required (returns before the chart-note branch); `events` is empty; no mutations; response shape unchanged.
- **Edge case (new):** template FK dangles (no template row) → defensive throw with the chosen error class; no writes occurred.

**Verification:**
- `pnpm --filter @careos/charting test` passes — all existing tests green, new tests green.
- `pnpm --filter @careos/charting typecheck` passes.
- `pnpm --filter @careos/api typecheck` passes (covers the route change).
- `pnpm lint` passes — `drizzle/enforce-update-with-where` already satisfied.

---

- [ ] **Unit 3: Manual curl test scripts**

**Goal:** Per-branch executable curl scripts covering the happy path + two rejection paths, committed with the executable bit per the CLAUDE.md scripts convention. These are **smoke scripts for manual verification against a running API**, not a substitute for Unit 2's handler-level automated tests.

**Requirements:** R4 (documentation / reproducibility).

**Dependencies:** Units 1, 2.

**Files:**
- Create: `scripts/test-car-123-accept-ai-draft-validation/01-happy-path.sh`
- Create: `scripts/test-car-123-accept-ai-draft-validation/02-reject-unknown-field-key.sh`
- Create: `scripts/test-car-123-accept-ai-draft-validation/03-reject-invalid-scale-value.sh`
- Create: `scripts/test-car-123-accept-ai-draft-validation/README.md`

**Approach:**
- Use `/generate-test-scripts` or author manually. Each script:
  - Seeds or references a known chart note + draft via `pnpm db:seed` output OR `psql` INSERTs.
  - Hits `POST /chart-notes/:id/ai-draft/:draftId/accept`.
  - Asserts the HTTP status and response shape via `jq`.
- `chmod +x` before committing (per CLAUDE.md convention).
- README documents prerequisites (DB seeded, API running) and expected output for each case.

**Patterns to follow:**
- Existing `scripts/test-car-120-field-value-validation/` directory from the CAR-120 PR.

**Test scenarios:**
- Test expectation: none -- scripts, not tests.

**Verification:**
- Running each script against a local API produces the expected status code and response body.

## System-Wide Impact

- **Interaction graph:** `packages/charting` gains a new runtime use of `ChartNote` from `@careos/scheduling` (dependency already present — no new package edge). Charting already depends on `@careos/clinical` transitively via scheduling; confirm direct dep presence in `package.json` (it IS present today — no change).
- **Error propagation:** Both new error classes throw from inside the aggregate, inside a `db.transaction`. Drizzle rolls back the (non-executed) mutations automatically since the throw happens before any write. The errors propagate unchanged up to the Hono error handler (no wrapping).
- **State lifecycle risks:** None beyond what `saveDraft` already accepted. The aggregate's overwrite semantics are unchanged from the pre-refactor handler — an AI emitting `fieldValues: {}` will still wipe the chart note (existing behavior; the aggregate does not reject empty payloads, same as the existing handler did not reject them).
- **API surface parity:** The new invariants now live in the aggregate for BOTH `saveDraft` and `acceptAiDraft`. `initialize` still bypasses the aggregate for key/value checks (not in scope; deferred). This improves the ratio of "chart-note commands that enforce invariants via the aggregate" from 1/N to 2/N.
- **Integration coverage:** Unit 1 aggregate tests prove the precondition ordering. Unit 2 handler tests prove the full draft+chart-note flow including rollback on rejection. The existing [apps/api/src/__tests__/error-handler.test.ts](apps/api/src/__tests__/error-handler.test.ts) (shipped with CAR-120) already proves `FieldValueValidationError` → 422 with structured `errors[]` and `UnknownFieldIdError` → 422 with the generic shape. Validator-depth unit tests from CAR-120 continue to cover the 14 field types — no re-testing.
- **Unchanged invariants:** Existing `saveDraft` behavior. Existing `DraftNotFoundError` / `DraftAlreadyResolvedError` / `ChartNoteNotFoundError` semantics on the accept path. Idempotent-return on already-accepted drafts. Overwrite (not merge) on accept. The Hono error handler. The existing `FieldValueSchema` validator and its tests.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| The existing fakes/tests for `acceptAiDraft` don't currently supply a template; migrating each case is fiddly. | The fakes already support `template` in `FakeDbConfig` and `templateFindCalls` — just wire it per test. Migrate each existing test deliberately (don't blanket-add templates; tests that fire a `DraftNotFoundError` early don't need one). |
| `ChartNote.fromRow(...)` is called in `save-draft.ts` via a port adapter, not against a raw Drizzle row as Unit 2 proposes. The row returned by `tx.query.chartNotes.findFirst()` must contain every `ChartNoteRow` field. | Verified via the ports.ts spec: `ChartNoteRow` requires `id`, `sessionId`, `templateVersionId`, `status`, `fieldValues`, `prePopulatedFromIntakeId`, `signedAt`, `signedBy`, `createdAt`, `updatedAt`, `version`. All are present on the `chartNotes` Drizzle schema (see [packages/db/src/schema.ts](packages/db/src/schema.ts)). Default `findFirst` returns every column; no column-selection narrowing. Implementer should double-check the shape once in the handler edit, but no harness change is expected. |
| Overwrite semantics + aggregate encapsulation could mask "empty payload wipes chart note" bug. | Documented in System-Wide Impact and tested in Unit 1 edge cases. The handler does NOT add a rejection for `{}` — matches pre-refactor behavior. File a separate discussion if this foot-gun warrants tightening. |
| `acceptedBy` addition to the handler input forces a route-layer change; forgetting to pass it would leave `editedBy` as `undefined` in the emitted event. | TypeScript enforces the new required input at the call-site in `apps/api/src/routes/charting.ts`. Typecheck is a required gate. |
| `FieldValueSchema.validate`'s full-depth coverage of 14 types is already tested in CAR-120 — re-testing it in the aggregate would be duplicative. | Unit 1 tests limit themselves to one simple type (`scale` out-of-range) and one nested type (`checkboxGroup` unknown option) to prove propagation through the new method. Validator depth is not retested. |
| Template FK dangle has no well-named error today — `generate-ai-draft.ts` uses `ChartNoteNotFoundError` (misleading). | Resolve at implementation time: reuse an existing error for this case in accept-ai-draft (matching the generate-ai-draft precedent for consistency), or add a narrowly-scoped `ChartNoteTemplateNotFoundError` if none fits. Out of scope to sweep `generate-ai-draft` on the same PR. |
| No automated integration test proves the full `app.request()` path. | Accepted. The handler-level tests (Unit 2) prove the invariants and the error types. The Hono error handler is already tested in isolation ([apps/api/src/__tests__/error-handler.test.ts](apps/api/src/__tests__/error-handler.test.ts)) and includes a dedicated `FieldValueValidationError` branch. Unit 3's curl scripts provide the manual smoke signal. Full route-integration harness tracked as deferred work. |

## Documentation / Operational Notes

- No new `docs/solutions/` entry needed — CAR-120's [field-value-validation-mirrors-template-schema.md](docs/solutions/best-practices/field-value-validation-mirrors-template-schema.md) already documents the pattern. If anything, consider a **one-line addendum** to that doc: "Aggregate-symmetric extension: `ChartNote.acceptAiDraft` mirrors `saveDraft`'s invariant chain, with overwrite (not merge) semantics. See [CAR-123](https://linear.app/careos/issue/CAR-123)." Treat this as optional — if the writeup is kept lean, link from the Linear issue instead.
- No rollout, monitoring, or migration concerns. No DB schema change. No feature flag. No new environment variable.
- Manual test scripts in `scripts/test-car-123-accept-ai-draft-validation/` (Unit 5) are the reproducible record of the three branches.

## Review Findings Integrated

This plan was reviewed by feasibility and scope-guardian personas before activation. Substantive changes made as a result:

- **Dropped the standalone "Wire `chartNoteSaved` Inngest event in the route" unit** (originally Unit 3). Reason: event-parity work outside CAR-123's stated validation goal. The aggregate still emits `chartNote.saved` (domain-correct) and the handler still surfaces it on `AcceptAiDraftEvents` for future consumers, but the route does NOT forward it to Inngest in this iteration. Tracked under Deferred to Separate Tasks.
- **Dropped the standalone `app.request()` integration-test unit** (originally Unit 4). Reason: no route-test harness exists in `apps/api/src/__tests__/` today (only `error-handler.test.ts`, which tests the handler in isolation). Building one is larger scope than CAR-123 warrants and would need to serve `saveDraft` at the same time. Handler-level tests (Unit 2) plus the already-shipped `error-handler.test.ts` provide adequate coverage. Tracked under Deferred to Separate Tasks.
- **Folded the route's `acceptedBy` wiring into Unit 2.** Reason: collapsing the three-unit handler-rewire into one atomic unit keeps the change reviewable as one concern.
- **Added a Risk row on the `ChartNote.fromRow(...)`-from-raw-Drizzle-row call pattern.** Reason: the cited precedent (`save-draft.ts`) goes through a port adapter, not a raw row. Verified against `ChartNoteRow` that all required fields ARE on the Drizzle row, but called out so the implementer doesn't trip over the indirection.
- **Clarified the `AcceptAiDraftEvents` idempotent-branch behavior.** Reason: the return type is `Partial<AcceptAiDraftEvents>`, so the idempotent branch naturally returns `{}` without further changes.

## Sources & References

- **Linear issue:** [CAR-123](https://linear.app/careos/issue/CAR-123)
- **Parent plan ([CAR-120](https://linear.app/careos/issue/CAR-120)):** [docs/plans/2026-04-18-001-feat-chart-note-field-value-validation-plan.md](docs/plans/2026-04-18-001-feat-chart-note-field-value-validation-plan.md) (Deferred to Separate Tasks → "Wire validator into `acceptAiDraft`")
- **Pattern writeup:** [docs/solutions/best-practices/field-value-validation-mirrors-template-schema.md](docs/solutions/best-practices/field-value-validation-mirrors-template-schema.md)
- **Current bypass (primary target):** [packages/charting/src/commands/accept-ai-draft.ts](packages/charting/src/commands/accept-ai-draft.ts)
- **Aggregate reference implementation:** [packages/scheduling/src/chart-note/chart-note.aggregate.ts](packages/scheduling/src/chart-note/chart-note.aggregate.ts) (`saveDraft`)
- **Save-draft handler reference:** [packages/scheduling/src/chart-note/save-draft.ts](packages/scheduling/src/chart-note/save-draft.ts)
- **Hono error handler (already compatible):** [apps/api/src/error-handler.ts](apps/api/src/error-handler.ts)
- **Inngest event definitions:** [packages/inngest/src/client.ts](packages/inngest/src/client.ts) (`chartNoteSaved` already exported)
- **Charting route (Inngest wiring target):** [apps/api/src/routes/charting.ts](apps/api/src/routes/charting.ts)
- **Save-draft route (event-emit precedent):** [apps/api/src/routes/clinical.ts](apps/api/src/routes/clinical.ts) lines 260-290
- **Institutional learning:** [docs/solutions/integration-issues/drizzle-error-wrapping-domain-isolation.md](docs/solutions/integration-issues/drizzle-error-wrapping-domain-isolation.md)
