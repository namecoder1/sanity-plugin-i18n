import type {ComponentType} from 'react'
import {defineType, defineField, defineArrayMember} from 'sanity'

import {InternationalizedInput} from '../components/InternationalizedInput'
import {
  BLOCK_CONTENT_OPTIONS_KEY,
  BLOCK_CONTENT_TYPE_CONFIG,
  resolveBlockContentConfig,
  type BlockContentConfigInput,
  type ResolvedBlockContentConfig,
} from '../lib/blockContentConfig'

/** Prefix of every type the plugin defines — see `lib/schemaHasI18nFields.ts`. */
const TYPE_PREFIX = 'autoI18n.'

/**
 * Builds an "internationalized" custom type on top of a base type (string, text).
 * The stored value is an array shaped like:
 * [{_key: 'it', value: 'Ciao'}, {_key: 'en', value: 'Hello'}]
 *
 * Used from another schema as:
 * defineField({name: 'title', type: 'autoI18n.string'})
 */
export function createInternationalizedFieldType(baseType: 'string' | 'text') {
  return defineType({
    name: `autoI18n.${baseType}`,
    title: `Internationalized text (${baseType})`,
    type: 'array',
    of: [
      defineArrayMember({
        type: 'object',
        name: 'localeValue',
        fields: [
          defineField({
            name: 'value',
            title: 'Value',
            type: baseType,
          }),
          defineField({
            name: 'sourceHash',
            type: 'string',
            hidden: true,
          }),
        ],
        preview: {
          select: {value: 'value', key: '_key'},
          prepare({value, key}) {
            return {
              title: value || '(empty)',
              subtitle: key?.toUpperCase(),
            }
          },
        },
      }),
    ],
    // Replaces the default rendering (a list with an "Add item" button) with the
    // tabbed component, which manages _keys and languages on its own.
    //
    // The cast is necessary: `defineType({type: 'array'})` does not statically narrow
    // to "array of objects", so TypeScript produces a union including
    // ArrayOfPrimitivesInputProps, which our component — typed for LocaleValue
    // objects only — does not satisfy. At runtime there is no ambiguity: this field
    // is always an array of objects, so the cast is safe.
    components: {
      input: InternationalizedInput as unknown as ComponentType<any>,
    },
  })
}

export const internationalizedStringType = createInternationalizedFieldType('string')
export const internationalizedTextType = createInternationalizedFieldType('text')

/**
 * A list of strings that are each translated independently — tags, for instance —
 * where EVERY ITEM carries its own per-language values. Not a single
 * `autoI18n.string`, which would put language tabs on the list as a whole rather
 * than on its items.
 *
 * It is deliberately not an `array` whose `of` holds `autoI18n.string` directly:
 * Sanity does not support an array as a direct member of another array. Each item is
 * instead a small object (`internationalizedListItem`) with a single `value` field of
 * type `autoI18n.string`, turning array-inside-array into array → object → array,
 * which is an ordinary data structure.
 *
 * Stored value:
 * [
 *   {_key: 'k1', value: [{_key: 'it', value: 'prova'}, {_key: 'en', value: 'test'}]},
 *   {_key: 'k2', value: [{_key: 'it', value: 'formattazione'}, ...]},
 * ]
 *
 * `findInternationalizedFieldPaths` in translationCore.ts walks into these nested
 * fields and builds Sanity paths such as `tags[_key=="k1"].value`.
 */
export const internationalizedStringListType = defineType({
  name: 'autoI18n.stringList',
  title: 'Internationalized string list',
  type: 'array',
  of: [
    defineArrayMember({
      type: 'object',
      name: 'internationalizedListItem',
      fields: [
        defineField({
          name: 'value',
          title: 'Value',
          type: 'autoI18n.string',
        }),
      ],
      preview: {
        select: {value: 'value'},
        prepare({value}) {
          // Shows the first language that has content. A preview has no access to
          // the plugin configuration, so it cannot know which language is the source:
          // hard-coding one — 'it' used to be hard-coded here, a leftover from the
          // project's origins — is an arbitrary choice for everyone else.
          const values = Array.isArray(value) ? (value as {_key?: string; value?: string}[]) : []
          const first = values.find((entry) => Boolean(entry?.value))
          return {title: first?.value || '(empty)'}
        },
      },
    }),
  ],
})

/**
 * Options for {@link defineInternationalizedBlockContent}.
 *
 * @public
 */
export interface InternationalizedBlockContentOptions extends BlockContentConfigInput {
  /**
   * Type name. The registered type is always `autoI18n.<name>`: the plugin recognises
   * its fields by that prefix (the "Translate missing" action and banner only appear
   * on document types that have one). A name that already carries it is used as is.
   */
  name: string
  /** Title shown for the type. Default: "Internationalized text (rich text)". */
  title?: string
}

