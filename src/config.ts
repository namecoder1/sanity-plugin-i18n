import {defineType, defineField, defineArrayMember} from 'sanity'
import {EarthGlobeIcon} from '@sanity/icons/EarthGlobe'

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
  title: 'Impostazioni Lingue',
  type: 'document',
  icon: EarthGlobeIcon,
  // Nasconde il tipo dal menu "crea nuovo documento": è un singleton
  __experimental_formPreviewTitle: false,
  preview: {
    select: {languages: 'supportedLanguages'},
    prepare({languages}: {languages?: {code?: string; label?: string; isDefault?: boolean}[]}) {
      const list = Array.isArray(languages) ? languages : []
      if (list.length === 0) {
        return {title: 'Impostazioni Lingue', subtitle: 'Nessuna lingua configurata'}
      }
      const subtitle = list
        .map((l) => (l.isDefault ? `${l.code?.toUpperCase()} (sorgente)` : l.code?.toUpperCase()))
        .join(' · ')
      return {
        title: 'Impostazioni Lingue',
        subtitle: `${list.length} ${list.length === 1 ? 'lingua' : 'lingue'}: ${subtitle}`,
      }
    },
  },
  fields: [
    defineField({
      name: 'supportedLanguages',
      title: 'Lingue supportate',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'languageEntry',
          fields: [
            defineField({
              name: 'code',
              title: 'Codice lingua (es. it, en, de)',
              type: 'string',
              validation: (Rule) => Rule.required().lowercase(),
            }),
            defineField({
              name: 'label',
              title: 'Etichetta visibile',
              type: 'string',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'isDefault',
              title: 'Lingua sorgente di default',
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
