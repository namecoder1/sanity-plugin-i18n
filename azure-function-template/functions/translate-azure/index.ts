import {createClient} from '@sanity/client'
import {documentEventHandler} from '@sanity/functions'

const LANGUAGE_SETTINGS_DOC_ID = 'autoI18n.languageSettings'

interface LanguageEntry {
  code: string
  label: string
  isDefault?: boolean
}

interface LocaleValue {
  _key: string
  _type: string
  value?: string | PortableTextBlockLike[]
  sourceHash?: string
}

interface PortableTextBlockLike {
  _type: string
  children?: Array<Record<string, unknown>>
  [key: string]: unknown
}

// ────────────────────────────────────────────────────────────────────────
// Tutto quello che segue, fino a "Provider Azure", è una copia deliberata
// della logica "pura" (nessuna dipendenza da 'sanity'/browser) che vive in
// sanity-plugin-i18n/src/lib/translationCore.ts. Non è importata da lì
// perché il plugin non è pubblicato su npm: le Sanity Function si compilano
// sui server di Sanity, che non hanno accesso al filesystem locale (yalc/file:
// non funzionano qui). Se in futuro il plugin viene pubblicato su npm, questa
// duplicazione va eliminata a favore di un import diretto.
//
// ATTENZIONE: `hashSourceValue` deve restare ALGORITMICAMENTE IDENTICA alla
// funzione omonima nel plugin. Il client (Studio, browser) calcola l'hash
// con la sua copia e lo confronta con `sourceHash` scritto qui dalla Function:
// se le due implementazioni divergono, il controllo di "traduzione obsoleta"
// smette di funzionare in modo silenzioso.
// ────────────────────────────────────────────────────────────────────────

function hasContent(value: string | PortableTextBlockLike[] | undefined): boolean {
  return Array.isArray(value) ? value.length > 0 : Boolean(value)
}

function hashSourceValue(value: string | PortableTextBlockLike[]): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0
  }
  return hash.toString(36)
}

function splitOuterWhitespace(text: string): {leading: string; core: string; trailing: string} {
  const match = text.match(/^(\s*)([\s\S]*?)(\s*)$/)
  if (!match) return {leading: '', core: text, trailing: ''}
  const [, leading, core, trailing] = match
  return {leading, core, trailing}
}

function isLocaleValueArray(val: unknown): val is LocaleValue[] {
  return (
    Array.isArray(val) && val.some((item) => (item as {_type?: string})?._type === 'localeValue')
  )
}

interface InternationalizedFieldPath {
  /**
   * Path in stile Sanity patch: `"title"` per un campo di primo livello,
   * `tags[_key=="k1"].value` per un campo annidato un livello dentro un
   * array di oggetti (es. `autoI18n.stringList`).
   */
  path: string
  values: LocaleValue[]
}

/**
 * Trova i campi internazionalizzati sia di primo livello sia annidati un
 * livello dentro un array di oggetti (es. autoI18n.stringList). Non scende
 * oltre un livello — vedi la stessa funzione in sanity-plugin-i18n
 * (translationCore.ts), da cui questa è copiata a mano.
 */
function findInternationalizedFieldPaths(
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

interface PendingTranslation {
  fieldPath: string
  targetLang: string
}

function findPendingTranslations(
  doc: Record<string, unknown>,
  sourceLang: string,
  targetLangs: string[],
): PendingTranslation[] {
  const pending: PendingTranslation[] = []
  for (const {path, values} of findInternationalizedFieldPaths(doc)) {
    const sourceValue = values.find((v) => v._key === sourceLang)?.value
    if (!hasContent(sourceValue)) continue

    const sourceHash = hashSourceValue(sourceValue as string | PortableTextBlockLike[])
    for (const targetLang of targetLangs) {
      const existing = values.find((v) => v._key === targetLang)
      const isStale = existing?.sourceHash !== sourceHash
      if (hasContent(existing?.value) && !isStale) continue
      pending.push({fieldPath: path, targetLang})
    }
  }
  return pending
}

async function fetchLanguageSettings(
  client: ReturnType<typeof createClient>,
  defaultSourceLanguage: string,
): Promise<{sourceLang: string; targetLangs: string[]}> {
  const langSettings = await client.fetch<{supportedLanguages: LanguageEntry[]} | null>(
    `*[_id == $id][0]{supportedLanguages}`,
    {id: LANGUAGE_SETTINGS_DOC_ID},
  )
  const languages = langSettings?.supportedLanguages || []
  if (languages.length === 0) {
    throw new Error('Nessuna lingua configurata in autoI18n.languageSettings')
  }
  const sourceLang = languages.find((l) => l.isDefault)?.code || defaultSourceLanguage
  const targetLangs = languages.map((l) => l.code).filter((c) => c !== sourceLang)
  return {sourceLang, targetLangs}
}

// ────────────────────────────────────────────────────────────────────────
// Provider Azure Translator. Qui (e solo qui, lato server) è sicuro tenere
// la subscription key: viene letta da una variabile d'ambiente della
// Function (`functions env add translate-azure AZURE_TRANSLATOR_KEY ...`),
// mai committata, mai esposta al browser.
// ────────────────────────────────────────────────────────────────────────

async function translateWithAzure(
  text: string,
  sourceLang: string,
  targetLang: string,
  apiKey: string,
  region?: string,
): Promise<string> {
  const url = new URL('https://api.cognitive.microsofttranslator.com/translate')
  url.searchParams.set('api-version', '3.0')
  url.searchParams.set('from', sourceLang)
  url.searchParams.set('to', targetLang)

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': apiKey,
      ...(region ? {'Ocp-Apim-Subscription-Region': region} : {}),
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
    throw new Error('Nessuna traduzione ricevuta da Azure Translator')
  }
  return translated
}

