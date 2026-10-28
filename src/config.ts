import {EarthGlobeIcon} from '@sanity/icons/EarthGlobe'
import {defineType, defineField, defineArrayMember} from 'sanity'

import {LANGUAGE_SETTINGS_DOC_ID} from './lib/shared'
import type {AutoI18nConfig, AutoI18nLabels} from './lib/shared'

// Re-exported from here so that every existing import path keeps working. The
// definitions moved to `lib/shared.ts` because this module registers a schema type,
// which makes it depend on `sanity` at runtime — and the framework-free entry point
// (`sanity-plugin-i18n/core`) must not pull that in.
export {LANGUAGE_SETTINGS_DOC_ID}
export type {AutoI18nConfig, AutoI18nLabels}

/** English texts the `labels` option overrides. */
export const DEFAULT_LABELS: AutoI18nLabels = {
  languageSettingsTitle: 'Language Settings',
  supportedLanguagesTitle: 'Supported languages',
  languageCodeTitle: 'Language code (e.g. en, fr, de)',
  languageLabelTitle: 'Display label',
  defaultSourceLanguageTitle: 'Default source language',
  noLanguagesSubtitle: 'No language configured',
  languageCountOne: '1 language',
  languageCountOther: '{{count}} languages',
  sourceMarker: '(source)',
  duplicateCodeError: 'Duplicate language code: {{codes}}. Each language must appear once.',
  multipleDefaultsError:
    'Only one language can be the default source ({{codes}} are all marked). Translation starts from exactly one language.',
  noDefaultWarning:
    'No default source language selected — translation will fall back to `defaultSourceLanguage` from the plugin config, or to English.',
}

/** Fills the caller's overrides in over the English defaults. */
export function resolveLabels(labels: Partial<AutoI18nLabels> | undefined): AutoI18nLabels {
  return {...DEFAULT_LABELS, ...labels}
}

/** Replaces `{{name}}` placeholders in a label. */
function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  )
}

/**
 * Singleton document defining which languages the Studio offers.
 *
 * Read both by the input component (to build the language tabs) and by the
 * translate action (to know which languages to translate into).
 *
 * Built by a factory rather than declared once because its titles and messages come
 * from the plugin config (`labels`): schema titles are outside the reach of the
 * Studio's locale, so this is the only way to change them.
 */
export function createLanguageSettingsType(labels: AutoI18nLabels = DEFAULT_LABELS) {
  return defineType({
    name: 'autoI18n.languageSettings',
    title: labels.languageSettingsTitle,
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
          return {title: labels.languageSettingsTitle, subtitle: labels.noLanguagesSubtitle}
        }
        const subtitle = list
          .map((l) =>
            l.isDefault ? `${l.code?.toUpperCase()} ${labels.sourceMarker}` : l.code?.toUpperCase(),
          )
          .join(' · ')
        const count = fill(
          list.length === 1 ? labels.languageCountOne : labels.languageCountOther,
          {count: list.length},
        )
        return {title: labels.languageSettingsTitle, subtitle: `${count}: ${subtitle}`}
      },
    },
    fields: [
      defineField({
        name: 'supportedLanguages',
        title: labels.supportedLanguagesTitle,
        type: 'array',
        of: [
          defineArrayMember({
            type: 'object',
            name: 'languageEntry',
            fields: [
              defineField({
                name: 'code',
                title: labels.languageCodeTitle,
                type: 'string',
                validation: (Rule) => Rule.required().lowercase(),
              }),
              defineField({
                name: 'label',
                title: labels.languageLabelTitle,
                type: 'string',
                validation: (Rule) => Rule.required(),
              }),
              defineField({
                name: 'isDefault',
                title: labels.defaultSourceLanguageTitle,
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
                return fill(labels.duplicateCodeError, {codes: duplicates.join(', ')})
              }

              const defaults = list.filter((lang) => lang?.isDefault)
              if (defaults.length > 1) {
                const names = defaults.map((lang) => lang.code || '?').join(', ')
                return fill(labels.multipleDefaultsError, {codes: names})
              }
              if (list.length > 0 && defaults.length === 0) {
                return {message: labels.noDefaultWarning, level: 'warning'}
              }

              return true
            }),
      }),
    ],
  })
}

/** The type with its English texts, for code that only needs its `name`. */
export const languageSettingsType = createLanguageSettingsType()

/** Shape of one row of `supportedLanguages`, as the custom validator above sees it. */
interface LanguageEntryValue {
  code?: string
  label?: string
  isDefault?: boolean
}
