# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [0.1.3](https://github.com/AscaL/neko-vue/compare/v0.1.2...v0.1.3) (2026-04-04)

## [0.1.2](https://github.com/AscaL/neko-vue/compare/v0.1.1...v0.1.2) (2026-04-04)


### Features

* add new behavior cycle types and utility functions to enhance behavior mode handling ([c5dd242](https://github.com/AscaL/neko-vue/commit/c5dd242d27164085865665521d79acd6b3fd8b89))
* enhance NekoPet component with public props and improve behavior mode handling in runtime ([53ed755](https://github.com/AscaL/neko-vue/commit/53ed7553fea2078c5ff648c5753a87420eb76b32))

## [0.1.1](https://github.com/AscaL/neko-vue/compare/v0.1.0...v0.1.1) (2026-04-04)

## [0.1.0] - 2026-04-04

### Added

- **Public API:** `useNeko`, `NekoPet`, `loadNekoRuntime`, placement helpers (`startCorner`, `anchorRef` / `anchorSelector`), and types (`BehaviorMode`, `DEFAULT_NEKO_BEHAVIOR_CYCLE`, etc.).
- **Bundled neko engine** (dynamic import chunk); `cursorStandoffPx`, `behaviorCycle`, `restUntilFirstPetInteraction`, `respectReducedMotion`, `mode` (`follow` / `rest`), and debug logging.
- **Export subpaths** (conditional `types` + `import`): `neko-vue/types`, `neko-vue/placement`, `neko-vue/runtime`, `neko-vue/vue` — for intent-specific imports alongside the root `neko-vue` barrel.
- **`engines.node`:** `>=24.0.0` (Active LTS).

[0.1.0]: https://github.com/AscaL/neko-vue/releases/tag/v0.1.0
