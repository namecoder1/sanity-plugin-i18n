import {TranslateIcon} from '@sanity/icons/Translate'
import {useToast} from '@sanity/ui/toast'
import {useState} from 'react'
import {useClient, useDocumentOperation} from 'sanity'
import type {DocumentActionComponent, DocumentActionProps} from 'sanity'

import type {AutoI18nConfig} from '../config'
import {createMyMemoryProvider} from '../lib/providers/mymemory'
import {buildTranslationPatches, fetchLanguageSettings} from '../lib/translationCore'

const API_VERSION = '2023-01-01'

/**
 * Azione disponibile solo con `provider: 'mymemory'` (default): con
 * `provider: 'azure'` la traduzione non gira nel browser (la subscription
 * key non può starci) ma in una Sanity Function server-side — vedi
 * `createAzureProvider` e `index.ts`, che in quel caso non registra affatto
 * questa azione.
 */
export function createTranslateAction(config: AutoI18nConfig): DocumentActionComponent {
  const provider = createMyMemoryProvider(config)

  const TranslateAction: DocumentActionComponent = (props: DocumentActionProps) => {
    const {draft, published, id, type} = props
    const client = useClient({apiVersion: API_VERSION})
    const {patch} = useDocumentOperation(id, type)
    const [isTranslating, setIsTranslating] = useState(false)
    const toast = useToast()

    // Cast esplicito: draft/published sono tipizzati come SanityDocument generico,
    // ma qui sappiamo che i nostri campi custom sono array di LocaleValue.
    const doc = (draft || published) as Record<string, unknown> | undefined

    return {
      label: isTranslating ? 'Translating...' : 'Translate missing',
      icon: TranslateIcon,
      disabled: isTranslating || !doc,
      onHandle: async () => {
        if (!doc) return
        setIsTranslating(true)
        try {
          const {sourceLang, targetLangs} = await fetchLanguageSettings(client, config)
          const patches = await buildTranslationPatches(doc, sourceLang, targetLangs, provider)

          if (patches.length > 0) {
            patch.execute(patches)
          }

          props.onComplete()
        } catch (err) {
          console.error('[auto-i18n] Errore durante la traduzione:', err)
          toast.push({
            status: 'error',
            title: 'Translation failed',
            description: err instanceof Error ? err.message : String(err),
          })
        } finally {
          setIsTranslating(false)
        }
      },
    }
  }

  return TranslateAction
}
