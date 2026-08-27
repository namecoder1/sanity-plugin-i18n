import sanityPluginKitOxlint from '@sanity/plugin-kit/oxlint'
import {defineConfig} from 'oxlint'

export default defineConfig({
  extends: [sanityPluginKitOxlint],
  // ignorePatterns non si propaga da `extends` (vedi doc del preset) — va
  // ripetuto esplicitamente insieme alle nostre aggiunte.
  ignorePatterns: [
    ...(sanityPluginKitOxlint.ignorePatterns ?? []),
    // Template da copiare in un altro repo (Studio), non fa parte del
    // pacchetto pubblicato: gira in Node su una Sanity Function, con le sue
    // dipendenze (@sanity/functions, @types/node) installate a parte, non
    // nel node_modules di questo package — lintarlo qui produce solo falsi
    // positivi su moduli/globali che semplicemente non sono installati qui.
    'azure-function-template/**',
  ],
  rules: {
    // Il dominio di questo plugin è "documenti Sanity poco tipizzati letti da
    // JSON" (campi custom, risposte di API di traduzione esterne): le
    // asserzioni di tipo sono strutturali al problema, non un errore da
    // evitare. La regola è preziosa in codice applicativo generico, qui è
    // quasi sempre un falso positivo.
    'typescript/no-unsafe-type-assertion': 'off',
    // Le chiamate alle API di traduzione DEVONO essere sequenziali: l'ordine
    // in cui vengono costruite le patch conta, e chiamarle in parallelo
    // martellerebbe inutilmente API esterne con rate limit stretti (MyMemory
    // in particolare).
    'no-await-in-loop': 'off',
    // `props.onComplete()` risulta "deprecated" per il type-checker in questo
    // setup (probabilmente per un disallineamento tra le versioni di `sanity`
    // nel devDependency del plugin e nello Studio di test), ma non è marcato
    // deprecato nei tipi effettivamente usati a runtime né ha un'alternativa
    // chiara per un'azione documento non-dialog. Da rivedere se in futuro
    // emerge un'alternativa ufficiale.
    'typescript/no-deprecated': 'off',
  },
})
