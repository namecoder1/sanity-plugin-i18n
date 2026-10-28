import {TranslateIcon} from '@sanity/icons/Translate'
import {useToast} from '@sanity/ui/toast'
import {useState} from 'react'
import {useClient, useDocumentOperation, useTranslation} from 'sanity'
import type {DocumentActionComponent, DocumentActionProps} from 'sanity'

import type {AutoI18nConfig} from '../config'
import {I18N_NAMESPACE} from '../i18n'
import {createMyMemoryProvider} from '../lib/providers/mymemory'
import {buildTranslationPatches, fetchLanguageSettings} from '../lib/translationCore'

const API_VERSION = '2023-01-01'

/**
 * Only available with `provider: 'mymemory'` (the default). With
 * `provider: 'azure'` translation does not run in the browser — the subscription key
 * cannot live there — but in a server-side Sanity Function; see `createAzureProvider`
 * and `index.ts`, which in that case does not register this action at all.
 */
export function createTranslateAction(config: AutoI18nConfig): DocumentActionComponent {
  const provider = createMyMemoryProvider(config)

  const TranslateAction: DocumentActionComponent = (props: DocumentActionProps) => {
    const {draft, published, id, type} = props
    const client = useClient({apiVersion: API_VERSION})
    const {patch} = useDocumentOperation(id, type)
    const [isTranslating, setIsTranslating] = useState(false)
    const [progress, setProgress] = useState<{done: number; total: number} | null>(null)
    const toast = useToast()
    const {t} = useTranslation(I18N_NAMESPACE)

    // Explicit cast: draft/published are typed as a generic SanityDocument, but here
    // we know our custom fields are arrays of LocaleValue.
    const doc = (draft || published) as Record<string, unknown> | undefined

    return {
      label: isTranslating
        ? progress
          ? t('translate.progress', progress)
          : t('translate.in-progress')
        : t('action.translate'),
      icon: TranslateIcon,
      disabled: isTranslating || !doc,
      onHandle: async () => {
        if (!doc) return
        setIsTranslating(true)
        setProgress(null)

        // Incremental application: see `BuildTranslationPatchesOptions.onPatch`. If
        // the run stops halfway, whatever already succeeded is kept.
        let applied = 0
        let total = 0

        try {
          const {sourceLang, targetLangs} = await fetchLanguageSettings(client, config)
          if (targetLangs.length === 0) {
            throw new Error(t('translate.no-target-language'))
          }

          await buildTranslationPatches(doc, sourceLang, targetLangs, provider, {
            onPatch: (translationPatch) => {
              patch.execute([translationPatch])
              applied += 1
            },
            onProgress: (done, count) => {
              total = count
              setProgress({done, total: count})
            },
          })

          toast.push({
            status: applied > 0 ? 'success' : 'info',
            title:
              applied === 0 ? t('translate.done-nothing') : t('translate.done', {count: applied}),
          })
          props.onComplete()
        } catch (err) {
          console.error('[auto-i18n] Translation failed:', err)
          const description = err instanceof Error ? err.message : String(err)
          toast.push(
            applied > 0
              ? {
                  status: 'warning',
                  title: t('translate.stopped', {applied, total: total || '?'}),
                  description: t('translate.stopped-description', {error: description}),
                }
              : {status: 'error', title: t('translate.failed'), description},
          )
        } finally {
          setIsTranslating(false)
          setProgress(null)
        }
      },
    }
  }

  return TranslateAction
}
