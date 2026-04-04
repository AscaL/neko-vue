# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [0.1.1](https://github.com/AscaL/neko-vue/compare/v0.1.0...v0.1.1) (2026-04-04)

## [0.1.0] - 2026-04-04

### Added

- **Public API:** `useNeko`, `NekoPet`, `loadNekoRuntime`, placement helpers (`startCorner`, `anchorRef` / `anchorSelector`), and types (`BehaviorMode`, `DEFAULT_NEKO_BEHAVIOR_CYCLE`, etc.).
- **Bundled neko engine** (dynamic import chunk); `cursorStandoffPx`, `behaviorCycle`, `restUntilFirstPetInteraction`, `respectReducedMotion`, `mode` (`follow` / `rest`), and debug logging.
- **Export subpaths** (conditional `types` + `import`): `neko-vue/types`, `neko-vue/placement`, `neko-vue/runtime`, `neko-vue/vue` — for intent-specific imports alongside the root `neko-vue` barrel.
- **`engines.node`:** `>=24.0.0` (Active LTS).

[0.1.0]: https://github.com/AscaL/neko-vue/releases/tag/v0.1.0
