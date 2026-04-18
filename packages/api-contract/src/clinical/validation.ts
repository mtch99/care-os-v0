import { z } from 'zod'

import { templateContentSchemaV2 } from './template-content-schema'

export const disciplineEnum = z.enum(['physiotherapy', 'ergotherapy'])

export const appointmentTypeEnum = z.enum(['initial', 'follow_up'])

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  discipline: disciplineEnum,
  appointmentType: appointmentTypeEnum,
  content: templateContentSchemaV2,
  isDefault: z.boolean().optional().default(false),
})

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  content: templateContentSchemaV2.optional(),
})

export const listTemplatesQuerySchema = z.object({
  discipline: disciplineEnum.optional(),
  appointmentType: appointmentTypeEnum.optional(),
  isArchived: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
})

export const defaultTemplateQuerySchema = z.object({
  discipline: disciplineEnum,
  appointmentType: appointmentTypeEnum,
})

export const initializeChartNoteSchema = z.object({
  sessionId: z.uuid(),
  discipline: disciplineEnum,
  appointmentType: appointmentTypeEnum,
})

export const generateAiDraftSchema = z.object({
  rawNotes: z.string().min(1),
})

export const markReadyForSignatureSchema = z.object({
  version: z.number().int().positive(),
})

export const reopenChartNoteSchema = z.object({
  version: z.number().int().positive(),
})
