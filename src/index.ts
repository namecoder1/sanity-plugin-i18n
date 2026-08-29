import {EarthGlobeIcon} from '@sanity/icons/EarthGlobe'
import {definePlugin} from 'sanity'

import {createTranslateAction} from './actions/translateAction'
import {LanguageSettingsTool} from './components/LanguageSettingsTool'
import {createTranslationBanner} from './components/TranslationBanner'
import {languageSettingsType} from './config'
import type {AutoI18nConfig} from './config'
import {documentTypeHasI18nFields} from './lib/schemaHasI18nFields'
import {
  internationalizedStringType,
  internationalizedTextType,
  internationalizedBlockContentType,
  internationalizedStringListType,
} from './schemaTypes/internationalizedField'

export type {AutoI18nConfig}

// Exported for use in a server-side Sanity Function (the Azure provider in
// particular, which cannot run in the browser — see AutoI18nConfig.provider and
// src/lib/providers/azure.ts). The plugin uses them internally for the same
// reason: one source of truth for hashing, staleness and patch building, shared
// between the Studio (MyMemory, synchronous) and the Function (Azure, event-driven).
export {
  findInternationalizedFieldPaths,
  findPendingTranslations,
  hasContent,
  hashSourceValue,
  fetchLanguageSettings,
  resolveLanguages,
  buildTranslationPatches,
} from './lib/translationCore'
export type {
  PendingTranslation,
  LocaleValue,
  LanguageEntry,
  TranslationPatch,
  BuildTranslationPatchesOptions,
  InternationalizedFieldPath,
} from './lib/translationCore'
export type {TranslationProvider} from './lib/providers/types'
export {createMyMemoryProvider} from './lib/providers/mymemory'
export {createAzureProvider} from './lib/providers/azure'
export type {AzureProviderOptions} from './lib/providers/azure'
export {LANGUAGE_SETTINGS_DOC_ID} from './config'

// Optional helpers for anyone who wants a dedicated sidebar entry for the
// "Language Settings" singleton instead of the generic per-type list — see the
// TSDoc in structure.ts for how to use them in a custom `structure()`.
export {languageSettingsListItem, excludeLanguageSettingsType} from './structure'

/**
 * Usage in `sanity.config.ts` (or .js):
 *
 * ```ts
 * import {defineConfig} from 'sanity'
 * import {autoI18nPlugin} from 'sanity-plugin-i18n'
 *
 * export default defineConfig({
 *   // ...
 *   plugins: [
 *     autoI18nPlugin({
 *       apiKey: process.env.SANITY_STUDIO_MYMEMORY_KEY,
 *       email: 'you@example.com',
 *       defaultSourceLanguage: 'en',
 *     }),
 *   ],
 * })
 * ```
 *
 * @public
 */
export const autoI18nPlugin = definePlugin<AutoI18nConfig | void>((config = {}) => {
  const resolvedConfig: AutoI18nConfig = config || {}

  return {
    name: 'sanity-plugin-i18n',
    schema: {
      types: [
        languageSettingsType,
        internationalizedStringType,
        internationalizedTextType,
        internationalizedBlockContentType,
        internationalizedStringListType,
      ],
    },
    document: {
      actions: (prev, context) => {
        // "Language Settings" is a singleton with a fixed ID, so "Duplicate" and
        // "Delete" have to go: either one would let a user end up with a second
        // copy, or with none at all.
        if (context.schemaType === languageSettingsType.name) {
          return prev.filter((action) => !['duplicate', 'delete'].includes(action.action ?? ''))
        }

        // With provider 'azure' translation does not run in the browser (the key
        // cannot live there): a Sanity Function does it on save. The manual action
        // would have nothing to run, so it is not registered at all.
        if (resolvedConfig.provider === 'azure') return prev

        // Only on types that actually have internationalized fields: anywhere else
        // the action would occupy the space next to "Publish" without being able to
        // do anything.
        if (!documentTypeHasI18nFields(context.schema.get(context.schemaType))) return prev

        // Inserted right after the first action (normally "Publish") rather than at
        // the end: the Studio renders only the leading actions as visible buttons and
        // pushes the rest into the "···" overflow menu. Appending it (after Duplicate/
        // Delete/Unpublish) buried it at the bottom of that menu.
        const [primary, ...rest] = prev
        return primary
          ? [primary, createTranslateAction(resolvedConfig), ...rest]
          : [...prev, createTranslateAction(resolvedConfig)]
      },
      // Banner at the top of the form: harder to miss than the toolbar action,
      // which stays available all the same.
      components: {
        unstable_layout: createTranslationBanner(resolvedConfig),
      },
      // Removes the singleton's template from EVERY creation point: the global "+"
      // menu and the per-type "+" in the default Content list. Filtering only the
      // global menu was not enough — the type is not hidden (see the comment in
      // config.ts), so it stays listed in the Content list with its own "+".
      newDocumentOptions: (prev) => {
        return prev.filter((template) => template.templateId !== languageSettingsType.name)
      },
    },
    tools: (prev) => {
      return [
        ...prev,
        {
          name: 'auto-i18n-language-settings',
          title: 'Language Settings',
          icon: EarthGlobeIcon,
          component: LanguageSettingsTool,
        },
      ]
    },
  }
})
