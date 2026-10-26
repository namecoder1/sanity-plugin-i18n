// @vitest-environment jsdom
import {ThemeProvider, studioTheme} from '@sanity/ui'
import {fireEvent, render, screen} from '@testing-library/react'
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
const {defineInternationalizedBlockContent, internationalizedBlockContentType} =
  await import('../schemaTypes/internationalizedField')

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

describe('InternationalizedInput with rich text', () => {
  const richText = defineInternationalizedBlockContent({
    name: 'richText',
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
    link: {title: 'Collegamento'},
  })

  const blocks = [
    {
      _type: 'block',
      _key: 'b1',
      style: 'normal',
      markDefs: [],
      children: [{_type: 'span', _key: 's1', marks: [], text: 'Ciao mondo'}],
    },
  ]

  function renderRichText(schemaType: unknown) {
    renderInput({schemaType, value: [{_key: 'en', _type: 'localeValue', value: blocks}]})
  }

  const buttonLabels = () =>
    screen
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'))
      .filter(Boolean)

  it('renders the rich-text editor for a type made with defineInternationalizedBlockContent', async () => {
    renderRichText({name: richText.name, options: richText.options})
    expect(await screen.findByText('Ciao mondo')).toBeTruthy()
    expect(screen.queryByDisplayValue('Ciao mondo')).toBeNull()
  })

  it('shows only the configured toolbar buttons, with the configured titles', async () => {
    renderRichText({name: richText.name, options: richText.options})
    await screen.findByText('Ciao mondo')
    expect(buttonLabels()).toEqual([
      'Paragrafo',
      'Titolo',
      'Sottotitolo',
      'Citazione',
      'Grassetto',
      'Corsivo',
      'Elenco puntato',
      'Elenco numerato',
      'Collegamento',
    ])
    // Short label on the button, the configured title in the tooltip.
    expect(screen.getByRole('button', {name: 'Sottotitolo'}).textContent).toBe('H3')
    expect(screen.queryByText('H1')).toBeNull()
  })

  it('rejects a link the configured validate refuses, before applying it', async () => {
    const validated = defineInternationalizedBlockContent({
      name: 'validated',
      link: {validate: (href) => (/^(\/|#|https?:\/\/)/.test(href) ? true : 'Bad link')},
    })
    renderRichText({name: validated.name, options: validated.options})
    await screen.findByText('Ciao mondo')
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const prompt = vi.spyOn(window, 'prompt')

    prompt.mockReturnValueOnce('ftp://x')
    fireEvent.mouseDown(screen.getByRole('button', {name: 'Link'}))
    expect(alert).toHaveBeenCalledWith('Bad link')

    alert.mockClear()
    prompt.mockReturnValueOnce('/contatti')
    fireEvent.mouseDown(screen.getByRole('button', {name: 'Link'}))
    expect(alert).not.toHaveBeenCalled()

    alert.mockRestore()
    prompt.mockRestore()
  })

  it('numbers list items by position, restarting after a paragraph', async () => {
    const block = (key: string, text: string, listItem?: string) => ({
      _type: 'block',
      _key: key,
      style: 'normal',
      markDefs: [],
      ...(listItem ? {listItem, level: 1} : {}),
      children: [{_type: 'span', _key: `${key}s`, marks: [], text}],
    })
    renderInput({
      schemaType: {name: richText.name, options: richText.options},
      value: [
        {
          _key: 'en',
          _type: 'localeValue',
          value: [
            block('a', 'Uno', 'number'),
            block('b', 'Due', 'number'),
            block('c', 'Tre', 'number'),
            block('p', 'Paragrafo'),
            block('d', 'Ancora uno', 'number'),
          ],
        },
      ],
    })
    await screen.findByText('Tre')
    const markers = [...document.querySelectorAll('[contenteditable="false"]')]
      .map((el) => el.textContent)
      .filter((text) => /^\d+\.$/.test(text ?? ''))
    expect(markers).toEqual(['1.', '2.', '3.', '1.'])
  })

  it('becomes editable when the form leaves read-only after mounting', async () => {
    // The Studio mounts the form read-only while the document loads, then flips it.
    // The editor only reads readOnly at mount, so without syncing it stayed locked
    // until a tab switch remounted it.
    const props = {
      value: [{_key: 'en', _type: 'localeValue', value: blocks}],
      onChange: vi.fn(),
      schemaType: {name: richText.name, options: richText.options},
      elementProps: {id: 'field-body'},
      validation: [],
      presence: [],
    }
    const view = (readOnly: boolean) => (
      <ThemeProvider theme={studioTheme}>
        {(<InternationalizedInput {...(props as any)} readOnly={readOnly} />) as ReactElement}
      </ThemeProvider>
    )
    const {rerender} = render(view(true))
    await screen.findByText('Ciao mondo')
    const editable = () => document.querySelector('[data-pt-editor]')
    expect(editable()?.getAttribute('contenteditable')).toBe('false')

    rerender(view(false))
    await vi.waitFor(() => expect(editable()?.getAttribute('contenteditable')).toBe('true'))
  })

  it('has no link button with link: false', async () => {
    const noLink = defineInternationalizedBlockContent({name: 'noLink', link: false})
    renderRichText({name: noLink.name, options: noLink.options})
    await screen.findByText('Ciao mondo')
    expect(screen.queryByRole('button', {name: 'Link'})).toBeNull()
  })

  it.each([
    ['with its options', {name: 'autoI18n.blockContent', options: undefined as unknown}],
    ['by name alone', {name: 'autoI18n.blockContent'}],
  ])('still shows every autoI18n.blockContent button (%s)', async (_label, schemaType) => {
    if ('options' in schemaType) schemaType.options = internationalizedBlockContentType.options
    renderRichText(schemaType)
    await screen.findByText('Ciao mondo')
    expect(buttonLabels()).toEqual([
      'Normal',
      'Heading 1',
      'Heading 2',
      'Heading 3',
      'Heading 4',
      'Quote',
      'Bold',
      'Italic',
      'Underline',
      'Strike',
      'Bullet',
      'Numbered',
      'Link',
    ])
  })
})
