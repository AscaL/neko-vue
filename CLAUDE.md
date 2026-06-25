@AGENTS.md

# neko-vue

Published Vue 3 **library** (`neko-vue` on npm) — a viewport-fixed Neko-style desktop pet. Ships the
pet engine inside the package via dynamic import. Built and tested with **Vite+ (`vp`)**; see the
imported `@AGENTS.md` for the full `vp` toolchain and its pitfalls.

## Commands

This is a library — `build` means `vp pack`, not a dev server.

```bash
vp install            # deps (bun is the underlying pm; packageManager pin)
bun run dev           # vp pack --watch (rebuild the lib on change)
bun run check         # format + lint + typecheck — run before claiming done
bun run check:all     # check src AND playground
bun run test          # vp test (Vitest via Vite+)
bun run build         # vp pack — production library build
bun run playground:dev # run the demo app in playground/
```

Validate every change with **`bun run check` and `bun run test`**.

## Hard rules (library constraints)

- **Public API is the `exports` map in `package.json`** (`.`, `./types`, `./placement`, `./runtime`, `./vue`). Entry points live in `src/entries/`. Changing or removing an export is a **breaking change** — bump major and update `CHANGELOG.md`.
- **`vue` is a peer dependency** (`^3.4 || ^3.5`), never a regular dependency. Don't import anything that would bundle Vue into `dist`.
- The pet engine is **dynamically imported** (`loadNekoRuntime`) so it's not in the main bundle — keep it lazy; don't add a static import of the runtime from the entry.
- `sideEffects: false` — keep modules side-effect free so tree-shaking works.
- Import test/build utilities from `vite-plus` (e.g. `vite-plus/test`), **not** from `vite`/`vitest` directly (see `@AGENTS.md`).
- Conventional Commits (commitlint on commit-msg). Release via `bun run release` (commit-and-tag-version).

## Layout

- `src/entries/` — public entry points (one per `exports` key)
- `src/runtime/` — the lazily-loaded pet engine (movement, sprites, viewport)
- `src/vue/` — `NekoPet` component + `useNeko` composable
- `src/placement/`, `src/utils/`, `src/types/` — placement math, helpers, shared types
- `tests/` — Vitest specs (happy-dom)
- `playground/` — local demo app (its own deps/check scripts)

## Gotchas

- Respect `prefersReducedMotion` (`src/utils/`) — the pet must not animate when the user opts out.
- After editing `exports`/entries, run `bun run build` and confirm `dist/` emits matching `.mjs` + `.d.mts` for each entry.
