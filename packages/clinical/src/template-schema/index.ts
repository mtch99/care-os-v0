import { templateContentSchemaV2 } from '@careos/api-contract'
import type { TemplateContentV2 } from '@careos/api-contract'

import { validateTemplateSemantics } from './validate'

/**
 * TemplateSchema value object — two-pass validation for chart note template content.
 *
 * Pass 1 (schema.parse): Zod structural validation — hierarchy, field types, config shapes
 * Pass 2 (validate): Domain semantic validation — unique keys, locale completeness
 *
 * Use `parse` for the combined single-entry-point.
 * Use `schema` directly when you only need structural validation (e.g., at API boundary).
 * Use `validate` when you already have a structurally valid object.
 */
export const TemplateSchema = {
  /** The Zod structural schema (re-exported from @careos/api-contract) */
  schema: templateContentSchemaV2,

  /** Semantic validation only — assumes structurally valid input. Throws TemplateValidationError. */
  validate: validateTemplateSemantics,

  /** Full two-pass validation: structural (Zod) then semantic. Returns typed TemplateContentV2. */
  parse(raw: unknown): TemplateContentV2 {
    const parsed = templateContentSchemaV2.parse(raw)
    validateTemplateSemantics(parsed)
    return parsed
  },
} as const
