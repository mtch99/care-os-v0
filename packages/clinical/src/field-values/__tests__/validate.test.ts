import { describe, it, expect } from 'vitest'
import { FieldValueValidationError } from '@careos/api-contract'
import type { TemplateContentV2 } from '@careos/api-contract'

import { FieldValueSchema } from '..'
import { validateFieldValues } from '../validate'

/**
 * Build a single-field template so each test focuses on one field type
 * without cross-contamination. The template is structurally valid per the
 * Zod schema in @careos/api-contract; the validator assumes that invariant.
 */
function makeTemplate(
  field: TemplateContentV2['pages'][number]['sections'][number]['rows'][number]['columns'][number],
): TemplateContentV2 {
  return {
    schemaVersion: '0.3',
    locale: ['fr', 'en'],
    pages: [
      {
        key: 'p1',
        label: { fr: 'Page', en: 'Page' },
        sections: [
          {
            key: 's1',
            label: { fr: 'Section', en: 'Section' },
            rows: [{ columns: [field] }],
          },
        ],
      },
    ],
  }
}

function expectValidationError(fn: () => void): FieldValueValidationError {
  try {
    fn()
  } catch (e) {
    expect(e).toBeInstanceOf(FieldValueValidationError)
    return e as FieldValueValidationError
  }
  expect.fail('expected FieldValueValidationError to be thrown')
}

