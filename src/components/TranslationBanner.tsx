import {TranslateIcon} from '@sanity/icons/Translate'
import {Card, Flex, Text, Button} from '@sanity/ui'
import {useToast} from '@sanity/ui/toast'
import {useEffect, useState} from 'react'
import {useClient, useDocumentOperation, useEditState} from 'sanity'
import type {DocumentLayoutProps} from 'sanity'

import type {AutoI18nConfig} from '../config'
import {createMyMemoryProvider} from '../lib/providers/mymemory'
import {
  buildTranslationPatches,
  fetchLanguageSettings,
  findPendingTranslations,
} from '../lib/translationCore'

const API_VERSION = '2023-01-01'

/**
 * Sostituisce il layout di default del documento aggiungendo, quando ci sono
 * campi internazionalizzati mancanti o obsoleti, una barra sticky in cima al
 * form con un pulsante di traduzione immediata. L'azione "Traduci mancanti"
 * nella toolbar resta disponibile, ma è facile da non notare — questa barra
 * serve a non doverla conoscere in anticipo.
 *
 * Importante: il componente deve restituire un UNICO nodo che avvolge sia la
 * barra sia `renderDefault(props)`. Il pannello documento dello Structure
 * Tool tratta ogni figlio diretto restituito qui come una colonna separata
 * (è un flex row): un Fragment con due figli spezza il layout in due "pannelli"
 * affiancati invece di impilare la barra sopra il form.
 */
export function createTranslationBanner(config: AutoI18nConfig) {
  const isAzure = config.provider === 'azure'
  const provider = isAzure ? null : createMyMemoryProvider(config)

  function TranslationBanner(props: DocumentLayoutProps) {
    const {documentId, documentType, renderDefault} = props
    const client = useClient({apiVersion: API_VERSION})
    const {patch} = useDocumentOperation(documentId, documentType)
    const {draft, published} = useEditState(documentId, documentType)
    const toast = useToast()

    const [pendingCount, setPendingCount] = useState<number | null>(null)
    const [isTranslating, setIsTranslating] = useState(false)

    const doc = (draft || published) as Record<string, unknown> | undefined

    useEffect(() => {
      let cancelled = false

      if (doc) {
        fetchLanguageSettings(client, config)
          .then(({sourceLang, targetLangs}) => {
            if (cancelled) return undefined
            setPendingCount(findPendingTranslations(doc, sourceLang, targetLangs).length)
            return undefined
          })
          .catch(() => {
            // Nessuna lingua configurata o errore di rete: niente barra, l'azione
            // in toolbar resta comunque disponibile e mostra l'errore esplicito.
            if (!cancelled) setPendingCount(null)
            return undefined
          })
      } else {
        setPendingCount(null)
      }

      return () => {
        cancelled = true
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- doc è un oggetto ricreato ad ogni render dal form, non è una dipendenza stabile
    }, [client, JSON.stringify(doc)])

    const handleTranslate = async () => {
      if (!doc || !provider) return
      setIsTranslating(true)
      try {
        const {sourceLang, targetLangs} = await fetchLanguageSettings(client, config)
        const patches = await buildTranslationPatches(doc, sourceLang, targetLangs, provider)
        if (patches.length > 0) {
          patch.execute(patches)
        }
        setPendingCount(0)
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
    }

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          minHeight: 0,
        }}
      >
        {pendingCount ? (
          <div style={{flex: '0 0 auto', width: '100%', zIndex: 1}}>
            <Card tone="caution" padding={2} borderBottom>
              <Flex align="center" justify="space-between" gap={3} paddingX={2}>
                <Text size={1}>
                  {pendingCount === 1
                    ? '1 translation missing or out of date.'
                    : `${pendingCount} translations missing or out of date.`}
                  {isAzure ? ' They will be translated automatically on save.' : ''}
                </Text>
                {isAzure ? null : (
                  <Button
                    icon={TranslateIcon}
                    text={isTranslating ? 'Translating...' : 'Translate now'}
                    tone="primary"
                    mode="ghost"
                    fontSize={1}
                    padding={2}
                    disabled={isTranslating}
                    onClick={handleTranslate}
                  />
                )}
              </Flex>
            </Card>
          </div>
        ) : null}
        <div
          style={{
            flex: '1 1 auto',
            width: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {renderDefault(props)}
        </div>
      </div>
    )
  }

  return TranslationBanner
}
