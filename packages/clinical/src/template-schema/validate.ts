import type { TemplateContentV2 } from '@careos/api-contract'
import { TemplateValidationError } from '@careos/api-contract'

/**
 * Semantic validation for a structurally valid TemplateContentV2.
 * Checks cross-cutting invariants that Zod cannot express declaratively:
 * - All field keys are globally unique across the entire template
 * - All LocalizedString values have keys matching the template's locale array
 *
 * Throws TemplateValidationError on first violation found.
 */
export function validateTemplateSemantics(content: TemplateContentV2): void {
  const errors: string[] = []
  const { locale, pages } = content

  const seenKeys = new Map<string, string>()

  for (const page of pages) {
    for (const section of page.sections) {
      for (const row of section.rows) {
        for (const field of row.columns) {
          // Unique key check
          const existing = seenKeys.get(field.key)
          if (existing) {
            errors.push(
              `Duplicate field key '${field.key}' in page '${page.key}', section '${section.key}' (first seen in ${existing})`,
            )
          } else {
            seenKeys.set(field.key, `page '${page.key}', section '${section.key}'`)
          }

          // Locale completeness on field label
          checkLocaleCompleteness(field.label, locale, `field '${field.key}' label`, errors)
        }
      }

      // Locale completeness on section label
      checkLocaleCompleteness(
        section.label,
        locale,
        `section '${section.key}' label in page '${page.key}'`,
        errors,
      )
    }

    // Locale completeness on page label
    checkLocaleCompleteness(page.label, locale, `page '${page.key}' label`, errors)
  }

  if (errors.length > 0) {
    throw new TemplateValidationError(errors)
  }
}

function checkLocaleCompleteness(
  localizedString: Record<string, string>,
  requiredLocales: string[],
  location: string,
  errors: string[],
): void {
  for (const loc of requiredLocales) {
    if (!(loc in localizedString)) {
      errors.push(`Missing locale '${loc}' in ${location}`)
    }
  }
}
