import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { schedulingRoutes } from './routes/scheduling'
import { clinicalRoutes } from './routes/clinical'
import { chartingRoutes } from './routes/charting'
import { aiTemplateDraftRoutes } from './routes/ai-template-drafts'
import { env } from './env'
import { handleAppError } from './error-handler'
import { serve as serveInngest } from 'inngest/hono'
import { inngest } from '@careos/inngest/client'

const app = new Hono()

app.onError(handleAppError)

app.route('/api/scheduling', schedulingRoutes)
app.route('/api/clinical', clinicalRoutes)
app.route('/api/charting', chartingRoutes)
app.route('/api/templates', aiTemplateDraftRoutes)

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