async function translateBlocks(
  blocks: PortableTextBlockLike[],
  sourceLang: string,
  targetLang: string,
  apiKey: string,
  region: string | undefined,
): Promise<PortableTextBlockLike[]> {
  const translatedBlocks: PortableTextBlockLike[] = []

  for (const block of blocks) {
    if (block._type !== 'block' || !Array.isArray(block.children)) {
      translatedBlocks.push(block)
      continue
    }

    const translatedChildren: Array<Record<string, unknown>> = []
    for (const child of block.children) {
      const text = child.text
      if (child._type !== 'span' || typeof text !== 'string' || !text.trim()) {
        translatedChildren.push(child)
        continue
      }
      const {leading, core, trailing} = splitOuterWhitespace(text)
      const translatedCore = await translateWithAzure(core, sourceLang, targetLang, apiKey, region)
      translatedChildren.push({...child, text: leading + translatedCore + trailing})
    }

    translatedBlocks.push({...block, children: translatedChildren})
  }

  return translatedBlocks
}

async function buildTranslationPatches(
  doc: Record<string, unknown>,
  sourceLang: string,
  targetLangs: string[],
  apiKey: string,
  region: string | undefined,
): Promise<Array<Record<string, unknown>>> {
  const patches: Array<Record<string, unknown>> = []

  for (const {path, values} of findInternationalizedFieldPaths(doc)) {
    const sourceValue = values.find((v) => v._key === sourceLang)?.value
    if (!hasContent(sourceValue)) continue

    const sourceHash = hashSourceValue(sourceValue as string | PortableTextBlockLike[])

    for (const targetLang of targetLangs) {
      const existing = values.find((v) => v._key === targetLang)
      const isStale = existing?.sourceHash !== sourceHash
      if (hasContent(existing?.value) && !isStale) continue

      const translated = Array.isArray(sourceValue)
        ? await translateBlocks(sourceValue, sourceLang, targetLang, apiKey, region)
        : await translateWithAzure(sourceValue as string, sourceLang, targetLang, apiKey, region)

      if (existing) {
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

// ────────────────────────────────────────────────────────────────────────
// Handler
// ────────────────────────────────────────────────────────────────────────

export const handler = documentEventHandler(async ({context, event}) => {
  const apiKey = process.env.AZURE_TRANSLATOR_KEY
  if (!apiKey) {
    console.error(
      '[auto-i18n] AZURE_TRANSLATOR_KEY non impostata. Esegui: ' +
        'npx sanity@latest functions env add translate-azure AZURE_TRANSLATOR_KEY <la-tua-key>',
    )
    return
  }
  const region = process.env.AZURE_TRANSLATOR_REGION
  const defaultSourceLanguage = process.env.DEFAULT_SOURCE_LANGUAGE || 'it'

  const client = createClient({...context.clientOptions, apiVersion: '2025-05-08'})
  const doc = event.data as Record<string, unknown> & {_id: string}

  try {
    const {sourceLang, targetLangs} = await fetchLanguageSettings(client, defaultSourceLanguage)

    // Early-exit PRIMA di chiamare Azure (risparmia chiamate a pagamento) e
    // prima di scrivere qualunque cosa: se non c'è nulla da tradurre, questa
    // invocazione non produce nessuna mutazione, quindi non emette un nuovo
    // evento 'update' — è questo, e non un campo "processed" statico, a
    // fermare il ciclo (la Function reagisce agli stessi eventi che scrive).
    const pending = findPendingTranslations(doc, sourceLang, targetLangs)
    if (pending.length === 0) return

    const patches = await buildTranslationPatches(doc, sourceLang, targetLangs, apiKey, region)
    if (patches.length === 0) return

    await client.mutate(
      patches.map((patch) => ({patch: {id: doc._id, ...patch}})),
      {dryRun: context.local},
    )
    console.log(`[auto-i18n] Tradotti ${patches.length} campo/lingua su ${doc._id}`)
  } catch (error) {
    console.error('[auto-i18n] Errore nella Function di traduzione Azure:', error)
  }
})
