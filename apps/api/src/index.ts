import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { ZodError } from 'zod'
import { DomainError } from '@careos/api-contract'
import { schedulingRoutes } from './routes/scheduling'
import { clinicalRoutes } from './routes/clinical'
import { chartingRoutes } from './routes/charting'
import { env } from './env'
import { serve as serveInngest } from 'inngest/hono'
import { inngest } from '@careos/inngest/client'

const app = new Hono()

app.onError((err, c) => {
  if (err instanceof DomainError) {
    return c.json(
      { error: { code: err.code, message: err.message } },
      err.httpStatus as ContentfulStatusCode,
    )
  }
  if (err instanceof ZodError) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: err.message } }, 400)
  }
  console.error(err)
  return c.json(
    { error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
    500,
  )
})

app.route('/api/scheduling', schedulingRoutes)
app.route('/api/clinical', clinicalRoutes)
app.route('/api/charting', chartingRoutes)

app.get('/health', (c) => c.json({ status: 'ok' }))

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`API running at http://localhost:${String(info.port)}`)
})

const inngestApp = new Hono()

inngestApp.on(
  ['GET', 'PUT', 'POST'],
  '/api/inngest',
  serveInngest({
    client: inngest,
    functions: inngest.funcs,
  }),
)

serve({ fetch: inngestApp.fetch, port: 9376 }, (info) => {
  console.log(`Inngest API running at http://localhost:${String(info.port)}`)
})
