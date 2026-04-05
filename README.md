# neko-vue

Vue 3 integration for a **viewport-fixed** desktop pet: **`NekoPet`**, **`useNeko()`**, **`loadNekoRuntime()`**, and types aligned with **`createNeko`**. The engine ships **only** inside this package (bundler **dynamic `import`** chunk in `dist/`). No supported remote URL or `<script src>` loader; tests may set **`globalThis.createNeko`** first.

**Requirements:** `vue` ^3.4 or ^3.5 ([`peerDependencies`](./package.json)). **Node.js** **24+** for local tooling ([`engines`](./package.json)).

---

## Installation

`npm install neko-vue` (or pnpm / yarn / bun). If the app has no Vue yet: `npm install neko-vue vue`.

---

## Usage

### Example apps

The **playground** is the canonical integration reference:

| Route | File | Purpose |
| ----- | ---- | ------- |
| `/` | [`playground/src/DemoNekoPet.vue`](./playground/src/DemoNekoPet.vue) | `<NekoPet />`, exposed `instance`, HUD via [`useNekoHud.ts`](./playground/src/useNekoHud.ts) |
| `/composable` | [`playground/src/DemoUseNekoAnchor.vue`](./playground/src/DemoUseNekoAnchor.vue) | `useNeko` + `anchorRef` / `useTemplateRef`, flags panel |
| `/customize` | [`playground/src/DemoCustomize.vue`](./playground/src/DemoCustomize.vue) | Sandbox: placement, `behaviorCycle`, `cursorStandoffPx`, **Apply** |

Routing: [`playground/src/router.ts`](./playground/src/router.ts). Shell UI: [`playground/src/App.vue`](./playground/src/App.vue), [`playground/src/PlaygroundLiveStats.vue`](./playground/src/PlaygroundLiveStats.vue).

### `NekoPet` vs `useNeko`

| | Use when |
| --- | --- |
| **`NekoPet`** | Props only; anchor via **`anchor-selector`** (CSS string). |
| **`useNeko`** | **`anchorRef`**, **`instance` / `isReady` / `error`**, **`setMode`**, **`destroy`**, **`petInteractionAwake`**, or options from **`computed()`**. |

`NekoPet` forwards props into `useNeko` ([`src/vue/NekoPet.ts`](./src/vue/NekoPet.ts)); core logic: [`src/vue/useNeko.ts`](./src/vue/useNeko.ts).

**Imports:** `import { NekoPet, useNeko, … } from "neko-vue"`. In templates, multi-word props use **kebab-case** (`start-corner`, `behavior-mode`, `behavior-cycle`, `cursor-standoff-px`, `anchor-selector`, `respect-reduced-motion`, `rest-until-first-pet-interaction`, …).

---

## How it works

