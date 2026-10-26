import {createSchema, defineField, defineType} from 'sanity'
import {describe, expect, it} from 'vitest'

import {getBlockContentConfig} from '../lib/blockContentConfig'
import {documentTypeHasI18nFields, type SchemaTypeLike} from '../lib/schemaHasI18nFields'
import {
  defineInternationalizedBlockContent,
  internationalizedBlockContentType,
} from './internationalizedField'

const isRelativeOrAbsolute = (href: string) =>
  /^(\/|#|https?:\/\/|mailto:|tel:)/.test(href)
    ? true
    : 'Must start with /, #, https://, mailto: or tel:'

const richText = defineInternationalizedBlockContent({
  name: 'richText',
  title: 'Testo',
  styles: [
    {value: 'normal', title: 'Paragrafo'},
    {value: 'h2', title: 'Titolo'},
    {value: 'h3', title: 'Sottotitolo'},
    {value: 'blockquote', title: 'Citazione'},
  ],
  decorators: [
    {value: 'strong', title: 'Grassetto'},
    {value: 'em', title: 'Corsivo'},
  ],
  lists: [
    {value: 'bullet', title: 'Elenco puntato'},
    {value: 'number', title: 'Elenco numerato'},
  ],
  link: {title: 'Link', validate: isRelativeOrAbsolute},
})

/** The `block` member of the per-language `value` array, as defined (not compiled). */
function blockDefinition(type: ReturnType<typeof defineInternationalizedBlockContent>) {
  const localeValue = (type as unknown as {of: Array<{fields: Array<{name: string; of?: any[]}>}>})
    .of[0]
  return localeValue.fields.find((field) => field.name === 'value')!.of![0] as {
    styles: Array<{value: string; title: string}>
    lists: Array<{value: string; title: string}>
    marks: {
      decorators: Array<{value: string; title: string}>
      annotations: Array<{name: string; fields: Array<{name: string; type: string}>}>
    }
  }
}

const values = (options: Array<{value: string}>) => options.map((option) => option.value)

/** Compiles a real Sanity schema, so the definitions are checked the way the Studio does. */
function compile(types: unknown[]) {
  return createSchema({name: 'test', types: types as any[]})
}

describe('defineInternationalizedBlockContent', () => {
  it('prefixes the type name with autoI18n.', () => {
    expect(richText.name).toBe('autoI18n.richText')
  })

  it('does not double a prefix the name already has', () => {
    expect(defineInternationalizedBlockContent({name: 'autoI18n.body'}).name).toBe('autoI18n.body')
  })

  it.each([
    ['style', {styles: [{value: 'h7' as never}]}],
    ['decorator', {decorators: [{value: 'superscript' as never}]}],
    ['list', {lists: [{value: 'checklist' as never}]}],
  ])('throws on an unknown %s', (kind, options) => {
    expect(() => defineInternationalizedBlockContent({name: 'x', ...options})).toThrow(
      new RegExp(`unknown ${kind}`),
    )
  })

  it('throws on a value listed twice', () => {
    expect(() =>
      defineInternationalizedBlockContent({name: 'x', styles: [{value: 'h2'}, {value: 'h2'}]}),
    ).toThrow(/listed twice/)
  })

  it('stores the resolved configuration in options', () => {
    const config = getBlockContentConfig(richText)!
    expect(config.styles).toEqual([
      {value: 'normal', title: 'Paragrafo'},
      {value: 'h2', title: 'Titolo'},
      {value: 'h3', title: 'Sottotitolo'},
      {value: 'blockquote', title: 'Citazione'},
    ])
    expect(values(config.decorators)).toEqual(['strong', 'em'])
    expect(values(config.lists)).toEqual(['bullet', 'number'])
    expect(config.link).toMatchObject({title: 'Link', type: 'string'})
    expect(config.link && config.link.validate).toBe(isRelativeOrAbsolute)
  })

  it('gives the block only the requested styles, lists and decorators', () => {
    const block = blockDefinition(richText)
    expect(values(block.styles)).toEqual(['normal', 'h2', 'h3', 'blockquote'])
    expect(values(block.lists)).toEqual(['bullet', 'number'])
    expect(values(block.marks.decorators)).toEqual(['strong', 'em'])
    expect(block.marks.annotations[0].fields[0]).toMatchObject({name: 'href', type: 'string'})
  })

  it('has no annotation with link: false', () => {
    const type = defineInternationalizedBlockContent({name: 'x', link: false})
    expect(blockDefinition(type).marks.annotations).toEqual([])
    expect(getBlockContentConfig(type as {options?: unknown})!.link).toBe(false)
  })

  it('offers everything Sanity offers by default when nothing is specified', () => {
    const block = blockDefinition(defineInternationalizedBlockContent({name: 'full'}))
    expect(values(block.styles)).toEqual([
      'normal',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'blockquote',
    ])
    expect(values(block.marks.decorators)).toEqual([
      'strong',
      'em',
      'code',
      'underline',
      'strike-through',
    ])
    expect(values(block.lists)).toEqual(['bullet', 'number'])
    expect(block.marks.annotations).toHaveLength(1)
  })

  it('offers nothing for an empty list', () => {
    const block = blockDefinition(
      defineInternationalizedBlockContent({name: 'bare', styles: [], decorators: [], lists: []}),
    )
    expect(block.styles).toEqual([])
    expect(block.marks.decorators).toEqual([])
    expect(block.lists).toEqual([])
  })

  it('compiles into a valid Sanity schema', () => {
    const schema = compile([richText])
    expect(schema._validation?.flatMap((group) => group.problems)).toEqual([])
  })
})

describe('autoI18n.blockContent', () => {
  it('keeps its pre-2.1 configuration', () => {
    const block = blockDefinition(internationalizedBlockContentType)
    expect(internationalizedBlockContentType.name).toBe('autoI18n.blockContent')
    expect(block.styles).toEqual([
      {value: 'normal', title: 'Normal'},
      {value: 'h1', title: 'Heading 1'},
      {value: 'h2', title: 'Heading 2'},
      {value: 'h3', title: 'Heading 3'},
      {value: 'h4', title: 'Heading 4'},
      {value: 'blockquote', title: 'Quote'},
    ])
    expect(block.lists).toEqual([
      {value: 'bullet', title: 'Bullet'},
      {value: 'number', title: 'Numbered'},
    ])
    expect(block.marks.decorators).toEqual([
      {value: 'strong', title: 'Bold'},
      {value: 'em', title: 'Italic'},
      {value: 'underline', title: 'Underline'},
      {value: 'strike-through', title: 'Strike'},
    ])
    // The url type, with no validation of its own added on top.
    expect(block.marks.annotations[0].fields[0]).toMatchObject({name: 'href', type: 'url'})
    expect(
      (block.marks.annotations[0].fields[0] as {validation?: unknown}).validation,
    ).toBeUndefined()
  })
})

describe('a compiled document using the type', () => {
  const page = defineType({
    name: 'page',
    type: 'document',
    fields: [
      defineField({name: 'body', type: 'autoI18n.richText'}),
      defineField({
        name: 'seo',
        type: 'object',
        fields: [defineField({name: 'description', type: 'autoI18n.richText'})],
      }),
      defineField({
        name: 'sections',
        type: 'array',
        of: [
          {
            type: 'object',
            name: 'section',
            fields: [defineField({name: 'text', type: 'autoI18n.richText'})],
          },
        ],
      }),
    ],
  })
  const plain = defineType({
    name: 'plain',
    type: 'document',
    fields: [defineField({name: 'title', type: 'string'})],
  })
  const schema = compile([richText, page, plain])
  const pageType = schema.get('page') as SchemaTypeLike

  it('is detected by documentTypeHasI18nFields', () => {
    expect(documentTypeHasI18nFields(pageType)).toBe(true)
    expect(documentTypeHasI18nFields(schema.get('plain') as SchemaTypeLike)).toBe(false)
  })

  it('is detected when nested only inside an object or an array', () => {
    const fields = pageType.fields!
    const onlyNested = (name: string): SchemaTypeLike => ({
      name: 'doc',
      fields: fields.filter((field) => field.name === name),
    })
    expect(documentTypeHasI18nFields(onlyNested('seo'))).toBe(true)
    expect(documentTypeHasI18nFields(onlyNested('sections'))).toBe(true)
  })

  it('exposes the configuration on the field type the input receives', () => {
    const bodyType = pageType.fields!.find((field) => field.name === 'body')!.type
    expect(getBlockContentConfig(bodyType as {options?: unknown})).toBeDefined()
  })

  it('finds the configuration on an ancestor when a field overrides options', () => {
    const custom = defineType({
      name: 'doc',
      type: 'document',
      fields: [defineField({name: 'body', type: 'autoI18n.richText', options: {}})],
    })
    const bodyType = (compile([richText, custom]).get('doc') as SchemaTypeLike).fields![0].type
    expect(getBlockContentConfig(bodyType as {options?: unknown})).toBeDefined()
  })
})
