import type {TranslationProvider} from './providers/types'
import {LANGUAGE_SETTINGS_DOC_ID} from './shared'
import type {
  AutoI18nConfig,
  LanguageEntry,
  LocaleValue,
  PortableTextBlockLike,
  QueryableClient,
} from './shared'

export type {LanguageEntry, LocaleValue, PortableTextBlockLike, QueryableClient}

export function hasContent(value: string | PortableTextBlockLike[] | undefined): boolean {
  return Array.isArray(value) ? value.length > 0 : Boolean(value)
}

/**
 * Hashes the source value as it was at translation time. Not cryptographic — it
 * only has to detect change.
 *
 * The result is stored on every translated entry as `sourceHash`. On the next run,
 * a different hash means the source text was edited since, so the existing
 * translation is treated as stale and regenerated even though it already holds a
 * `value`.
 */
export function hashSourceValue(value: string | PortableTextBlockLike[]): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0
  }
  return hash.toString(36)
}

/**
 * Many translation APIs — MyMemory chief among them — strip leading and trailing
 * whitespace from the text they return. When a span ends or begins with a space
 * (say "...we " before a bold span), that space is lost and the next span welds
 * onto the previous one: "...weare...".
 *
 * Splitting the whitespace off before translating and re-attaching it afterwards
 * keeps the spacing between consecutive spans exactly as it was, whatever the API
 * decides to do with the edges.
 */
function splitOuterWhitespace(text: string): {leading: string; core: string; trailing: string} {
  const match = text.match(/^(\s*)([\s\S]*?)(\s*)$/)
  if (!match) return {leading: '', core: text, trailing: ''}
  const [, leading, core, trailing] = match
  return {leading, core, trailing}
}

/**
 * Translates an array of Portable Text blocks while preserving their structure:
 * each span is translated on its own and keeps its `marks` (bold, italic) on the
 * translated text. Non-text blocks (images, custom objects) and empty spans are
 * copied through untouched.
 *
 * Works in two passes — collect every translatable span across the whole array,
 * translate them, then put the results back. The collect-first shape is what makes
 * batching possible: a provider that implements `translateTexts` gets all the spans
 * of a field in one round trip instead of one request each, which on a long
 * rich-text field is the difference between a handful of calls and hundreds.
 *
 * Known trade-off: translating span by span rather than whole sentences can hurt
 * fluency when a sentence is broken up by inline formatting ("the **black** cat"
 * becomes two separate segments). It is the price of preserving marks against APIs
 * that only translate plain text.
 */
async function translateBlocks(
  blocks: PortableTextBlockLike[],
  sourceLang: string,
  targetLang: string,
  provider: TranslationProvider,
): Promise<PortableTextBlockLike[]> {
  // First pass: find what needs translating and remember where each result goes.
  const slots: Array<{block: number; child: number; leading: string; trailing: string}> = []
  const texts: string[] = []

  blocks.forEach((block, blockIndex) => {
    const children = block.children
    if (block._type !== 'block' || !Array.isArray(children)) return

    children.forEach((rawChild, childIndex) => {
      const child = rawChild as Record<string, unknown>
      const text = child.text
      if (child._type !== 'span' || typeof text !== 'string' || !text.trim()) return
      const {leading, core, trailing} = splitOuterWhitespace(text)
      slots.push({block: blockIndex, child: childIndex, leading, trailing})
      texts.push(core)
    })
  })

  if (slots.length === 0) return blocks

  const translated = provider.translateTexts
    ? await provider.translateTexts(texts, sourceLang, targetLang)
    : await translateSequentially(texts, sourceLang, targetLang, provider)

  if (translated.length !== texts.length) {
    throw new Error(
      `Translation provider returned ${translated.length} results for ${texts.length} texts`,
    )
  }

  // Second pass: rebuild the blocks with the translated text in place.
  const byBlock = new Map<number, Map<number, string>>()
  slots.forEach((slot, i) => {
    const perChild = byBlock.get(slot.block) ?? new Map<number, string>()
    perChild.set(slot.child, slot.leading + translated[i] + slot.trailing)
    byBlock.set(slot.block, perChild)
  })

  return blocks.map((block, blockIndex) => {
    const perChild = byBlock.get(blockIndex)
    const children = block.children
    if (!perChild || !Array.isArray(children)) return block
    return {
      ...block,
      children: children.map((child, childIndex) => {
        const text = perChild.get(childIndex)
        if (text === undefined) return child
        // Object.assign onto a fresh object rather than a spread: same result, but
        // it does not fall foul of the "spread inside map" rule, which flags the
        // pattern as needlessly allocating.
        return Object.assign({}, child as Record<string, unknown>, {text})
      }),
    }
  })
}

/**
 * Fallback for providers with no batch endpoint. Sequential on purpose: firing these
 * in parallel would hammer APIs with tight rate limits, MyMemory above all.
 */
async function translateSequentially(
  texts: string[],
  sourceLang: string,
  targetLang: string,
  provider: TranslationProvider,
): Promise<string[]> {
  const out: string[] = []
  for (const text of texts) {
    out.push(await provider.translateText(text, sourceLang, targetLang))
  }
  return out
}

