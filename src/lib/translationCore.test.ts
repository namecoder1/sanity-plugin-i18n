import type {PortableTextBlock} from '@portabletext/editor'
import {describe, expect, it} from 'vitest'

import type {TranslationProvider} from './providers/types'
import {
  buildTranslationPatches,
  findInternationalizedFieldPaths,
  findPendingTranslations,
  hasContent,
  hashSourceValue,
} from './translationCore'

describe('hasContent', () => {
  it('is false for undefined, empty string, and empty array', () => {
    expect(hasContent(undefined)).toBe(false)
    expect(hasContent('')).toBe(false)
    expect(hasContent([])).toBe(false)
  })

  it('is true for non-empty string and non-empty array', () => {
    expect(hasContent('ciao')).toBe(true)
    expect(hasContent([{_type: 'block'} as unknown as PortableTextBlock])).toBe(true)
  })
})

describe('hashSourceValue', () => {
  it('is stable for identical input', () => {
    expect(hashSourceValue('ciao mondo')).toBe(hashSourceValue('ciao mondo'))
  })

  it('changes when the text changes', () => {
    expect(hashSourceValue('ciao mondo')).not.toBe(hashSourceValue('ciao mondo!'))
  })

  it('hashes block arrays by their JSON content', () => {
    const a = [{_type: 'block', children: [{_type: 'span', text: 'ciao'}]}] as PortableTextBlock[]
    const b = [{_type: 'block', children: [{_type: 'span', text: 'ciao'}]}] as PortableTextBlock[]
    const c = [{_type: 'block', children: [{_type: 'span', text: 'salve'}]}] as PortableTextBlock[]
    expect(hashSourceValue(a)).toBe(hashSourceValue(b))
    expect(hashSourceValue(a)).not.toBe(hashSourceValue(c))
  })
})

describe('findInternationalizedFieldPaths', () => {
  it('finds only arrays containing localeValue items, at the top level', () => {
    const titleValues = [{_key: 'it', _type: 'localeValue', value: 'Ciao'}]
    const doc = {
      _id: 'x',
      _type: 'post',
      title: titleValues,
      tags: ['a', 'b'], // array, ma non di localeValue: non è un campo i18n
      slug: {current: 'ciao'},
    }
    expect(findInternationalizedFieldPaths(doc)).toEqual([{path: 'title', values: titleValues}])
  })

  it('returns an empty array when there are no i18n fields', () => {
    expect(findInternationalizedFieldPaths({_id: 'x', _type: 'post'})).toEqual([])
  })

  it('finds localeValue arrays nested one level inside an array of objects (autoI18n.stringList)', () => {
    const tag1Values = [{_key: 'it', _type: 'localeValue', value: 'prova'}]
    const tag2Values = [{_key: 'it', _type: 'localeValue', value: 'e2e'}]
    const doc = {
      _id: 'x',
      _type: 'post',
      tags: [
        {_key: 'k1', _type: 'internationalizedListItem', value: tag1Values},
        {_key: 'k2', _type: 'internationalizedListItem', value: tag2Values},
      ],
    }
    expect(findInternationalizedFieldPaths(doc)).toEqual([
      {path: 'tags[_key=="k1"].value', values: tag1Values},
      {path: 'tags[_key=="k2"].value', values: tag2Values},
    ])
  })

  it('ignores array items with no _key (not addressable by a Sanity patch path)', () => {
    const doc = {
      tags: [{value: [{_key: 'it', _type: 'localeValue', value: 'prova'}]}],
    }
    expect(findInternationalizedFieldPaths(doc)).toEqual([])
  })
})

describe('findPendingTranslations', () => {
  it('flags a target language with no existing entry as pending', () => {
    const doc = {
      title: [{_key: 'it', _type: 'localeValue', value: 'Ciao'}],
    }
    expect(findPendingTranslations(doc, 'it', ['en'])).toEqual([
      {fieldPath: 'title', targetLang: 'en'},
    ])
  })

  it('does not flag a target language whose sourceHash matches the current source', () => {
    const sourceHash = hashSourceValue('Ciao')
    const doc = {
      title: [
        {_key: 'it', _type: 'localeValue', value: 'Ciao'},
        {_key: 'en', _type: 'localeValue', value: 'Hello', sourceHash},
      ],
    }
    expect(findPendingTranslations(doc, 'it', ['en'])).toEqual([])
  })

  it('flags a target language as pending when the source text changed since translation', () => {
    const staleHash = hashSourceValue('Ciao')
    const doc = {
      title: [
        {_key: 'it', _type: 'localeValue', value: 'Ciao a tutti'}, // sorgente cambiato
        {_key: 'en', _type: 'localeValue', value: 'Hello', sourceHash: staleHash},
      ],
    }
    expect(findPendingTranslations(doc, 'it', ['en'])).toEqual([
      {fieldPath: 'title', targetLang: 'en'},
    ])
  })

  it('flags an existing translation with no sourceHash as pending (created before this check existed)', () => {
    const doc = {
      title: [
        {_key: 'it', _type: 'localeValue', value: 'Ciao'},
        {_key: 'en', _type: 'localeValue', value: 'Hello'}, // nessun sourceHash
      ],
    }
    expect(findPendingTranslations(doc, 'it', ['en'])).toEqual([
      {fieldPath: 'title', targetLang: 'en'},
    ])
  })

  it('skips a field with no source content', () => {
    const doc = {title: [{_key: 'it', _type: 'localeValue', value: ''}]}
    expect(findPendingTranslations(doc, 'it', ['en'])).toEqual([])
  })
})

