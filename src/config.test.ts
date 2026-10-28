import {describe, expect, it} from 'vitest'

import {createLanguageSettingsType, resolveLabels} from './config'

type Validator = (value: unknown) => unknown

// Pulls the custom validator out of the `supportedLanguages` rule by running the
// rule builder against a minimal stand-in that records the `.custom()` callback.
function supportedLanguagesValidator(type: ReturnType<typeof createLanguageSettingsType>) {
  const field = type.fields.find((f) => f.name === 'supportedLanguages') as unknown as {
    validation: (rule: unknown) => unknown
  }
  let custom: Validator | undefined
  const rule: Record<string, unknown> = {}
  rule.required = () => rule
  rule.min = () => rule
  rule.custom = (fn: Validator) => {
    custom = fn
    return rule
  }
  field.validation(rule)
  return custom!
}

describe('Language Settings labels', () => {
  it('keeps the English texts by default', () => {
    const type = createLanguageSettingsType()
    expect(type.title).toBe('Language Settings')
    expect(supportedLanguagesValidator(type)([{code: 'en'}, {code: 'en'}])).toBe(
      'Duplicate language code: en. Each language must appear once.',
    )
  })

  it('uses the overrides, filling in their placeholders', () => {
    const labels = resolveLabels({
      languageSettingsTitle: 'Lingue',
      duplicateCodeError: 'Codice ripetuto: {{codes}}.',
    })
    const type = createLanguageSettingsType(labels)
    expect(type.title).toBe('Lingue')
    expect(supportedLanguagesValidator(type)([{code: 'it'}, {code: 'it'}])).toBe(
      'Codice ripetuto: it.',
    )
    // Not overridden: still the English default.
    expect(labels.languageLabelTitle).toBe('Display label')
  })

  it('builds the preview subtitle from the labels', () => {
    const type = createLanguageSettingsType(
      resolveLabels({languageCountOther: '{{count}} lingue', sourceMarker: '(origine)'}),
    )
    const preview = type.preview as {prepare: (value: unknown) => {subtitle?: string}}
    expect(
      preview.prepare({languages: [{code: 'it', isDefault: true}, {code: 'en'}]}).subtitle,
    ).toBe('2 lingue: IT (origine) · EN')
  })
})
