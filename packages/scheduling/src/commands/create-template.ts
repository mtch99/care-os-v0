import { eq, and } from 'drizzle-orm'
import type { DrizzleDB } from '@careos/db'
import { chartNoteTemplates } from '@careos/db'

export interface CreateTemplateInput {
  name: string
  discipline: string
  appointmentType: string
  content: unknown
  isDefault: boolean
  createdBy: string
}

export interface CreateTemplateResult {
  template: {
    id: string
    name: string
    discipline: string
    appointmentType: string
    content: unknown
    version: number
    parentTemplateId: string | null
    isDefault: boolean
    isArchived: boolean
    createdBy: string
    createdAt: Date
    updatedAt: Date
  }
}

/**
 * Create a chart note template.
 *
 * Transaction script shape: validate -> write -> return.
 *
 * If isDefault is true, atomically unsets the previous default for the same
 * discipline x appointmentType pair before inserting.
 *
 * Semantic validation (TemplateSchema.validate) and structural validation
 * (Zod parse) happen at the route boundary before this script is called.
 */
export async function createTemplate(
  db: DrizzleDB,
  input: CreateTemplateInput,
): Promise<CreateTemplateResult> {
  const template = await db.transaction(async (tx) => {
    // 1. If isDefault, atomically unset the previous default
    if (input.isDefault) {
      await tx
        .update(chartNoteTemplates)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          and(
            eq(chartNoteTemplates.discipline, input.discipline),
            eq(
              chartNoteTemplates.appointmentType,
              input.appointmentType as 'initial' | 'follow_up',
            ),
            eq(chartNoteTemplates.isDefault, true),
          ),
        )
    }

    // 2. Insert new template
    const [row] = await tx
      .insert(chartNoteTemplates)
      .values({
        name: input.name,
        discipline: input.discipline,
        appointmentType: input.appointmentType as 'initial' | 'follow_up',
        content: input.content,
        isDefault: input.isDefault,
        createdBy: input.createdBy,
      })
      .returning()

    return row
  })

  // 3. Emit domain event (console.log for v0.1 — will be replaced by Inngest)
  console.log(
    `[event] template.created`,
    JSON.stringify({
      templateId: template.id,
      discipline: template.discipline,
      appointmentType: template.appointmentType,
      version: template.version,
    }),
  )

  return {
    template: {
      id: template.id,
      name: template.name,
      discipline: template.discipline,
      appointmentType: template.appointmentType,
      content: template.content,
      version: template.version,
      parentTemplateId: template.parentTemplateId,
      isDefault: template.isDefault,
      isArchived: template.isArchived,
      createdBy: template.createdBy,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    },
  }
}
