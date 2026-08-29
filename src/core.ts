/**
 * Framework-free entry point: `sanity-plugin-i18n/core`.
 *
 * Everything here runs on plain Node with no React, no `@sanity/ui` and no `sanity`
 * import — nothing from the Studio runtime. It exists so that server-side code can
 * reuse the plugin's translation logic instead of copying it.
 *
 * The concrete case is the Azure Sanity Function in `azure-function-template/`, which
 * previously kept a hand-maintained duplicate of the hashing and staleness rules.
 * That duplication was a real hazard: `hashSourceValue` has to stay byte-for-byte
 * equivalent on both sides or stale-translation detection stops working *silently*,
 * and nothing enforced it but discipline. Importing from here makes the module system
 * enforce it instead.
 *
 * Import the main entry (`sanity-plugin-i18n`) for anything that runs inside the
 * Studio; it re-exports all of this alongside the plugin itself.
 */

export {
  buildTranslationPatches,
  fetchLanguageSettings,
  findInternationalizedFieldPaths,
  findPendingTranslations,
  hasContent,
  hashSourceValue,
  resolveLanguages,
} from './lib/translationCore'

export type {
  BuildTranslationPatchesOptions,
  InternationalizedFieldPath,
  PendingTranslation,
  TranslationPatch,
} from './lib/translationCore'

export {createAzureProvider} from './lib/providers/azure'
export {createMyMemoryProvider} from './lib/providers/mymemory'
export type {AzureProviderOptions} from './lib/providers/azure'
export type {TranslationProvider} from './lib/providers/types'

export {LANGUAGE_SETTINGS_DOC_ID} from './lib/shared'
export type {
  AutoI18nConfig,
  LanguageEntry,
  LocaleValue,
  PortableTextBlockLike,
  QueryableClient,
} from './lib/shared'
