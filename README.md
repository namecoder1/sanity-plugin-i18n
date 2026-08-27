# sanity-plugin-i18n

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

Use the `autoI18n.string` / `autoI18n.text` / `autoI18n.blockContent` types instead of
`string` / `text` / a Portable Text block array in your schemas:

```ts
defineField({name: 'title', type: 'autoI18n.string'})
defineField({name: 'excerpt', type: 'autoI18n.text'})
defineField({name: 'body', type: 'autoI18n.blockContent'}) // rich text
```

Each of these fields stores an array `[{_key: 'en', value: '...'}, {_key: 'fr', value: '...'}]`
instead of a single value — one tab per language in the Studio editor, handled automatically
by the plugin.

`autoI18n.blockContent` supports paragraphs, headings (H1-H4), quotes, bulleted/numbered
lists, links, and the bold/italic/underline/strike-through decorators — not custom objects
or non-text blocks (images, etc. already present in the document are left untouched by
translation, see "Known limitations" below).

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

With `provider: 'azure'` (see below) these two controls disappear: translation no longer
runs in the browser, but automatically on save, via a Sanity Function.

### Configuring languages (source and automatic translations)

The plugin adds an **"Language Settings"** entry to the Studio nav bar. From there you
open a singleton document with a `supportedLanguages` array, where each row has:

- `code`: the language code (e.g. `en`, `fr`, `de`) — must match the keys used in
  internationalized fields;
- `label`: the label shown on the editor tabs;
- `isDefault`: **check this on exactly one language** — it's the source language,
  the one translation starts from.

Every other language in the array automatically becomes a "target" language: when you
click **"Translate missing"** on a document, the plugin translates from the source
language to each of the other listed languages, skipping ones that already have a value.

If no language has `isDefault: true`, the `defaultSourceLanguage` passed in the config
is used instead (or `en` as a last-resort fallback).

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

**Azure Translator** (`provider: 'azure'`) — noticeably better translation quality (a real
machine translation engine, not a translation memory — see "Known limitations"), but
**requires extra infrastructure**: the Azure subscription key can't live in the Studio's
browser bundle, so translation runs in a server-side Sanity Function that fires on its own
whenever a document is saved. See the full step-by-step guide in
[`azure-function-template/README.md`](./azure-function-template/README.md) — it requires an
Azure account (a free tier is available), a few terminal commands (`sanity blueprints`),
and copying a couple of files into your Studio repo. Not complicated, but not "zero
config" like MyMemory: if you're just trying out the plugin, start with MyMemory.

## Known limitations

- **MyMemory is a translation memory, not a real translation engine**: it returns the
  closest match in its database (often extracted from books, academic papers). On short
  or generic text, it can occasionally return fragments unrelated to your source (e.g. a
  bibliographic citation). The plugin filters out the most suspicious results (low
  quality score, anomalous length), but it's not an absolute guarantee — this doesn't
  happen with Azure Translator.
- **Span-by-span translation in rich text**: to preserve bold/italic with APIs that only
  translate plain text, every "span" in a Portable Text block is translated separately.
  This can reduce fluency when a sentence is split by inline formatting (e.g. "the
  **black** cat" translated in two separate calls instead of as one full sentence).
- **`autoI18n.blockContent` doesn't support custom objects**: only text blocks
  (paragraphs, headings, quotes, lists) with decorators/links — no inline images, code
  blocks, or other custom block objects inside the translated field. If your regular
  block content needs those, keep them out of `autoI18n.blockContent` or handle them in
  a separate field.
- **Links in the editor are created via a browser prompt** (`window.prompt`), not a real
  dialog — simple but unpolished: no URL validation, and editing an existing link means
  removing and re-creating it rather than editing it in place.

## License

[MIT](LICENSE) © tobi

## Develop & test

This plugin uses [@sanity/plugin-kit](https://github.com/sanity-io/plugins/tree/main/packages/@sanity/plugin-kit)
with default configuration for build & watch scripts.

See [Testing a plugin in Sanity Studio](https://github.com/sanity-io/plugins/tree/main/packages/@sanity/plugin-kit#testing-a-plugin-in-sanity-studio)
on how to run this plugin with hotreload in the studio.

### Release new version

Run the ["CI & Release" workflow](https://github.com/namecoder1/sanity-plugin-i18n/actions/workflows/main.yml).
Make sure to select the main branch and check "Release new version".

Semantic release will only release on configured branches, so it is safe to run release on any branch.
