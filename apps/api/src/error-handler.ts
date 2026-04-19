import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { ZodError } from 'zod'
import {
  DomainError,
  FieldValueValidationError,
  NoDefaultTemplateError,
} from '@careos/api-contract'

/**
 * Single source of truth for how application errors are serialized to HTTP.
 *
 * Kept in its own module (not inlined in index.ts) so tests can exercise it
 * without importing index.ts — which calls `serve()` at module load and boots
 * two HTTP servers as a side effect.
 *
 * Branch order matters: more specific DomainError subclasses that need to
 * forward extra structured fields (availableTemplates, errors, …) must sit
 * above the generic DomainError branch.
 */
export function handleAppError(err: Error, c: Context): Response {
  if (err instanceof NoDefaultTemplateError) {
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          availableTemplates: err.availableTemplates,
        },
      },
      err.httpStatus as ContentfulStatusCode,
    )
  }
  if (err instanceof FieldValueValidationError) {
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          errors: err.errors,
        },
      },
      err.httpStatus as ContentfulStatusCode,
    )
  }
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
}
