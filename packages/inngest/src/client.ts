import { eventType, Inngest } from 'inngest'
import { z } from 'zod'
import { createSessionStartedFunction } from './functions/clinical/session/session.started'

export const sessionStarted = eventType('clinical/session.started', {
  schema: z.object({
    sessionId: z.string(),
  }),
})

export const userSignup = eventType('user/signup', {
  schema: z.object({
    email: z.email(),
    name: z.string(),
  }),
})

export const inngest = new Inngest({
  id: 'my-app',
})

export const functions = [createSessionStartedFunction(inngest.createFunction)]
