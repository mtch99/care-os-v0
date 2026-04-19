import { describe, it, expect } from 'vitest'
import { ZodError } from 'zod'
import { TemplateValidationError } from '@careos/api-contract'
import { TemplateSchema } from '../index'

const validContent = {
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
}

describe('TemplateSchema.parse', () => {
  it('returns typed TemplateContentV2 for valid input', () => {
    const result = TemplateSchema.parse(validContent)
    expect(result.schemaVersion).toBe('0.3')
    expect(result.pages).toHaveLength(1)
    expect(result.pages[0].sections[0].rows[0].columns[0].key).toBe('field_a')
  })

  it('throws ZodError for structurally invalid input (Pass 1)', () => {
    expect(() => {
      TemplateSchema.parse({ locale: validContent.locale, pages: validContent.pages })
    }).toThrow(ZodError)
  })

  it('throws TemplateValidationError for semantically invalid input (Pass 2)', () => {
    const duplicateKeys = {
      ...validContent,
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
                      key: 'same_key',
                      label: { fr: 'A', en: 'A' },
                      type: 'text',
                      required: false,
                      config: {},
                    },
                    {
                      key: 'same_key',
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
    }

    expect(() => TemplateSchema.parse(duplicateKeys)).toThrow(TemplateValidationError)
  })
})
