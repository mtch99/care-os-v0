import type {
  FieldValueError,
  KeyedLocalizedOption,
  LocalizedString,
  TemplateContentV2,
} from '@careos/api-contract'
import { FieldValueValidationError, fieldConfigByType } from '@careos/api-contract'
import type { z } from 'zod'

/**
 * Semantic validation for chart-note field-value payloads against a
 * structurally-valid TemplateContentV2.
 *
 * Walks the payload (not the template) so the validator enforces PATCH
 * semantics: only keys present in `payload` are checked, and payload keys
 * not declared in the template are silently ignored (key-existence is a
 * separate aggregate-level invariant, surfaced by `UnknownFieldIdError`).
 *
 * `null` is accepted for any field — drafts are incomplete by design (R5).
 * On a collection-typed field (repeaterTable, checkboxGroup, checkboxWithText,
 * table), `null` CLEARS the field; clients wanting to keep the field as an
 * empty collection must send `[]` / `{}`. This matches the aggregate's
 * existing merge semantics.
 *
 * All per-field errors are accumulated before throwing, so a client can
 * surface every invalid field in a single response instead of the
 * fix-one-discover-another loop.
 */

type Field =
  TemplateContentV2['pages'][number]['sections'][number]['rows'][number]['columns'][number]
type FieldType = Field['type']

// The template-content Zod schema is a discriminated union at runtime, but
// the static inference widens `config` into the union of all per-type
// configs — narrowing on `field.type` does not narrow `field.config` in
// TypeScript. We derive per-type config types directly from
// `fieldConfigByType` via `z.infer` so any change to the Zod schemas in
// `field-configs.ts` (new constraints, renamed keys) is picked up here
// without manual syncing. The runtime cast is safe because any
// TemplateContentV2 reaching this validator has already passed the
// structural Zod schema.
type ScaleConfig = z.infer<(typeof fieldConfigByType)['scale']>
type SelectConfig = z.infer<(typeof fieldConfigByType)['select']>
type CheckboxGroupConfig = z.infer<(typeof fieldConfigByType)['checkboxGroup']>
type CheckboxWithTextConfig = z.infer<(typeof fieldConfigByType)['checkboxWithText']>
type RepeaterConfig = z.infer<(typeof fieldConfigByType)['repeaterTable']>
type RepeaterColumn = RepeaterConfig['columns'][number]
type TableConfig = z.infer<(typeof fieldConfigByType)['table']>

type ErrorAccumulator = FieldValueError[]
type FieldPath = ReadonlyArray<string | number>

export function validateFieldValues(
  payload: Record<string, unknown>,
  content: TemplateContentV2,
): void {
  const errors: ErrorAccumulator = []
  const fieldsByKey = indexFields(content)

  for (const [key, value] of Object.entries(payload)) {
    const field = fieldsByKey.get(key)
    if (!field) continue
    if (value === null) continue

    validateOne(field, value, [key], errors)
  }

  if (errors.length > 0) {
    throw new FieldValueValidationError(errors)
  }
}

function indexFields(content: TemplateContentV2): Map<string, Field> {
  const map = new Map<string, Field>()
  for (const page of content.pages) {
    for (const section of page.sections) {
      for (const row of section.rows) {
        for (const field of row.columns) {
          map.set(field.key, field)
        }
      }
    }
  }
  return map
}

function validateOne(
  field: Field,
  value: unknown,
  path: FieldPath,
  errors: ErrorAccumulator,
): void {
  const type: FieldType = field.type
  switch (type) {
    case 'text':
    case 'narrative':
      validateString(value, path, errors)
      return
    case 'scale':
      validateScale(value, field.config as ScaleConfig, path, errors)
      return
    case 'select':
    case 'radio':
      validateKeyedOption(value, (field.config as SelectConfig).options, path, errors)
      return
    case 'date':
      validateDate(value, path, errors)
      return
    case 'checkboxGroup':
      validateKeyedCheckboxGroup(value, (field.config as CheckboxGroupConfig).options, path, errors)
      return
    case 'checkboxWithText':
      validateCheckboxWithText(value, (field.config as CheckboxWithTextConfig).items, path, errors)
      return
    case 'repeaterTable':
      validateRepeaterTable(value, (field.config as RepeaterConfig).columns, path, errors)
      return
    case 'table':
      validateTable(value, field.config as TableConfig, path, errors)
      return
    case 'legend':
      validateLegend(value, path, errors)
      return
    case 'bodyDiagram':
    case 'romDiagram':
    case 'signature':
      return
    default:
      assertNever(type)
  }
}

