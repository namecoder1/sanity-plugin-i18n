import {EarthGlobeIcon} from '@sanity/icons/EarthGlobe'
import {defineType, defineField, defineArrayMember} from 'sanity'

import {LANGUAGE_SETTINGS_DOC_ID} from './lib/shared'
import type {AutoI18nConfig} from './lib/shared'

// Re-exported from here so that every existing import path keeps working. The
// definitions moved to `lib/shared.ts` because this module registers a schema type,
// which makes it depend on `sanity` at runtime — and the framework-free entry point
// (`sanity-plugin-i18n/core`) must not pull that in.
export {LANGUAGE_SETTINGS_DOC_ID}
export type {AutoI18nConfig}

/**
 * Singleton document defining which languages the Studio offers.
 *
 * Read both by the input component (to build the language tabs) and by the
 * translate action (to know which languages to translate into).
 */
export const languageSettingsType = defineType({
  name: 'autoI18n.languageSettings',
  title: 'Language Settings',
  type: 'document',
  icon: EarthGlobeIcon,
  // NOTE: deliberately no `hidden: () => true` here. On a whole document type that
  // flag does not just hide the type from lists and menus, it hides the FORM too —
  // the Studio then shows "This form is hidden" even on the legitimate singleton
  // opened from LanguageSettingsTool. Preventing duplicates is left entirely to
  // `document.newDocumentOptions` / `document.actions` in index.ts, which block
  // creation without breaking editing.
  __experimental_formPreviewTitle: false,
  preview: {
    select: {languages: 'supportedLanguages'},
    prepare({languages}: {languages?: {code?: string; label?: string; isDefault?: boolean}[]}) {
      const list = Array.isArray(languages) ? languages : []
      if (list.length === 0) {
        return {title: 'Language Settings', subtitle: 'No language configured'}
      }
      const subtitle = list
        .map((l) => (l.isDefault ? `${l.code?.toUpperCase()} (source)` : l.code?.toUpperCase()))
        .join(' · ')
      return {
        title: 'Language Settings',
        subtitle: `${list.length} ${list.length === 1 ? 'language' : 'languages'}: ${subtitle}`,
      }
    },
  },
  fields: [
    defineField({
      name: 'supportedLanguages',
      title: 'Supported languages',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'languageEntry',
          fields: [
            defineField({
              name: 'code',
              title: 'Language code (e.g. en, fr, de)',
              type: 'string',
              validation: (Rule) => Rule.required().lowercase(),
            }),
            defineField({
              name: 'label',
              title: 'Display label',
              type: 'string',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'isDefault',
              title: 'Default source language',
              type: 'boolean',
              initialValue: false,
            }),
          ],
          preview: {
            select: {title: 'label', subtitle: 'code'},
          },
        }),
      ],
      validation: (Rule) =>
        Rule.required()
          .min(1)
          // The README has always asked for exactly one `isDefault` and no repeated
          // codes, but nothing enforced it. Both mistakes fail silently and
          // expensively: with two defaults the first one in array order wins, which
          // is not obvious from anywhere; with two identical codes you get duplicate
          // `_key`s inside the `localeValue` arrays, which Sanity rejects downstream
          // with an error that points nowhere near this cause.
          .custom((languages) => {
            const list = Array.isArray(languages) ? (languages as LanguageEntryValue[]) : []

            const codes = list
              .map((lang) => lang?.code?.trim().toLowerCase())
              .filter((code): code is string => Boolean(code))
            const duplicates = [...new Set(codes.filter((c, i) => codes.indexOf(c) !== i))]
            if (duplicates.length > 0) {
              return `Duplicate language code: ${duplicates.join(', ')}. Each language must appear once.`
            }

            const defaults = list.filter((lang) => lang?.isDefault)
            if (defaults.length > 1) {
              const names = defaults.map((lang) => lang.code || '?').join(', ')
              return `Only one language can be the default source (${names} are all marked). Translation starts from exactly one language.`
            }
            if (list.length > 0 && defaults.length === 0) {
              return {
                message:
                  'No default source language selected — translation will fall back to `defaultSourceLanguage` from the plugin config, or to English.',
                level: 'warning',
              }
            }

            return true
          }),
    }),
  ],
})

/** Shape of one row of `supportedLanguages`, as the custom validator above sees it. */
interface LanguageEntryValue {
  code?: string
  label?: string
  isDefault?: boolean
}
