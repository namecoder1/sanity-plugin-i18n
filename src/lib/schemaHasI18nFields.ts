/**
 * Prefix shared by every type the plugin registers
 * (`autoI18n.string`, `.text`, `.blockContent`, `.stringList`).
 */
const TYPE_PREFIX = 'autoI18n.'

/**
 * The minimum shape of a schema type this check needs.
 *
 * Deliberately structural rather than Sanity's `SchemaType`: that type is large,
 * changes between majors, and none of it is needed to answer the question. The
 * narrower shape also makes the function testable with object literals, without
 * compiling a real schema.
 */
export interface SchemaTypeLike {
  name?: string
  /** The type this one extends, walking up to the intrinsic type. */
  type?: SchemaTypeLike | null
  fields?: Array<{name?: string; type?: SchemaTypeLike}>
  of?: SchemaTypeLike[]
}

/** True if the type, or any type it extends, is one of the plugin's own. */
function isI18nType(type: SchemaTypeLike | null | undefined): boolean {
  let current: SchemaTypeLike | null | undefined = type
  let guard = 0
  while (current && guard < 20) {
    if (current.name?.startsWith(TYPE_PREFIX)) return true
    current = current.type
    guard += 1
  }
  return false
}

/**
 * Reports whether a document type contains at least one internationalized field, at
 * any depth.
 *
 * Used to keep the "Translate missing" action off types with nothing to translate.
 * It used to be added to every type indiscriminately, permanently occupying the
 * space next to "Publish" — the most valuable spot in the interface — even where it
 * could do nothing.
 *
 * It does not follow `reference` fields: those point at another document, whose
 * fields are not part of this one and would not be touched by the patches anyway.
 */
export function documentTypeHasI18nFields(rootType: SchemaTypeLike | null | undefined): boolean {
  const seen = new WeakSet<object>()

  function walk(type: SchemaTypeLike | null | undefined, depth: number): boolean {
    if (!type || depth > 12) return false
    if (seen.has(type)) return false
    seen.add(type)

    if (isI18nType(type)) return true

    for (const field of type.fields ?? []) {
      if (isI18nType(field.type)) return true
      if (walk(field.type, depth + 1)) return true
    }

    for (const member of type.of ?? []) {
      if (isI18nType(member)) return true
      if (walk(member, depth + 1)) return true
    }

    // Custom types inherit fields by walking up the `type` chain, so that has to
    // be followed too: a custom `object` can carry the parent type's fields without
    // redeclaring them.
    return walk(type.type, depth + 1)
  }

  return walk(rootType, 0)
}
