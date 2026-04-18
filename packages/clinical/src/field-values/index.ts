import type { TemplateContentV2 } from '@careos/api-contract'

import { validateFieldValues } from './validate'

/**
 * FieldValueSchema value object — semantic validation for chart-note field
 * value payloads against a structurally-valid TemplateContentV2.
 *
 * Mirrors the shape of `TemplateSchema` (sibling module). The two are kept
 * distinct because `TemplateSchema.parse(content)` and
 * `FieldValueSchema.parse(payload, content)` operate on different inputs —
 * co-locating them would muddle their identities.
 *
 * Use `validate` when you already have a typed template and want a
 * side-effecting check that throws `FieldValueValidationError` on violations.
 * Use `parse` to additionally return the (narrowed) payload for persistence.
 *
 * The validator only checks keys present in the payload (PATCH semantics).
 * Payload keys not declared in the template are silently ignored —
 * key-existence is a separate aggregate-level invariant (see
 * `UnknownFieldIdError`).
 */
export const FieldValueSchema = {
  /** Semantic validation only. Throws FieldValueValidationError on failure. */
  validate: validateFieldValues,

  /** Validate then return the payload unchanged. Throws on failure. */
  parse(payload: Record<string, unknown>, content: TemplateContentV2): Record<string, unknown> {
    validateFieldValues(payload, content)
    return payload
  },
} as const
