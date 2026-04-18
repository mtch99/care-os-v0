import { z } from 'zod'

export const startSessionSchema = z.object({
  appointmentId: z.uuid(),
  practitionerId: z.uuid(),
})
