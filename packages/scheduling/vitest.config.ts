import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    passWithNoTests: true,
    exclude: ['dist/**', 'node_modules/**'],
    env: {
      // Required by @careos/db env.ts which parses DATABASE_URL at import time.
      // Tests use fakes, not real DB connections.
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    },
  },
})
