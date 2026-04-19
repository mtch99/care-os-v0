import type { TemplateContentV2 } from '@careos/api-contract'

import type { ChartNoteDraft } from '../types/chart-note-draft'

/**
 * Port for AI-assisted charting capabilities.
 *
 * The domain layer depends on this interface; infrastructure adapters implement it.
 * Zero infrastructure imports -- only domain types.
 */
export interface AIChartingPort {
  /**
   * Generate a full template draft from high-level practitioner preferences.
   *
   * Returns raw TemplateContentV2 data. The caller must validate the result
   * through TemplateSchema.parse() before persisting.
   */
  generateTemplateDraft(input: {
    discipline: string
    appointmentType: string
    preferences: string
    locale: ('fr' | 'en')[]
  }): Promise<TemplateContentV2>

  /**
   * Generate a chart note draft by filling template fields from raw session notes.
   *
   * Returns raw ChartNoteDraft data. The caller must validate that field keys
   * exist in the template and that value types match the corresponding FieldType.
   */
  generateChartNoteDraft(input: {
    rawNotes: string
    templateContent: TemplateContentV2
    intakeData?: Record<string, unknown>
  }): Promise<ChartNoteDraft>
}
