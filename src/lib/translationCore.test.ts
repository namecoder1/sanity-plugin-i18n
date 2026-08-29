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
    expect(hasContent([{_type: 'block'}])).toBe(true)
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
      tags: ['a', 'b'], // an array, but not of localeValue: not an i18n field
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

  it('finds a field nested inside a plain object field (seo.title)', () => {
    const titleValues = [{_key: 'it', _type: 'localeValue', value: 'Ciao'}]
    const doc = {_id: 'x', _type: 'post', seo: {title: titleValues}}
    expect(findInternationalizedFieldPaths(doc)).toEqual([{path: 'seo.title', values: titleValues}])
  })

  it('finds a field nested several object levels deep', () => {
    const values = [{_key: 'it', _type: 'localeValue', value: 'Ciao'}]
    const doc = {hero: {cta: {label: values}}}
    expect(findInternationalizedFieldPaths(doc)).toEqual([{path: 'hero.cta.label', values}])
  })

  it('finds a field nested two array levels deep, building the full keyed path', () => {
    const values = [{_key: 'it', _type: 'localeValue', value: 'Ciao'}]
    const doc = {
      sections: [{_key: 'sec1', items: [{_key: 'item1', title: values}]}],
    }
    expect(findInternationalizedFieldPaths(doc)).toEqual([
      {path: 'sections[_key=="sec1"].items[_key=="item1"].title', values},
    ])
  })

  it('mixes object and array nesting in one path', () => {
    const values = [{_key: 'it', _type: 'localeValue', value: 'Ciao'}]
    const doc = {page: {blocks: [{_key: 'b1', content: {heading: values}}]}}
    expect(findInternationalizedFieldPaths(doc)).toEqual([
      {path: 'page.blocks[_key=="b1"].content.heading', values},
    ])
  })

  it('skips everything below an array item with no _key', () => {
    const doc = {
      sections: [{items: [{_key: 'i1', title: [{_key: 'it', _type: 'localeValue', value: 'x'}]}]}],
    }
    expect(findInternationalizedFieldPaths(doc)).toEqual([])
  })

  it('does not descend into Sanity system fields', () => {
    // `_type` is a string, not a container: treating it as an ordinary field would
    // just be wasted work on every object in the document.
    const doc = {_id: 'x', _type: 'post', _rev: 'abc', _createdAt: '2026-01-01'}
    expect(findInternationalizedFieldPaths(doc)).toEqual([])
  })

  it('terminates on a cyclic structure instead of hanging', () => {
    const doc: Record<string, unknown> = {
      title: [{_key: 'it', _type: 'localeValue', value: 'Ciao'}],
    }
    doc.self = doc // circular reference
    expect(findInternationalizedFieldPaths(doc)).toEqual([{path: 'title', values: doc.title}])
  })

  it('finds several i18n fields spread across different nesting shapes', () => {
    const a = [{_key: 'it', _type: 'localeValue', value: 'a'}]
    const b = [{_key: 'it', _type: 'localeValue', value: 'b'}]
    const c = [{_key: 'it', _type: 'localeValue', value: 'c'}]
    const doc = {
      title: a,
      seo: {description: b},
      tags: [{_key: 'k1', value: c}],
    }
    expect(findInternationalizedFieldPaths(doc)).toEqual([
      {path: 'title', values: a},
      {path: 'seo.description', values: b},
      {path: 'tags[_key=="k1"].value', values: c},
    ])
  })
})

