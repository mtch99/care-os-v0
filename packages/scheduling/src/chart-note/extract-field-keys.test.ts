import { describe, it, expect } from 'vitest'

import { extractFieldKeys } from './extract-field-keys'

describe('extractFieldKeys', () => {
  it('Given a template with multiple pages, sections, rows, when extracting, then returns all field keys', () => {
    const content = {
      pages: [
        {
          sections: [
            {
              rows: [
                { columns: [{ key: 'field_a' }, { key: 'field_b' }] },
                { columns: [{ key: 'field_c' }] },
              ],
            },
          ],
        },
        {
          sections: [
            {
              rows: [{ columns: [{ key: 'field_d' }] }],
            },
          ],
        },
      ],
    }

    expect(extractFieldKeys(content)).toEqual(['field_a', 'field_b', 'field_c', 'field_d'])
  })

  it('Given a template with a single field, when extracting, then returns one key', () => {
    const content = {
      pages: [
        {
          sections: [
            {
              rows: [{ columns: [{ key: 'only_field' }] }],
            },
          ],
        },
      ],
    }

    expect(extractFieldKeys(content)).toEqual(['only_field'])
  })

  it('Given a template with no fields, when extracting, then returns empty array', () => {
    const content = {
      pages: [
        {
          sections: [
            {
              rows: [{ columns: [] }],
            },
          ],
        },
      ],
    }

    expect(extractFieldKeys(content)).toEqual([])
  })
})
