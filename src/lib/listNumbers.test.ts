import {describe, expect, it} from 'vitest'

import {computeListNumbers, type ListBlockLike} from './listNumbers'

const item = (key: string, listItem: string, level = 1): ListBlockLike => ({
  _key: key,
  _type: 'block',
  listItem,
  level,
})
const paragraph = (key: string): ListBlockLike => ({_key: key, _type: 'block'})

const numbersOf = (blocks: ListBlockLike[]) => Object.fromEntries(computeListNumbers(blocks))

describe('computeListNumbers', () => {
  it('numbers consecutive items', () => {
    expect(numbersOf([item('a', 'number'), item('b', 'number'), item('c', 'number')])).toEqual({
      a: 1,
      b: 2,
      c: 3,
    })
  })

  it('restarts after a block that is not a list item', () => {
    expect(
      numbersOf([item('a', 'number'), item('b', 'number'), paragraph('p'), item('c', 'number')]),
    ).toEqual({a: 1, b: 2, c: 1})
  })

  it('restarts after an image or other non-text block', () => {
    expect(
      numbersOf([item('a', 'number'), {_key: 'img', _type: 'image'}, item('b', 'number')]),
    ).toEqual({a: 1, b: 1})
  })

  it('restarts when the list type changes at the same level', () => {
    expect(numbersOf([item('a', 'number'), item('b', 'bullet'), item('c', 'number')])).toEqual({
      a: 1,
      c: 1,
    })
  })

  it('keeps the outer count across a nested sub-list', () => {
    expect(
      numbersOf([
        item('a', 'number'),
        item('a1', 'number', 2),
        item('a2', 'number', 2),
        item('b', 'number'),
        item('b1', 'number', 2),
      ]),
    ).toEqual({a: 1, a1: 1, a2: 2, b: 2, b1: 1})
  })

  it('keeps the count under a nested bullet list', () => {
    expect(numbersOf([item('a', 'number'), item('x', 'bullet', 2), item('b', 'number')])).toEqual({
      a: 1,
      b: 2,
    })
  })

  it('returns the same map for the same array', () => {
    const blocks = [item('a', 'number')]
    expect(computeListNumbers(blocks)).toBe(computeListNumbers(blocks))
  })
})
