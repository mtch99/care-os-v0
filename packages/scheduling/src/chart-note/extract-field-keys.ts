/**
 * Extract all field keys from a TemplateContentV2 structure.
 *
 * Traverses pages -> sections -> rows -> columns and collects each column's key.
 * The template content shape is defined in @careos/api-contract.
 */
export function extractFieldKeys(
  content: {
    pages: Array<{
      sections: Array<{
        rows: Array<{
          columns: Array<{ key: string }>
        }>
      }>
    }>
  },
): string[] {
  const keys: string[] = []
  for (const page of content.pages) {
    for (const section of page.sections) {
      for (const row of section.rows) {
        for (const column of row.columns) {
          keys.push(column.key)
        }
      }
    }
  }
  return keys
}
