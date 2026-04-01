import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.url(),
  DB_POOL_MAX:         z.coerce.number().int().positive().optional(),
  DB_IDLE_TIMEOUT:     z.coerce.number().int().nonnegative().optional(),
  DB_CONNECT_TIMEOUT:  z.coerce.number().int().positive().optional(),
  DB_SSL:              z.enum(['true', 'false']).transform(v => v === 'true').optional(),
});

export const env = schema.parse(process.env);
