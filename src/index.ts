import {EarthGlobeIcon} from '@sanity/icons/EarthGlobe'
import {definePlugin} from 'sanity'

import {createTranslateAction} from './actions/translateAction'
import {LanguageSettingsTool} from './components/LanguageSettingsTool'
import {createTranslationBanner} from './components/TranslationBanner'
import {languageSettingsType} from './config'
import type {AutoI18nConfig} from './config'
import {
  internationalizedStringType,
  internationalizedTextType,
  internationalizedBlockContentType,
  internationalizedStringListType,
} from './schemaTypes/internationalizedField'

export type {AutoI18nConfig}

// Esportati per l'uso in una Sanity Function server-side (es. il provider
// Azure, che non può girare nel browser — vedi AutoI18nConfig.provider e
// src/lib/providers/azure.ts). Il plugin stesso li usa internamente per lo
// stesso motivo: unica fonte di verità per hashing/staleness/costruzione patch,
// condivisa tra Studio (MyMemory, sincrono) e Function (Azure, event-driven).
export {
  findInternationalizedFieldPaths,
  findPendingTranslations,
  hasContent,
  hashSourceValue,
  fetchLanguageSettings,
  buildTranslationPatches,
} from './lib/translationCore'
export type {PendingTranslation, LocaleValue, LanguageEntry} from './lib/translationCore'
export type {TranslationProvider} from './lib/providers/types'
export {createMyMemoryProvider} from './lib/providers/mymemory'
export {createAzureProvider} from './lib/providers/azure'
export type {AzureProviderOptions} from './lib/providers/azure'

/**
 * Usage in `sanity.config.ts` (o .js)
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
 *       email: 'tuo@email.com',
 *       defaultSourceLanguage: 'it',
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
        // "Impostazioni Lingue" è un singleton (id fisso, tipo nascosto da
        // liste/menu — vedi languageSettingsType.hidden): niente "Duplica" o
        // "Elimina", altrimenti un utente potrebbe comunque crearne una
        // seconda copia o cancellare l'unica esistente.
        if (context.schemaType === languageSettingsType.name) {
          return prev.filter((action) => !['duplicate', 'delete'].includes(action.action ?? ''))
        }

        // Con provider 'azure' la traduzione non gira nel browser (la key non
        // può starci): la fa una Sanity Function al salvataggio. L'azione
        // manuale non avrebbe nulla da eseguire, quindi non la registriamo.
        if (resolvedConfig.provider === 'azure') return prev

        // Aggiunge l'azione "Traduci mancanti" a tutti i tipi di documento.
        // In una versione successiva si può filtrare per context.schemaType
        // solo sui documenti che effettivamente contengono campi internazionalizzati.
        //
        // Viene inserita subito dopo la prima azione (di norma "Publish"), non in coda:
        // lo Studio mostra come pulsante visibile solo le prime azioni della lista,
        // le altre finiscono nel menu overflow "···". Metterla in coda (dopo Duplicate/
        // Delete/Unpublish) la seppelliva in fondo a quel menu.
        const [primary, ...rest] = prev
        return primary
          ? [primary, createTranslateAction(resolvedConfig), ...rest]
          : [...prev, createTranslateAction(resolvedConfig)]
      },
      // Banner in cima al form: più difficile da non notare rispetto
      // all'azione nella toolbar, che resta comunque disponibile.
      components: {
        unstable_layout: createTranslationBanner(resolvedConfig),
      },
      // Il tipo è già "hidden" (fuori da liste/ricerca), ma il menu "+"
      // globale può comunque proporre un template per qualsiasi document
      // type dello schema: lo escludiamo esplicitamente per sicurezza.
      newDocumentOptions: (prev, {creationContext}) => {
        if (creationContext.type === 'global') {
          return prev.filter((template) => template.templateId !== languageSettingsType.name)
        }
        return prev
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
