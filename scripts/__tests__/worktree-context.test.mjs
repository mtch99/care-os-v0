import { test } from 'node:test'
import assert from 'node:assert/strict'

import { sanitizeProjectName } from '../worktree-context.mjs'

test('preserves a clean slug', () => {
  assert.equal(
    sanitizeProjectName('feature-car-111-api-mark-chart-note-ready-for-signature'),
    'feature-car-111-api-mark-chart-note-ready-for-signature',
  )
})

test('lowercases and normalizes slashes and underscores', () => {
  assert.equal(sanitizeProjectName('Feature/CAR-96_Foo'), 'feature-car-96_foo')
})

test('strips leading and trailing dashes', () => {
  assert.equal(sanitizeProjectName('--leading-dashes--'), 'leading-dashes')
})

test('accepts a leading digit', () => {
  assert.equal(sanitizeProjectName('0-starts-with-digit'), '0-starts-with-digit')
})

test('collapses runs of invalid characters into a single dash', () => {
  assert.equal(sanitizeProjectName('careos  //  weird!!!name'), 'careos-weird-name')
})

test('throws on empty string', () => {
  assert.throws(() => sanitizeProjectName(''), /must not be empty/)
})

test('throws on whitespace-only string', () => {
  assert.throws(() => sanitizeProjectName('   '), /must not be empty/)
})

test('throws on input with no valid characters', () => {
  assert.throws(() => sanitizeProjectName('!!!'), /cannot be reduced/)
})

test('throws on non-string input', () => {
  assert.throws(() => sanitizeProjectName(null), /must be a string/)
})
