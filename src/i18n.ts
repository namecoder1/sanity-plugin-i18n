import {defineLocaleResourceBundle} from 'sanity'

import {I18N_NAMESPACE} from './lib/shared'

// Defined in lib/shared.ts (see the note there), re-exported as part of the public API.
export {I18N_NAMESPACE}

// Loaded lazily: the Studio only fetches the bundle of the locale actually in use,
// the first time a component asks for the namespace.
const enUSBundle = defineLocaleResourceBundle({
  locale: 'en-US',
  namespace: I18N_NAMESPACE,
  resources: () => import('./locales/en-US'),
})

const itITBundle = defineLocaleResourceBundle({
  locale: 'it-IT',
  namespace: I18N_NAMESPACE,
  resources: () => import('./locales/it-IT'),
})

/** @internal Registered by the plugin under `i18n.bundles`. */
export const pluginLocaleBundles = [enUSBundle, itITBundle]
