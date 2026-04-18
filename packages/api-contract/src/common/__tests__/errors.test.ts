import { describe, it, expect } from 'vitest'

import {
  DomainError,
  FieldValueValidationError,
  type FieldValueError,
} from '../errors'

describe('FieldValueValidationError', () => {
  it('is an instance of DomainError', () => {
    const err = new FieldValueValidationError([
      { path: ['pain_scale'], code: 'WRONG_TYPE', message: 'expected number' },
    ])
    expect(err).toBeInstanceOf(DomainError)
    expect(err).toBeInstanceOf(FieldValueValidationError)
  })

  it('has httpStatus 422 and the expected code', () => {
    const err = new FieldValueValidationError([
      { path: ['x'], code: 'WRONG_TYPE', message: 'bad' },
    ])
    expect(err.httpStatus).toBe(422)
    expect(err.code).toBe('FIELD_VALUE_VALIDATION_ERROR')
  })

  it('summarises the error count in the message', () => {
    const err = new FieldValueValidationError([
      { path: ['a'], code: 'C', message: 'x' },
      { path: ['b'], code: 'C', message: 'y' },
      { path: ['c'], code: 'C', message: 'z' },
    ])
    expect(err.message).toBe('3 field value(s) failed validation')
  })

  it('preserves the errors array verbatim, including nested paths', () => {
    const errors: FieldValueError[] = [
      { path: ['painLog', 2, 'col_b'], code: 'NOT_IN_OPTIONS', message: 'not in declared options' },
      { path: ['mechanism'], code: 'NOT_IN_OPTIONS', message: 'not in declared options' },
    ]
    const err = new FieldValueValidationError(errors)
    expect(err.errors).toEqual(errors)
    // Nested path is preserved, not flattened
    expect(err.errors[0]?.path).toEqual(['painLog', 2, 'col_b'])
  })

  it('throws when constructed with an empty errors array', () => {
    // A validator should never construct this with nothing wrong. Fail loudly
    // rather than surface a misleading "validation failed" response.
    expect(() => new FieldValueValidationError([])).toThrow(
      /constructed with no errors/,
    )
  })
})