describe('collisions with a foreign `localeValue` type', () => {
  // `_type: 'localeValue'` is not namespaced, so in principle another schema could
  // use the same name. These two tests pin down how far that actually reaches, because
  // the answer is much narrower than "any array with that _type gets translated".
  const provider: TranslationProvider = {translateText: async (text) => `[XX] ${text}`}

  it('ignores a foreign localeValue array whose keys are not language codes', async () => {
    // The realistic collision. Nothing here is keyed by the source language, so there
    // is no source value to translate from and the field is never touched.
    const doc = {colors: [{_key: 'k1', _type: 'localeValue', value: 'red'}]}
    expect(findPendingTranslations(doc, 'en', ['de'])).toEqual([])
    expect(await buildTranslationPatches(doc, 'en', ['de'], provider)).toEqual([])
  })

  it('does translate a foreign array that is keyed by the configured languages', async () => {
    // The remaining exposure, documented rather than fixed: a foreign type named
    // `localeValue` whose items happen to be keyed by exactly the configured language
    // codes is indistinguishable from one of ours, and gets translated.
    const doc = {units: [{_key: 'en', _type: 'localeValue', value: 'meters'}]}
    expect(findPendingTranslations(doc, 'en', ['de'])).toEqual([
      {fieldPath: 'units', targetLang: 'de'},
    ])
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
        {_key: 'it', _type: 'localeValue', value: 'Ciao a tutti'}, // source has changed
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
        {_key: 'en', _type: 'localeValue', value: 'Hello'}, // no sourceHash
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
      throw new Error('must not be called: there is nothing to translate')
    })

    const patches = await buildTranslationPatches(doc, 'it', ['en'], provider)
    expect(patches).toEqual([])
  })

  it('preserves whitespace between translated spans even if the provider trims its output', async () => {
    // Regression: a "MyMemory-like" provider that strips leading/trailing whitespace
    // from the translated text must no longer weld words together across two
    // consecutive spans ("...si vede" became "...siyou" before the fix).
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
    const provider = fakeProvider((text) => text.trim().toUpperCase()) // mimics MyMemory's trimming

    const patches = await buildTranslationPatches(doc, 'it', ['en'], provider)

    const insertPatch = patches[0] as {insert: {items: Array<{value: PortableTextBlock[]}>}}
    const translatedChildren = (
      insertPatch.insert.items[0].value[0] as unknown as {children: Array<{text: string}>}
    ).children
    const fullText = translatedChildren.map((c) => c.text).join('')
    expect(fullText).toBe('CIAO A TUTTI, OGGI SIAMO QUI.')
    // No word welded onto the next: the original spacing must survive
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

  it('translates a field nested inside an object field, with the right patch path', async () => {
    const doc = {seo: {title: [{_key: 'it', _type: 'localeValue', value: 'Ciao'}]}}
    const provider = fakeProvider((text) => `[EN] ${text}`)

    const patches = await buildTranslationPatches(doc, 'it', ['en'], provider)

    expect(patches).toEqual([
      {
        insert: {
          after: 'seo.title[-1]',
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

  it('emits no patch when the provider returns an empty string', async () => {
    // Regression: an empty patch leaves the entry without content, so it is still
    // pending next time round. In the Studio that is a wasted click; in the Sanity
    // Function the write regenerates an update event and restarts it in a loop,
    // spending a billable call on every turn.
    const doc = {title: [{_key: 'it', _type: 'localeValue', value: 'Ciao'}]}
    const patches = await buildTranslationPatches(
      doc,
      'it',
      ['en'],
      fakeProvider(() => ''),
    )
    expect(patches).toEqual([])
  })

  it('reports each patch through onPatch as soon as it is built', async () => {
    const doc = {
      title: [{_key: 'it', _type: 'localeValue', value: 'Ciao'}],
      body: [{_key: 'it', _type: 'localeValue', value: 'Mondo'}],
    }
    const seen: unknown[] = []
    const patches = await buildTranslationPatches(
      doc,
      'it',
      ['en'],
      fakeProvider((t) => `[EN] ${t}`),
      {
        onPatch: (patch) => seen.push(patch),
      },
    )
    expect(seen).toEqual(patches)
    expect(seen).toHaveLength(2)
  })

  it('keeps the patches produced before a provider failure', async () => {
    // The heart of "do not throw away work that succeeded": the second field blows
    // up, but the first was already handed to the caller through onPatch.
    const doc = {
      title: [{_key: 'it', _type: 'localeValue', value: 'Ciao'}],
      body: [{_key: 'it', _type: 'localeValue', value: 'esplodi'}],
    }
    const seen: unknown[] = []
    const provider = fakeProvider((text) => {
      if (text === 'esplodi') throw new Error('rate limit')
      return `[EN] ${text}`
    })

    await expect(
      buildTranslationPatches(doc, 'it', ['en'], provider, {onPatch: (p) => seen.push(p)}),
    ).rejects.toThrow('rate limit')

    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({insert: {after: 'title[-1]'}})
  })

  it('reports progress as completed/total', async () => {
    const doc = {
      title: [{_key: 'it', _type: 'localeValue', value: 'Ciao'}],
      body: [{_key: 'it', _type: 'localeValue', value: 'Mondo'}],
    }
    const steps: Array<[number, number]> = []
    await buildTranslationPatches(
      doc,
      'it',
      ['en', 'fr'],
      fakeProvider((t) => `[X] ${t}`),
      {
        onProgress: (done, total) => steps.push([done, total]),
      },
    )
    // two fields x two target languages
    expect(steps).toEqual([
      [1, 4],
      [2, 4],
      [3, 4],
      [4, 4],
    ])
  })

  it('uses the provider batch endpoint when it exposes one', async () => {
    const calls: string[][] = []
    const batching: TranslationProvider = {
      translateText: async () => {
        throw new Error('must not be called when translateTexts exists')
      },
      translateTexts: async (texts) => {
        calls.push(texts)
        return texts.map((t) => `[EN] ${t}`)
      },
    }
    const blocks = [
      {
        _type: 'block',
        _key: 'b1',
        markDefs: [],
        children: [
          {_type: 'span', _key: 's1', marks: [], text: 'uno'},
          {_type: 'span', _key: 's2', marks: ['strong'], text: 'due'},
        ],
      },
      {
        _type: 'block',
        _key: 'b2',
        markDefs: [],
        children: [{_type: 'span', _key: 's3', marks: [], text: 'tre'}],
      },
    ]
    const doc = {body: [{_key: 'it', _type: 'localeValue', value: blocks}]}

    await buildTranslationPatches(doc, 'it', ['en'], batching)

    // Tutti gli span del campo in una sola chiamata, non una per span.
    expect(calls).toEqual([['uno', 'due', 'tre']])
  })

  it('falls back to sequential calls when the provider has no batch endpoint', async () => {
    const seen: string[] = []
    const provider = fakeProvider((text) => {
      seen.push(text)
      return `[EN] ${text}`
    })
    const blocks = [
      {
        _type: 'block',
        _key: 'b1',
        markDefs: [],
        children: [
          {_type: 'span', _key: 's1', marks: [], text: 'uno'},
          {_type: 'span', _key: 's2', marks: [], text: 'due'},
        ],
      },
    ]
    const doc = {body: [{_key: 'it', _type: 'localeValue', value: blocks}]}

    await buildTranslationPatches(doc, 'it', ['en'], provider)
    expect(seen).toEqual(['uno', 'due'])
  })

  it('rejects a batch response whose length does not match the request', async () => {
    // Le traduzioni sono riassociate agli span per posizione: una risposta di
    // lunghezza diversa attaccherebbe ogni traduzione allo span sbagliato.
    const broken: TranslationProvider = {
      translateText: async (t) => t,
      translateTexts: async () => ['solo una'],
    }
    const blocks = [
      {
        _type: 'block',
        _key: 'b1',
        markDefs: [],
        children: [
          {_type: 'span', _key: 's1', marks: [], text: 'uno'},
          {_type: 'span', _key: 's2', marks: [], text: 'due'},
        ],
      },
    ]
    const doc = {body: [{_key: 'it', _type: 'localeValue', value: blocks}]}

    await expect(buildTranslationPatches(doc, 'it', ['en'], broken)).rejects.toThrow(
      /returned 1 results for 2 texts/,
    )
  })

  it('leaves non-text blocks (e.g. images) untouched', async () => {
    const blocks: PortableTextBlock[] = [{_type: 'image', _key: 'img1', asset: {_ref: 'image-abc'}}]
    const doc = {body: [{_key: 'it', _type: 'localeValue', value: blocks}]}
    const provider = fakeProvider(() => {
      throw new Error('must not be called for non-text blocks')
    })

    const patches = await buildTranslationPatches(doc, 'it', ['en'], provider)
    const insertPatch = patches[0] as {insert: {items: Array<{value: PortableTextBlock[]}>}}
    expect(insertPatch.insert.items[0].value).toEqual(blocks)
  })
})
