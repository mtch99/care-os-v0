// Stub env vars required by packages/db/src/env.ts at module load time.
// Tests that need a real database should override DATABASE_URL in their own setup.
process.env.DATABASE_URL = 'postgres://localhost:5432/careos_test'
