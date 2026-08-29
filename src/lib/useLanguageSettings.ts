import {useCallback, useSyncExternalStore} from 'react'
import {useClient} from 'sanity'
import type {SanityClient} from 'sanity'

import {LANGUAGE_SETTINGS_DOC_ID} from './shared'
import type {LanguageEntry} from './shared'

const API_VERSION = '2023-01-01'
const QUERY = `*[_id == $id][0]{supportedLanguages}`

export interface LanguageSettingsState {
  status: 'loading' | 'ready' | 'error'
  languages: LanguageEntry[]
}

const LOADING: LanguageSettingsState = {status: 'loading', languages: []}

interface Store {
  state: LanguageSettingsState
  listeners: Set<() => void>
  teardown: () => void
}

/**
 * One store per project/dataset pair, shared by every plugin component mounted in
 * the Studio.
 *
 * Each instance used to run its own fetch: the banner on every document change —
 * so on every keystroke — and each i18n field on mount. A document with six
 * internationalized fields opened seven identical queries for the same handful of
 * configuration rows.
 *
 * Here the query runs once and the result is shared. A listener on the document
 * keeps the state live, so adding a language shows up in the tabs immediately
 * instead of after a Studio reload — which a plain static cache could not do.
 */
const stores = new Map<string, Store>()

function storeKey(client: SanityClient): string {
  const {projectId, dataset} = client.config()
  return `${projectId ?? ''}:${dataset ?? ''}`
}

function emit(store: Store): void {
  for (const listener of store.listeners) listener()
}

function createStore(client: SanityClient, key: string): Store {
  const store: Store = {state: LOADING, listeners: new Set(), teardown: () => undefined}
  let disposed = false

  const load = (): void => {
    client
      .fetch<{supportedLanguages?: LanguageEntry[]} | null>(QUERY, {id: LANGUAGE_SETTINGS_DOC_ID})
      .then((res) => {
        if (disposed) return undefined
        store.state = {status: 'ready', languages: res?.supportedLanguages ?? []}
        emit(store)
        return undefined
      })
      .catch((err) => {
        if (disposed) return undefined
        console.error('[auto-i18n] Could not load language settings:', err)
        store.state = {status: 'error', languages: []}
        emit(store)
        return undefined
      })
  }

  load()

  // A listener error must not break anything: only live updates are lost, and the
  // value already loaded stays valid.
  const subscription = client
    .listen(`*[_id == $id]`, {id: LANGUAGE_SETTINGS_DOC_ID}, {visibility: 'query'})
    .subscribe({
      next: () => load(),
      error: (err: unknown) => {
        console.warn('[auto-i18n] Live updates for language settings unavailable:', err)
      },
    })

  store.teardown = () => {
    disposed = true
    subscription.unsubscribe()
    stores.delete(key)
  }

  stores.set(key, store)
  return store
}

/**
 * Reads the languages configured in the "Language Settings" singleton, sharing a
 * single query (and a single listener) across every component that needs them.
 */
export function useLanguageSettings(): LanguageSettingsState {
  const client = useClient({apiVersion: API_VERSION})
  const key = storeKey(client)

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const store = stores.get(key) ?? createStore(client, key)
      store.listeners.add(onStoreChange)

      return () => {
        const current = stores.get(key)
        if (!current) return
        current.listeners.delete(onStoreChange)
        // Last consumer unmounted: close the listener instead of leaving it open
        // for the rest of the Studio session.
        if (current.listeners.size === 0) current.teardown()
      }
    },
    [client, key],
  )

  const getSnapshot = useCallback(() => stores.get(key)?.state ?? LOADING, [key])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
