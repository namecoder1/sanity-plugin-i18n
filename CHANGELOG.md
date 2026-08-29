<!-- markdownlint-disable --><!-- textlint-disable -->

# 📓 Changelog

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.0.0](https://github.com/namecoder1/sanity-plugin-i18n/compare/v1.1.1...v2.0.0) (2026-08-29)

### ⚠ BREAKING CHANGES

- peerDependencies now require sanity ^6.10.0 and react ^19.2, and
  @portabletext/editor moves from dependencies to peerDependencies. Studios on Sanity 5,
  on 6.0-6.9, or on React 18 are no longer supported; those combinations already pulled a
  conflicting second copy of @sanity/ui or @portabletext/editor into the bundle.

### Features

- form integration, recursive field discovery, and a framework-free core entry ([#1](https://github.com/namecoder1/sanity-plugin-i18n/issues/1)) ([cc5b629](https://github.com/namecoder1/sanity-plugin-i18n/commit/cc5b629e08a7d889f97f9c2f061576f8e8f95dab))

## [1.1.1](https://github.com/namecoder1/sanity-plugin-i18n/compare/v1.1.0...v1.1.1) (2026-08-28)

### Bug Fixes

- document how to fix the broken document preview ([5d9eccc](https://github.com/namecoder1/sanity-plugin-i18n/commit/5d9ecccacdd6a2afa30bd5a62367d665e9fe09be))

## [1.1.0](https://github.com/namecoder1/sanity-plugin-i18n/compare/v1.0.4...v1.1.0) (2026-08-28)

### Features

- export optional structure helpers for a dedicated Language Settings entry ([4ec30f2](https://github.com/namecoder1/sanity-plugin-i18n/commit/4ec30f2a2a8253806a7d32a9689fefd9a2e5537f))

## [1.0.4](https://github.com/namecoder1/sanity-plugin-i18n/compare/v1.0.3...v1.0.4) (2026-08-28)

### Bug Fixes

- correctly prevent duplicate Language Settings documents ([7c2d69c](https://github.com/namecoder1/sanity-plugin-i18n/commit/7c2d69c07700d3cfb940d02c61f2197c68da57d4))

## [1.0.3](https://github.com/namecoder1/sanity-plugin-i18n/compare/v1.0.2...v1.0.3) (2026-08-28)

### Bug Fixes

- make Language Settings a true singleton ([3204222](https://github.com/namecoder1/sanity-plugin-i18n/commit/3204222ce31f61f8c06a99ab4055d33904344ead))
- translate Studio UI strings to English ([91e38a1](https://github.com/namecoder1/sanity-plugin-i18n/commit/91e38a1cf14772f4f9af6ff13e558d40353c66e0))

## [1.0.2](https://github.com/namecoder1/sanity-plugin-i18n/compare/v1.0.1...v1.0.2) (2026-08-28)

### Bug Fixes

- enable real releases (remove semantic-release --dry-run) ([65c7adf](https://github.com/namecoder1/sanity-plugin-i18n/commit/65c7adf9b6a92b1c27f06a706046cf1c7893be16))
- hoist conventional-changelog-conventionalcommits as a direct devDependency ([9c73079](https://github.com/namecoder1/sanity-plugin-i18n/commit/9c730791649ddd0fa7231a41ab970fe8c906864d))
- pin conventional-changelog-conventionalcommits to unblock releases ([70d8cbe](https://github.com/namecoder1/sanity-plugin-i18n/commit/70d8cbe56bfdabaa384ce7d14ed8408003f5a2c8))
- widen react peer dependency to allow React 19 ([b47bd6b](https://github.com/namecoder1/sanity-plugin-i18n/commit/b47bd6b5727256fb41ef0046a9fa6fea2a886e87))
