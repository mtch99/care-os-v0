import { z } from 'zod'

export const disciplineEnum = z.enum(['physiotherapy', 'ergotherapy'])

export const appointmentTypeEnum = z.enum(['initial', 'follow_up'])

const templateContentSchema = z.object({
  sections: z.array(z.string()).min(1),
})

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  discipline: disciplineEnum,
  appointmentType: appointmentTypeEnum,
  content: templateContentSchema,
  isDefault: z.boolean().optional().default(false),
})

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  content: templateContentSchema.optional(),
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
