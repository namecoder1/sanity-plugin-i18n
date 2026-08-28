import {EarthGlobeIcon} from '@sanity/icons/EarthGlobe'
import {defineType, defineField, defineArrayMember} from 'sanity'

/**
 * Configurazione passata dall'utente in sanity.config.ts:
 *
 * plugins: [autoI18nPlugin({
 *   provider: 'mymemory',                            // opzionale, default 'mymemory'
 *   apiKey: process.env.SANITY_STUDIO_MYMEMORY_KEY, // opzionale, ma consigliata
 *   email: 'tuo@email.com',                          // opzionale, alza i rate limit
 *   defaultSourceLanguage: 'it',
 * })]
 */
export interface AutoI18nConfig {
  /**
   * Motore di traduzione. Default 'mymemory' (chiamato direttamente dal
   * browser, sincrono: bottone "Traduci mancanti" e banner funzionano come
   * sempre). Con 'azure' il plugin NON traduce da solo — la subscription key
   * di Azure Translator non deve mai stare nel bundle dello Studio, quindi la
   * traduzione la fa una Sanity Function server-side che si attiva da sola al
   * salvataggio del documento (vedi `functions/` nel repo dello Studio). In
   * questa modalità il bottone/banner diventano solo informativi.
   */
  provider?: 'mymemory' | 'azure'
  /** MyMemory API key dell'utente. Senza key il rate limit è molto più basso. */
  apiKey?: string
  /** Email da passare a MyMemory per rate limit più alti (non richiede key). */
  email?: string
  /** Lingua sorgente di default se non specificata a livello di documento. */
  defaultSourceLanguage?: string
}

/**
 * Singleton document: definisce quali lingue sono disponibili nello studio.
 * Viene letto sia dal componente di input (per generare i tab lingua)
 * sia dalla translateAction (per sapere verso quali lingue tradurre).
 */
export const languageSettingsType = defineType({
  name: 'autoI18n.languageSettings',
  title: 'Language Settings',
  type: 'document',
  icon: EarthGlobeIcon,
  // Singleton: nasconde il tipo da liste/ricerca e dal menu "crea nuovo
  // documento" — resta comunque raggiungibile navigando direttamente
  // all'ID fisso, che è esattamente ciò che fa LanguageSettingsTool.
  hidden: () => true,
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
      validation: (Rule) => Rule.required().min(1),
    }),
  ],
})

/** ID fisso del documento singleton, usato per fetch/patch diretti. */
export const LANGUAGE_SETTINGS_DOC_ID = 'autoI18n.languageSettings'
