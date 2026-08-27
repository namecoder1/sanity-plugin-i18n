import type {ComponentType} from 'react'
import {defineType, defineField, defineArrayMember} from 'sanity'
import {InternationalizedInput} from '../components/InternationalizedInput'

/**
 * Crea un custom type "internazionalizzato" per un tipo base (string, text, ecc).
 * Il valore salvato è un array del tipo:
 * [{ _key: "it", value: "Ciao" }, { _key: "en", value: "Hello" }]
 *
 * Uso in un altro schema:
 * defineField({ name: 'title', type: 'autoI18n.string' })
 */
export function createInternationalizedFieldType(baseType: 'string' | 'text') {
  return defineType({
    name: `autoI18n.${baseType}`,
    title: `Testo internazionalizzato (${baseType})`,
    type: 'array',
    of: [
      defineArrayMember({
        type: 'object',
        name: 'localeValue',
        fields: [
          defineField({
            name: 'value',
            title: 'Valore',
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
              title: value || '(vuoto)',
              subtitle: key?.toUpperCase(),
            }
          },
        },
      }),
    ],
    // Sostituisce la resa di default (lista con "Aggiungi elemento") con
    // il componente a tab, che gestisce _key/lingue in autonomia.
    //
    // Cast necessario: `defineType({type: 'array'})` non narrowa staticamente
    // il tipo a "array di oggetti", quindi TypeScript genera un'unione con
    // ArrayOfPrimitivesInputProps che il nostro componente (tipizzato solo per
    // oggetti LocaleValue) non soddisfa. A runtime non c'è ambiguità: questo
    // campo sarà sempre un array di oggetti, quindi il cast è sicuro.
    components: {
      input: InternationalizedInput as unknown as ComponentType<any>,
    },
  })
}

export const internationalizedStringType = createInternationalizedFieldType('string')
export const internationalizedTextType = createInternationalizedFieldType('text')

/**
 * Variante rich-text: il valore per lingua è un array di blocchi Portable Text
 * invece di una stringa. Supporta solo blocchi di testo con decorator
 * `strong`/`em` per l'MVP (niente liste, link, o oggetti custom) — vedi
 * InternationalizedBlockContentInput per il perché di questo limite.
 */
export const internationalizedBlockContentType = defineType({
  name: 'autoI18n.blockContent',
  title: 'Testo internazionalizzato (rich text)',
  type: 'array',
  of: [
    defineArrayMember({
      type: 'object',
      name: 'localeValue',
      fields: [
        defineField({
          name: 'value',
          title: 'Valore',
          type: 'array',
          of: [{type: 'block'}],
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
            title: text || '(vuoto)',
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