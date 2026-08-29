/**
 * Constants and types with no dependency on `sanity`, on React, or on the browser.
 *
 * This module exists so that `translationCore` and the providers can be imported
 * from a plain Node process — a Sanity Function, a migration script, a test — without
 * dragging in the Studio runtime. Everything the framework-free entry point
 * (`sanity-plugin-i18n/core`) exposes bottoms out here.
 *
 * Nothing in this file may import from `../config`, which registers a Sanity schema
 * type and therefore pulls in `sanity` and `@sanity/icons` at runtime.
 */

/** Fixed ID of the singleton settings document, used for direct fetches and patches. */
export const LANGUAGE_SETTINGS_DOC_ID = 'autoI18n.languageSettings'

/**
 * A Portable Text block, described structurally rather than imported from
 * `@portabletext/editor`.
 *
 * The real type would be a better description, but importing it would make
 * `@portabletext/editor` a type-level dependency of the framework-free entry point —
 * which is exactly what a Sanity Function must not need to install. The shape is
 * loose on purpose: this code only ever reads `_type` and `children`, and copies
 * everything else through untouched. The fields are listed individually rather than
 * behind an index signature, because `PortableTextBlock` has no index signature and
 * would not be assignable to one.
 */
export interface PortableTextBlockLike {
  _type: string
  _key?: string
  children?: unknown[]
  markDefs?: unknown[]
  style?: string
  listItem?: string
  level?: number
}

/** One row of the `supportedLanguages` array in the settings singleton. */
export interface LanguageEntry {
  code: string
  label: string
  isDefault?: boolean
}

/** One per-language entry inside an internationalized field. */
export interface LocaleValue {
  _key: string
  _type: string
  value?: string | PortableTextBlockLike[]
  sourceHash?: string
}

/**
 * The only thing the core needs from a Sanity client: the ability to run a query.
 *
 * Structural rather than `SanityClient` so that `@sanity/client` and `sanity` both
 * satisfy it without either becoming a dependency here. A real `SanityClient` is
 * assignable to this, so existing callers are unaffected.
 */
export interface QueryableClient {
  fetch<R>(query: string, params?: Record<string, unknown>): Promise<R>
}

/**
 * Options passed to the plugin in `sanity.config.ts`.
 *
 * The example is fenced on purpose: an unfenced one makes the TSDoc parser
 * read `{` and `@` in the sample code as malformed inline tags, which surfaces
 * as build warnings on every `pkg-utils build`.
 *
 * ```ts
 * plugins: [
 *   autoI18nPlugin({
 *     provider: 'mymemory', // optional, defaults to 'mymemory'
 *     apiKey: process.env.SANITY_STUDIO_MYMEMORY_KEY, // optional, but recommended
 *     email: 'you@example.com', // optional, raises the MyMemory rate limit
 *     defaultSourceLanguage: 'en',
 *   }),
 * ]
 * ```
 *
 * @public
 */
export interface AutoI18nConfig {
  /**
   * Translation engine. Defaults to `'mymemory'`, which is called straight from
   * the browser: the "Translate missing" action and the banner button both work
   * synchronously, with no extra setup.
   *
   * With `'azure'` the plugin does NOT translate on its own. An Azure Translator
   * subscription key must never reach the Studio bundle, so translation runs in a
   * server-side Sanity Function that fires whenever a document is saved (see
   * `azure-function-template/` in the plugin repo). In that mode the action is not
   * registered at all and the banner only reports how many fields are pending.
   */
  provider?: 'mymemory' | 'azure'
  /** Your MyMemory API key. Without one the rate limit is considerably lower. */
  apiKey?: string
  /** Email passed to MyMemory for a higher rate limit. Works without an API key. */
  email?: string
  /** Source language to fall back on when no configured language is marked as default. */
  defaultSourceLanguage?: string
}
