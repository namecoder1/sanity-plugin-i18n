import type {ComponentType} from 'react'
import {defineType, defineField, defineArrayMember} from 'sanity'

import {InternationalizedInput} from '../components/InternationalizedInput'

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
 * Rich-text variant: the per-language value is an array of Portable Text blocks
 * rather than a string. Supports paragraphs, headings (H1–H4), quotes, bulleted and
 * numbered lists, links, and the bold/italic/underline/strike-through decorators.
 *
 * Must stay in sync with the editor schema in `PortableTextTabEditor.tsx`. The
 * styles/lists/marks there use `name` where these use `value` — same list of values,
 * different syntax, because they are two schemas from two different packages.
 */
export const internationalizedBlockContentType = defineType({
  name: 'autoI18n.blockContent',
  title: 'Internationalized text (rich text)',
  type: 'array',
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
            {
              type: 'block',
              styles: [
                {title: 'Normal', value: 'normal'},
                {title: 'Heading 1', value: 'h1'},
                {title: 'Heading 2', value: 'h2'},
                {title: 'Heading 3', value: 'h3'},
                {title: 'Heading 4', value: 'h4'},
                {title: 'Quote', value: 'blockquote'},
              ],
              lists: [
                {title: 'Bullet', value: 'bullet'},
                {title: 'Numbered', value: 'number'},
              ],
              marks: {
                decorators: [
                  {title: 'Bold', value: 'strong'},
                  {title: 'Italic', value: 'em'},
                  {title: 'Underline', value: 'underline'},
                  {title: 'Strike', value: 'strike-through'},
                ],
                annotations: [
                  {
                    name: 'link',
                    type: 'object',
                    title: 'Link',
                    fields: [{name: 'href', type: 'url', title: 'URL'}],
                  },
                ],
              },
            },
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