- **Pet is not in your DOM tree** — it is fixed to the viewport; “placement” is **`startX` / `startY`**, **`startCorner`**, **`anchorRef`** / **`anchorSelector`** (see [`src/placement/nekoPlacement.ts`](./src/placement/nekoPlacement.ts)).
- **Per axis:** explicit coord → anchor top-left → corner → `0`. **`0`** is valid. Corner math uses **`NEKOJS_SPRITE_SIZE` (32)**.
- **Anchor gate:** `createNeko` waits until the element exists and has **non-zero** size. **`ResizeObserver`** runs in **`useNeko`** only when **`anchorRef`** is set—not for **`anchorSelector`** alone.
- **`mode`:** **`follow`** (loop on) vs **`rest`** (stop at resolved home after create). Imperative: **`setMode`**, **`restAtOrigin`**, **`resumeFollow`**, or reactive **`mode`** in options. Changing placement-related options **recreates** the instance (no teleport API).
- **`behaviorMode`:** **Initial** create (+ special cases leaving the first-click gate); **live** mode advances by **clicking the cat** (if **`allowBehaviorChange`**). On recreate, the **previous engine mode** is kept unless leaving that gate (`applyBehaviorModeForRecreate` in [`src/vue/useNeko.ts`](./src/vue/useNeko.ts)). Enum **`BehaviorMode`** (ids **0…6** in the engine), **`BEHAVIOR_MODES_IN_ORDER`**, **`DEFAULT_NEKO_BEHAVIOR_CYCLE`**, **`BehaviorCycle`**, **`isBehaviorMode`** — [`src/types/index.ts`](./src/types/index.ts). **Readable strings (HUD / logs / hovers):** **`formatBehaviorMode`**, **`behaviorModeEnumName`**, **`BEHAVIOR_MODE_LABELS`**. **Stable cycle typing** (avoid inferred `0 \| 2 \| 1` unions): **`behaviorCycleOf(BehaviorMode.ChaseMouse, …)`**. **`NekoPet`** is cast to **`DefineComponent<NekoPetPublicProps>`** so Volar shows **`BehaviorMode`** on props, not plain `number`. Custom click order: **`behaviorCycle`**; invalid ids stripped in [`normalizeBehaviorCycle`](./src/runtime/nekojsRuntime.ts).
- **`allowBehaviorChange`:** On `NekoPet`, default **`undefined`** so the field is omitted and the engine default **`true`** applies (see props table below).
- **`restUntilFirstPetInteraction`:** First pointer-down wakes **`follow`** without consuming the first cycle step; then normal cycle. **`petInteractionAwake`** tracks this.
- **Reduced motion:** Default **skip** load + create; **`skippedForReducedMotion`**. Opt out: **`respectReducedMotion: false`** (use with care). Helper: **`prefersReducedMotion()`** ([`src/utils/prefersReducedMotion.ts`](./src/utils/prefersReducedMotion.ts)).
- **SSR:** Never run **`loadNekoRuntime`**, **`useNeko`**, or mount **`NekoPet`** on the server. **Nuxt 4:** [`.client.vue` + `#components` / auto-import](https://nuxt.com/docs/4.x/guide/directory-structure/components#client-components) and/or [`<ClientOnly>`](https://nuxt.com/docs/4.x/api/components/client-only).

---

## API reference

### `NekoPet` props

`defineComponent` in [`src/vue/NekoPet.ts`](./src/vue/NekoPet.ts). Exposes **`instance`** (**`shallowRef`**, unwrapped on parent component ref like **`useNeko`’s `instance`**).

| Script | Template | Default | Notes |
| ------ | -------- | ------- | ----- |
| `speed` | `speed` | omit → **24** | Logic tick step; ~5 ticks/s in engine. |
| `fps` | `fps` | omit → **120** | Animation interval. |
| `behaviorMode` | `behavior-mode` | omit | Initial only; clicks change live mode. |
| `idleThreshold` | `idle-threshold` | omit → **6** | Idle distance (px). |
| `cursorStandoffPx` | `cursor-standoff-px` | omit / 0 | Chase: min distance from pointer. |
| `allowBehaviorChange` | `allow-behavior-change` | **`undefined`** | `undefined` → engine default **true**; `false` disables click cycle. |
| `behaviorCycle` | `behavior-cycle` | omit | → **`DEFAULT_NEKO_BEHAVIOR_CYCLE`**. |
| `startX` / `startY` | `start-x` / `start-y` | omit | Home coords; **0** valid. |
| `autoStart` | `auto-start` | **true** | Loop after create unless **`rest`** or **false**. |
| `respectReducedMotion` | `respect-reduced-motion` | **true** | Skip when user prefers reduced motion. |
| `startCorner` | `start-corner` | omit | `top-left` … `bottom-right` for missing axes. |
| `anchorSelector` | `anchor-selector` | omit | `querySelector`; prefer **`anchorRef`** in **`useNeko`**. |
| `mode` | `mode` | **follow** | `follow` \| `rest`. |
| `restUntilFirstPetInteraction` | `rest-until-first-pet-interaction` | **`undefined`** | First click wakes follow. |
| `debug` | `debug` | **false** | **`[neko-vue]`** placement / recreate logs. |

**Option groups:** Engine — `speed`, `fps`, `behaviorMode`, `idleThreshold`, `cursorStandoffPx`, `behaviorCycle`, `allowBehaviorChange`, `startX`/`startY`. Placement — `startCorner`, `anchorRef` (composable) / `anchorSelector` (component). Loop — `mode`, `autoStart`, `respectReducedMotion`, `restUntilFirstPetInteraction`. Most engine/placement changes **recreate**; **`behaviorMode`** in options does not drive recreate except first create / gate exit.

### `useNeko()` return value

| Name | Type / role |
| ---- | ----------- |
| `instance` | `ShallowRef<NekoInstance \| null>` |
| `error` | `Ref<Error \| null>` |
| `isReady` | `Ref<boolean>` |
| `skippedForReducedMotion` | `Ref<boolean>` |
| `mode` | Readonly ref `follow` \| `rest` |
| `petInteractionAwake` | Readonly ref (with **`restUntilFirstPetInteraction`**) |
| `setMode`, `restAtOrigin`, `resumeFollow`, `destroy` | Imperative |

### `loadNekoRuntime()`

[`src/runtime/loadNekoRuntime.ts`](./src/runtime/loadNekoRuntime.ts): **`Promise<CreateNekoFn>`**; browser uses existing **`globalThis.createNeko`** or one **shared** bundled import; non-browser **rejects**. Options: **`LoadNekoRuntimeOptions`** — **`timeoutMs`** only ([`src/types/index.ts`](./src/types/index.ts)).

### Package exports (subpaths)

[`package.json` `exports`](./package.json) + pack entries [`src/entries/*.ts`](./src/entries/) ([`vite.config.ts`](./vite.config.ts) **`pack.entry`**, **`pack.exports: false`**).

| Import | Exposes |
| ------ | ------- |
| `neko-vue` | Full API ([`src/index.ts`](./src/index.ts)) |
| `neko-vue/types` | Same as root type exports: behavior helpers **`formatBehaviorMode`**, **`behaviorModeEnumName`**, **`BEHAVIOR_MODE_LABELS`**, **`behaviorCycleOf`**, plus `BehaviorMode`, `BehaviorCycle`, etc. — no Vue |
| `neko-vue/placement` | `cornerToStartXY`, `resolveStartPosition`, corners / input types |
| `neko-vue/runtime` | `loadNekoRuntime` only |
| `neko-vue/vue` | `useNeko`, `NekoPet`, **`NekoPetPublicProps`** (typed props for Volar), option types |

---

## Troubleshooting

- **Nothing draws:** Confirm the runtime **chunk** loads (Network). Check console.
- **Skipped pet:** **`prefers-reduced-motion: reduce`** — intentional unless you set **`respectReducedMotion: false`** (with consent).
- **Wrong corner on first paint:** Viewport **`clientWidth` / `innerHeight`** can be **0** briefly; **`debug: true`** logs resolved coords.
- **Listeners / timers:** Unmount should call **`stop`** + **`destroy`**; engine uses **`AbortController`** ([`src/runtime/nekojsRuntime.ts`](./src/runtime/nekojsRuntime.ts)).

---

## Technical notes

Classic “one-file” neko demos often use a **GIF** or scalable strip. This engine uses **fixed 32×32** cells—use **`NEKOJS_SPRITE_SIZE`** for layout math. **HMR** in dev can briefly duplicate pets; **full refresh** fixes it. The runtime loads via a **single shared** dynamic import (separate bundler chunk); no alternate script URL at runtime.

---

## Development

- **Layout:** `src/types`, `src/runtime`, `src/vue`, `src/placement`, `src/utils`, `src/entries` (subpath barrels), root [`src/index.ts`](./src/index.ts).
- **Playground:** run / HMR / port **5175** — [`playground/README.md`](./playground/README.md).
- **Scripts:** [`package.json`](./package.json) — `vp test`; `vp run check` & `vp run check:playground` (or `bun run check:all`); `vp pack`; `bun run playground:dev`. Do **not** run bare **`vp check`** on the whole tree (playground would resolve wrong `node_modules`).
- **CI:** [`.github/workflows/ci.yml`](./.github/workflows/ci.yml).
- **Local tarball:** `vp pack` then `npm pack`; install the `.tgz` (name matches **`version`** in `package.json`) or use `file:` on a folder with built `dist/`.

---

## License

Wrapper and tooling in this repository: [MIT License](./LICENSE) — use freely, including commercially, subject to the notice requirement in the license text.

The **bundled pet runtime** in `dist/` is **third-party** code (nekojs lineage) under **GNU GPLv3**; see **`LICENSE`** and [Acknowledgments](#acknowledgments).

---

## Acknowledgments

This package is **Vue 3 integration and tooling** around existing Neko-style ideas and code; it does not claim to have invented the pet engine.

- **[nekojs](https://github.com/louisabraham/nekojs)** (Louis Abraham) — JavaScript Neko for the web (`createNeko`, sprites, behavior). The bundled runtime in `dist/` follows this project and is licensed under **GPLv3** (see [`LICENSE`](./LICENSE)).
- **[neko-ts](https://github.com/ABSanthosh/neko-ts)** — TypeScript implementation ([`Neko.ts`](https://github.com/ABSanthosh/neko-ts/blob/master/src/Neko.ts)) that informed how a typed, component-friendly layer could be shaped.