/**
 * Defines an internationalized rich-text type with a chosen subset of the editor's
 * features. Same stored shape as `autoI18n.blockContent` — an array of `localeValue`
 * items whose `value` is an array of `block`s — so translation works unchanged.
 *
 * Omitting `styles`, `decorators` or `lists` offers everything Sanity's own `block`
 * type offers by default (styles normal, h1–h6, blockquote; decorators strong, em,
 * code, underline, strike-through; bullet and numbered lists); an empty array offers
 * none. `link: false` removes links. Unknown values throw at definition time.
 *
 * Register the returned type in your schema (it is not part of the plugin's own
 * types), then use it by its full name:
 *
 * ```ts
 * import {defineInternationalizedBlockContent} from 'sanity-plugin-i18n'
 *
 * export const i18nRichText = defineInternationalizedBlockContent({
 *   name: 'richText', // registered as `autoI18n.richText`
 *   styles: [{value: 'normal'}, {value: 'h2'}, {value: 'h3'}, {value: 'blockquote'}],
 *   decorators: [{value: 'strong'}, {value: 'em'}],
 *   link: {
 *     validate: (href) =>
 *       /^(\/|#|https?:\/\/|mailto:|tel:)/.test(href) || 'Must start with /, #, https://, mailto: or tel:',
 *   },
 * })
 *
 * // schema: {types: [i18nRichText, ...]}
 * // field:  defineField({name: 'body', type: 'autoI18n.richText'})
 * ```
 *
 * @public
 */
export function defineInternationalizedBlockContent(options: InternationalizedBlockContentOptions) {
  const {name, title, ...configInput} = options
  const config = resolveBlockContentConfig(configInput)
  const typeName = name.startsWith(TYPE_PREFIX) ? name : `${TYPE_PREFIX}${name}`

  const annotations = config.link ? [createLinkAnnotation(config.link)] : []

  return defineType({
    name: typeName,
    title: title || 'Internationalized text (rich text)',
    type: 'array',
    // Read back by InternationalizedInput to build the editor from the same
    // configuration as the schema below: one source of truth for both.
    options: {[BLOCK_CONTENT_OPTIONS_KEY]: config} as Record<string, unknown>,
    of: [
      defineArrayMember({
        type: 'object',
        name: 'localeValue',
        fields: [
          defineField({
            name: 'value',
            title: 'Value',
            type: 'array',
            of: [
              defineArrayMember({
                type: 'block',
                styles: config.styles,
                lists: config.lists,
                marks: {decorators: config.decorators, annotations},
              }),
            ],
          }),
          defineField({
            name: 'sourceHash',
            type: 'string',
            hidden: true,
          }),
        ],
        preview: {
          select: {value: 'value', key: '_key'},
          prepare({value, key}) {
            const blocks = Array.isArray(value) ? value : []
            const text = blocks
              .map((block: {children?: {text?: string}[]}) =>
                (block?.children || []).map((child) => child?.text || '').join(''),
              )
              .join(' ')
              .trim()
            return {
              title: text || '(empty)',
              subtitle: key?.toUpperCase(),
            }
          },
        },
      }),
    ],
    components: {
      input: InternationalizedInput as unknown as ComponentType<any>,
    },
  })
}

function createLinkAnnotation(link: Exclude<ResolvedBlockContentConfig['link'], false>) {
  const {validate} = link
  const checkHref = (href: string | undefined) => (href && validate ? validate(href) : true)

  return defineArrayMember({
    name: 'link',
    type: 'object',
    title: link.title,
    fields: [
      link.type === 'url'
        ? defineField({
            name: 'href',
            title: 'URL',
            type: 'url',
            // Without `validate`, a `url` link keeps exactly the validation it has
            // always had (the url type's own), so data saved in `autoI18n.blockContent`
            // before 2.1 does not start failing.
            validation: validate ? (rule) => rule.required().custom(checkHref) : undefined,
          })
        : defineField({
            name: 'href',
            title: 'URL',
            type: 'string',
            validation: (rule) => rule.required().custom(checkHref),
          }),
    ],
  })
}

/**
 * Rich-text variant: the per-language value is an array of Portable Text blocks
 * rather than a string. Supports paragraphs, headings (H1–H4), quotes, bulleted and
 * numbered lists, links, and the bold/italic/underline/strike-through decorators.
 *
 * Defined through `defineInternationalizedBlockContent` like any custom rich-text
 * type, with the configuration it has always had — including the `url` link, so data
 * saved before 2.1 keeps validating the same way.
 */
export const internationalizedBlockContentType = defineInternationalizedBlockContent({
  name: 'blockContent',
  ...BLOCK_CONTENT_TYPE_CONFIG,
})
