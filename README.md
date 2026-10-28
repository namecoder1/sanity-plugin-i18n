# sanity-plugin-i18n

Field-level internationalization for Sanity Studio, with automatic machine
translation. Add `autoI18n.string` / `autoI18n.text` / `autoI18n.blockContent`
/ `autoI18n.stringList` fields to your schemas — or define your own rich-text
type with exactly the styles, decorators, lists and links you want — and get a
per-language tab editor for free, plus a one-click **"Translate missing"** action
that fills in every other configured language from your source text.

![The plugin in Sanity Studio: the Language Settings sidebar entry, the "translations missing" banner mid-run, and per-language tabs on a string, a text and a rich-text field.](https://raw.githubusercontent.com/namecoder1/sanity-plugin-i18n/main/docs/screenshot.png)

## Requirements

- `sanity` package `^6.10.0` or later — this is the first release that ships
  `@sanity/ui` v4, which the plugin's UI is built against. On Sanity `^5` (and on
  `^6.0`–`^6.9`) the plugin would pull in a second, conflicting copy of `@sanity/ui`.
- React `^19.2` — required transitively by `@sanity/ui` v4 and by Sanity itself,
  which peer-depends on React `^19.2.2` from v5 onwards. React 18 is not supported.
- Node.js `>=20.19 <22` or `>=22.12`

## Installation

```sh
npm install sanity-plugin-i18n
```

## Usage

Add it as a plugin in `sanity.config.ts` (or .js):

```ts
import {defineConfig} from 'sanity'
import {autoI18nPlugin} from 'sanity-plugin-i18n'

export default defineConfig({
  //...
  plugins: [
    autoI18nPlugin({
      apiKey: process.env.SANITY_STUDIO_MYMEMORY_KEY, // optional
      email: 'you@email.com', // optional, raises the MyMemory rate limit
      defaultSourceLanguage: 'en', // fallback if no language is marked as source
    }),
  ],
})
```

This registers four schema types you can use instead of `string` / `text` /
a Portable Text block array / a plain string array:

```ts
defineField({name: 'title', type: 'autoI18n.string'})
defineField({name: 'excerpt', type: 'autoI18n.text'})
defineField({name: 'body', type: 'autoI18n.blockContent'}) // rich text
defineField({name: 'tags', type: 'autoI18n.stringList'}) // array of independently-translated strings
```

| Type                    | Replaces               | Notes                                                                 |
| ----------------------- | ---------------------- | --------------------------------------------------------------------- |
| `autoI18n.string`       | `string`               | single-line text                                                      |
| `autoI18n.text`         | `text`                 | multi-line plain text                                                 |
| `autoI18n.blockContent` | an `array` of `block`  | rich text — see "Rich text support" below                             |
| `autoI18n.stringList`   | an `array` of `string` | each list item has its own independent per-language value (e.g. tags) |

Need a rich-text field with a different toolbar (no H1, only bold/italic, relative links,
localized button labels)? Define your own type with `defineInternationalizedBlockContent`
— see "Custom rich text" below.

Each of the first three (and every custom rich-text type) stores an array `[{_key: 'en', value: '...'}, {_key: 'fr', value: '...'}]`
instead of a single value — one tab per language in the Studio editor, handled automatically
by the plugin. `autoI18n.stringList` nests that same shape inside every list item, so tags
(or any short repeated string) can each carry their own translations independently.

An entry exists only while its language has content: deleting a language's text removes its
entry instead of storing `""` (or a paragraph with no text), so an entry can be read as "this
language is translated". Data written before 2.1.2 may still hold empty entries; when you
query, treat an empty `value` as missing (e.g. `field[_key == $lang && length(value) > 0]`).

### Rich text support

`autoI18n.blockContent` supports paragraphs, headings (H1-H4), quotes, bulleted/numbered
lists, links, and the bold/italic/underline/strike-through decorators — not custom objects
or non-text blocks (images, etc. already present in the document are left untouched by
translation, see "Known limitations" below). Its links use Sanity's `url` type, so only
absolute URLs validate. Its configuration is frozen for compatibility with data already
stored: for a different set, or for relative links, define your own type (next section).

### Custom rich text

