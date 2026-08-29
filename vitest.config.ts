import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    // Only the component tests need a DOM; the pure-logic suites run faster
    // without one, so the environment is opted into per file via
    // `// @vitest-environment jsdom` rather than switched on globally.
    environment: 'node',
  },
})
