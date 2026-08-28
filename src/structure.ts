import {EarthGlobeIcon} from '@sanity/icons/EarthGlobe'
import type {StructureBuilder} from 'sanity/structure'

import {LANGUAGE_SETTINGS_DOC_ID} from './config'

/**
 * Voce di sidebar pronta per il singleton "Language Settings": salta
 * direttamente al documento con ID fisso, invece della lista generica per
 * tipo (che richiede un documento già esistente e non distingue un
 * singleton da un tipo qualsiasi). Stesso pattern di `S.document()` usato
 * "a mano" nei progetti che configurano un `structure()` custom — vedi
 * `excludeLanguageSettingsType` per toglierlo dalla lista generica sotto.
 *
 * ```ts
 * import {structureTool} from 'sanity/structure'
 * import {languageSettingsListItem, excludeLanguageSettingsType} from 'sanity-plugin-i18n'
 *
 * const structure = (S) =>
 *   S.list()
 *     .title('Content')
 *     .items([
 *       languageSettingsListItem(S),
 *       ...excludeLanguageSettingsType(S.documentTypeListItems()),
 *     ])
 *
 * export default defineConfig({
 *   // ...
 *   plugins: [structureTool({structure}), autoI18nPlugin({...})],
 * })
 * ```
 */
export function languageSettingsListItem(S: StructureBuilder) {
  return (
    S.listItem()
      .id(LANGUAGE_SETTINGS_DOC_ID)
      .title('Language Settings')
      .icon(EarthGlobeIcon)
      // Necessario anche qui (non solo dentro .child() sotto): quando Sanity
      // risolve il pannello dall'URL invece che dall'albero appena costruito,
      // recupera il tipo da QUESTO schemaType — senza, prova a dedurlo
      // interrogando il dataset per quell'ID, cosa che fallisce con
      // "Failed to resolve document, and no type provided in parameters" se
      // il documento non esiste ancora (nessun documento da cui leggere _type).
      .schemaType(LANGUAGE_SETTINGS_DOC_ID)
      // Il child DEVE essere una funzione, non un DocumentBuilder statico: la
      // navigazione via intent (`router.navigateIntent`, usata dal Tool in
      // index.ts) ridrilla nel child passandogli l'id incontrato lungo il
      // percorso — con un valore statico quel secondo passaggio finisce sul
      // resolver generico di Sanity invece che su questo nodo, che fallisce
      // con lo stesso errore se il documento non esiste ancora. Ignoriamo
      // l'id ricevuto: questo pannello punta sempre allo stesso documento.
      .child(() =>
        S.document().schemaType(LANGUAGE_SETTINGS_DOC_ID).documentId(LANGUAGE_SETTINGS_DOC_ID),
      )
  )
}

/**
 * Toglie il singleton "Language Settings" dalla lista generica per tipo
 * (`S.documentTypeListItems()`), da usare insieme a `languageSettingsListItem`
 * per evitare che compaia due volte nella sidebar.
 */
export function excludeLanguageSettingsType<T extends {getId: () => string | undefined}>(
  items: T[],
): T[] {
  return items.filter((item) => item.getId() !== LANGUAGE_SETTINGS_DOC_ID)
}
