import { z } from 'zod'

const localizedString = z.object({
  fr: z.string(),
  en: z.string(),
})

export type LocalizedString = z.infer<typeof localizedString>

export { localizedString }

// --- FieldType config schemas ---
// z.object() strips unknown keys by default in Zod v4

const narrativeConfig = z.object({
  placeholder: localizedString.optional(),
})

const textConfig = z.object({
  placeholder: localizedString.optional(),
})

const scaleConfig = z.object({
  min: z.number(),
  max: z.number(),
  step: z.number().optional(),
  unit: z.string().optional(),
})

const selectConfig = z.object({
  options: z.array(localizedString).min(1),
})

const checkboxGroupConfig = z.object({
  options: z.array(localizedString).min(1),
})

const checkboxWithTextConfig = z.object({
  items: z
    .array(
      z.object({
        key: z.string(),
        label: localizedString,
      }),
    )
    .min(1),
  columns: z.number().optional(),
})

const radioConfig = z.object({
  options: z.array(localizedString).min(1),
})

const dateConfig = z.object({})

const repeaterTableConfig = z.object({
  columns: z
    .array(
      z.object({
        key: z.string(),
        label: localizedString,
        type: z.enum(['text', 'select', 'narrative']),
        options: z.array(z.string()).optional(),
      }),
    )
    .min(1),
})

const tableConfig = z.object({
  columns: z.array(z.string()).min(1),
  rows: z.array(z.string()).optional(),
})

const legendConfig = z.object({
  content: localizedString,
})

const bodyDiagramConfig = z.object({
  view: z.enum(['front', 'back', 'side', 'hands', 'feet']),
})

const romDiagramConfig = z.object({
  region: z.enum(['cervical', 'thoracic', 'lumbar']),
})

const signatureConfig = z.object({})

export const fieldTypeEnum = z.enum([
  'narrative',
  'text',
  'select',
  'radio',
  'date',
  'scale',
  'checkboxGroup',
  'checkboxWithText',
  'repeaterTable',
  'table',
  'legend',
  'bodyDiagram',
  'romDiagram',
  'signature',
])

export type FieldType = z.infer<typeof fieldTypeEnum>

export const fieldConfigByType = {
  narrative: narrativeConfig,
  text: textConfig,
  scale: scaleConfig,
  select: selectConfig,
  checkboxGroup: checkboxGroupConfig,
  checkboxWithText: checkboxWithTextConfig,
  radio: radioConfig,
  date: dateConfig,
  repeaterTable: repeaterTableConfig,
  table: tableConfig,
  legend: legendConfig,
  bodyDiagram: bodyDiagramConfig,
  romDiagram: romDiagramConfig,
  signature: signatureConfig,
} as const satisfies Record<FieldType, z.ZodType>
