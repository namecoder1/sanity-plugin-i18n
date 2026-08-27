import type {PortableTextBlock} from '@portabletext/editor'
import type {SanityClient} from 'sanity'

import {LANGUAGE_SETTINGS_DOC_ID} from '../config'
import type {AutoI18nConfig} from '../config'
import type {TranslationProvider} from './providers/types'

export interface LanguageEntry {
  code: string
  label: string
  isDefault?: boolean
}

export interface LocaleValue {
  _key: string
  _type: string
  value?: string | PortableTextBlock[]
  sourceHash?: string
}

export function hasContent(value: string | PortableTextBlock[] | undefined): boolean {
  return Array.isArray(value) ? value.length > 0 : Boolean(value)
}

/**
 * Hash (non crittografico, solo per rilevare modifiche) del valore sorgente
 * al momento della traduzione. Salvato su ogni voce tradotta come `sourceHash`:
 * se al prossimo giro il sorgente ha un hash diverso, la traduzione esistente
 * viene considerata obsoleta e rigenerata, anche se ha già un `value`.
 */
export function hashSourceValue(value: string | PortableTextBlock[]): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0
  }
  return hash.toString(36)
}

/**
 * Molte API di traduzione (MyMemory in testa) eliminano gli spazi
 * iniziali/finali dal testo restituito. Quando uno span termina o inizia con
 * uno spazio (es. "...si " prima di uno span in grassetto), quello spazio va
 * perso e lo span successivo si salda al precedente ("...siyou..."). Isolando
 * lo spazio prima di tradurre e riattaccandolo dopo, la spaziatura tra span
 * consecutivi resta quella originale indipendentemente da cosa fa l'API con
 * gli estremi.
 */
function splitOuterWhitespace(text: string): {leading: string; core: string; trailing: string} {
  const match = text.match(/^(\s*)([\s\S]*?)(\s*)$/)
  if (!match) return {leading: '', core: text, trailing: ''}
  const [, leading, core, trailing] = match
  return {leading, core, trailing}
}

/**
 * Traduce un array di blocchi Portable Text mantenendo la struttura originale:
 * ogni span viene tradotto individualmente e i suoi `marks` (grassetto,
 * corsivo) restano invariati sul testo tradotto. Blocchi non testuali
 * (immagini, oggetti custom) e span vuoti vengono ricopiati senza modifiche.
 *
 * Limite noto: tradurre span per span invece che l'intera frase può ridurre
 * la fluidità della traduzione quando una frase è spezzata da formattazione
 * inline (es. "il **gatto** nero" tradotto in due chiamate separate) — è il
 * compromesso necessario per preservare i marks con API di sola traduzione
 * testuale (MyMemory, Azure Translator).
 */
async function translateBlocks(
  blocks: PortableTextBlock[],
  sourceLang: string,
  targetLang: string,
  provider: TranslationProvider,
): Promise<PortableTextBlock[]> {
  const translatedBlocks: PortableTextBlock[] = []

  for (const block of blocks) {
    const children = (block as {children?: unknown}).children
    if (block._type !== 'block' || !Array.isArray(children)) {
      translatedBlocks.push(block)
      continue
    }

    const translatedChildren = []
    for (const child of children as Array<Record<string, unknown>>) {
      const text = child.text
      if (child._type !== 'span' || typeof text !== 'string' || !text.trim()) {
        translatedChildren.push(child)
        continue
      }
      const {leading, core, trailing} = splitOuterWhitespace(text)
      const translatedCore = await provider.translateText(core, sourceLang, targetLang)
      translatedChildren.push({...child, text: leading + translatedCore + trailing})
    }

    translatedBlocks.push({...block, children: translatedChildren})
  }

  return translatedBlocks
}

function isLocaleValueArray(val: unknown): val is LocaleValue[] {
  return (
    Array.isArray(val) && val.some((item) => (item as {_type?: string})?._type === 'localeValue')
  )
}

export interface InternationalizedFieldPath {
  /**
   * Path in stile Sanity patch: `"title"` per un campo di primo livello,
   * `tags[_key=="k1"].value` per un campo annidato un livello dentro un
   * array di oggetti (es. `autoI18n.stringList`).
   */
  path: string
  /** L'array di localeValue trovato in quel punto del documento. */
  values: LocaleValue[]
}

/**
 * Trova tutti i campi internazionalizzati (array con _type 'localeValue')
 * dentro il documento, sia di primo livello (title, body, ...) sia annidati
 * UN livello dentro un array di oggetti (es. `autoI18n.stringList`: ogni tag
 * ha il proprio `value: [{_key:'it', ...}, ...]`). Non scende oltre un
 * livello: sufficiente per "lista di valori tradotti singolarmente", non
 * pensato per strutture innestate più a fondo.
 */
