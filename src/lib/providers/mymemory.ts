import type {AutoI18nConfig} from '../../config'
import type {TranslationProvider} from './types'

/**
 * MyMemory è una translation memory: invece di tradurre "da zero" restituisce
 * la voce più simile nel suo database (spesso frasi estratte da libri, paper
 * accademici, corpus bilingue). Su testo breve o generico il match migliore
 * può trascinarsi dietro frammenti del contesto originale della fonte (es.
 * una citazione bibliografica tipo "Cambridge, MA: Harvard University
 * Press."), risultando molto più lungo del testo di partenza. Non c'è modo
 * di "correggere" una traduzione così — l'unica difesa è scartarla e provare
 * i match alternativi che l'API restituisce in `matches`.
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
  // MyMemory risponde con HTTP 200 anche sugli errori (chiave non valida, quota
  // esaurita, ecc.): lo stato reale è in `responseStatus`, non nell'HTTP status.
  if (data?.responseStatus && Number(data.responseStatus) !== 200) {
    throw new Error(
      `MyMemory API error ${data.responseStatus}: ${data?.responseData?.translatedText || 'errore sconosciuto'}`,
    )
  }

  const topTranslation: string | undefined = data?.responseData?.translatedText
  const topMatch: number | undefined =
    typeof data?.responseData?.match === 'number' ? data.responseData.match : undefined
  if (!topTranslation) {
    throw new Error('Nessuna traduzione ricevuta da MyMemory')
  }

  // Il primo candidato è `responseData`, gli altri (se presenti) sono le
  // alternative in `matches`, già ordinate da MyMemory per qualità decrescente.
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
        '[auto-i18n] Traduzione MyMemory scartata (probabile artefatto della translation memory), uso un match alternativo',
        {source: text, scartata: topTranslation, usata: goodCandidate.translation},
      )
    }
    return goodCandidate.translation
  }

  // Nessun candidato ha superato il controllo: meglio restituire comunque il
  // risultato migliore (con un avviso) che bloccare l'intera traduzione.
  console.warn(
    '[auto-i18n] Nessun match di MyMemory ha superato il controllo di qualità, uso comunque il risultato migliore',
    {source: text, result: topTranslation},
  )
  return topTranslation
}

/**
 * Provider MyMemory: pensato per essere chiamato direttamente dal browser
 * (Studio). `apiKey`/`email` alzano solo i rate limit, non sono segreti
 * critici — a differenza della key di Azure, non c'è problema a tenerli in
 * `sanity.config.ts`.
 */
export function createMyMemoryProvider(config: AutoI18nConfig): TranslationProvider {
  return {
    translateText: (text, sourceLang, targetLang) =>
      translateWithMyMemory(text, sourceLang, targetLang, config),
  }
}
