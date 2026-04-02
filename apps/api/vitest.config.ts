// ⚠️  Never import apps/api/src/index.ts in tests — it calls serve() at the
// top level and starts two HTTP servers on import. Test route handlers directly
// via their exported Hono instances (e.g. schedulingRoutes) using app.request().
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    passWithNoTests: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
