# neko-vue — plan

**What this is:** Vue 3 wrapper around a typed port of the [nekojs](https://github.com/louisabraham/nekojs) pet (see README **Credits**; third-party runtime → **`LICENSE`**).

**Tooling:** Vite+ — `vp pack`, `vp check`, `vp test`. CI runs all three on `main`.

**Docs:** README states **bundled engine only** (no remote `createNeko` URL / no `<script src>` loader). `LoadNekoRuntimeOptions` is **`timeoutMs`** only (bundled import timeout). Optional **`window.createNeko`** before load is for tests / advanced setups.

---

## Shipped today

- **API:** `useNeko`, `NekoPet` (`defineComponent` in `src/vue/`, not an SFC), `loadNekoRuntime`, placement helpers, types (`BehaviorMode`, **`DEFAULT_NEKO_BEHAVIOR_CYCLE`**), optional **`cursorStandoffPx`**, optional ordered **`behaviorCycle`** for pet-click mode rotation, `prefersReducedMotion` / debug logging.
- **Package exports:** root **`neko-vue`** plus subpaths **`/types`**, **`/placement`**, **`/runtime`**, **`/vue`** (conditional `types` + `import`; `pack.exports: false` so `vp pack` does not overwrite `package.json`).
- **`NekoPet`:** `expose({ instance })` — template `ref` yields the same `NekoInstance | null` handle as `useNeko`’s `instance`.
- **Runtime:** `src/runtime/nekojsRuntime.ts` + sprites; **only** bundled chunk (dynamic import). No `scriptUrl`, no injected script tags. `Neko.destroy()` tears down interval + `AbortController` listeners.
- **Placement:** `startCorner`, `startX`/`startY`, `anchorRef` / `anchorSelector` (deferred until layout), `ResizeObserver` when anchored; `mode` `follow` | `rest` (recreate when placement-affecting options change).
- **Behavior:** `behaviorMode` in options is **initial** + pet-gate wake; **clicks on the cat** cycle the live engine mode (not reactive prop churn). Default cycle is seven modes (see **`DEFAULT_NEKO_BEHAVIOR_CYCLE`**); **`behaviorCycle`** overrides order and membership.
- **Playground:** `playground/` — routes **`/`**, **`/composable`**, **`/customize`** (options sandbox); one pet at a time; **`PlaygroundLiveStats.vue`** + **`useNekoHud.ts`**.
- **Tests:** happy-dom; `loadNekoRuntime`, `useNeko`, `NekoPet`, anchor/ResizeObserver, reduced motion, payloads, pet gate (mocks set `window.createNeko`).

---

## Constraints (unchanged)

- Pet is **viewport-fixed** (not a child of your component’s layout tree). “Attach” = lifecycle + feeding `startX`/`startY` / corner / anchor — **not** a true DOM parent for the engine without forking upstream.

---

## Backlog (prioritized)

| Priority | Item                                                                                                                  |
| -------- | --------------------------------------------------------------------------------------------------------------------- |
| **P0**   | **Publish:** `neko-vue` **0.1.0** — `vp pack`, `npm publish` / dry-run, git tag **`v0.1.0`**, GitHub release.         |
| **P1**   | ~~**`exports` subpaths**~~ **Done** (ships in **0.1.0**): `neko-vue/types`, `/placement`, `/runtime`, `/vue`.         |
| **P2**   | **Nuxt module** — separate package/repo, not this tree.                                                               |
| **P2**   | **Optional `attach(...)`-style API** on `useNeko` if you want an explicit hook instead of only options + `anchorRef`. |
| **P3**   | **Tests:** stronger coverage for edge cases (e.g. `clientWidth === 0` first paint) if bugs show up in the wild.       |
| **P3**   | **Optional validation** (Zod/Valibot) for public options — product call.                                              |

**Open nits:** Vue peer already `^3.4 || ^3.5`; stricter 3.5-only is a policy choice, not code.

---

_Update when scope or release status changes._
