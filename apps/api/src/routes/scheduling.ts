import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { db } from '@careos/db'
import { startSession } from '@careos/scheduling'
import { startSessionSchema } from '@careos/api-contract'
import { DomainError } from '@careos/api-contract'
import { inngest, sessionStarted } from '@careos/inngest/client'

export const schedulingRoutes = new Hono()

schedulingRoutes.post('/sessions', async (c) => {
  try {
    // 1. Validate
    const body = startSessionSchema.parse(await c.req.json())

    // 2. Execute
    const result = await startSession(db, {
      appointmentId: body.appointmentId,
      practitionerId: body.practitionerId,
    })

    const sessionStartedEvent = sessionStarted.create({
      sessionId: result.sessionId,
    })

    // 3. TODO: Emit Inngest event here
    await inngest.send(sessionStartedEvent)

    return c.json({ data: result })
  } catch (error) {
    if (error instanceof DomainError) {
      return c.json(
        { error: { code: error.code, message: error.message } },
        error.httpStatus as ContentfulStatusCode,
      )
    }
    throw error
  }
})
