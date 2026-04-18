import { describe, it, expect } from 'vitest'
import { templateContentSchemaV2 } from '@careos/api-contract'

import {
  physioInitialEval,
  physioFollowUpSoap,
  ergoInitialEval,
  ergoFollowUpSoap,
} from '..'

/**
 * Loud-fail test for fixture drift against the current template schema.
 *
 * The db package historically relied on TypeScript inference alone to gate
 * fixture correctness, but Zod schemas carry runtime constraints (like
 * `key: z.string().min(1)` on option-bearing configs) that a structural
 * type annotation does not enforce — TS is lenient on nested option arrays
 * with a single missing field. This test closes that gap: any fixture drift
 * fails with a clear Zod path, not a misleading `NOT_IN_OPTIONS` 422 at the
 * first saveDraft.
 *
 * Added in CAR-122 alongside the seed-time parse, as the primary forcing
 * function for keeping fixtures in sync with the schema.
 */
describe('fixture schema parse', () => {
  it('physioInitialEval parses under the current templateContentSchemaV2', () => {
    expect(() => templateContentSchemaV2.parse(physioInitialEval)).not.toThrow()
  })

  it('physioFollowUpSoap parses under the current templateContentSchemaV2', () => {
    expect(() => templateContentSchemaV2.parse(physioFollowUpSoap)).not.toThrow()
  })

  it('ergoInitialEval parses under the current templateContentSchemaV2', () => {
    expect(() => templateContentSchemaV2.parse(ergoInitialEval)).not.toThrow()
  })

  it('ergoFollowUpSoap parses under the current templateContentSchemaV2', () => {
    expect(() => templateContentSchemaV2.parse(ergoFollowUpSoap)).not.toThrow()
  })
})
