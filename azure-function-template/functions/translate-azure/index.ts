import {createClient} from '@sanity/client'
import {documentEventHandler} from '@sanity/functions'
import {
  buildTranslationPatches,
  createAzureProvider,
  fetchLanguageSettings,
  findPendingTranslations,
  type TranslationPatch,
} from 'sanity-plugin-i18n/core'

/**
 * Server-side translation for `provider: 'azure'`.
 *
 * All the real logic — finding internationalized fields, deciding what is stale,
 * building patches, talking to Azure — is imported from `sanity-plugin-i18n/core`,
 * the plugin's framework-free entry point. It runs on plain Node: no React, no
 * `@sanity/ui`, nothing from the Studio runtime.
 *
 * This file used to carry a hand-maintained copy of that logic instead. The copy was
 * a genuine hazard: `hashSourceValue` has to stay byte-for-byte equivalent on both
 * sides, or the Studio and this Function disagree about which translations are stale
 * — and they disagree *silently*, with no error anywhere. Nothing enforced it but
 * discipline. Importing makes the module system enforce it.
 *
 * If you need to customise behaviour, prefer wrapping the imported functions over
 * reimplementing them.
 */
export const handler = documentEventHandler(async ({context, event}) => {
  const apiKey = process.env.AZURE_TRANSLATOR_KEY
  if (!apiKey) {
    console.error(
      '[auto-i18n] AZURE_TRANSLATOR_KEY is not set. Run: ' +
        'npx sanity@latest functions env add translate-azure AZURE_TRANSLATOR_KEY <your-key>',
    )
    return
  }

  // The provider implements `translateTexts`, so every span of a field goes to Azure
  // in a single request (up to 100 texts) instead of one request per span.
  const provider = createAzureProvider({
    apiKey,
    region: process.env.AZURE_TRANSLATOR_REGION,
  })

  // Only used when no language in Language Settings is marked as the default source.
  // Keep this fallback aligned with the plugin's own (`resolveLanguages`), or in that
  // case the Studio button and this Function would translate from different sources.
  const config = {defaultSourceLanguage: process.env.DEFAULT_SOURCE_LANGUAGE || 'en'}

  const client = createClient({...context.clientOptions, apiVersion: '2025-05-08'})
  const doc = event.data as Record<string, unknown> & {_id: string}

  try {
    const {sourceLang, targetLangs} = await fetchLanguageSettings(client, config)

    // Early exit BEFORE calling Azure (which saves billable calls) and before writing
    // anything: with nothing to translate, this invocation produces no mutation, so
    // it emits no new 'update' event. That — not some static "processed" flag — is
    // what stops the cycle, since the Function reacts to the very events it writes.
    if (findPendingTranslations(doc, sourceLang, targetLangs).length === 0) return

    // Patches are collected as they are produced rather than only at the end, so a
    // run that fails partway can still write whatever already succeeded. Without
    // this, one failed call would discard every translation already paid for.
    const patches: TranslationPatch[] = []

    try {
      await buildTranslationPatches(doc, sourceLang, targetLangs, provider, {
        onPatch: (patch) => patches.push(patch),
      })
    } finally {
      if (patches.length > 0) {
        await client.mutate(
          patches.map((patch) => ({patch: {id: doc._id, ...patch}})),
          {dryRun: context.local},
        )
        console.log(`[auto-i18n] Translated ${patches.length} field/language on ${doc._id}`)
      }
    }
  } catch (error) {
    console.error('[auto-i18n] Azure translation Function failed:', error)
  }
})
