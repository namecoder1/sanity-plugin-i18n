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
 * Lista di stringhe internazionalizzate indipendentemente l'una dall'altra
 * (es. tag), dove OGNI ELEMENTO ha i propri valori per lingua — non un solo
 * `autoI18n.string` (che aggiungerebbe tab lingua all'intera lista, non ai
 * singoli elementi).
 *
 * Non è un `array` il cui `of` contiene direttamente `autoI18n.string`: Sanity
 * non supporta un array come membro diretto di un altro array. Ogni elemento
 * è invece un piccolo oggetto (`internationalizedListItem`) con un unico
 * campo `value` di tipo `autoI18n.string` — l'array-dentro-array diventa così
 * array → oggetto → array, che è una struttura dati normale.
 *
 * Valore salvato:
 * [
 *   {_key: 'k1', value: [{_key: 'it', value: 'prova'}, {_key: 'en', value: 'test'}]},
 *   {_key: 'k2', value: [{_key: 'it', value: 'formattazione'}, ...]},
 * ]
 *
 * `translationCore.ts` cerca questi campi annidati con un livello di
 * ricorsione dedicato (vedi `findInternationalizedFieldPaths`), costruendo
 * path Sanity tipo `tags[_key=="k1"].value`.
 */
export const internationalizedStringListType = defineType({
  name: 'autoI18n.stringList',
  title: 'Elenco di stringhe internazionalizzate',
  type: 'array',
  of: [
    defineArrayMember({
      type: 'object',
      name: 'internationalizedListItem',
      fields: [
        defineField({
          name: 'value',
          title: 'Valore',
          type: 'autoI18n.string',
        }),
      ],
      preview: {
        select: {value: 'value'},
        prepare({value}) {
          const values = Array.isArray(value) ? value : []
          const it = values.find((v: {_key?: string}) => v._key === 'it')?.value as
            | string
            | undefined
          return {title: it || values[0]?.value || '(vuoto)'}
        },
      },
    }),
  ],
})

/**
 * Variante rich-text: il valore per lingua è un array di blocchi Portable Text
 * invece di una stringa. Supporta paragrafi, titoli (H1-H4), citazioni, liste
 * puntate/numerate, link, e i decorator grassetto/corsivo/sottolineato/barrato.
 * Questa definizione deve restare in sincronia con lo schema dell'editor in
 * `PortableTextTabEditor.tsx` (styles/lists/marks lì usano `name`, qui
 * `value` — stessa lista di valori, sintassi diversa perché sono due schema
 * provenienti da pacchetti diversi).
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
          of: [
            {
              type: 'block',
              styles: [
                {title: 'Normale', value: 'normal'},
                {title: 'Titolo 1', value: 'h1'},
                {title: 'Titolo 2', value: 'h2'},
                {title: 'Titolo 3', value: 'h3'},
                {title: 'Titolo 4', value: 'h4'},
                {title: 'Citazione', value: 'blockquote'},
              ],
              lists: [
                {title: 'Puntata', value: 'bullet'},
                {title: 'Numerata', value: 'number'},
              ],
              marks: {
                decorators: [
                  {title: 'Grassetto', value: 'strong'},
                  {title: 'Corsivo', value: 'em'},
                  {title: 'Sottolineato', value: 'underline'},
                  {title: 'Barrato', value: 'strike-through'},
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
