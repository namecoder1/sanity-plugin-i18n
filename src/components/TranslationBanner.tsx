import {TranslateIcon} from '@sanity/icons/Translate'
import {Card, Flex, Text, Button} from '@sanity/ui'
import {useToast} from '@sanity/ui/toast'
import {useMemo, useState} from 'react'
import {useDocumentOperation, useEditState} from 'sanity'
import type {DocumentLayoutProps} from 'sanity'

import type {AutoI18nConfig} from '../config'
import {createMyMemoryProvider} from '../lib/providers/mymemory'
import {
  buildTranslationPatches,
  findInternationalizedFieldPaths,
  findPendingTranslations,
  resolveLanguages,
} from '../lib/translationCore'
import {useLanguageSettings} from '../lib/useLanguageSettings'

/**
 * Replaces the default document layout, adding a sticky bar above the form whenever
 * internationalized fields are missing or out of date, with a button to translate
 * them on the spot. The "Translate missing" toolbar action does the same job but is
 * easy to overlook — this bar means you do not have to know about it in advance.
 *
 * Important: the component must return a SINGLE node wrapping both the bar and
 * `renderDefault(props)`. The Structure Tool's document pane treats every direct
 * child returned here as a separate column (it is a flex row), so a Fragment with
 * two children splits the layout into two side-by-side "panes" instead of stacking
 * the bar above the form.
 *
 * MAINTENANCE NOTE: `unstable_layout`, the extension point that mounts this
 * component, is marked `@internal` in Sanity's types — not `@beta`. It can change
 * shape or disappear in a patch release, with no deprecation cycle. That is why this
 * component is written defensively: whatever goes wrong while computing the bar, it
 * must still let `renderDefault(props)` through, because a plugin cannot afford to
 * make a document's form unreachable.
 */
export function createTranslationBanner(config: AutoI18nConfig) {
  const isAzure = config.provider === 'azure'
  const provider = isAzure ? null : createMyMemoryProvider(config)

  function TranslationBanner(props: DocumentLayoutProps) {
    const {documentId, documentType, renderDefault} = props
    const {patch} = useDocumentOperation(documentId, documentType)
    const {draft, published} = useEditState(documentId, documentType)
    const {languages} = useLanguageSettings()
    const toast = useToast()

    const [isTranslating, setIsTranslating] = useState(false)
    const [progress, setProgress] = useState<{done: number; total: number} | null>(null)

    const doc = (draft || published) as Record<string, unknown> | undefined

    // The count is DERIVED from the document, not recomputed by an effect keyed on
    // `JSON.stringify(doc)`. That version serialised the entire document on every
    // render — on every document in the Studio, since the banner is registered
    // globally — and fired a fresh GROQ query for the languages on every keystroke.
    // Languages now come from a shared store (one query and one listener for the
    // whole Studio) and the count is a local computation over data already in memory.
    //
    // The dependency is the document's `_rev`, not the document object: it changes
    // once per applied mutation rather than once per render.
    const pendingCount = useMemo(() => {
      if (!doc || languages.length === 0) return 0
      try {
        // Shortcut: if the document has no i18n fields at all — the normal case for
        // most types, since the banner is mounted on all of them — bail out before
        // resolving languages.
        if (findInternationalizedFieldPaths(doc).length === 0) return 0
        const {sourceLang, targetLangs} = resolveLanguages(languages, config)
        return findPendingTranslations(doc, sourceLang, targetLangs).length
      } catch (err) {
        console.error('[auto-i18n] Could not compute pending translations:', err)
        return 0
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- `doc` is rebuilt on every render by the form; `_rev` changes only when the content really changes
    }, [doc?._rev, doc === undefined, languages])

    const handleTranslate = async () => {
      if (!doc || !provider) return
      setIsTranslating(true)
      setProgress(null)

      // Each patch is applied the moment it is ready, not all at the end: a run that
      // stops halfway (rate limit, exhausted quota, network) then keeps everything
      // that already succeeded instead of discarding it.
      let applied = 0

      try {
        const {sourceLang, targetLangs} = resolveLanguages(languages, config)
        if (targetLangs.length === 0) {
          throw new Error('No target language configured in autoI18n.languageSettings')
        }

        await buildTranslationPatches(doc, sourceLang, targetLangs, provider, {
          onPatch: (translationPatch) => {
            patch.execute([translationPatch])
            applied += 1
          },
          onProgress: (done, total) => setProgress({done, total}),
        })

        toast.push({
          status: 'success',
          title:
            applied === 1 ? 'Translated 1 field' : `Translated ${applied} field/language pairs`,
        })
      } catch (err) {
        console.error('[auto-i18n] Translation failed:', err)
        const description = err instanceof Error ? err.message : String(err)
        toast.push(
          applied > 0
            ? {
                status: 'warning',
                title: `Stopped after ${applied} of ${progress?.total ?? '?'} translations`,
                description: `${description} — what was already translated has been kept.`,
              }
            : {status: 'error', title: 'Translation failed', description},
        )
      } finally {
        setIsTranslating(false)
        setProgress(null)
      }
    }

    const showBanner = pendingCount > 0

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
        {showBanner ? (
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
                    text={
                      isTranslating
                        ? progress
                          ? `Translating ${progress.done}/${progress.total}...`
                          : 'Translating...'
                        : 'Translate now'
                    }
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