function validateString(value: unknown, path: FieldPath, errors: ErrorAccumulator): void {
  if (typeof value !== 'string') {
    errors.push({ path, code: 'WRONG_TYPE', message: 'Expected a string' })
  }
}

function validateScale(
  value: unknown,
  config: ScaleConfig,
  path: FieldPath,
  errors: ErrorAccumulator,
): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push({ path, code: 'WRONG_TYPE', message: 'Expected a finite number' })
    return
  }
  if (value < config.min || value > config.max) {
    errors.push({
      path,
      code: 'OUT_OF_RANGE',
      message: `Value ${String(value)} is outside [${String(config.min)}, ${String(config.max)}]`,
    })
    return
  }
  if (config.step !== undefined) {
    const ratio = (value - config.min) / config.step
    if (Math.abs(ratio - Math.round(ratio)) > 1e-9) {
      errors.push({
        path,
        code: 'NOT_ALIGNED_TO_STEP',
        message: `Value ${String(value)} is not aligned to step ${String(config.step)} (from min ${String(config.min)})`,
      })
    }
  }
}

// Value is matched against option.key only. Localized labels (option.fr /
// option.en) are rendering concerns, not persistence concerns. CAR-122
// introduced the stable key field to stop pinning persisted values to a
// locale; accepting labels here would re-open that footgun.
function validateKeyedOption(
  value: unknown,
  options: ReadonlyArray<KeyedLocalizedOption>,
  path: FieldPath,
  errors: ErrorAccumulator,
): void {
  if (typeof value !== 'string') {
    errors.push({ path, code: 'WRONG_TYPE', message: 'Expected a string' })
    return
  }
  if (!options.some((opt) => opt.key === value)) {
    errors.push({
      path,
      code: 'NOT_IN_OPTIONS',
      message: `Value '${value}' does not match any declared option.key`,
    })
  }
}

function validateDate(value: unknown, path: FieldPath, errors: ErrorAccumulator): void {
  if (typeof value !== 'string') {
    errors.push({ path, code: 'WRONG_TYPE', message: 'Expected a date string' })
    return
  }
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) {
    errors.push({ path, code: 'INVALID_DATE', message: `Value '${value}' is not a parseable date` })
  }
}

function validateKeyedCheckboxGroup(
  value: unknown,
  options: ReadonlyArray<KeyedLocalizedOption>,
  path: FieldPath,
  errors: ErrorAccumulator,
): void {
  if (!Array.isArray(value)) {
    errors.push({ path, code: 'WRONG_TYPE', message: 'Expected an array of strings' })
    return
  }
  const seen = new Set<string>()
  for (let i = 0; i < value.length; i++) {
    const el = value[i] as unknown
    const elPath = [...path, i]
    if (typeof el !== 'string') {
      errors.push({ path: elPath, code: 'WRONG_TYPE', message: 'Expected a string' })
      continue
    }
    if (seen.has(el)) {
      errors.push({
        path: elPath,
        code: 'DUPLICATE',
        message: `Value '${el}' appears more than once`,
      })
      continue
    }
    seen.add(el)
    if (!options.some((opt) => opt.key === el)) {
      errors.push({
        path: elPath,
        code: 'NOT_IN_OPTIONS',
        message: `Value '${el}' does not match any declared option.key`,
      })
    }
  }
}

function validateCheckboxWithText(
  value: unknown,
  items: ReadonlyArray<{ key: string; label: LocalizedString }>,
  path: FieldPath,
  errors: ErrorAccumulator,
): void {
  if (!Array.isArray(value)) {
    errors.push({
      path,
      code: 'WRONG_TYPE',
      message: 'Expected an array of { key, checked, text? } entries',
    })
    return
  }
  const allowedKeys = new Set(items.map((item) => item.key))
  for (let i = 0; i < value.length; i++) {
    const entry = value[i] as unknown
    const entryPath = [...path, i]
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push({
        path: entryPath,
        code: 'WRONG_TYPE',
        message: 'Expected an object { key, checked, text? }',
      })
      continue
    }
    const record = entry as Record<string, unknown>
    const keyValue = record.key
    const checkedValue = record.checked
    const textValue = record.text

    if (typeof keyValue !== 'string') {
      errors.push({
        path: [...entryPath, 'key'],
        code: 'WRONG_TYPE',
        message: 'Expected `key` to be a string',
      })
    } else if (!allowedKeys.has(keyValue)) {
      errors.push({
        path: [...entryPath, 'key'],
        code: 'UNKNOWN_KEY',
        message: `Key '${keyValue}' is not declared on this field`,
      })
    }

    if (typeof checkedValue !== 'boolean') {
      errors.push({
        path: [...entryPath, 'checked'],
        code: 'WRONG_TYPE',
        message: 'Expected `checked` to be a boolean',
      })
    }

    if (textValue !== undefined && typeof textValue !== 'string') {
      errors.push({
        path: [...entryPath, 'text'],
        code: 'WRONG_TYPE',
        message: 'Expected `text` to be a string when provided',
      })
    }
  }
}

