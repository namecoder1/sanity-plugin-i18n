/**
 * The path segment Sanity uses to address an array item by key. Here the key is
 * always a language code.
 */
interface KeyedSegmentLike {
  _key: string
}

/** A marker — validation or presence — carrying the path it refers to. */
interface PathedMarker {
  path: ReadonlyArray<unknown>
}

/**
 * True when the marker belongs to this language's item.
 *
 * Validation and presence reach the field carrying the full path of the node they
 * refer to; for an array item the first segment is `{_key: '<language>'}`. Without
 * this routing, a validation error on the German translation would also show up on
 * the English tab.
 */
export function belongsToLanguage(path: ReadonlyArray<unknown>, langCode: string): boolean {
  const [first] = path
  return (
    typeof first === 'object' &&
    first !== null &&
    '_key' in first &&
    (first as KeyedSegmentLike)._key === langCode
  )
}

/**
 * Groups markers by language code, dropping any that belong to none of the
 * configured languages — markers on the field as a whole, for instance, which have
 * no tab to belong to.
 */
export function groupByLanguage<T extends PathedMarker>(
  markers: readonly T[] | undefined,
  langCodes: readonly string[],
): Map<string, T[]> {
  const byLang = new Map<string, T[]>()
  for (const marker of markers ?? []) {
    for (const code of langCodes) {
      if (!belongsToLanguage(marker.path, code)) continue
      const list = byLang.get(code)
      if (list) list.push(marker)
      else byLang.set(code, [marker])
    }
  }
  return byLang
}
