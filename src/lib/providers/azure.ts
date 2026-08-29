import type {TranslationProvider} from './types'

export interface AzureProviderOptions {
  /** Subscription key of the Azure Translator resource. */
  apiKey: string
  /** Resource region. Required for most "regional" resources, unnecessary for "global" ones. */
  region?: string
  /** Endpoint override, for resources with a dedicated endpoint. Defaults to the public global endpoint. */
  endpoint?: string
}

/**
 * Maximum number of texts the Azure Translator API accepts in one request. A long
 * rich-text field has many spans; batching them is the difference between one
 * request and dozens.
 */
const MAX_BATCH = 100

/**
 * Azure Translator provider.
 *
 * NEVER instantiate this with a real key inside the Studio bundle. Plugin code runs
 * in the browser, so anyone who opens the Studio can read the key straight off the
 * network requests.
 *
 * It is meant for server-side use only, inside a Sanity Function, where `apiKey`
 * comes from a Function environment variable — never committed, never bundled for
 * the client. See `azure-function-template/` in the plugin repo for a working setup.
 */
export function createAzureProvider(options: AzureProviderOptions): TranslationProvider {
  const endpoint = options.endpoint || 'https://api.cognitive.microsofttranslator.com'

  async function requestBatch(
    texts: string[],
    sourceLang: string,
    targetLang: string,
  ): Promise<string[]> {
    if (texts.length === 0) return []

    const url = new URL('/translate', endpoint)
    url.searchParams.set('api-version', '3.0')
    url.searchParams.set('from', sourceLang)
    url.searchParams.set('to', targetLang)

    const results: string[] = []

    for (let offset = 0; offset < texts.length; offset += MAX_BATCH) {
      const chunk = texts.slice(offset, offset + MAX_BATCH)

      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': options.apiKey,
          ...(options.region ? {'Ocp-Apim-Subscription-Region': options.region} : {}),
        },
        body: JSON.stringify(chunk.map((text) => ({Text: text}))),
      })

      if (!res.ok) {
        const errorBody = await res.text().catch(() => '')
        throw new Error(`Azure Translator API error: ${res.status} ${errorBody}`)
      }

      const data = await res.json()
      // Results are matched back to their spans by position, so a response of the
      // wrong length would attach every translation to the wrong span. Failing here
      // is much better than writing quietly scrambled content.
      if (!Array.isArray(data) || data.length !== chunk.length) {
        throw new Error(
          `Azure Translator returned ${
            Array.isArray(data) ? data.length : 'a non-array'
          } results for ${chunk.length} texts`,
        )
      }

      for (const entry of data) {
        const translated = entry?.translations?.[0]?.text
        if (typeof translated !== 'string') {
          throw new Error('No translation received from Azure Translator')
        }
        results.push(translated)
      }
    }

    return results
  }

  return {
    async translateText(text, sourceLang, targetLang) {
      const [translated] = await requestBatch([text], sourceLang, targetLang)
      if (typeof translated !== 'string') {
        throw new Error('No translation received from Azure Translator')
      }
      return translated
    },

    translateTexts: (texts, sourceLang, targetLang) => requestBatch(texts, sourceLang, targetLang),
  }
}
