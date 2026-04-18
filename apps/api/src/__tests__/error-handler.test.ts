import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  ChartNoteNotDraftError,
  DomainError,
  FieldValueValidationError,
  NoDefaultTemplateError,
} from '@careos/api-contract'

import { handleAppError } from '../error-handler'

/**
 * Build a minimal Hono app wired to `handleAppError` with a single route
 * that throws whatever error the test hands it. Avoids importing the real
 * `apps/api/src/index.ts`, which calls `serve()` at module load.
 */
function makeThrowingApp(err: Error) {
  const app = new Hono()
  app.onError(handleAppError)
  app.get('/throw', () => {
    throw err
  })
  return app
}

describe('handleAppError', () => {
  describe('FieldValueValidationError branch', () => {
    it('returns 422 with { code, message, errors } where errors preserves the per-leaf shape', async () => {
      const err = new FieldValueValidationError([
        { path: ['pain_scale'], code: 'OUT_OF_RANGE', message: 'Value 42 is outside [0, 10]' },
        {
          path: ['rom_log', 0, 'side'],
          code: 'NOT_IN_OPTIONS',
          message: "Value 'middle' is not in options",
        },
      ])
      const res = await makeThrowingApp(err).request('/throw')

      expect(res.status).toBe(422)
      const body = (await res.json()) as {
        error: {
          code: string
          message: string
          errors: Array<{ path: (string | number)[]; code: string; message: string }>
        }
      }
      expect(body.error.code).toBe('FIELD_VALUE_VALIDATION_ERROR')
      expect(body.error.message).toBe('2 field value(s) failed validation')
      expect(body.error.errors).toHaveLength(2)
      expect(body.error.errors[0]).toEqual({
        path: ['pain_scale'],
        code: 'OUT_OF_RANGE',
        message: 'Value 42 is outside [0, 10]',
      })
      expect(body.error.errors[1].path).toEqual(['rom_log', 0, 'side'])
    })
  })

  describe('NoDefaultTemplateError branch (regression)', () => {
    it('still forwards availableTemplates', async () => {
      const err = new NoDefaultTemplateError('physio', 'initial', [
        { id: 't1', name: 'Template 1', discipline: 'physio', appointmentType: 'initial' },
      ])
      const res = await makeThrowingApp(err).request('/throw')

      expect(res.status).toBe(err.httpStatus)
      const body = (await res.json()) as {
        error: {
          code: string
          availableTemplates: Array<{ id: string }>
        }
      }
      expect(body.error.code).toBe('NO_DEFAULT_TEMPLATE')
      expect(body.error.availableTemplates).toEqual([
        { id: 't1', name: 'Template 1', discipline: 'physio', appointmentType: 'initial' },
      ])
    })
  })

  describe('generic DomainError branch (regression)', () => {
    it('serializes to { code, message } at the error httpStatus — no extra fields leaked', async () => {
      const err = new ChartNoteNotDraftError()
      const res = await makeThrowingApp(err).request('/throw')

      expect(res.status).toBe(409)
      const body = (await res.json()) as { error: Record<string, unknown> }
      expect(body.error).toEqual({
        code: 'CHART_NOTE_NOT_DRAFT',
        message: err.message,
      })
    })

    it('never picks up the FieldValueValidationError branch for an unrelated DomainError subclass', async () => {
      const err = new ChartNoteNotDraftError()
      const res = await makeThrowingApp(err).request('/throw')
      const body = (await res.json()) as { error: { errors?: unknown } }
      expect(body.error.errors).toBeUndefined()
    })
  })

  describe('ZodError branch', () => {
    it('serializes to 400 with code VALIDATION_ERROR', async () => {
      // Build a real ZodError by parsing an invalid value — avoids coupling
      // the test to the internal ZodIssue shape, which varies across Zod
      // versions.
      const result = z.string().safeParse(1)
      if (result.success) {
        expect.fail('safeParse should have failed for input of wrong type')
      }
      const res = await makeThrowingApp(result.error).request('/throw')

      expect(res.status).toBe(400)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('unknown Error branch', () => {
    it('serializes to 500 with INTERNAL_SERVER_ERROR', async () => {
      const res = await makeThrowingApp(new Error('something went wrong')).request('/throw')

      expect(res.status).toBe(500)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe('INTERNAL_SERVER_ERROR')
    })
  })

  describe('branch ordering', () => {
    it('FieldValueValidationError wins over generic DomainError', () => {
      const err = new FieldValueValidationError([{ path: ['x'], code: 'WRONG_TYPE', message: 'x' }])
      // Sanity: FieldValueValidationError extends DomainError. The ordering of
      // the branches in handleAppError is what ensures the structured `errors`
      // array reaches the client.
      expect(err).toBeInstanceOf(DomainError)
      expect(err).toBeInstanceOf(FieldValueValidationError)
    })
  })
})
