import {describe, expect, it} from 'vitest'

import {belongsToLanguage, groupByLanguage} from './localeMarkers'

describe('belongsToLanguage', () => {
  it('matches a keyed first segment', () => {
    expect(belongsToLanguage([{_key: 'en'}, 'value'], 'en')).toBe(true)
  })

  it('does not match another language', () => {
    expect(belongsToLanguage([{_key: 'de'}, 'value'], 'en')).toBe(false)
  })

  it('does not match a path that starts with a plain field name', () => {
    expect(belongsToLanguage(['value'], 'en')).toBe(false)
  })

  it('does not match an empty path (a marker on the field as a whole)', () => {
    expect(belongsToLanguage([], 'en')).toBe(false)
  })

  it('does not throw on unexpected segment shapes', () => {
    expect(belongsToLanguage([null], 'en')).toBe(false)
    expect(belongsToLanguage([0], 'en')).toBe(false)
    expect(belongsToLanguage([{}], 'en')).toBe(false)
  })
})

describe('groupByLanguage', () => {
  it('routes each marker to its own language', () => {
    const en = {path: [{_key: 'en'}, 'value']}
    const de = {path: [{_key: 'de'}, 'value']}
    const grouped = groupByLanguage([en, de], ['en', 'de'])

    expect(grouped.get('en')).toEqual([en])
    expect(grouped.get('de')).toEqual([de])
  })

  it('keeps several markers for the same language', () => {
    const a = {path: [{_key: 'en'}, 'value']}
    const b = {path: [{_key: 'en'}, 'sourceHash']}
    expect(groupByLanguage([a, b], ['en'])).toEqual(new Map([['en', [a, b]]]))
  })

  it('drops markers that belong to no configured language', () => {
    // A marker on the field as a whole has no tab to belong to.
    const fieldLevel = {path: []}
    const other = {path: [{_key: 'fr'}, 'value']}
    expect(groupByLanguage([fieldLevel, other], ['en', 'de']).size).toBe(0)
  })

  it('returns an empty map for undefined markers', () => {
    expect(groupByLanguage(undefined, ['en']).size).toBe(0)
  })
})