`defineInternationalizedBlockContent` (since 2.1) defines a rich-text type with the
styles, decorators, lists and link you choose. The data has the same shape as
`autoI18n.blockContent`, so translation works the same way.

```ts
import {defineInternationalizedBlockContent} from 'sanity-plugin-i18n'

export const i18nRichText = defineInternationalizedBlockContent({
  name: 'richText', // registered as `autoI18n.richText`
  title: 'Testo',
  styles: [
    // subset of normal | h1 | h2 | h3 | h4 | h5 | h6 | blockquote
    {value: 'normal', title: 'Paragrafo'},
    {value: 'h2', title: 'Titolo'},
    {value: 'h3', title: 'Sottotitolo'},
    {value: 'blockquote', title: 'Citazione'},
  ],
  decorators: [
    // subset of strong | em | code | underline | strike-through
    {value: 'strong', title: 'Grassetto'},
    {value: 'em', title: 'Corsivo'},
  ],
  lists: [
    // subset of bullet | number ([] = no lists)
    {value: 'bullet', title: 'Elenco puntato'},
    {value: 'number', title: 'Elenco numerato'},
  ],
  link: {
    // false = no links
    title: 'Link',
    // optional; without it any non-empty string is accepted
    validate: (href) =>
      /^(\/|#|https?:\/\/|mailto:|tel:)/.test(href)
        ? true
        : 'Must start with /, #, https://, mailto: or tel:',
  },
})
```

Register it next to your other schema types and use it by its full name:

```ts
// sanity.config.ts
schema: {
  types: [i18nRichText /* , ... */]
}

// in a document
defineField({name: 'body', type: 'autoI18n.richText'})
```

- The type name always gets the `autoI18n.` prefix (it is not doubled if already there):
  the plugin finds internationalized fields by it, for the "Translate missing" action and
  banner.
- Omitting `styles`, `decorators` or `lists` offers everything Sanity's own `block` type
  offers by default; an empty array offers none. Values outside the lists above throw when
  the type is defined.
- `title` is shown in the toolbar tooltips; style buttons show a short label (¶, H2, …).
- The link's `href` is a `string`, so relative links (`/contact`, `#section`, `mailto:`,
  `tel:`) are allowed. `validate` runs both as Sanity validation and in the editor, where
  a rejected link is not applied. `link: {type: 'url'}` keeps Sanity's `url` type instead
  (that is what `autoI18n.blockContent` uses).
- Spans marked `code` are not sent to the translation provider: inline code stays as
  written in every language.
- The type is yours, not the plugin's: register it in `schema.types` yourself. It still
  works with everything else the plugin does — tabs, "Translate missing", the banner, the
  Azure Function — because it is recognised by the `autoI18n.` prefix and stores the same
  shape as `autoI18n.blockContent`.
- Switching an existing field from `autoI18n.blockContent` to a custom type needs no
  migration (same stored shape), as long as the new type allows every style, decorator,
  list and link already present in the data: anything it does not allow is flagged by
  Sanity's validation and can no longer be applied from the toolbar.

| Option       | Type                                                                               | Default                                |
| ------------ | ---------------------------------------------------------------------------------- | -------------------------------------- |
| `name`       | `string` (required)                                                                | —                                      |
| `title`      | `string`                                                                           | `'Internationalized text (rich text)'` |
| `styles`     | `{value: 'normal' \| 'h1'…'h6' \| 'blockquote', title?}[]`                         | all eight                              |
| `decorators` | `{value: 'strong' \| 'em' \| 'code' \| 'underline' \| 'strike-through', title?}[]` | all five                               |
| `lists`      | `{value: 'bullet' \| 'number', title?}[]`                                          | both                                   |
| `link`       | `false \| {title?, type?: 'string' \| 'url', validate?}`                           | `{title: 'Link', type: 'string'}`      |

## How translation works

The plugin adds two ways to trigger automatic translation (they do the same thing,
deliberately redundant because the first one is easy to miss):

- A **"Translate missing"** action in the document toolbar, right next to "Publish".
- A **banner** at the top of the document form, shown whenever fields are missing or
  outdated, with a "Translate now" button.

