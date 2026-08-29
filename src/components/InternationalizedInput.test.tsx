// @vitest-environment jsdom
import {ThemeProvider, studioTheme} from '@sanity/ui'
import {render, screen} from '@testing-library/react'
import type {ReactElement} from 'react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const languages = [
  {code: 'en', label: 'English', isDefault: true},
  {code: 'de', label: 'Deutsch'},
]

// `useLanguageSettings` opens a GROQ query and a listener against a live client.
// Stubbing it keeps these tests about the component's own behaviour.
vi.mock('../lib/useLanguageSettings', () => ({
  useLanguageSettings: () => ({status: 'ready', languages}),
}))

// Both are `@internal` presentational components from `sanity`; importing the real
// ones would drag the whole Studio runtime into a unit test.
vi.mock('sanity', async () => {
  const actual = await vi.importActual<typeof import('sanity')>('sanity')
  return {
    ...actual,
    FieldPresence: ({presence}: {presence: unknown[]}) => (
      <div data-testid="presence">{presence.length}</div>
    ),
    FormFieldValidationStatus: ({validation}: {validation: unknown[]}) => (
      <div data-testid="validation">{validation.length}</div>
    ),
  }
})

const {InternationalizedInput} = await import('./InternationalizedInput')

function renderInput(overrides: Record<string, unknown> = {}): {
  onChange: ReturnType<typeof vi.fn>
} {
  const onChange = vi.fn()
  const props = {
    value: [{_key: 'en', _type: 'localeValue', value: 'Hello'}],
    onChange,
    schemaType: {name: 'autoI18n.string'},
    elementProps: {id: 'field-title'},
    validation: [],
    presence: [],
    ...overrides,
  }
  render(
    <ThemeProvider theme={studioTheme}>
      {(<InternationalizedInput {...(props as any)} />) as ReactElement}
    </ThemeProvider>,
  )
  return {onChange}
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => document.body.replaceChildren())

describe('InternationalizedInput', () => {
  it('renders one tab per configured language, marking the source one', () => {
    renderInput()
    expect(screen.getByText(/English \(source\)/)).toBeTruthy()
    expect(screen.getByText(/Deutsch/)).toBeTruthy()
  })

  it('marks a language with no content with a dot', () => {
    renderInput()
    // English has a value, German does not.
    expect(screen.getByText('English (source)')).toBeTruthy()
    expect(screen.getByText('Deutsch ·')).toBeTruthy()
  })

  it('shows the source language value in the input', () => {
    renderInput()
    expect(screen.getByDisplayValue('Hello')).toBeTruthy()
  })

  it('makes the input read-only when the form says so', () => {
    renderInput({readOnly: true})
    // Asserted through the attribute rather than the `readOnly` property so the test
    // needs no cast away from HTMLElement.
    expect(screen.getByDisplayValue('Hello').hasAttribute('readonly')).toBe(true)
  })

  it('is editable when readOnly is not set', () => {
    renderInput()
    expect(screen.getByDisplayValue('Hello').hasAttribute('readonly')).toBe(false)
  })

  it('routes a validation marker to the language it belongs to', () => {
    renderInput({
      validation: [{path: [{_key: 'en'}, 'value'], level: 'error', message: 'Required'}],
    })
    expect(screen.getByTestId('validation').textContent).toBe('1')
    // The tab carries the warning marker rather than the "empty" dot.
    expect(screen.getByText(/English \(source\) ⚠/)).toBeTruthy()
  })

  it('does not show another language validation marker on the active tab', () => {
    renderInput({
      validation: [{path: [{_key: 'de'}, 'value'], level: 'error', message: 'Required'}],
    })
    // The active tab is English, so nothing is rendered for the German error.
    expect(screen.queryByTestId('validation')).toBeNull()
    expect(screen.getByText(/Deutsch.*⚠/)).toBeTruthy()
  })

  it('shows presence avatars for the active language only', () => {
    renderInput({
      presence: [
        {path: [{_key: 'en'}, 'value'], user: {id: 'u1'}, sessionId: 's', lastActiveAt: ''},
        {path: [{_key: 'de'}, 'value'], user: {id: 'u2'}, sessionId: 's', lastActiveAt: ''},
      ],
    })
    expect(screen.getByTestId('presence').textContent).toBe('1')
  })

  it('reports "no language configured" instead of an empty tab bar', async () => {
    vi.resetModules()
    vi.doMock('../lib/useLanguageSettings', () => ({
      useLanguageSettings: () => ({status: 'ready', languages: []}),
    }))
    const {InternationalizedInput: Empty} = await import('./InternationalizedInput')
    render(
      <ThemeProvider theme={studioTheme}>
        {
          (
            <Empty
              {...({
                value: [],
                onChange: vi.fn(),
                schemaType: {name: 'autoI18n.string'},
                elementProps: {id: 'x'},
                validation: [],
                presence: [],
              } as any)}
            />
          ) as ReactElement
        }
      </ThemeProvider>,
    )
    expect(screen.getByText(/No language configured/)).toBeTruthy()
  })
})