function isLocaleValueArray(val: unknown): val is LocaleValue[] {
  return (
    Array.isArray(val) && val.some((item) => (item as {_type?: string})?._type === 'localeValue')
  )
}

export interface InternationalizedFieldPath {
  /**
   * Sanity patch path: `"title"` for a top-level field, or
   * `tags[_key=="k1"].value` for one nested a single level inside an array of
   * objects (as `autoI18n.stringList` produces).
   */
  path: string
  /** The array of localeValue items found at that point in the document. */
  values: LocaleValue[]
}

/**
 * Fields Sanity owns. Descending into them can only waste time — and `_type` in
 * particular must never be mistaken for content.
 */
const SYSTEM_FIELDS = new Set(['_id', '_type', '_rev', '_key', '_createdAt', '_updatedAt'])

/**
 * How deep to walk before giving up. Sanity documents are not deeply nested in
 * practice; the limit exists purely so that a cyclic or pathological structure
 * cannot hang the Studio.
 */
const MAX_DEPTH = 12

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

/**
 * Finds every internationalized field in a document — that is, every array whose
 * items carry `_type: 'localeValue'` — wherever it sits.
 *
 * The walk descends through object fields (`seo.title`) and through arrays of
 * keyed objects (`sections[_key=="a"].items[_key=="b"].title`), at any depth,
 * building the Sanity patch path segment by segment as it goes.
 *
 * Two things are deliberately skipped, because neither can be addressed by a
 * patch path: items of an array that have no `_key`, and anything below them.
 * Positional indexes would be an alternative, but they shift the moment an
 * editor reorders the array, so a patch built on one can silently hit the wrong
 * item.
 *
 * An earlier version only looked at the top level and one level inside an array
 * of objects. Anything else — most commonly an i18n field inside a plain object
 * field — was silently left untranslated: no error, no mention in the pending
 * count, just a field the "Translate missing" button quietly ignored.
 */
export function findInternationalizedFieldPaths(
  doc: Record<string, unknown>,
): InternationalizedFieldPath[] {
  const results: InternationalizedFieldPath[] = []
  // Guards against cyclic references: a real document has none, but these
  // functions are exported, so a hand-built object could.
  const seen = new WeakSet<object>()

  function walk(node: unknown, prefix: string, depth: number): void {
    if (depth > MAX_DEPTH || !isPlainObject(node)) return
    if (seen.has(node)) return
    seen.add(node)

    for (const [key, val] of Object.entries(node)) {
      if (SYSTEM_FIELDS.has(key)) continue

      const path = prefix ? `${prefix}.${key}` : key

      if (isLocaleValueArray(val)) {
        results.push({path, values: val})
        continue
      }

      if (Array.isArray(val)) {
        for (const item of val) {
          if (!isPlainObject(item)) continue
          const itemKey = item._key
          // Without a `_key` there is no stable way to address the item in a
          // patch, so the item and everything inside it is skipped.
          if (typeof itemKey !== 'string') continue
          walk(item, `${path}[_key=="${itemKey}"]`, depth + 1)
        }
        continue
      }

      if (isPlainObject(val)) {
        walk(val, path, depth + 1)
      }
    }
  }

  walk(doc, '', 0)
  return results
}

export interface PendingTranslation {
  fieldPath: string
  targetLang: string
}

/**
 * Lists the field/language pairs that are missing or stale relative to their
 * source, without calling the translation API at all.
 *
 * This is what decides whether to show the "translations out of date" banner, and
 * whether a Sanity Function has any reason to do work — both without spending API
 * quota.
 */
export function findPendingTranslations(
  doc: Record<string, unknown>,
  sourceLang: string,
  targetLangs: string[],
): PendingTranslation[] {
  const pending: PendingTranslation[] = []

  for (const {path, values} of findInternationalizedFieldPaths(doc)) {
    const sourceValue = values.find((v) => v._key === sourceLang)?.value
    if (!hasContent(sourceValue)) continue

    const sourceHash = hashSourceValue(sourceValue as string | PortableTextBlockLike[])

    for (const targetLang of targetLangs) {
      const existing = values.find((v) => v._key === targetLang)
      const isStale = existing?.sourceHash !== sourceHash
      if (hasContent(existing?.value) && !isStale) continue
      pending.push({fieldPath: path, targetLang})
    }
  }

  return pending
}

/**
 * Derives the source language and the target languages from an already-loaded
 * list of configured languages.
 *
 * Pure and synchronous on purpose: it is the single place that decides "which
 * language do we translate from", shared by the async `fetchLanguageSettings`
 * and by every caller that already holds the languages and must not pay for
 * another query to re-derive the same answer.
 */
export function resolveLanguages(
  languages: LanguageEntry[],
  config: AutoI18nConfig,
): {sourceLang: string; targetLangs: string[]} {
  const sourceLang =
    languages.find((l) => l.isDefault)?.code || config.defaultSourceLanguage || 'en'
  return {
    sourceLang,
    targetLangs: languages.map((l) => l.code).filter((code) => code !== sourceLang),
  }
}

