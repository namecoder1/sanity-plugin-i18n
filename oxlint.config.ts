import sanityPluginKitOxlint from '@sanity/plugin-kit/oxlint'
import {defineConfig} from 'oxlint'

export default defineConfig({
  extends: [sanityPluginKitOxlint],
  // `ignorePatterns` is not inherited through `extends` (see the preset's docs), so
  // the preset's own patterns have to be repeated alongside ours.
  ignorePatterns: [
    ...(sanityPluginKitOxlint.ignorePatterns ?? []),
    // A template meant to be copied into another repo (a Studio); not part of the
    // published package. It runs on Node inside a Sanity Function, with its own
    // dependencies (@sanity/functions, @types/node) installed separately rather than
    // in this package's node_modules — linting it here only produces false positives
    // about modules and globals that simply are not installed on this side.
    'azure-function-template/**',
  ],
  rules: {
    // This plugin's domain is "loosely typed Sanity documents read from JSON":
    // custom fields, responses from third-party translation APIs. Type assertions are
    // structural to that problem, not a mistake to avoid. The rule is valuable in
    // general application code; here it is almost always a false positive.
    'typescript/no-unsafe-type-assertion': 'off',
    // Calls to the translation APIs MUST be sequential: the order in which patches
    // are built matters, and firing them in parallel would hammer third-party APIs
    // with tight rate limits — MyMemory above all.
    'no-await-in-loop': 'off',
    // `props.onComplete()` reads as "deprecated" to the type-checker in this setup
    // (most likely a mismatch between the `sanity` version in the plugin's
    // devDependencies and the one in the test Studio), but it is not marked
    // deprecated in the types actually used at runtime, and there is no clear
    // alternative for a non-dialog document action. Revisit if an official
    // replacement appears.
    'typescript/no-deprecated': 'off',
  },
})