Both translate from the source language to every other configured language, **skipping
fields that already have an up-to-date translation** — if you edit the source text after
already translating, the plugin notices on its own and only re-translates that field on
the next click (it leaves untouched languages, and translations you edited by hand whose
source hasn't changed since, alone).

Internationalized fields are found **wherever they sit in the document**: at the top
level, inside object fields (`seo.title`), and inside arrays of objects at any depth
(`sections[].items[].heading`). The one thing that is skipped is an array item without a
`_key`, because there is no stable way to address it in a patch.

Translation runs one API call per field per language, and both controls **report progress
and apply each translation as soon as it arrives**. If a run stops partway — a rate limit,
an exhausted quota, a dropped connection — everything already translated is kept, and you
get a message saying how far it got. Clicking again resumes from there.

With `provider: 'azure'` (see below) these two controls disappear: translation no longer
runs in the browser, but automatically on save, via a Sanity Function.

### Configuring languages (source and automatic translations)

The plugin adds a **"Language Settings"** entry to the Studio nav bar. It's a singleton —
there is always exactly one such document, with a fixed ID, and it can't be created a
second time or duplicated (the "+" new-document menu and the "Duplicate"/"Delete" actions
are disabled for it). From there you open a document with a `supportedLanguages` array,
where each row has:

- `code`: the language code (e.g. `en`, `fr`, `de`) — must match the keys used in
  internationalized fields;
- `label`: the label shown on the editor tabs;
- `isDefault`: **check this on exactly one language** — it's the source language,
  the one translation starts from.

Every other language in the array automatically becomes a "target" language: when you
click **"Translate missing"** on a document, the plugin translates from the source
language to each of the other listed languages, skipping ones that already have a value.

If no language has `isDefault: true`, the `defaultSourceLanguage` passed in the config
is used instead (or `en` as a last-resort fallback). **No translation is possible until
at least one language is configured** — with none configured, internationalized fields
render an empty state instead of the tab editor.

#### Optional: a dedicated sidebar entry

By default, "Language Settings" is reachable from the nav bar tool above, and — because
it's a regular document type — it also shows up in the Structure tool's default "Content"
list, in a generic per-type list pane (this is a Sanity Studio limitation: a plugin has no
way to hide one of its own document types from the default Content list; only a custom
`structure()` in the Studio itself can do that).

If you'd rather have a single, dedicated sidebar entry that jumps straight to the document
(no "No documents of this type" state, no generic list) — the same experience you'd hand-build
for any other singleton — the plugin exports two helpers for your own `structure()`:

```ts
// structure.ts
import type {StructureBuilder} from 'sanity/structure'
import {languageSettingsListItem, excludeLanguageSettingsType} from 'sanity-plugin-i18n'

export const structure = (S: StructureBuilder) =>
  S.list()
    .title('Content')
    .items([languageSettingsListItem(S), ...excludeLanguageSettingsType(S.documentTypeListItems())])
```

```ts
// sanity.config.ts
import {structureTool} from 'sanity/structure'
import {structure} from './structure'

export default defineConfig({
  // ...
  plugins: [structureTool({structure}), autoI18nPlugin({...})],
})
```

`languageSettingsListItem(S)` builds the sidebar entry; `excludeLanguageSettingsType(...)`
removes the type from the generic per-type list so it doesn't appear twice.
`languageSettingsListItem(S, {title})` changes the entry's title (see "Interface language").

## Interface language

The plugin's interface follows the **Studio's language**. English (`en-US`) and Italian
(`it-IT`) are built in: install Sanity's Italian locale and the plugin is in Italian too,
with no configuration.

```ts
import {itITLocale} from '@sanity/locale-it-it'

export default defineConfig({
  // ...
  plugins: [itITLocale(), autoI18nPlugin({...})],
})
```

That covers the language tabs ("(source)", placeholders), the loading and empty states,
the "Translate missing" action and its toasts, the banner, the rich-text toolbar's
tooltips and link prompt, and the navbar tool's loading screen. Bundles load lazily: a
Studio only fetches the locale it uses.

Rich-text tooltips you set yourself with `defineInternationalizedBlockContent` (`title`
on a style, decorator, list or link) are shown as written; only the built-in defaults
are translated.

### Overriding a string or adding a language

The strings live in the `sanity-plugin-i18n` i18next namespace (exported as
`I18N_NAMESPACE`), so Sanity's standard mechanism applies: add a bundle under `i18n.bundles`
in your Studio config. A bundle for a locale the plugin already ships overrides only the
keys it lists; a bundle for a new locale adds it (anything missing falls back to English).
The keys, with their English text, are in
[`src/locales/en-US.ts`](src/locales/en-US.ts).

```ts
import {defineConfig, defineLocaleResourceBundle} from 'sanity'
import {I18N_NAMESPACE} from 'sanity-plugin-i18n'

export default defineConfig({
  // ...
  i18n: {
    bundles: [
      // Override: change one Italian string.
      defineLocaleResourceBundle({
        locale: 'it-IT',
        namespace: I18N_NAMESPACE, // 'sanity-plugin-i18n'
        resources: {'action.translate': 'Traduci'},
      }),
      // New language (alongside the Studio's own locale for it, e.g. @sanity/locale-de-de).
      defineLocaleResourceBundle({
        locale: 'de-DE',
        namespace: I18N_NAMESPACE,
        resources: () => import('./locales/sanity-plugin-i18n.de-DE'),
      }),
    ],
  },
})
```

Plurals use i18next's suffixes (`banner.pending_one` / `banner.pending_other`, chosen by
`{{count}}`).

