# Template: automatic translation via Azure Translator

`provider: 'azure'` in the plugin **does not translate by itself**. The Azure Translator
subscription key must never end up in the Studio's browser bundle (anyone opening the
Studio would see it in network requests), so translation has to run **server-side**, in
a [Sanity Function](https://www.sanity.io/docs/blueprints) that fires on its own every
time a document is created or updated.

This folder is the ready-to-use code for that Function. It needs to be **copied into your
Studio** and deployed with your own Sanity identity and Azure key.

The Function itself is thin — around 60 lines. All the translation logic is imported
from `sanity-plugin-i18n/core`, the plugin's framework-free entry point, which runs on
plain Node with no React and nothing from the Studio runtime. You should not need to
change any of it.

If you're only using MyMemory (the default provider) **you don't need any of this** —
skip this folder, the "Translate missing" button and the banner already work on their own.

## 1. Create an Azure Translator resource

On the [Azure portal](https://portal.azure.com): create a "Translator" resource (a free
tier exists and is enough to get started). Once created, go to **Keys and Endpoint** and
note down:

- **KEY 1** (either key works — KEY 2 is just a duplicate for rotating without downtime)
- **Region**, e.g. `westeurope` — write it exactly as it appears, lowercase, no spaces

## 2. Copy the files into your Studio

Copy `functions/translate-azure/` and `sanity.blueprint.ts.example` (renaming it to
`sanity.blueprint.ts`) **into the root of your Studio repo** — not inside `src/`, at the
same level as `sanity.config.ts`.

If your Studio already lives inside a subfolder of a monorepo (e.g. `apps/studio/`), put
`sanity.blueprint.ts` and `functions/` one level above it, not inside it. If instead your
Studio is at the root of the repo (the most common case for a single-project setup), it's
fine to put them there together: on deploy you'll see a notice —

```
Notice
 Blueprint should not be co-located with a Sanity Studio.
```

— this is **expected and harmless** in that case: it's Sanity's advice for people managing
multiple projects (studio, frontend, functions) in the same monorepo, not an error. Feel
free to ignore it.

## 3. Install the function's dependencies

```sh
cd functions/translate-azure
npm install
cd ../..
```

Easy to forget: without this, the deploy fails with an error like `Rolldown failed to
resolve import "@sanity/functions"` — the function has its own `package.json`, separate
from the Studio's, with its own dependencies to install. Those are `@sanity/functions`,
`@sanity/client`, and `sanity-plugin-i18n` itself, which is where the translation logic
comes from.

## 4. Initialize the Blueprint (once)

```sh
npx sanity@latest blueprints init . --type ts --stack-name production --project-id <your-project-id>
```

It'll prompt you to confirm/log in if you're not already authenticated. This creates a
"Stack" — the deployed remote state — linked to your Sanity project. It doesn't change
anything visible yet.

## 5. Deploy (actually creates the Function)

```sh
npx sanity@latest blueprints plan     # preview, safe, touches nothing
npx sanity@latest blueprints deploy   # applies it for real
```

**Only once the deploy completes** does the Function exist as a remote resource — it's
important to deploy BEFORE setting secrets in the next step, otherwise `functions env add`
responds with `Error: Unable to find function`.

The Function already works at this point, even without secrets: it simply logs an error
("AZURE_TRANSLATOR_KEY not set") and does nothing, without breaking anything.

## 6. Set the secrets

```sh
npx sanity@latest functions env add translate-azure AZURE_TRANSLATOR_KEY <your-KEY-1>
npx sanity@latest functions env add translate-azure AZURE_TRANSLATOR_REGION <your-region>
```

Optionally, a third one:

```sh
npx sanity@latest functions env add translate-azure DEFAULT_SOURCE_LANGUAGE <e.g. en>
```

This is only the fallback used when **no** language in Language Settings is marked as the
default source. It defaults to `en`, matching the plugin's own fallback — keep the two in
sync, or the Studio button and the Function would translate from different source
languages in that case. If you did mark a default source language (you should), this
variable is never read.

## 7. Verify it works

Edit and save an internationalized field on a document in the Studio, then check the
logs:

```sh
npx sanity@latest functions logs translate-azure
```

You should see `[auto-i18n] Translated N field/language on <document-id>`. If you want to check the
document's actual content without opening the Studio:

```sh
npx sanity@latest documents query '*[_id=="<document-id>"]{...}' --project <project-id> --dataset <dataset>
```

(note: `--project` is deprecated in favor of `--project-id`, but both still work as of
this writing; if the document is still a draft, its real `_id` has the `drafts.` prefix
in front of it).

## 8. Enable Azure in the Studio

In `sanity.config.ts`:

```ts
autoI18nPlugin({
  provider: 'azure',
  defaultSourceLanguage: 'en',
})
```

With `provider: 'azure'` the "Translate missing" button and the banner's button disappear
from the Studio (there's nothing left to run client-side) — only the informational count
remains, "N translations missing or outdated. They will be translated automatically on
save."

## Notes / limitations of this template

- **Document filter**: by default the Function runs on every document type except
  `autoI18n.languageSettings`. If you have many document types with no internationalized
  fields, you can narrow the filter in `sanity.blueprint.ts` (e.g. `_type == "post"`) to
  save invocations — not strictly necessary, the Function exits immediately without doing
  anything if it finds no fields to translate, but a tighter filter is still cleaner.
- **No duplicated logic**: the Function imports `sanity-plugin-i18n/core` rather than
  copying the plugin's hashing and staleness rules, so the two can no longer drift apart.
  Earlier versions of this template did keep a hand-maintained copy; if you are upgrading
  from one, replace your `functions/translate-azure/` folder wholesale rather than merging
  into it.
- **Version pinning**: because the Function imports the plugin, keep the
  `sanity-plugin-i18n` version in `functions/translate-azure/package.json` in step with
  the one your Studio uses. They are separate installs and nothing checks this for you.
- **Batched requests**: spans are collected across the whole field and sent to Azure in
  one request (up to 100 texts per call), rather than one request per span. On a long
  rich-text field this is the difference between a handful of calls and hundreds.
- **Local testing**: `npx sanity@latest functions test translate-azure --document-id <id>
--dataset <dataset> --with-user-token` runs the function locally, but does NOT read the
  secrets set with `functions env add` (those only apply to the remote deploy) — to test
  locally with real values, pass them as shell environment variables, e.g.
  `AZURE_TRANSLATOR_KEY=... npx sanity@latest functions test ...`.
