# Review Comment Template

Use this structure exactly when posting the review comment via `mcp__linear-server__save_comment`.

```markdown
## Post-Implementation Review — PR #XX

**PR:** [title](url)

### Spec Compliance: X%

| Spec Item | Status | Notes |
| -- | -- | -- |
| Endpoint `POST /path` | ✅ Match | Route at `file:line` |
| Input field `fieldName` | ⚠️ Deviation | Spec says X, implementation does Y |
| Port `PortName` defined | ✅ Match | Interface at `file:line` |
| Error `CODE` (HTTP) | ✅ Match | Defined in `file:line` |
| Event `name` emitted | ❌ Missing | Not found in implementation |

### Deviations & Decisions

1. **What changed** — description. Within agent latitude / spec violation. Impact assessment.

### Learnings

1. **Transferable insight.** What happened, why it matters for future issues. **Takeaway:** one-line actionable lesson.

### Process Improvements

- [ ] **Agent instructions** (`path/to/file`): add/update guidance about X
- [ ] **Solution doc** (`docs/solutions/category/title.md`): document pattern Y
- [ ] **Spec template**: future specs should include Z

### Test Evidence

- N unit tests (M files) — packages covered
- K manual test scripts — scenarios covered
- Quality gate: typecheck ✓/✗ · lint ✓/✗ · format ✓/✗

### Recommendation

Move to **Done** / **Needs work**. Justification.
```

## Compliance Calculation

Count each independently verifiable spec item:
- Each endpoint = 1 item
- Each input field = 1 item
- Each port = 1 item
- Each error code = 1 item
- Each domain event = 1 item
- Each invariant = 1 item
- Each precondition = 1 item
- Response shape = 1 item
- Idempotency behavior = 1 item (if specified)
- Race condition handling = 1 item (if specified)

Status mapping:
- **✅ Match**: implementation matches spec
- **⚠️ Deviation**: implementation differs but is reasonable (within latitude or justified)
- **❌ Missing**: spec item not implemented

Compliance % = (✅ count) / (total items) * 100. Deviations (⚠️) count as partial — 0.5 each.
