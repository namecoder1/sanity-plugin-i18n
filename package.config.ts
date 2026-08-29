import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  dist: 'dist',
  tsconfig: 'tsconfig.dist.json',

  // Two entry points. `./core` is the framework-free half — see src/core.ts for why
  // it exists. Keeping it as a separate export is what lets a Sanity Function import
  // the translation logic without pulling the Studio's React components into a Node
  // build.
  exports: (prev) => ({
    ...prev,
    './core': {
      source: './src/core.ts',
      import: './dist/core.js',
      default: './dist/core.js',
    },
  }),

  // Remove this block to enable stricter TSDoc / API Extractor checks
  tsdoc: {
    rules: {
      'ae-incompatible-release-tags': 'off',
      'ae-internal-missing-underscore': 'off',
      'ae-missing-release-tag': 'off',
    },
  },
})
