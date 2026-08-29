import {describe, expect, it} from 'vitest'

import {documentTypeHasI18nFields, type SchemaTypeLike} from './schemaHasI18nFields'

/** An intrinsic type, as Sanity's compiled schema exposes it. */
const stringType: SchemaTypeLike = {name: 'string'}

/**
 * The plugin's types are arrays whose `name` carries the `autoI18n.` prefix; walking
 * up `type` reaches the intrinsic `array` type.
 */
const i18nString: SchemaTypeLike = {name: 'autoI18n.string', type: {name: 'array'}}

describe('documentTypeHasI18nFields', () => {
  it('is false for a document with no i18n field', () => {
    const post: SchemaTypeLike = {
      name: 'post',
      type: {name: 'document'},
      fields: [
        {name: 'title', type: stringType},
        {name: 'slug', type: {name: 'slug'}},
      ],
    }
    expect(documentTypeHasI18nFields(post)).toBe(false)
  })

  it('is true for a top-level i18n field', () => {
    const post: SchemaTypeLike = {
      name: 'post',
      fields: [
        {name: 'title', type: i18nString},
        {name: 'slug', type: {name: 'slug'}},
      ],
    }
    expect(documentTypeHasI18nFields(post)).toBe(true)
  })

  it('is true for an i18n field nested inside an object field', () => {
    const post: SchemaTypeLike = {
      name: 'post',
      fields: [
        {
          name: 'seo',
          type: {name: 'seo', type: {name: 'object'}, fields: [{name: 'title', type: i18nString}]},
        },
      ],
    }
    expect(documentTypeHasI18nFields(post)).toBe(true)
  })

  it('is true for an i18n field inside an array member', () => {
    const page: SchemaTypeLike = {
      name: 'page',
      fields: [
        {
          name: 'sections',
          type: {
            name: 'array',
            of: [{name: 'section', fields: [{name: 'heading', type: i18nString}]}],
          },
        },
      ],
    }
    expect(documentTypeHasI18nFields(page)).toBe(true)
  })

  it('is true when a field inherits from an i18n type through the type chain', () => {
    const custom: SchemaTypeLike = {name: 'myTitle', type: i18nString}
    const post: SchemaTypeLike = {name: 'post', fields: [{name: 'title', type: custom}]}
    expect(documentTypeHasI18nFields(post)).toBe(true)
  })

  it('is false for undefined (unknown schema type)', () => {
    expect(documentTypeHasI18nFields(undefined)).toBe(false)
    expect(documentTypeHasI18nFields(null)).toBe(false)
  })

  it('terminates on a self-referencing schema instead of hanging', () => {
    const node: SchemaTypeLike = {name: 'node', fields: []}
    node.fields = [{name: 'child', type: node}]
    expect(documentTypeHasI18nFields(node)).toBe(false)
  })

  it('finds an i18n field beyond a self-reference', () => {
    const node: SchemaTypeLike = {name: 'node', fields: []}
    node.fields = [
      {name: 'child', type: node},
      {name: 'label', type: i18nString},
    ]
    expect(documentTypeHasI18nFields(node)).toBe(true)
  })
})
