import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { eq, and, sql, max, type SQL } from 'drizzle-orm'
import { db, chartNoteTemplates } from '@careos/db'
import {
  createTemplateSchema,
  updateTemplateSchema,
  listTemplatesQuerySchema,
  defaultTemplateQuerySchema,
  initializeChartNoteSchema,
  TemplateNotFoundError,
  DefaultTemplateNotFoundError,
  CannotArchiveDefaultTemplateError,
  TemplateArchivedError,
  DefaultAlreadyExistsError,
} from '@careos/api-contract'
import { TemplateSchema } from '@careos/clinical'
import { initializeChartNote } from '@careos/scheduling'
import { makeChartNotePorts } from '../composition/clinical-ports'

export const clinicalRoutes = new Hono()

// Hardcoded auth for v0.1
const HARDCODED_PRACTITIONER_ID = '0323c4a0-28e8-48cd-aed0-d57bf170a948'

// POST /templates — create new template
clinicalRoutes.post('/templates', async (c) => {
  const input = createTemplateSchema.parse(await c.req.json())
  TemplateSchema.validate(input.content)

  if (input.isDefault) {
    const existing = await db.query.chartNoteTemplates.findFirst({
      where: and(
        eq(chartNoteTemplates.discipline, input.discipline),
        eq(chartNoteTemplates.appointmentType, input.appointmentType),
        eq(chartNoteTemplates.isDefault, true),
      ),
    })
    if (existing) {
      throw new DefaultAlreadyExistsError(input.discipline, input.appointmentType)
    }
  }

  const [template] = await db
    .insert(chartNoteTemplates)
    .values({
      name: input.name,
      discipline: input.discipline,
      appointmentType: input.appointmentType,
      content: input.content,
      isDefault: input.isDefault,
      createdBy: HARDCODED_PRACTITIONER_ID,
    })
    .returning()

  return c.json({ data: template }, 201)
})

// GET /templates — list templates with optional filters
clinicalRoutes.get('/templates', async (c) => {
  // Must be defined before /templates/:id to avoid route conflicts
  // but Hono handles this correctly with exact path matching
  const raw = c.req.query()

  // Skip parsing for the /default sub-route (handled separately)
  const query = listTemplatesQuerySchema.parse(raw)

  const conditions: SQL[] = [eq(chartNoteTemplates.isArchived, query.isArchived)]

  if (query.discipline) {
    conditions.push(eq(chartNoteTemplates.discipline, query.discipline))
  }
  if (query.appointmentType) {
    conditions.push(eq(chartNoteTemplates.appointmentType, query.appointmentType))
  }

  const templates = await db
    .select()
    .from(chartNoteTemplates)
    .where(and(...conditions))

  return c.json({ data: templates })
})

// GET /templates/default — get default template for discipline+appointmentType
clinicalRoutes.get('/templates/default', async (c) => {
  const query = defaultTemplateQuerySchema.parse(c.req.query())

  const template = await db.query.chartNoteTemplates.findFirst({
    where: and(
      eq(chartNoteTemplates.discipline, query.discipline),
      eq(chartNoteTemplates.appointmentType, query.appointmentType),
      eq(chartNoteTemplates.isDefault, true),
    ),
  })

  if (!template) {
    throw new DefaultTemplateNotFoundError(query.discipline, query.appointmentType)
  }

  return c.json({ data: template })
})

// GET /templates/:id — get template by ID
clinicalRoutes.get('/templates/:id', async (c) => {
  const { id } = c.req.param()

  const template = await db.query.chartNoteTemplates.findFirst({
    where: eq(chartNoteTemplates.id, id),
  })

  if (!template) {
    throw new TemplateNotFoundError(id)
  }

  return c.json({ data: template })
})

