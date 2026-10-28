import {createInstance} from 'i18next'

import {I18N_NAMESPACE} from '../lib/shared'
import enUS from '../locales/en-US'
import itIT from '../locales/it-IT'

/**
 * Stand-in for `sanity`'s `useTranslation` in unit tests.
 *
 * The real hook reads the i18next instance the Studio's LocaleProvider sets up; that
 * provider is internal and needs a whole workspace (project, source, locale store),
 * and without it the hook falls back to an instance that only knows Sanity's own
 * strings — so every plugin key would render as the key itself. Instead, this is a
 * real i18next instance loaded with the plugin's two bundles, configured like the
 * Studio's (en-US fallback, no HTML escaping), so plurals and interpolation behave
 * as they do in the Studio.
 *
 * Mock it in with:
 *
 * ```ts
 * vi.mock('sanity', async () => ({
 *   ...(await vi.importActual<typeof import('sanity')>('sanity')),
 *   useTranslation: (await import('../__mocks__/translation')).useTestTranslation,
 * }))
 * ```
 */
const i18n = createInstance()
void i18n.init({
  initAsync: false,
  lng: 'en-US',
  fallbackLng: 'en-US',
  ns: [I18N_NAMESPACE],
  defaultNS: I18N_NAMESPACE,
  interpolation: {escapeValue: false},
  resources: {
    'en-US': {[I18N_NAMESPACE]: enUS},
    'it-IT': {[I18N_NAMESPACE]: itIT},
  },
})

let currentLocale = 'en-US'

/** Switches the locale the next renders use, as picking a language in the Studio does. */
export function setTestLocale(locale: 'en-US' | 'it-IT'): void {
  currentLocale = locale
}

export function useTestTranslation(ns: string = I18N_NAMESPACE) {
  return {t: i18n.getFixedT(currentLocale, ns)}
}
