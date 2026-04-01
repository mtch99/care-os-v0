import type { InngestFunction } from "inngest";
import { inngest } from "../../../client";
import { eventType } from "inngest";
import { z } from "zod";

export const sessionStarted = eventType("clinical/session.started", {
  schema: z.object({
    sessionId: z.string(),
  }),
});

export const createSessionStartedFunction = (createFn: typeof inngest.createFunction) => createFn(
  { 
    id: "session-started", 
    triggers: [sessionStarted] },
  async ({
    event,
    logger
  }) => {
    throw new Error("Not implemented");
    // Your function code
    return { message: "Session started function executed" };
  }
) as any;
