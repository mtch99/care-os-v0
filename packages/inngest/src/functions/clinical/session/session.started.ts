import { inngest } from '../../../client'
import { sessionStarted } from '../../../client'

export const createSessionStartedFunction = (createFn: typeof inngest.createFunction) =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  createFn(
    {
      id: 'session-started',
      triggers: [sessionStarted],
    },
    // eslint-disable-next-line @typescript-eslint/require-await
    async () => {
      throw new Error('Not implemented')
    },
  ) as any // eslint-disable-line @typescript-eslint/no-explicit-any
