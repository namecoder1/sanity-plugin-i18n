import {EarthGlobeIcon} from '@sanity/icons/EarthGlobe'
import type {StructureBuilder} from 'sanity/structure'

import {LANGUAGE_SETTINGS_DOC_ID} from './config'

/**
 * A ready-made sidebar entry for the "Language Settings" singleton. It jumps
 * straight to the document with the fixed ID, instead of going through the generic
 * per-type list — which needs the document to already exist and does not treat a
 * singleton any differently from an ordinary type.
 *
 * It is the same `S.document()` pattern you would hand-build in a custom
 * `structure()`. Pair it with `excludeLanguageSettingsType` to keep the type from
 * also appearing in the generic list.
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
      // Needed here too, not only inside .child() below: when Sanity resolves the
      // pane from the URL rather than from the tree it just built, it takes the type
      // from THIS schemaType. Without it, it tries to infer the type by querying the
      // dataset for that ID, which fails with "Failed to resolve document, and no
      // type provided in parameters" while the document does not exist yet — there
      // is no document to read a _type from.
      .schemaType(LANGUAGE_SETTINGS_DOC_ID)
      // The child MUST be a function, not a static DocumentBuilder. Intent
      // navigation (`router.navigateIntent`, used by the Tool in index.ts) drills
      // into the child again, passing the id it met along the way — with a static
      // value that second pass lands on Sanity's generic resolver instead of this
      // node, and fails with the same error while the document does not exist yet.
      // The id handed in is ignored on purpose: this pane always points at the same
      // document.
      .child(() =>
        S.document().schemaType(LANGUAGE_SETTINGS_DOC_ID).documentId(LANGUAGE_SETTINGS_DOC_ID),
      )
  )
}

/**
 * Removes the "Language Settings" singleton from the generic per-type list
 * (`S.documentTypeListItems()`). Use it together with `languageSettingsListItem`
 * so the entry does not show up twice in the sidebar.
 */
export function excludeLanguageSettingsType<T extends {getId: () => string | undefined}>(
  items: T[],
): T[] {
  return items.filter((item) => item.getId() !== LANGUAGE_SETTINGS_DOC_ID)
}