describe('FieldValueSchema.validate / validateFieldValues', () => {
  describe('payload-level invariants', () => {
    it('passes on a valid payload across multiple field types', () => {
      const template: TemplateContentV2 = {
        schemaVersion: '0.3',
        locale: ['fr', 'en'],
        pages: [
          {
            key: 'p1',
            label: { fr: 'Page', en: 'Page' },
            sections: [
              {
                key: 's1',
                label: { fr: 'Section', en: 'Section' },
                rows: [
                  {
                    columns: [
                      {
                        key: 'summary',
                        label: { fr: 'Résumé', en: 'Summary' },
                        type: 'text',
                        required: false,
                        config: {},
                      },
                      {
                        key: 'pain_level',
                        label: { fr: 'Douleur', en: 'Pain' },
                        type: 'scale',
                        required: false,
                        config: { min: 0, max: 10, step: 1 },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }

      expect(() => {
        validateFieldValues({ summary: 'fine', pain_level: 7 }, template)
      }).not.toThrow()
    })

    it('accepts null for any field (draft incompleteness)', () => {
      const template = makeTemplate({
        key: 'pain_level',
        label: { fr: 'Douleur', en: 'Pain' },
        type: 'scale',
        required: true,
        config: { min: 0, max: 10, step: 1 },
      })
      expect(() => {
        validateFieldValues({ pain_level: null }, template)
      }).not.toThrow()
    })

    it('silently ignores payload keys not declared in the template', () => {
      const template = makeTemplate({
        key: 'summary',
        label: { fr: 'Résumé', en: 'Summary' },
        type: 'text',
        required: false,
        config: {},
      })
      expect(() => {
        validateFieldValues({ not_a_real_field: 'anything' }, template)
      }).not.toThrow()
    })

    it('passes on an empty payload', () => {
      const template = makeTemplate({
        key: 'summary',
        label: { fr: 'Résumé', en: 'Summary' },
        type: 'text',
        required: false,
        config: {},
      })
      expect(() => {
        validateFieldValues({}, template)
      }).not.toThrow()
    })

    it('collects errors across multiple invalid fields before throwing once', () => {
      const template: TemplateContentV2 = {
        schemaVersion: '0.3',
        locale: ['fr', 'en'],
        pages: [
          {
            key: 'p1',
            label: { fr: 'Page', en: 'Page' },
            sections: [
              {
                key: 's1',
                label: { fr: 'Section', en: 'Section' },
                rows: [
                  {
                    columns: [
                      {
                        key: 'pain_level',
                        label: { fr: 'Douleur', en: 'Pain' },
                        type: 'scale',
                        required: false,
                        config: { min: 0, max: 10, step: 1 },
                      },
                      {
                        key: 'injury_kind',
                        label: { fr: 'Blessure', en: 'Injury' },
                        type: 'select',
                        required: false,
                        config: {
                          options: [
                            { key: 'traumatic', fr: 'Traumatique', en: 'Traumatic' },
                            { key: 'repetitive', fr: 'Répétition', en: 'Repetitive' },
                          ],
                        },
                      },
                      {
                        key: 'rom_log',
                        label: { fr: 'Amplitude', en: 'ROM log' },
                        type: 'repeaterTable',
                        required: false,
                        config: {
                          columns: [
                            {
                              key: 'angle',
                              label: { fr: 'Angle', en: 'Angle' },
                              type: 'text',
                            },
                          ],
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }

      const err = expectValidationError(() => {
        validateFieldValues(
          {
            pain_level: 42,
            injury_kind: 'Unknown',
            rom_log: [{ angle: 90 }],
          },
          template,
        )
      })

      expect(err.errors).toHaveLength(3)
      expect(err.errors.map((e) => e.code).sort()).toEqual([
        'NOT_IN_OPTIONS',
        'OUT_OF_RANGE',
        'WRONG_TYPE',
      ])
    })
  })

  describe('text and narrative', () => {
    it('accepts a string', () => {
      const template = makeTemplate({
        key: 'summary',
        label: { fr: 'Résumé', en: 'Summary' },
        type: 'text',
        required: false,
        config: {},
      })
      expect(() => {
        validateFieldValues({ summary: 'ok' }, template)
      }).not.toThrow()
    })

    it('rejects a non-string with WRONG_TYPE', () => {
      const template = makeTemplate({
        key: 'summary',
        label: { fr: 'Résumé', en: 'Summary' },
        type: 'text',
        required: false,
        config: {},
      })
      const err = expectValidationError(() => {
        validateFieldValues({ summary: 42 }, template)
      })
      expect(err.errors).toEqual([
        { path: ['summary'], code: 'WRONG_TYPE', message: 'Expected a string' },
      ])
    })

    it('narrative accepts a string and rejects non-strings', () => {
      const template = makeTemplate({
        key: 'note',
        label: { fr: 'Note', en: 'Note' },
        type: 'narrative',
        required: false,
        config: {},
      })
      expect(() => {
        validateFieldValues({ note: 'free text' }, template)
      }).not.toThrow()
      const err = expectValidationError(() => {
        validateFieldValues({ note: 123 }, template)
      })
      expect(err.errors[0].code).toBe('WRONG_TYPE')
    })
  })

  describe('scale', () => {
    const scaleField = makeTemplate({
      key: 'pain_level',
      label: { fr: 'Douleur', en: 'Pain' },
      type: 'scale',
      required: false,
      config: { min: 0, max: 10, step: 1 },
    })

    it('accepts the min boundary', () => {
      expect(() => {
        validateFieldValues({ pain_level: 0 }, scaleField)
      }).not.toThrow()
    })

    it('accepts the max boundary', () => {
      expect(() => {
        validateFieldValues({ pain_level: 10 }, scaleField)
      }).not.toThrow()
    })

    it('rejects below min with OUT_OF_RANGE', () => {
      const err = expectValidationError(() => {
        validateFieldValues({ pain_level: -1 }, scaleField)
      })
      expect(err.errors[0].code).toBe('OUT_OF_RANGE')
    })

    it('rejects above max with OUT_OF_RANGE', () => {
      const err = expectValidationError(() => {
        validateFieldValues({ pain_level: 11 }, scaleField)
      })
      expect(err.errors[0].code).toBe('OUT_OF_RANGE')
    })

    it('rejects a non-integer step mismatch with NOT_ALIGNED_TO_STEP', () => {
      const err = expectValidationError(() => {
        validateFieldValues({ pain_level: 7.5 }, scaleField)
      })
      expect(err.errors[0].code).toBe('NOT_ALIGNED_TO_STEP')
    })

    it('accepts a step-aligned fractional value', () => {
      const halfStep = makeTemplate({
        key: 'pain_level',
        label: { fr: 'Douleur', en: 'Pain' },
        type: 'scale',
        required: false,
        config: { min: 0, max: 10, step: 0.5 },
      })
      expect(() => {
        validateFieldValues({ pain_level: 1.5 }, halfStep)
      }).not.toThrow()
    })

    it('uses float-safe alignment (no false positives on 0.1 + 0.2)', () => {
      const tenths = makeTemplate({
        key: 'v',
        label: { fr: 'V', en: 'V' },
        type: 'scale',
        required: false,
        config: { min: 0, max: 1, step: 0.1 },
      })
      expect(() => {
        validateFieldValues({ v: 0.1 + 0.2 }, tenths)
      }).not.toThrow()
    })

    it('skips step alignment when step is omitted', () => {
      const noStep = makeTemplate({
        key: 'v',
        label: { fr: 'V', en: 'V' },
        type: 'scale',
        required: false,
        config: { min: 0, max: 10 },
      })
      expect(() => {
        validateFieldValues({ v: 3.7 }, noStep)
      }).not.toThrow()
    })

    it('rejects non-number with WRONG_TYPE', () => {
      const err = expectValidationError(() => {
        validateFieldValues({ pain_level: 'seven' }, scaleField)
      })
      expect(err.errors[0].code).toBe('WRONG_TYPE')
    })

    it('rejects NaN and Infinity with WRONG_TYPE', () => {
      expect(
        expectValidationError(() => {
          validateFieldValues({ pain_level: NaN }, scaleField)
        }).errors[0].code,
      ).toBe('WRONG_TYPE')
      expect(
        expectValidationError(() => {
          validateFieldValues({ pain_level: Infinity }, scaleField)
        }).errors[0].code,
      ).toBe('WRONG_TYPE')
    })
  })

  describe('select', () => {
    const template = makeTemplate({
      key: 'injury_kind',
      label: { fr: 'Blessure', en: 'Injury' },
      type: 'select',
      required: false,
      config: {
        options: [
          { key: 'traumatic', fr: 'Traumatique', en: 'Traumatic' },
          { key: 'repetitive', fr: 'Répétition', en: 'Repetitive' },
        ],
      },
    })

    it('accepts a value matching option.key', () => {
      expect(() => {
        validateFieldValues({ injury_kind: 'traumatic' }, template)
      }).not.toThrow()
    })

    // CAR-122: matching is key-only. Sending the localized label is now a
    // NOT_IN_OPTIONS error — this test proves the old locale-permissive
    // behavior is gone.
    it('rejects a value that is the localized EN label with NOT_IN_OPTIONS', () => {
      const err = expectValidationError(() => {
        validateFieldValues({ injury_kind: 'Traumatic' }, template)
      })
      expect(err.errors[0].code).toBe('NOT_IN_OPTIONS')
    })

    it('rejects a value that is the localized FR label with NOT_IN_OPTIONS', () => {
      const err = expectValidationError(() => {
        validateFieldValues({ injury_kind: 'Traumatique' }, template)
      })
      expect(err.errors[0].code).toBe('NOT_IN_OPTIONS')
    })

    it('rejects an unknown value with NOT_IN_OPTIONS', () => {
      const err = expectValidationError(() => {
        validateFieldValues({ injury_kind: 'Mystery' }, template)
      })
      expect(err.errors[0].code).toBe('NOT_IN_OPTIONS')
    })

    it('rejects non-string with WRONG_TYPE', () => {
      const err = expectValidationError(() => {
        validateFieldValues({ injury_kind: 5 }, template)
      })
      expect(err.errors[0].code).toBe('WRONG_TYPE')
    })
  })

  describe('radio', () => {
    const template = makeTemplate({
      key: 'handedness',
      label: { fr: 'Dominance', en: 'Handedness' },
      type: 'radio',
      required: false,
      config: {
        options: [
          { key: 'left', fr: 'Gauche', en: 'Left' },
          { key: 'right', fr: 'Droite', en: 'Right' },
        ],
      },
    })

    it('accepts option.key', () => {
      expect(() => {
        validateFieldValues({ handedness: 'right' }, template)
      }).not.toThrow()
    })

    it('rejects localized label with NOT_IN_OPTIONS', () => {
      const err = expectValidationError(() => {
        validateFieldValues({ handedness: 'Right' }, template)
      })
      expect(err.errors[0].code).toBe('NOT_IN_OPTIONS')
    })

    it('rejects unknown with NOT_IN_OPTIONS', () => {
      const err = expectValidationError(() => {
        validateFieldValues({ handedness: 'Ambi' }, template)
      })
      expect(err.errors[0].code).toBe('NOT_IN_OPTIONS')
    })
  })

  describe('date', () => {
    const template = makeTemplate({
      key: 'onset',
      label: { fr: 'Début', en: 'Onset' },
      type: 'date',
      required: false,
      config: {},
    })

    it('accepts an ISO date string', () => {
      expect(() => {
        validateFieldValues({ onset: '2026-04-18' }, template)
      }).not.toThrow()
    })

    it('rejects a non-parseable string with INVALID_DATE', () => {
      const err = expectValidationError(() => {
        validateFieldValues({ onset: 'not a date' }, template)
      })
      expect(err.errors[0].code).toBe('INVALID_DATE')
    })

    it('rejects non-string with WRONG_TYPE', () => {
      const err = expectValidationError(() => {
        validateFieldValues({ onset: 1234567890 }, template)
      })
      expect(err.errors[0].code).toBe('WRONG_TYPE')
    })
  })

  describe('checkboxGroup', () => {
    const template = makeTemplate({
      key: 'symptoms',
      label: { fr: 'Symptômes', en: 'Symptoms' },
      type: 'checkboxGroup',
      required: false,
      config: {
        options: [
          { key: 'swelling', fr: 'Enflure', en: 'Swelling' },
          { key: 'redness', fr: 'Rougeur', en: 'Redness' },
          { key: 'warmth', fr: 'Chaleur', en: 'Warmth' },
        ],
      },
    })

    it('accepts a subset of options.key', () => {
      expect(() => {
        validateFieldValues({ symptoms: ['swelling', 'redness'] }, template)
      }).not.toThrow()
    })

    it('rejects an element that is the localized EN label with NOT_IN_OPTIONS at that index', () => {
      const err = expectValidationError(() => {
        validateFieldValues({ symptoms: ['swelling', 'Redness'] }, template)
      })
      expect(err.errors).toHaveLength(1)
      expect(err.errors[0].path).toEqual(['symptoms', 1])
      expect(err.errors[0].code).toBe('NOT_IN_OPTIONS')
    })

    it('accepts an empty array (clear-but-preserve-as-collection)', () => {
      expect(() => {
        validateFieldValues({ symptoms: [] }, template)
      }).not.toThrow()
    })

    it('rejects an unknown option with NOT_IN_OPTIONS at the element index', () => {
      const err = expectValidationError(() => {
        validateFieldValues({ symptoms: ['swelling', 'Mystery'] }, template)
      })
      expect(err.errors).toHaveLength(1)
      expect(err.errors[0].path).toEqual(['symptoms', 1])
      expect(err.errors[0].code).toBe('NOT_IN_OPTIONS')
      expect(err.errors[0].message).toContain('Mystery')
    })

    it('rejects non-array with WRONG_TYPE', () => {
      const err = expectValidationError(() => {
        validateFieldValues({ symptoms: 'swelling' }, template)
      })
      expect(err.errors[0].code).toBe('WRONG_TYPE')
    })

    it('rejects duplicates with DUPLICATE at the duplicate element index', () => {
      const err = expectValidationError(() => {
        validateFieldValues({ symptoms: ['swelling', 'swelling'] }, template)
      })
      expect(err.errors).toHaveLength(1)
      expect(err.errors[0].code).toBe('DUPLICATE')
      expect(err.errors[0].path).toEqual(['symptoms', 1])
    })
  })

  describe('checkboxWithText', () => {
    const template = makeTemplate({
      key: 'medications',
      label: { fr: 'Médicaments', en: 'Medications' },
      type: 'checkboxWithText',
      required: false,
      config: {
        items: [
          { key: 'ibuprofen', label: { fr: 'Ibuprofène', en: 'Ibuprofen' } },
          { key: 'acetaminophen', label: { fr: 'Acétaminophène', en: 'Acetaminophen' } },
        ],
      },
    })

    it('accepts valid items', () => {
      expect(() => {
        validateFieldValues(
          {
            medications: [
              { key: 'ibuprofen', checked: true, text: '400mg' },
              { key: 'acetaminophen', checked: false },
            ],
          },
          template,
        )
      }).not.toThrow()
    })

    it('rejects an item with an undeclared key using UNKNOWN_KEY at entry.key', () => {
      const err = expectValidationError(() => {
        validateFieldValues({ medications: [{ key: 'aspirin', checked: true }] }, template)
      })
      expect(err.errors).toHaveLength(1)
      expect(err.errors[0].code).toBe('UNKNOWN_KEY')
      expect(err.errors[0].path).toEqual(['medications', 0, 'key'])
    })

    it('rejects an item missing `checked` with WRONG_TYPE', () => {
      const err = expectValidationError(() => {
        validateFieldValues({ medications: [{ key: 'ibuprofen' }] }, template)
      })
      expect(err.errors).toHaveLength(1)
      expect(err.errors[0].code).toBe('WRONG_TYPE')
      expect(err.errors[0].path).toEqual(['medications', 0, 'checked'])
    })

    it('rejects a non-string `text` with WRONG_TYPE', () => {
      const err = expectValidationError(() => {
        validateFieldValues(
          { medications: [{ key: 'ibuprofen', checked: true, text: 400 }] },
          template,
        )
      })
      expect(err.errors[0].path).toEqual(['medications', 0, 'text'])
    })

    it('rejects non-array payload with WRONG_TYPE on the field', () => {
      const err = expectValidationError(() => {
        validateFieldValues({ medications: 'ibuprofen' }, template)
      })
      expect(err.errors[0].path).toEqual(['medications'])
      expect(err.errors[0].code).toBe('WRONG_TYPE')
      expect(err.errors[0].message).toContain('Expected')
    })
  })

  describe('repeaterTable', () => {
    // CAR-121: repeater `select` options share the keyed-localized shape with
    // top-level select, so these tests exercise the same matcher as the
    // top-level select/radio/checkboxGroup suites above.
    const template = makeTemplate({
      key: 'rom_log',
      label: { fr: 'Amplitude', en: 'ROM log' },
      type: 'repeaterTable',
      required: false,
      config: {
        columns: [
          { key: 'motion', label: { fr: 'Mouvement', en: 'Motion' }, type: 'text' },
          {
            key: 'side',
            label: { fr: 'Côté', en: 'Side' },
            type: 'select',
            options: [
              { key: 'left', fr: 'Gauche', en: 'Left' },
              { key: 'right', fr: 'Droite', en: 'Right' },
            ],
          },
          { key: 'notes', label: { fr: 'Notes', en: 'Notes' }, type: 'narrative' },
        ],
      },
    })

    it('accepts valid rows with option.key values', () => {
      expect(() => {
        validateFieldValues(
          {
            rom_log: [
              { motion: 'flex', side: 'left', notes: 'ok' },
              { motion: 'ext', side: 'right' },
            ],
          },
          template,
        )
      }).not.toThrow()
    })

    it('accepts an empty array', () => {
      expect(() => {
        validateFieldValues({ rom_log: [] }, template)
      }).not.toThrow()
    })

    it('rejects a row containing an unknown column key with UNKNOWN_COLUMN', () => {
      const err = expectValidationError(() => {
        validateFieldValues({ rom_log: [{ motion: 'flex', mystery: 'x' }] }, template)
      })
      expect(err.errors).toHaveLength(1)
      expect(err.errors[0].code).toBe('UNKNOWN_COLUMN')
      expect(err.errors[0].path).toEqual(['rom_log', 0, 'mystery'])
    })

    it('rejects a select cell value not matching any option.key', () => {
      const err = expectValidationError(() => {
        validateFieldValues({ rom_log: [{ motion: 'flex', side: 'middle' }] }, template)
      })
      expect(err.errors).toHaveLength(1)
      expect(err.errors[0].code).toBe('NOT_IN_OPTIONS')
      expect(err.errors[0].path).toEqual(['rom_log', 0, 'side'])
    })

    // Parity with top-level select (CAR-122): sending the localized label
    // instead of the key is a validation error, not a silent match.
    it('rejects a select cell value that is the EN label with NOT_IN_OPTIONS', () => {
      const err = expectValidationError(() => {
        validateFieldValues({ rom_log: [{ motion: 'flex', side: 'Left' }] }, template)
      })
      expect(err.errors).toHaveLength(1)
      expect(err.errors[0].code).toBe('NOT_IN_OPTIONS')
      expect(err.errors[0].path).toEqual(['rom_log', 0, 'side'])
    })

    it('rejects a select cell value that is the FR label with NOT_IN_OPTIONS', () => {
      const err = expectValidationError(() => {
        validateFieldValues({ rom_log: [{ motion: 'flex', side: 'Gauche' }] }, template)
      })
      expect(err.errors[0].code).toBe('NOT_IN_OPTIONS')
    })

    // A select column without an `options` array is a rare but schema-legal
    // shape (free-text-with-suggestions). It should still reject non-string
    // cells, but any string is accepted.
    it('accepts any string when the select column has no options array', () => {
      const freeSelect = makeTemplate({
        key: 'rom_log',
        label: { fr: 'Amplitude', en: 'ROM log' },
        type: 'repeaterTable',
        required: false,
        config: {
          columns: [
            {
              key: 'side',
              label: { fr: 'Côté', en: 'Side' },
              type: 'select',
            },
          ],
        },
      })
      expect(() => {
        validateFieldValues({ rom_log: [{ side: 'anything' }] }, freeSelect)
      }).not.toThrow()
    })

    it('includes rowIndex in the error path for nested failures', () => {
      const err = expectValidationError(() => {
        validateFieldValues(
          {
            rom_log: [{ motion: 'flex' }, { motion: 'ext' }, { motion: 42 }],
          },
          template,
        )
      })
      expect(err.errors).toHaveLength(1)
      expect(err.errors[0].path).toEqual(['rom_log', 2, 'motion'])
      expect(err.errors[0].code).toBe('WRONG_TYPE')
    })

    it('rejects non-array payload with WRONG_TYPE', () => {
      const err = expectValidationError(() => {
        validateFieldValues({ rom_log: { not: 'an array' } }, template)
      })
      expect(err.errors[0].code).toBe('WRONG_TYPE')
    })

    it('rejects a row that is not an object', () => {
      const err = expectValidationError(() => {
        validateFieldValues({ rom_log: ['not a row'] }, template)
      })
      expect(err.errors[0].path).toEqual(['rom_log', 0])
      expect(err.errors[0].code).toBe('WRONG_TYPE')
    })

    it('accepts null in a cell (clears the cell)', () => {
      expect(() => {
        validateFieldValues({ rom_log: [{ motion: 'flex', notes: null }] }, template)
      }).not.toThrow()
    })
  })

  describe('table', () => {
    const template = makeTemplate({
      key: 'grip_strength',
      label: { fr: 'Force', en: 'Grip strength' },
      type: 'table',
      required: false,
      config: { columns: ['left', 'right'], rows: ['trial1', 'trial2'] },
    })

    it('accepts a valid object shape', () => {
      expect(() => {
        validateFieldValues(
          { grip_strength: { trial1: { left: '40', right: '42' }, trial2: { left: '41' } } },
          template,
        )
      }).not.toThrow()
    })

    it('rejects an undeclared row key with UNKNOWN_ROW', () => {
      const err = expectValidationError(() => {
        validateFieldValues({ grip_strength: { trialX: { left: '40' } } }, template)
      })
      expect(err.errors[0].code).toBe('UNKNOWN_ROW')
      expect(err.errors[0].path).toEqual(['grip_strength', 'trialX'])
    })

    it('rejects an undeclared column key with UNKNOWN_COLUMN', () => {
      const err = expectValidationError(() => {
        validateFieldValues({ grip_strength: { trial1: { middle: '40' } } }, template)
      })
      expect(err.errors[0].code).toBe('UNKNOWN_COLUMN')
      expect(err.errors[0].path).toEqual(['grip_strength', 'trial1', 'middle'])
    })

    it('rejects a non-string cell value with WRONG_TYPE', () => {
      const err = expectValidationError(() => {
        validateFieldValues({ grip_strength: { trial1: { left: 40 } } }, template)
      })
      expect(err.errors[0].code).toBe('WRONG_TYPE')
      expect(err.errors[0].path).toEqual(['grip_strength', 'trial1', 'left'])
    })

    it('accepts when rows are undeclared (schema permits omitting them)', () => {
      const flexible = makeTemplate({
        key: 'grip',
        label: { fr: 'G', en: 'G' },
        type: 'table',
        required: false,
        config: { columns: ['left', 'right'] },
      })
      expect(() => {
        validateFieldValues({ grip: { anything: { left: 'a' } } }, flexible)
      }).not.toThrow()
    })

    it('rejects an array-shaped payload with WRONG_TYPE on the field', () => {
      const err = expectValidationError(() => {
        validateFieldValues({ grip_strength: [] }, template)
      })
      expect(err.errors[0].path).toEqual(['grip_strength'])
      expect(err.errors[0].code).toBe('WRONG_TYPE')
      expect(err.errors[0].message).toContain('Expected')
    })
  })

  describe('legend', () => {
    const template = makeTemplate({
      key: 'pain_key',
      label: { fr: 'Clé', en: 'Legend' },
      type: 'legend',
      required: false,
      config: { content: { fr: 'Échelle 0-10', en: 'Scale 0-10' } },
    })

    it('accepts null (legend has no value)', () => {
      expect(() => {
        validateFieldValues({ pain_key: null }, template)
      }).not.toThrow()
    })

    it('rejects any non-null value with LEGEND_HAS_NO_VALUE', () => {
      const err = expectValidationError(() => {
        validateFieldValues({ pain_key: 'anything' }, template)
      })
      expect(err.errors[0].code).toBe('LEGEND_HAS_NO_VALUE')
    })
  })

  describe('opaque blob types (passthrough)', () => {
    it('bodyDiagram accepts null and any non-null value', () => {
      const template = makeTemplate({
        key: 'pain_map',
        label: { fr: 'Carte', en: 'Map' },
        type: 'bodyDiagram',
        required: false,
        config: { view: 'front' },
      })
      expect(() => {
        validateFieldValues({ pain_map: null }, template)
      }).not.toThrow()
      expect(() => {
        validateFieldValues({ pain_map: { anything: 'goes' } }, template)
      }).not.toThrow()
      expect(() => {
        validateFieldValues({ pain_map: 'a string is fine too' }, template)
      }).not.toThrow()
    })

    it('romDiagram accepts any non-null value', () => {
      const template = makeTemplate({
        key: 'rom_map',
        label: { fr: 'ROM', en: 'ROM' },
        type: 'romDiagram',
        required: false,
        config: { region: 'cervical' },
      })
      expect(() => {
        validateFieldValues({ rom_map: [1, 2, 3] }, template)
      }).not.toThrow()
    })

    it('signature accepts any non-null value', () => {
      const template = makeTemplate({
        key: 'sig',
        label: { fr: 'Signature', en: 'Signature' },
        type: 'signature',
        required: false,
        config: {},
      })
      expect(() => {
        validateFieldValues({ sig: { png: 'base64data' } }, template)
      }).not.toThrow()
    })
  })

  describe('FieldValueSchema.parse', () => {
    it('returns the payload unchanged when validation passes', () => {
      const template = makeTemplate({
        key: 'summary',
        label: { fr: 'R', en: 'S' },
        type: 'text',
        required: false,
        config: {},
      })
      const payload = { summary: 'ok' }
      expect(FieldValueSchema.parse(payload, template)).toBe(payload)
    })

    it('throws FieldValueValidationError on failure', () => {
      const template = makeTemplate({
        key: 'summary',
        label: { fr: 'R', en: 'S' },
        type: 'text',
        required: false,
        config: {},
      })
      expect(() => {
        FieldValueSchema.parse({ summary: 1 }, template)
      }).toThrow(FieldValueValidationError)
    })
  })
})
