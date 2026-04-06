# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [0.1.7](https://github.com/AscaL/neko-vue/compare/v0.1.6...v0.1.7) (2026-04-06)

### Features

- add options for behavior tracking and display in Neko components ([43a72b0](https://github.com/AscaL/neko-vue/commit/43a72b007b6f9da81441cfb1955b4ad9a92a08ef))
- implement NekoEngineMovement and viewport handling for enhanced pet behavior and movement logic ([2dd8484](https://github.com/AscaL/neko-vue/commit/2dd848413050e2e51bc7f6e215ed6c6f4bb05407))

## [0.1.6](https://github.com/AscaL/neko-vue/compare/v0.1.5...v0.1.6) (2026-04-05)

### Features

- add NekoEngineApi and NekoEngineState types for enhanced engine functionality ([138ca8d](https://github.com/AscaL/neko-vue/commit/138ca8d2486ec6e8ace114803db32bea0a14548b))

## [0.1.5](https://github.com/AscaL/neko-vue/compare/v0.1.4...v0.1.5) (2026-04-04)

### Features

- implement viewport clamping for Neko sprite and enhance resize handling with tests ([086d2ca](https://github.com/AscaL/neko-vue/commit/086d2caddc44afd1043c18c633b9ab02cf505598))

## [0.1.4](https://github.com/AscaL/neko-vue/compare/v0.1.3...v0.1.4) (2026-04-04)

## [0.1.3](https://github.com/AscaL/neko-vue/compare/v0.1.2...v0.1.3) (2026-04-04)

## [0.1.2](https://github.com/AscaL/neko-vue/compare/v0.1.1...v0.1.2) (2026-04-04)

### Features

- add new behavior cycle types and utility functions to enhance behavior mode handling ([c5dd242](https://github.com/AscaL/neko-vue/commit/c5dd242d27164085865665521d79acd6b3fd8b89))
- enhance NekoPet component with public props and improve behavior mode handling in runtime ([53ed755](https://github.com/AscaL/neko-vue/commit/53ed7553fea2078c5ff648c5753a87420eb76b32))

## [0.1.1](https://github.com/AscaL/neko-vue/compare/v0.1.0...v0.1.1) (2026-04-04)

## [0.1.0] - 2026-04-04

### Added

- **Public API:** `useNeko`, `NekoPet`, `loadNekoRuntime`, placement helpers (`startCorner`, `anchorRef` / `anchorSelector`), and types (`BehaviorMode`, `DEFAULT_NEKO_BEHAVIOR_CYCLE`, etc.).
- **Bundled neko engine** (dynamic import chunk); `cursorStandoffPx`, `behaviorCycle`, `restUntilFirstPetInteraction`, `respectReducedMotion`, `mode` (`follow` / `rest`), and debug logging.
- **Export subpaths** (conditional `types` + `import`): `neko-vue/types`, `neko-vue/placement`, `neko-vue/runtime`, `neko-vue/vue` — for intent-specific imports alongside the root `neko-vue` barrel.
- **`engines.node`:** `>=24.0.0` (Active LTS).

[0.1.0]: https://github.com/AscaL/neko-vue/releases/tag/v0.1.0
