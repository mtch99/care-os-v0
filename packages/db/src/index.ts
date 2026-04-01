import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as shared from './schema/shared';
import * as scheduling from './schema/scheduling';
import * as clinical from './schema/clinical';
import { env } from './env';

const client = postgres(env.DATABASE_URL, {
  max:             env.DB_POOL_MAX,
  idle_timeout:    env.DB_IDLE_TIMEOUT,
  connect_timeout: env.DB_CONNECT_TIMEOUT,
  ssl:             env.DB_SSL,
});

export const db = drizzle(client, {
  schema: { ...shared, ...scheduling, ...clinical },
});

export type DrizzleDB = typeof db;

// Re-export schemas
export * from './schema/shared';
export * from './schema/scheduling';
export * from './schema/clinical';