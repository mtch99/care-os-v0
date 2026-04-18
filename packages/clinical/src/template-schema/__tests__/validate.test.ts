import { describe, it, expect } from 'vitest'
import { TemplateValidationError } from '@careos/api-contract'
import type { TemplateContentV2 } from '@careos/api-contract'
import { validateTemplateSemantics } from '../validate'

function makeTemplate(overrides: Partial<TemplateContentV2> = {}): TemplateContentV2 {
  return {
    schemaVersion: '0.3',
    locale: ['fr', 'en'],
    pages: [
      {
        key: 'pg1',
        label: { fr: 'Page 1', en: 'Page 1' },
        sections: [
          {
            key: 's1',
            label: { fr: 'Section 1', en: 'Section 1' },
            rows: [
              {
                columns: [
                  {
                    key: 'field_a',
                    label: { fr: 'Champ A', en: 'Field A' },
                    type: 'text',
                    required: false,
                    config: {},
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  }
}

describe('validateTemplateSemantics', () => {
  it('accepts a valid template without throwing', () => {
    expect(() => {
      validateTemplateSemantics(makeTemplate())
    }).not.toThrow()
  })

  it('rejects duplicate field keys within the same page', () => {
    const template = makeTemplate({
      pages: [
        {
          key: 'pg1',
          label: { fr: 'Page 1', en: 'Page 1' },
          sections: [
            {
              key: 's1',
              label: { fr: 'Section 1', en: 'Section 1' },
              rows: [
                {
                  columns: [
                    {
                      key: 'pain_level',
                      label: { fr: 'Douleur', en: 'Pain' },
                      type: 'scale',
                      required: true,
                      config: { min: 0, max: 10 },
                    },
                    {
                      key: 'pain_level',
                      label: { fr: 'Douleur (bis)', en: 'Pain (dup)' },
                      type: 'scale',
                      required: false,
                      config: { min: 0, max: 10 },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })

    expect(() => {
      validateTemplateSemantics(template)
    }).toThrow(TemplateValidationError)
    try {
      validateTemplateSemantics(template)
    } catch (e) {
      const err = e as TemplateValidationError
      expect(err.details).toHaveLength(1)
      expect(err.details[0]).toContain('pain_level')
    }
  })

  it('rejects duplicate field keys across different pages', () => {
    const template = makeTemplate({
      pages: [
        {
          key: 'pg1',
          label: { fr: 'Page 1', en: 'Page 1' },
          sections: [
            {
              key: 's1',
              label: { fr: 'Section 1', en: 'Section 1' },
              rows: [
                {
                  columns: [
                    {
                      key: 'shared_key',
                      label: { fr: 'Champ', en: 'Field' },
                      type: 'text',
                      required: false,
                      config: {},
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          key: 'pg2',
          label: { fr: 'Page 2', en: 'Page 2' },
          sections: [
            {
              key: 's2',
              label: { fr: 'Section 2', en: 'Section 2' },
              rows: [
                {
                  columns: [
                    {
                      key: 'shared_key',
                      label: { fr: 'Champ', en: 'Field' },
                      type: 'text',
                      required: false,
                      config: {},
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })

    expect(() => {
      validateTemplateSemantics(template)
    }).toThrow(TemplateValidationError)
    try {
      validateTemplateSemantics(template)
    } catch (e) {
      const err = e as TemplateValidationError
      expect(err.details[0]).toContain('shared_key')
      expect(err.details[0]).toContain("page 'pg2'")
    }
  })

  it('rejects missing locale in a field label', () => {
    const template = makeTemplate({
      pages: [
        {
          key: 'pg1',
          label: { fr: 'Page 1', en: 'Page 1' },
          sections: [
            {
              key: 's1',
              label: { fr: 'Section 1', en: 'Section 1' },
              rows: [
                {
                  columns: [
                    {
                      key: 'field_a',
                      label: { fr: 'Champ A' } as { fr: string; en: string },
                      type: 'text',
                      required: false,
                      config: {},
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })

    expect(() => {
      validateTemplateSemantics(template)
    }).toThrow(TemplateValidationError)
    try {
      validateTemplateSemantics(template)
    } catch (e) {
      const err = e as TemplateValidationError
      expect(err.details.some((d) => d.includes("Missing locale 'en'"))).toBe(true)
    }
  })

  it('collects multiple errors in a single pass', () => {
    const template = makeTemplate({
      pages: [
        {
          key: 'pg1',
          label: { fr: 'Page 1' } as { fr: string; en: string },
          sections: [
            {
              key: 's1',
              label: { fr: 'Section 1', en: 'Section 1' },
              rows: [
                {
                  columns: [
                    {
                      key: 'dup',
                      label: { fr: 'A', en: 'A' },
                      type: 'text',
                      required: false,
                      config: {},
                    },
                    {
                      key: 'dup',
                      label: { fr: 'B', en: 'B' },
                      type: 'text',
                      required: false,
                      config: {},
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })

    try {
      validateTemplateSemantics(template)
      expect.unreachable('should have thrown')
    } catch (e) {
      const err = e as TemplateValidationError
      // At least: 1 duplicate key + 1 missing locale on page label
      expect(err.details.length).toBeGreaterThanOrEqual(2)
      expect(err.details.some((d) => d.includes('Duplicate field key'))).toBe(true)
      expect(err.details.some((d) => d.includes("Missing locale 'en'"))).toBe(true)
    }
  })
})