### Texts the Studio's locale cannot reach

Sanity translates components, not schema titles. The "Language Settings" document type
(its title, field titles, preview and validation messages) and the navbar tool's title
therefore stay in English unless you set them through the plugin's `labels` option:

```ts
autoI18nPlugin({
  labels: {
    languageSettingsTitle: 'Lingue', // document type, navbar tool, preview
    supportedLanguagesTitle: 'Lingue disponibili',
    languageCodeTitle: 'Codice lingua (es. it, en, fr)',
    languageLabelTitle: 'Nome visualizzato',
    defaultSourceLanguageTitle: 'Lingua di partenza',
    noLanguagesSubtitle: 'Nessuna lingua configurata',
    languageCountOne: '1 lingua',
    languageCountOther: '{{count}} lingue',
    sourceMarker: '(origine)',
    duplicateCodeError: 'Codice lingua ripetuto: {{codes}}. Ogni lingua deve comparire una volta.',
    multipleDefaultsError:
      'Solo una lingua può essere quella di partenza ({{codes}} sono tutte selezionate).',
    noDefaultWarning:
      "Nessuna lingua di partenza selezionata: verrà usata `defaultSourceLanguage` della configurazione del plugin, o l'inglese.",
  },
})
```

Every key is optional; anything left out keeps its English default. The sidebar entry from
`languageSettingsListItem` takes its own title: `languageSettingsListItem(S, {title: 'Lingue'})`.

## Translation engine: MyMemory (default) or Azure Translator

```ts
autoI18nPlugin({
  provider: 'mymemory', // default — no need to set it explicitly
  apiKey: process.env.SANITY_STUDIO_MYMEMORY_KEY, // optional
  email: 'you@email.com', // optional, raises the MyMemory rate limit
})
```

**MyMemory** (default) — called directly from the browser, works out of the box with no
extra configuration. No infrastructure to set up or maintain. Recommended to get started,
for small projects, or if you don't want to manage an Azure account.

> **Where your content goes.** With MyMemory, the text of the fields being translated
> leaves the editor's browser and is sent to `api.mymemory.translated.net`, a third-party
> service. MyMemory is a _translation memory_: by design it retains and reuses the
> segments it receives, which is exactly why it can answer without a paid key. Don't use
> it for confidential or personal data. Azure Translator, by contrast, states that it does
> not retain submitted text — and with `provider: 'azure'` the request leaves your Sanity
> Function, not the editor's browser.

