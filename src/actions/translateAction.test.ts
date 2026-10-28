// @vitest-environment jsdom
import {renderHook} from '@testing-library/react'
import type {DocumentActionProps} from 'sanity'
import {afterEach, describe, expect, it, vi} from 'vitest'

// The action is a hook: it reads a client, the document operations and the toast
// context from the Studio. Stubbing them keeps the test about its label.
// `useTranslation` comes from the plugin's own bundles — see the mock for why.
vi.mock('sanity', async () => {
  const actual = await vi.importActual<typeof import('sanity')>('sanity')
  const {useTestTranslation} = await import('../__mocks__/translation')
  return {
    ...actual,
    useTranslation: useTestTranslation,
    useClient: () => ({}),
    useDocumentOperation: () => ({patch: {execute: vi.fn()}}),
  }
})
vi.mock('@sanity/ui/toast', () => ({useToast: () => ({push: vi.fn()})}))

const {createTranslateAction} = await import('./translateAction')
const {setTestLocale} = await import('../__mocks__/translation')

function renderLabel(): string | undefined {
  const TranslateAction = createTranslateAction({})
  const props = {
    id: 'doc',
    type: 'page',
    draft: {_id: 'drafts.doc', _type: 'page'},
    published: null,
    onComplete: vi.fn(),
  } as unknown as DocumentActionProps
  const {result} = renderHook(() => TranslateAction(props))
  return result.current?.label
}

afterEach(() => setTestLocale('en-US'))

describe('translateAction', () => {
  it('is labelled "Translate missing" with en-US', () => {
    expect(renderLabel()).toBe('Translate missing')
  })

  it('is labelled "Traduci mancanti" with it-IT', () => {
    setTestLocale('it-IT')
    expect(renderLabel()).toBe('Traduci mancanti')
  })
})
