import type {AutoI18nConfig} from '../shared'
import type {TranslationProvider} from './types'

/**
 * A NOTE ON LOGGING IN THIS MODULE: the warnings report the length of the text,
 * never the text itself. Document content should not end up in the browser console
 * by default — this is the one place in the plugin where it would be tempting, and
 * it is the user's content, not ours. Anyone debugging already has the text in
 * front of them in the field.
 */

/**
 * MyMemory is a translation memory: rather than translating from scratch it returns
 * the closest entry in its database, often sentences harvested from books, academic
 * papers and bilingual corpora.
 *
 * On short or generic text the best match can drag along fragments of its original
 * context — a bibliographic citation such as "Cambridge, MA: Harvard University
 * Press." — and come back far longer than the source. There is no way to "repair" a
 * result like that; the only defence is to discard it and try the alternative
 * matches the API returns in `matches`.
 */
function isSaneTranslationLength(source: string, candidate: string): boolean {
  const maxLen = Math.max(source.length * 3, source.length + 30)
  return candidate.length > 0 && candidate.length <= maxLen
}

async function translateWithMyMemory(
  text: string,
  sourceLang: string,
  targetLang: string,
  config: AutoI18nConfig,
): Promise<string> {
  const params = new URLSearchParams({
    q: text,
    langpair: `${sourceLang}|${targetLang}`,
  })
  if (config.apiKey) params.set('key', config.apiKey)
  if (config.email) params.set('de', config.email)

  const res = await fetch(`https://api.mymemory.translated.net/get?${params.toString()}`)
  if (!res.ok) {
    throw new Error(`MyMemory API error: ${res.status}`)
  }
  const data = await res.json()
  // MyMemory answers with HTTP 200 even on errors (invalid key, exhausted quota
  // and so on): the real status is in `responseStatus`, not in the HTTP status.
  if (data?.responseStatus && Number(data.responseStatus) !== 200) {
    throw new Error(
      `MyMemory API error ${data.responseStatus}: ${data?.responseData?.translatedText || 'unknown error'}`,
    )
  }

  const topTranslation: string | undefined = data?.responseData?.translatedText
  const topMatch: number | undefined =
    typeof data?.responseData?.match === 'number' ? data.responseData.match : undefined
  if (!topTranslation) {
    throw new Error('No translation received from MyMemory')
  }

  // The first candidate is `responseData`; the rest, when present, are the
  // alternatives in `matches`, already ordered by MyMemory best-first.
  const candidates: Array<{translation?: string; match?: number}> = [
    {translation: topTranslation, match: topMatch},
    ...(Array.isArray(data?.matches)
      ? data.matches.map((m: {translation?: string; match?: number}) => ({
          translation: m?.translation,
          match: typeof m?.match === 'number' ? m.match : undefined,
        }))
      : []),
  ]

  const goodCandidate = candidates.find(
    (c) =>
      typeof c.translation === 'string' &&
      (c.match === undefined || c.match >= 0.5) &&
      isSaneTranslationLength(text, c.translation),
  )

  if (goodCandidate?.translation) {
    if (goodCandidate.translation !== topTranslation) {
      console.warn(
        '[auto-i18n] Discarded the top MyMemory result (likely a translation-memory artifact), ' +
          `using an alternative match instead (source length: ${text.length})`,
      )
    }
    return goodCandidate.translation
  }

  // No candidate passed the checks. Returning the best available result with a
  // warning beats failing the whole translation run over one questionable segment.
  console.warn(
    '[auto-i18n] No MyMemory match passed the quality checks, falling back to the best available ' +
      `result (source length: ${text.length})`,
  )
  return topTranslation
}

/**
 * MyMemory provider, designed to be called straight from the browser (Studio).
 *
 * `apiKey` and `email` only raise rate limits — they are not sensitive
 * credentials, so unlike the Azure subscription key there is no problem keeping
 * them in `sanity.config.ts`.
 *
 * Note that document content is sent to `api.mymemory.translated.net`, a third-party
 * translation memory that retains what it receives. See the README before using
 * this provider with confidential content.
 */
export function createMyMemoryProvider(config: AutoI18nConfig): TranslationProvider {
  return {
    translateText: (text, sourceLang, targetLang) =>
      translateWithMyMemory(text, sourceLang, targetLang, config),
  }
}