**Azure Translator** (`provider: 'azure'`) — noticeably better translation quality (a real
machine translation engine, not a translation memory — see "Known limitations"), but
**requires extra infrastructure**: the Azure subscription key can't live in the Studio's
browser bundle, so translation runs in a server-side Sanity Function that fires on its own
whenever a document is saved. See the full step-by-step guide in
[`azure-function-template/README.md`](https://github.com/namecoder1/sanity-plugin-i18n/blob/main/azure-function-template/README.md) — it requires an
Azure account (a free tier is available), a few terminal commands (`sanity blueprints`),
and copying a couple of files into your Studio repo. Not complicated, but not "zero
config" like MyMemory: if you're just trying out the plugin, start with MyMemory.

## Integrating into your Studio: best practices

What we do, and what we learned, wiring the plugin into real Studios.

### Set-up order

1. Install the plugin and add `autoI18nPlugin()` to `plugins` (see "Usage").
2. Open **Language Settings** and add your languages **before** adding fields: until at
   least one language exists, internationalized fields show an empty state. Mark exactly
   one as `isDefault` (the source).
3. Optionally add `languageSettingsListItem(S)` to your `structure()` so the singleton has
   its own sidebar entry (see "Optional: a dedicated sidebar entry").
4. Replace fields one at a time (`string` → `autoI18n.string`, rich text →
   `autoI18n.blockContent` or your own type) and check the document still opens.

### Schema

- **Rich text: define one type per toolbar you need**, in its own file, and register it in
  `schema.types` next to your documents. Reuse it across documents rather than defining a
  near-identical type per field:

  ```ts
  // schemaTypes/richText.ts
  export const richText = defineInternationalizedBlockContent({name: 'richText' /* ... */})

  // schemaTypes/index.ts
  export const schema = {types: [richText, post /* ... */]}
  ```

- **Give the type labels in your Studio's language** (`title` on styles, decorators, lists
  and link): they become the toolbar tooltips.
- **Prefer a `string` link with `validate`** over the `url` type when editors need internal
  links (`/contact`, `#section`, `mailto:`, `tel:`).
- **Add a `preview`** to every document whose title is an internationalized field (see
  "Known limitations" for the snippet), and point any `slug` `source` at the source
  language's value:

  ```ts
  defineField({
    name: 'slug',
    type: 'slug',
    options: {
      source: (doc: any) => (doc.title || []).find((v: any) => v._key === 'it')?.value || '',
    },
  })
  ```

- **Per-language rules (e.g. "required in the source language") belong to your schema**,
  as a `custom` rule on the field: the plugin does not add any.

  ```ts
  defineField({
    name: 'title',
    type: 'autoI18n.string',
    validation: (rule) =>
      rule.custom((values?: Array<{_key: string; value?: string}>) =>
        values?.find((v) => v._key === 'it')?.value ? true : 'Required in Italian',
      ),
  })
  ```

- **Moving an existing `autoI18n.blockContent` field to a custom type** needs no data
  migration — but first make sure the new type allows everything already stored (an `h1`
  in old content is flagged once the type drops `h1`).

### Translation provider