/**
 * Reads the "Language Settings" singleton and resolves which language is the
 * source and which ones are translation targets.
 *
 * Throws when no language is configured — there is nothing sensible to translate
 * from or into, and failing loudly here produces a far clearer message than any
 * downstream symptom would.
 */
export async function fetchLanguageSettings(
  client: QueryableClient,
  config: AutoI18nConfig,
): Promise<{sourceLang: string; targetLangs: string[]}> {
  const langSettings = await client.fetch<{supportedLanguages: LanguageEntry[]} | null>(
    `*[_id == $id][0]{supportedLanguages}`,
    {id: LANGUAGE_SETTINGS_DOC_ID},
  )
  const languages = langSettings?.supportedLanguages || []
  if (languages.length === 0) {
    throw new Error('No language configured in autoI18n.languageSettings')
  }

  return resolveLanguages(languages, config)
}

/** A single Sanity patch produced by {@link buildTranslationPatches}. */
export type TranslationPatch =
  | {set: Record<string, string | PortableTextBlockLike[]>}
  | {insert: {after: string; items: LocaleValue[]}}

/** Optional hooks for observing {@link buildTranslationPatches} as it runs. */
export interface BuildTranslationPatchesOptions {
  /**
   * Called with each patch the moment it is built, before the next translation
   * request goes out.
   *
   * Apply patches from here when partial progress matters. Translation runs one
   * API call per field per language and can fail halfway through — a rate limit,
   * an exhausted quota, a dropped connection. Waiting for the returned array means
   * a failure on the last call discards every translation that already succeeded;
   * applying from this callback keeps them.
   */
  onPatch?: (patch: TranslationPatch) => void
  /**
   * Called after every field/language pair completes, with how many are done out
   * of how many were pending when the run started. Use it to report progress on
   * long runs.
   */
  onProgress?: (completed: number, total: number) => void
}

/**
 * Translates every missing or stale field in the document using the given provider
 * and returns the Sanity patches to apply.
 *
 * It does not apply them: the caller decides when and how — `patch.execute()` from
 * a Studio action, or `client.mutate()` inside a Sanity Function. Pass
 * `options.onPatch` to receive each patch as it is produced, which is what lets a
 * caller keep partial progress when a run fails midway.
 *
 * Errors from the provider are not swallowed: they propagate to the caller. Any
 * patch already handed to `onPatch` stays valid.
 */
export async function buildTranslationPatches(
  doc: Record<string, unknown>,
  sourceLang: string,
  targetLangs: string[],
  provider: TranslationProvider,
  options: BuildTranslationPatchesOptions = {},
): Promise<TranslationPatch[]> {
  const patches: TranslationPatch[] = []
  const total = findPendingTranslations(doc, sourceLang, targetLangs).length
  let completed = 0

  for (const {path, values} of findInternationalizedFieldPaths(doc)) {
    const sourceValue = values.find((v) => v._key === sourceLang)?.value
    if (!hasContent(sourceValue)) continue

    const sourceHash = hashSourceValue(sourceValue as string | PortableTextBlockLike[])

    for (const targetLang of targetLangs) {
      const existing = values.find((v) => v._key === targetLang)
      // An existing translation is skipped only if it has content AND its
      // `sourceHash` matches the source's current hash. A missing `sourceHash`
      // (an entry translated before this check existed, or written by hand) counts
      // as stale and gets regenerated: there is no way to tell whether it still
      // matches the current source.
      const isStale = existing?.sourceHash !== sourceHash
      if (hasContent(existing?.value) && !isStale) continue

      const translated = Array.isArray(sourceValue)
        ? await translateBlocks(sourceValue, sourceLang, targetLang, provider)
        : await provider.translateText(sourceValue as string, sourceLang, targetLang)

      // A provider returning an empty string must not produce a patch. The entry
      // would stay without content, so it would still count as pending next time
      // round. In the Studio that is a wasted click; in the Sanity Function the
      // write regenerates an `update` event, which restarts the Function, which
      // writes empty again — a loop that never settles and that spends a billable
      // Azure call on every turn.
      if (!hasContent(translated)) {
        completed += 1
        options.onProgress?.(completed, total)
        continue
      }

      const patch: TranslationPatch = existing
        ? // `existing` here means "an item with this _key is already there", with an
          // empty or stale `value`. It has to be overwritten with `set`, not
          // `setIfMissing`, which does nothing when the field is present at all —
          // empty or stale included.
          {
            set: {
              [`${path}[_key=="${targetLang}"].value`]: translated,
              [`${path}[_key=="${targetLang}"].sourceHash`]: sourceHash,
            },
          }
        : {
            insert: {
              after: `${path}[-1]`,
              items: [{_key: targetLang, _type: 'localeValue', value: translated, sourceHash}],
            },
          }

      patches.push(patch)
      options.onPatch?.(patch)
      completed += 1
      options.onProgress?.(completed, total)
    }
  }

  return patches
}
