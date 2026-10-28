import {describe, expect, it} from 'vitest'

import enUS from './en-US'
import itIT from './it-IT'

describe('locale bundles', () => {
  it('have the same keys', () => {
    // Also enforced by the type of it-IT; checked here too for bundles a Studio adds
    // as plain objects, and because the type cannot catch an extra key.
    expect(Object.keys(itIT).sort()).toEqual(Object.keys(enUS).sort())
  })

  it.each([
    ['en-US', enUS],
    ['it-IT', itIT],
  ])('has no empty string in %s', (_locale, resources) => {
    const empty = Object.entries(resources).filter(([, value]) => !value.trim())
    expect(empty).toEqual([])
  })

  it('keeps every interpolation of en-US in it-IT', () => {
    const placeholders = (value: string) => (value.match(/\{\{\s*\w+\s*\}\}/g) ?? []).sort()
    for (const [key, value] of Object.entries(enUS)) {
      expect([key, placeholders(itIT[key as keyof typeof itIT])]).toEqual([
        key,
        placeholders(value),
      ])
    }
  })
})
