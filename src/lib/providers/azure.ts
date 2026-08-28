import type {TranslationProvider} from './types'

export interface AzureProviderOptions {
  /** Subscription key del resource Azure Translator. */
  apiKey: string
  /** Region del resource (richiesta per la maggior parte dei resource "regional", non serve per quelli "global"). */
  region?: string
  /** Override dell'endpoint, per resource con endpoint dedicato. Default: endpoint globale pubblico. */
  endpoint?: string
}

/**
 * Provider Azure Translator. NON va mai istanziato con una key nel bundle
 * dello Studio (il codice del plugin gira nel browser: chiunque apra
 * lo Studio vedrebbe la key nelle richieste di rete). È pensato per essere
 * usato solo lato server, dentro una Sanity Function, dove `apiKey` arriva
 * da una variabile d'ambiente della Function (mai committata, mai nel
 * bundle client) — vedi il pacchetto `functions/` dello Studio.
 */
export function createAzureProvider(options: AzureProviderOptions): TranslationProvider {
  const endpoint = options.endpoint || 'https://api.cognitive.microsofttranslator.com'

  return {
    async translateText(text, sourceLang, targetLang) {
      const url = new URL('/translate', endpoint)
      url.searchParams.set('api-version', '3.0')
      url.searchParams.set('from', sourceLang)
      url.searchParams.set('to', targetLang)

      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': options.apiKey,
          ...(options.region ? {'Ocp-Apim-Subscription-Region': options.region} : {}),
        },
        body: JSON.stringify([{Text: text}]),
      })

      if (!res.ok) {
        const errorBody = await res.text().catch(() => '')
        throw new Error(`Azure Translator API error: ${res.status} ${errorBody}`)
      }

      const data = await res.json()
      const translated = data?.[0]?.translations?.[0]?.text
      if (typeof translated !== 'string') {
        throw new Error('No translation received from Azure Translator')
      }
      return translated
    },
  }
}