function validateRepeaterTable(
  value: unknown,
  columns: ReadonlyArray<RepeaterColumn>,
  path: FieldPath,
  errors: ErrorAccumulator,
): void {
  if (!Array.isArray(value)) {
    errors.push({ path, code: 'WRONG_TYPE', message: 'Expected an array of row objects' })
    return
  }
  const columnsByKey = new Map(columns.map((col) => [col.key, col]))
  for (let rowIndex = 0; rowIndex < value.length; rowIndex++) {
    const row = value[rowIndex] as unknown
    const rowPath = [...path, rowIndex]
    if (row === null || typeof row !== 'object' || Array.isArray(row)) {
      errors.push({ path: rowPath, code: 'WRONG_TYPE', message: 'Expected a row object' })
      continue
    }
    for (const [cellKey, cellValue] of Object.entries(row)) {
      const cellPath = [...rowPath, cellKey]
      const column = columnsByKey.get(cellKey)
      if (!column) {
        errors.push({
          path: cellPath,
          code: 'UNKNOWN_COLUMN',
          message: `Column '${cellKey}' is not declared on this repeaterTable`,
        })
        continue
      }
      if (cellValue === null) continue
      validateRepeaterCell(cellValue, column, cellPath, errors)
    }
  }
}

function validateRepeaterCell(
  value: unknown,
  column: RepeaterColumn,
  path: FieldPath,
  errors: ErrorAccumulator,
): void {
  switch (column.type) {
    case 'text':
    case 'narrative':
      validateString(value, path, errors)
      return
    case 'select':
      if (typeof value !== 'string') {
        errors.push({ path, code: 'WRONG_TYPE', message: 'Expected a string' })
        return
      }
      if (column.options && !column.options.includes(value)) {
        errors.push({
          path,
          code: 'NOT_IN_OPTIONS',
          message: `Value '${value}' does not match any option for column '${column.key}'`,
        })
      }
      return
    default:
      assertNever(column.type)
  }
}

function validateTable(
  value: unknown,
  config: TableConfig,
  path: FieldPath,
  errors: ErrorAccumulator,
): void {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    errors.push({
      path,
      code: 'WRONG_TYPE',
      message: 'Expected an object shaped as { [rowKey]: { [columnKey]: string } }',
    })
    return
  }
  const allowedColumns = new Set(config.columns)
  const allowedRows = config.rows ? new Set(config.rows) : null

  for (const [rowKey, rowValue] of Object.entries(value)) {
    const rowPath = [...path, rowKey]
    if (allowedRows && !allowedRows.has(rowKey)) {
      errors.push({
        path: rowPath,
        code: 'UNKNOWN_ROW',
        message: `Row '${rowKey}' is not declared on this table`,
      })
      continue
    }
    if (rowValue === null || typeof rowValue !== 'object' || Array.isArray(rowValue)) {
      errors.push({
        path: rowPath,
        code: 'WRONG_TYPE',
        message: 'Expected a row object { [columnKey]: string }',
      })
      continue
    }
    for (const [colKey, cellValue] of Object.entries(rowValue as Record<string, unknown>)) {
      const cellPath = [...rowPath, colKey]
      if (!allowedColumns.has(colKey)) {
        errors.push({
          path: cellPath,
          code: 'UNKNOWN_COLUMN',
          message: `Column '${colKey}' is not declared on this table`,
        })
        continue
      }
      if (cellValue === null) continue
      if (typeof cellValue !== 'string') {
        errors.push({
          path: cellPath,
          code: 'WRONG_TYPE',
          message: 'Expected a string cell value',
        })
      }
    }
  }
}

function validateLegend(value: unknown, path: FieldPath, errors: ErrorAccumulator): void {
  errors.push({
    path,
    code: 'LEGEND_HAS_NO_VALUE',
    message: 'Legend fields are display-only and cannot hold a value',
  })
  void value
}

function assertNever(x: never): never {
  throw new Error(`Unreachable: unexpected field variant ${JSON.stringify(x)}`)
}