function fakeProvider(translate: (text: string) => string): TranslationProvider {
  return {
    translateText: async (text) => translate(text),
  }
}

describe('buildTranslationPatches', () => {
  it('inserts a new localeValue item for a missing target language', async () => {
    const doc = {title: [{_key: 'it', _type: 'localeValue', value: 'Ciao'}]}
    const provider = fakeProvider((text) => `[EN] ${text}`)

    const patches = await buildTranslationPatches(doc, 'it', ['en'], provider)

    expect(patches).toEqual([
      {
        insert: {
          after: 'title[-1]',
          items: [
            {
              _key: 'en',
              _type: 'localeValue',
              value: '[EN] Ciao',
              sourceHash: hashSourceValue('Ciao'),
            },
          ],
        },
      },
    ])
  })

  it('inserts a translated item for a tag nested inside autoI18n.stringList', async () => {
    const doc = {
      tags: [
        {
          _key: 'k1',
          _type: 'internationalizedListItem',
          value: [{_key: 'it', _type: 'localeValue', value: 'prova'}],
        },
      ],
    }
    const provider = fakeProvider((text) => `[EN] ${text}`)

    const patches = await buildTranslationPatches(doc, 'it', ['en'], provider)

    expect(patches).toEqual([
      {
        insert: {
          after: 'tags[_key=="k1"].value[-1]',
          items: [
            {
              _key: 'en',
              _type: 'localeValue',
              value: '[EN] prova',
              sourceHash: hashSourceValue('prova'),
            },
          ],
        },
      },
    ])
  })

  it('overwrites a stale existing translation with set (not insert)', async () => {
    const doc = {
      title: [
        {_key: 'it', _type: 'localeValue', value: 'Ciao a tutti'},
        {_key: 'en', _type: 'localeValue', value: 'Hello', sourceHash: hashSourceValue('Ciao')},
      ],
    }
    const provider = fakeProvider((text) => `[EN] ${text}`)

    const patches = await buildTranslationPatches(doc, 'it', ['en'], provider)

    expect(patches).toEqual([
      {
        set: {
          'title[_key=="en"].value': '[EN] Ciao a tutti',
          'title[_key=="en"].sourceHash': hashSourceValue('Ciao a tutti'),
        },
      },
    ])
  })

  it('produces no patches when every target is already up to date', async () => {
    const sourceHash = hashSourceValue('Ciao')
    const doc = {
      title: [
        {_key: 'it', _type: 'localeValue', value: 'Ciao'},
        {_key: 'en', _type: 'localeValue', value: 'Hello', sourceHash},
      ],
    }
    const provider = fakeProvider(() => {
      throw new Error('non deve essere chiamato: nulla da tradurre')
    })

    const patches = await buildTranslationPatches(doc, 'it', ['en'], provider)
    expect(patches).toEqual([])
  })

  it('preserves whitespace between translated spans even if the provider trims its output', async () => {
    // Regressione: un provider "MyMemory-like" che rimuove gli spazi iniziali/
    // finali dal testo tradotto non deve più far incollare le parole tra due
    // span consecutivi (es. "...si vede" diventato "...siyou" prima del fix).
    const blocks: PortableTextBlock[] = [
      {
        _type: 'block',
        _key: 'b1',
        style: 'normal',
        markDefs: [],
        children: [
          {_type: 'span', _key: 's1', marks: [], text: 'Ciao a tutti, '},
          {_type: 'span', _key: 's2', marks: ['strong'], text: 'oggi'},
          {_type: 'span', _key: 's3', marks: [], text: ' siamo qui.'},
        ],
      },
    ]
    const doc = {body: [{_key: 'it', _type: 'localeValue', value: blocks}]}
    const provider = fakeProvider((text) => text.trim().toUpperCase()) // simula il trimming di MyMemory

    const patches = await buildTranslationPatches(doc, 'it', ['en'], provider)

    const insertPatch = patches[0] as {insert: {items: Array<{value: PortableTextBlock[]}>}}
    const translatedChildren = (
      insertPatch.insert.items[0].value[0] as unknown as {children: Array<{text: string}>}
    ).children
    const fullText = translatedChildren.map((c) => c.text).join('')
    expect(fullText).toBe('CIAO A TUTTI, OGGI SIAMO QUI.')
    // Nessuna parola incollata alla successiva: deve restarci lo spazio originale
    expect(translatedChildren[0].text.endsWith(' ')).toBe(true)
    expect(translatedChildren[2].text.startsWith(' ')).toBe(true)
  })

  it('preserves marks on translated spans', async () => {
    const blocks: PortableTextBlock[] = [
      {
        _type: 'block',
        _key: 'b1',
        style: 'normal',
        markDefs: [],
        children: [{_type: 'span', _key: 's1', marks: ['strong', 'em'], text: 'importante'}],
      },
    ]
    const doc = {body: [{_key: 'it', _type: 'localeValue', value: blocks}]}
    const provider = fakeProvider((text) => `[EN] ${text}`)

    const patches = await buildTranslationPatches(doc, 'it', ['en'], provider)
    const insertPatch = patches[0] as {insert: {items: Array<{value: PortableTextBlock[]}>}}
    const span = (
      insertPatch.insert.items[0].value[0] as unknown as {
        children: Array<{marks: string[]; text: string}>
      }
    ).children[0]

    expect(span.marks).toEqual(['strong', 'em'])
    expect(span.text).toBe('[EN] importante')
  })

  it('preserves style, listItem/level, and link markDefs on translated blocks', async () => {
    const blocks: PortableTextBlock[] = [
      {
        _type: 'block',
        _key: 'heading',
        style: 'h2',
        markDefs: [],
        children: [{_type: 'span', _key: 's1', marks: [], text: 'Titolo di sezione'}],
      },
      {
        _type: 'block',
        _key: 'item1',
        style: 'normal',
        listItem: 'bullet',
        level: 1,
        markDefs: [],
        children: [{_type: 'span', _key: 's2', marks: [], text: 'Primo punto elenco'}],
      },
      {
        _type: 'block',
        _key: 'linkblock',
        style: 'normal',
        markDefs: [{_key: 'link1', _type: 'link', href: 'https://example.com'}],
        children: [
          {_type: 'span', _key: 's3', marks: [], text: 'Vai al '},
          {_type: 'span', _key: 's4', marks: ['link1', 'underline'], text: 'sito'},
        ],
      },
    ]
    const doc = {body: [{_key: 'it', _type: 'localeValue', value: blocks}]}
    const provider = fakeProvider((text) => `[EN] ${text}`)

    const patches = await buildTranslationPatches(doc, 'it', ['en'], provider)
    const insertPatch = patches[0] as {insert: {items: Array<{value: PortableTextBlock[]}>}}
    const translated = insertPatch.insert.items[0].value as unknown as Array<{
      style: string
      listItem?: string
      level?: number
      markDefs: Array<{_key: string; _type: string; href?: string}>
      children: Array<{marks: string[]; text: string}>
    }>

    expect(translated[0].style).toBe('h2')
    expect(translated[0].children[0].text).toBe('[EN] Titolo di sezione')

    expect(translated[1].listItem).toBe('bullet')
    expect(translated[1].level).toBe(1)
    expect(translated[1].children[0].text).toBe('[EN] Primo punto elenco')

    expect(translated[2].markDefs).toEqual([
      {_key: 'link1', _type: 'link', href: 'https://example.com'},
    ])
    expect(translated[2].children[1].marks).toEqual(['link1', 'underline'])
    expect(translated[2].children[1].text).toBe('[EN] sito')
  })

  it('leaves non-text blocks (e.g. images) untouched', async () => {
    const blocks: PortableTextBlock[] = [{_type: 'image', _key: 'img1', asset: {_ref: 'image-abc'}}]
    const doc = {body: [{_key: 'it', _type: 'localeValue', value: blocks}]}
    const provider = fakeProvider(() => {
      throw new Error('non deve essere chiamato per blocchi non testuali')
    })

    const patches = await buildTranslationPatches(doc, 'it', ['en'], provider)
    const insertPatch = patches[0] as {insert: {items: Array<{value: PortableTextBlock[]}>}}
    expect(insertPatch.insert.items[0].value).toEqual(blocks)
  })
})