- **MyMemory**: `email` alone is enough to raise the rate limit. Only set `apiKey` with a
  key you know is valid: MyMemory rejects the whole request with `403 AUTHENTICATION
FAILURE` when the key does not match, rather than ignoring it.
- **Azure**: build the Function on `sanity-plugin-i18n/core` (see
  [`azure-function-template/`](https://github.com/namecoder1/sanity-plugin-i18n/blob/main/azure-function-template/README.md))
  instead of copying the translation logic into it, and keep its `sanity-plugin-i18n`
  version in step with the Studio's — otherwise fixes such as leaving inline code
  untranslated never reach the Function. With `provider: 'azure'` the "Translate missing"
  action is not registered, so test that action with MyMemory.

### Reading the content on your site

Each field is an array keyed by language; pick the requested language and fall back to
the source one in GROQ:

```groq
*[_type == "post" && slug.current == $slug][0]{
  "title": coalesce(title[_key == $lang][0].value, title[_key == "it"][0].value),
  "body": coalesce(body[_key == $lang][0].value, body[_key == "it"][0].value)
}
```

`body` is then ordinary Portable Text: render it with `@portabletext/react` (or your
framework's equivalent) like any other block content.

### Testing an unreleased build in a Studio

Keep a dedicated test Studio with a document that has every field type: internationalized
fields at the top level, inside an `object` and inside an array of objects, next to plain
non-internationalized fields (numbers, images, references…), so a change that breaks field
discovery or coexistence shows up immediately. Then:

1. In the plugin: `npm run build && npx yalc publish` (later builds: `npx yalc publish --push`).
2. In the Studio: `npx yalc add sanity-plugin-i18n` once, `npx yalc update` afterwards.
3. Clear Vite's cache before starting, or the Studio may keep serving the previous build:
   `rm -rf node_modules/.sanity && npm run dev`.
4. Check: the toolbar of each rich-text type, links (valid and rejected), "Translate
   missing" and the banner (with MyMemory), the stored shape in Vision, and that opening a
   published document without typing does not create a draft.

### Troubleshooting

| Symptom                                                                 | Cause and fix                                                                                                                                 |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `MyMemory API error 403: AUTHENTICATION FAILURE`                        | Invalid `apiKey`: remove it (keep `email`) or replace it.                                                                                     |
| `Incompatible React versions` when starting the Studio                  | `react` and `react-dom` installed at different versions, typically after upgrading `sanity`: install both at the same version.                |
| No "Translate missing" action or banner on a document                   | No field of a type named `autoI18n.*` in it, or `provider: 'azure'` (no action by design).                                                    |
| A custom rich-text type does not show its toolbar                       | The type is not registered in `schema.types`, or the field references it without the `autoI18n.` prefix.                                      |
| Banner reappears on a fully translated rich-text field after publishing | Fixed in 2.1.1 (the source hash depended on JSON key order). Upgrade; fields translated before the fix may need one last "Translate missing". |
| Toolbar still shows options you removed                                 | The Studio is serving an old build: clear `node_modules/.sanity` and restart.                                                                 |

## Advanced: building a custom translation provider

If neither MyMemory nor Azure fits (e.g. you want DeepL, or an in-house translation
service), the plugin exports the pieces used internally to build one:

```ts
import {
  fetchLanguageSettings, // reads the Language Settings singleton -> {sourceLang, targetLangs}
  findInternationalizedFieldPaths, // walks a document, returns every autoI18n.* field's path
  findPendingTranslations, // diffs source vs. translated values, returns what needs (re)translating
  buildTranslationPatches, // runs a TranslationProvider over pending translations, returns Sanity patches
  hashSourceValue, // hashing used to detect a stale translation (source edited since last run)
  hasContent, // true if a LocaleValue actually holds text/blocks
  createMyMemoryProvider,
  createAzureProvider,
} from 'sanity-plugin-i18n'
import type {
  TranslationProvider, // the interface a custom provider must implement
  PendingTranslation,
  LocaleValue,
  LanguageEntry,
  AzureProviderOptions,
} from 'sanity-plugin-i18n'
```

`TranslationProvider` is the shape both bundled providers implement: a required
`translateText(text, from, to)`, plus an optional `translateTexts(texts, from, to)` for
APIs that accept a batch. When a provider implements the batch method, every span of a
rich-text field is translated in one round trip instead of one call each; when it
doesn't, the plugin falls back to sequential calls automatically.

### Importing the core outside the Studio

These functions are also available from a second, framework-free entry point:

```ts
import {buildTranslationPatches, createAzureProvider} from 'sanity-plugin-i18n/core'
```

`sanity-plugin-i18n/core` pulls in no React, no `@sanity/ui` and nothing from the Studio
runtime, so it can be imported from a Sanity Function, a migration script or a plain Node
process. The Azure Function in
[`azure-function-template/`](https://github.com/namecoder1/sanity-plugin-i18n/blob/main/azure-function-template/README.md)
is built on it, and is a good reference for writing your own server-side translation
Function.

## Known limitations

- **Document previews (list rows, the document title bar) break by default**: since
  `autoI18n.string` / `autoI18n.text` / `autoI18n.blockContent` (and custom rich-text
  types) store an array of
  `{_key, value, sourceHash}` instead of a plain string, Sanity Studio's automatic preview
  (which expects a field literally named `title` to be a string) can't derive a title from
  it and falls back to showing the raw serialized array. Fix it by adding an explicit
  `preview` to any document type that uses one of these fields as its title/subtitle:

  ```ts
  const localeValueToText = (value: unknown, sourceLang = 'en') => {
    const values = Array.isArray(value) ? value : []
    return values.find((v: any) => v._key === sourceLang)?.value || values[0]?.value
  }

  defineType({
    name: 'post',
    type: 'document',
    fields: [
      defineField({name: 'title', type: 'autoI18n.string'}),
      // ...
    ],
    preview: {
      select: {title: 'title'},
      prepare({title}) {
        return {title: localeValueToText(title) || 'Untitled'}
      },
    },
  })
  ```

  Use the same `sourceLang` you configured as `isDefault` in Language Settings (or your
  `defaultSourceLanguage`).

- **`localeValue` is a generic `_type` name**: the plugin recognises an internationalized
  field by looking for array items with `_type: 'localeValue'`, and that name is not
  namespaced (everything else in the plugin is, under `autoI18n.`).

  In practice the exposure is narrow. A field is only ever translated if it _also_ has an
  item keyed with your configured source language, carrying content — so a foreign
  `localeValue` array keyed by anything else (`k1`, a UUID, a slug) is skipped entirely,
  with no patch and no entry in the pending count. The one case that would collide is
  another type named `localeValue` whose items are keyed by exactly your configured
  language codes; at that point it is indistinguishable from one of ours. Both behaviours
  are pinned by tests.

  If you do have such a type, rename it on your side — renaming it in the plugin would
  break every document already stored.

- **The banner is built on a Sanity internal API**: the top-of-form banner is mounted via
  `document.components.unstable_layout`, which Sanity marks `@internal` — it can change or
  disappear in a patch release without a deprecation cycle. The component is written
  defensively (a failure there still renders the document form), and the "Translate
  missing" toolbar action does the same job without relying on it, but this is worth
  knowing before pinning a Studio version.
- **MyMemory is a translation memory, not a real translation engine**: it returns the
  closest match in its database (often extracted from books, academic papers). On short
  or generic text, it can occasionally return fragments unrelated to your source (e.g. a
  bibliographic citation). The plugin filters out the most suspicious results (low
  quality score, anomalous length), but it's not an absolute guarantee — this doesn't
  happen with Azure Translator.
- **Span-by-span translation in rich text**: to preserve bold/italic with APIs that only
  translate plain text, every "span" in a Portable Text block is translated as its own
  segment. This can reduce fluency when a sentence is split by inline formatting (e.g. "the
  **black** cat" translated as two separate segments instead of as one full sentence). The
  Azure Function batches these into a single request per field, so the cost is in
  translation quality, not in the number of API calls. Spans marked `code` are skipped.
- **`autoI18n.blockContent` doesn't support custom objects**: only text blocks
  (paragraphs, headings, quotes, lists) with decorators/links — no inline images, code
  blocks, or other custom block objects inside the translated field. If your regular
  block content needs those, keep them out of `autoI18n.blockContent` or handle them in
  a separate field. The same holds for types made with `defineInternationalizedBlockContent`:
  they choose among the built-in styles/decorators/lists/link, they cannot add custom
  annotations or objects.
- **Links in the editor are created via a browser prompt** (`window.prompt`), not a real
  dialog — simple but unpolished: a link rejected by `validate` is reported with
  `window.alert`, and editing an existing link means removing and re-creating it rather
  than editing it in place.
- **`autoI18n.blockContent` links use Sanity's `url` type**, so relative links
  (`/contact`, `mailto:`) fail validation there. This is configurable from 2.1: define
  your own type with `defineInternationalizedBlockContent` (see "Custom rich text").

## License

[MIT](LICENSE) © tobi

## Develop & test

This plugin uses [@sanity/plugin-kit](https://github.com/sanity-io/plugins/tree/main/packages/@sanity/plugin-kit)
with default configuration for build & watch scripts.

See [Testing a plugin in Sanity Studio](https://github.com/sanity-io/plugins/tree/main/packages/@sanity/plugin-kit#testing-a-plugin-in-sanity-studio)
on how to run this plugin with hotreload in the studio.

Before opening a PR, run what CI runs:

```sh
npm run lint && npm run typecheck && npm test && npm run build
```

Tests sit next to the code they cover (`*.test.ts(x)`, Vitest). Component tests opt into
jsdom per file; everything else runs on plain Node. `schemaTypes/internationalizedField.test.ts`
compiles a real Sanity schema, so a definition Sanity would reject fails the suite.

To try an unreleased build in a real Studio, see "Testing an unreleased build in a Studio"
above (yalc), or use `npm run link-watch` for hot reload.

### Release new version

Run the ["CI & Release" workflow](https://github.com/namecoder1/sanity-plugin-i18n/actions/workflows/main.yml).
Make sure to select the main branch and check "Release new version".

Semantic release will only release on configured branches, so it is safe to run release on any branch.
