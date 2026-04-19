import { z } from 'zod'

const schema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().min(1).optional(),
})

export const env = schema.parse(process.env)
