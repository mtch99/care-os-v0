/**
 * Value produced by AI for a single chart note field.
 *
 * Each variant maps to one or more FieldType values:
 *   string          -> narrative, text, date
 *   number          -> scale
 *   string[]        -> checkboxGroup, select, radio
 *   CheckboxWithTextItem[] -> checkboxWithText
 *   Record<string, string>[] -> repeaterTable rows
 *   Record<string, string>   -> table (row-key -> value)
 *   null            -> bodyDiagram, romDiagram, signature (AI cannot fill these)
 */
export type ChartNoteDraftFieldValue =
  | string
  | number
  | string[]
  | { key: string; checked: boolean; text?: string }[]
  | Record<string, string>[]
  | Record<string, string>
  | null

/**
 * AI-generated draft of chart note field values.
 *
 * Keys are field keys from the template; values are the AI's suggested content.
 * The caller is responsible for validating that the keys exist in the template
 * and that the value types match the corresponding FieldType.
 */
export interface ChartNoteDraft {
  fields: Record<string, ChartNoteDraftFieldValue>
}
