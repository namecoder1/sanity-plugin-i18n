/** The fields of a Portable Text block that decide list numbering. */
export interface ListBlockLike {
  _key?: string
  _type?: string
  listItem?: string
  level?: number
}

const cache = new WeakMap<readonly ListBlockLike[], Map<string, number>>()

/**
 * Position of every numbered list item, keyed by block `_key`.
 *
 * Follows the usual Portable Text rendering rules (the ones `@portabletext/react`
 * applies when it nests lists): items are numbered among the consecutive items of the
 * same type at the same level. Deeper items do not interrupt the outer count, so a
 * nested sub-list leaves "1. 2. 3." intact around it; a block that is not a list item,
 * or an item of a different type at the same level, starts again from 1.
 *
 * Cached per value array: the editor hands out a new array on every change and the
 * same one in between, so every list item of a render shares one pass.
 */
export function computeListNumbers(blocks: readonly ListBlockLike[]): Map<string, number> {
  const cached = cache.get(blocks)
  if (cached) return cached

  const numbers = new Map<string, number>()
  // One open counter per level: index 0 is level 1.
  let open: Array<{listItem: string; count: number} | undefined> = []

  for (const block of blocks) {
    if (block._type !== 'block' || !block.listItem) {
      open = []
      continue
    }
    const level = Math.max(1, block.level ?? 1)
    // Everything deeper than this item has ended.
    open = open.slice(0, level)
    const current = open[level - 1]
    const next =
      current && current.listItem === block.listItem
        ? {listItem: block.listItem, count: current.count + 1}
        : {listItem: block.listItem, count: 1}
    open[level - 1] = next
    if (block.listItem === 'number' && block._key) numbers.set(block._key, next.count)
  }

  cache.set(blocks, numbers)
  return numbers
}
