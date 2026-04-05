import { z } from 'zod'

import { fieldConfigByType, fieldTypeEnum, localizedString } from './field-configs'

const fieldVariants = fieldTypeEnum.options.map((type) =>
  z.object({
    key: z.string().min(1),
    label: localizedString,
    type: z.literal(type),
    required: z.boolean(),
    config: fieldConfigByType[type],
  }),
)

const fieldSchema = z.discriminatedUnion(
  'type',
  fieldVariants as unknown as [
    (typeof fieldVariants)[number],
    ...(typeof fieldVariants)[number][],
  ],
)

const rowSchema = z.object({
  columns: z.array(fieldSchema).min(1),
})

const sectionSchema = z.object({
  key: z.string().min(1),
  label: localizedString,
  rows: z.array(rowSchema).min(1),
})

const pageSchema = z.object({
  key: z.string().min(1),
  label: localizedString,
  sections: z.array(sectionSchema).min(1),
})

export const templateContentSchemaV2 = z.object({
  schemaVersion: z.literal('0.2'),
  locale: z.array(z.string().min(1)).min(1),
  pages: z.array(pageSchema).min(1),
})

export type TemplateContentV2 = z.infer<typeof templateContentSchemaV2>