export function findInternationalizedFieldPaths(
  doc: Record<string, unknown>,
): InternationalizedFieldPath[] {
  const results: InternationalizedFieldPath[] = []

  for (const [key, val] of Object.entries(doc)) {
    if (isLocaleValueArray(val)) {
      results.push({path: key, values: val})
      continue
    }
    if (!Array.isArray(val)) continue

    for (const item of val) {
      if (!item || typeof item !== 'object' || !('_key' in item)) continue
      for (const [subKey, subVal] of Object.entries(item as Record<string, unknown>)) {
        if (isLocaleValueArray(subVal)) {
          results.push({
            path: `${key}[_key=="${(item as {_key: string})._key}"].${subKey}`,
            values: subVal,
          })
        }
      }
    }
  }

  return results
}

export interface PendingTranslation {
  fieldPath: string
  targetLang: string
}

/**
 * Elenca (senza chiamare l'API di traduzione) le coppie campo/lingua che
 * risultano mancanti o obsolete rispetto al sorgente. Usata per decidere se
 * mostrare l'avviso "traduzioni da aggiornare" (o se una Sanity Function deve
 * proprio svegliarsi) senza consumare quota API.
 */
export function findPendingTranslations(
  doc: Record<string, unknown>,
  sourceLang: string,
  targetLangs: string[],
): PendingTranslation[] {
  const pending: PendingTranslation[] = []

  for (const {path, values} of findInternationalizedFieldPaths(doc)) {
    const sourceValue = values.find((v) => v._key === sourceLang)?.value
    if (!hasContent(sourceValue)) continue

    const sourceHash = hashSourceValue(sourceValue as string | PortableTextBlock[])

    for (const targetLang of targetLangs) {
      const existing = values.find((v) => v._key === targetLang)
      const isStale = existing?.sourceHash !== sourceHash
      if (hasContent(existing?.value) && !isStale) continue
      pending.push({fieldPath: path, targetLang})
    }
  }

  return pending
}

export async function fetchLanguageSettings(
  client: SanityClient,
  config: AutoI18nConfig,
): Promise<{sourceLang: string; targetLangs: string[]}> {
  const langSettings = await client.fetch<{supportedLanguages: LanguageEntry[]} | null>(
    `*[_id == $id][0]{supportedLanguages}`,
    {id: LANGUAGE_SETTINGS_DOC_ID},
  )
  const languages = langSettings?.supportedLanguages || []
  if (languages.length === 0) {
    throw new Error('Nessuna lingua configurata in autoI18n.languageSettings')
  }

  const sourceLang =
    languages.find((l) => l.isDefault)?.code || config.defaultSourceLanguage || 'it'
  const targetLangs = languages.map((l) => l.code).filter((c) => c !== sourceLang)

  return {sourceLang, targetLangs}
}

/**
 * Traduce tutti i campi mancanti/obsoleti del documento con il provider
 * passato e ritorna le patch Sanity da applicare (senza applicarle: sta al
 * chiamante decidere quando — sincrono da un bottone nello Studio, oppure
 * `client.patch(...)` dentro una Sanity Function).
 */
export async function buildTranslationPatches(
  doc: Record<string, unknown>,
  sourceLang: string,
  targetLangs: string[],
  provider: TranslationProvider,
): Promise<any[]> {
  const patches: any[] = []

  for (const {path, values} of findInternationalizedFieldPaths(doc)) {
    const sourceValue = values.find((v) => v._key === sourceLang)?.value
    if (!hasContent(sourceValue)) continue

    const sourceHash = hashSourceValue(sourceValue as string | PortableTextBlock[])

    for (const targetLang of targetLangs) {
      const existing = values.find((v) => v._key === targetLang)
      // Una traduzione esistente viene saltata solo se ha contenuto E il suo
      // `sourceHash` combacia con quello attuale del sorgente. Se manca il
      // `sourceHash` (voce tradotta prima dell'introduzione di questo controllo,
      // o inserita manualmente) viene considerata obsoleta e rigenerata: non c'è
      // modo di sapere se è già allineata al sorgente attuale.
      const isStale = existing?.sourceHash !== sourceHash
      if (hasContent(existing?.value) && !isStale) continue

      const translated = Array.isArray(sourceValue)
        ? await translateBlocks(sourceValue, sourceLang, targetLang, provider)
        : await provider.translateText(sourceValue as string, sourceLang, targetLang)

      if (existing) {
        // `existing` qui significa "l'item con questa _key c'è già" (con `value`
        // vuoto oppure obsoleto): va sovrascritto con `set`, non `setIfMissing`
        // (che non fa nulla se il campo è già presente, anche se vuoto/obsoleto).
        patches.push({
          set: {
            [`${path}[_key=="${targetLang}"].value`]: translated,
            [`${path}[_key=="${targetLang}"].sourceHash`]: sourceHash,
          },
        })
      } else {
        patches.push({
          insert: {
            after: `${path}[-1]`,
            items: [{_key: targetLang, _type: 'localeValue', value: translated, sourceHash}],
          },
        })
      }
    }
  }

  return patches
}