// PUT /templates/:id — create new version
clinicalRoutes.put('/templates/:id', async (c) => {
  const { id } = c.req.param()
  const input = updateTemplateSchema.parse(await c.req.json())

  const result = await db.transaction(async (tx) => {
    // 1. Fetch current template
    const current = await tx.query.chartNoteTemplates.findFirst({
      where: eq(chartNoteTemplates.id, id),
    })

    if (!current) {
      throw new TemplateNotFoundError(id)
    }
    if (current.isArchived) {
      throw new TemplateArchivedError(id)
    }

    // 2. Determine root template ID
    const rootTemplateId = current.parentTemplateId ?? current.id

    // 3. Find latest version number for this chain
    const [{ maxVersion }] = await tx
      .select({ maxVersion: max(chartNoteTemplates.version) })
      .from(chartNoteTemplates)
      .where(
        sql`${chartNoteTemplates.id} = ${rootTemplateId} OR ${chartNoteTemplates.parentTemplateId} = ${rootTemplateId}`,
      )

    const nextVersion = (maxVersion ?? 1) + 1

    // 4. If current was default, unset it
    if (current.isDefault) {
      await tx
        .update(chartNoteTemplates)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(chartNoteTemplates.id, current.id))
    }

    // 5. Validate new content semantically if provided
    if (input.content) {
      TemplateSchema.validate(input.content)
    }

    // 6. Insert new version
    const [newVersion] = await tx
      .insert(chartNoteTemplates)
      .values({
        name: input.name ?? current.name,
        discipline: current.discipline,
        appointmentType: current.appointmentType,
        content: input.content ?? current.content,
        version: nextVersion,
        parentTemplateId: rootTemplateId,
        isDefault: current.isDefault,
        isArchived: false,
        createdBy: HARDCODED_PRACTITIONER_ID,
      })
      .returning()

    return newVersion
  })

  return c.json({ data: result })
})

// PATCH /templates/:id/set-default — reassign default
clinicalRoutes.patch('/templates/:id/set-default', async (c) => {
  const { id } = c.req.param()

  const result = await db.transaction(async (tx) => {
    // 1. Fetch target template
    const target = await tx.query.chartNoteTemplates.findFirst({
      where: eq(chartNoteTemplates.id, id),
    })

    if (!target) {
      throw new TemplateNotFoundError(id)
    }
    if (target.isArchived) {
      throw new TemplateArchivedError(id)
    }

    // 2. Unset current default for same discipline+appointmentType
    await tx
      .update(chartNoteTemplates)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(
        and(
          eq(chartNoteTemplates.discipline, target.discipline),
          eq(chartNoteTemplates.appointmentType, target.appointmentType),
          eq(chartNoteTemplates.isDefault, true),
        ),
      )

    // 3. Set target as default
    const [updated] = await tx
      .update(chartNoteTemplates)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(chartNoteTemplates.id, id))
      .returning()

    return updated
  })

  return c.json({ data: result })
})

// DELETE /templates/:id — soft-delete (archive)
// eslint-disable-next-line drizzle/enforce-delete-with-where
clinicalRoutes.delete('/templates/:id', async (c) => {
  const { id } = c.req.param()

  const template = await db.query.chartNoteTemplates.findFirst({
    where: eq(chartNoteTemplates.id, id),
  })

  if (!template) {
    throw new TemplateNotFoundError(id)
  }
  if (template.isDefault) {
    throw new CannotArchiveDefaultTemplateError(id)
  }

  const [archived] = await db
    .update(chartNoteTemplates)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(eq(chartNoteTemplates.id, id))
    .returning()

  return c.json({ data: archived })
})

// ── Chart Note Initialization ──

const ports = makeChartNotePorts()

clinicalRoutes.post('/chart-notes/initialize', async (c) => {
  const input = initializeChartNoteSchema.parse(await c.req.json())
  const result = await initializeChartNote(
    {
      sessionId: input.sessionId,
      discipline: input.discipline,
      appointmentType: input.appointmentType,
      practitionerId: HARDCODED_PRACTITIONER_ID,
    },
    ports,
  )
  const status = result.created ? 201 : 200
  return c.json(result, status as ContentfulStatusCode)
})
