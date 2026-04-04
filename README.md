# neko-vue

Vue 3 helpers for a classic viewport-fixed desktop pet: typed options, `loadNekoRuntime()`, `useNeko()`, and `NekoPet`. The default path uses programmatic `createNeko` only (no `data-autostart`).

The pet **engine always comes from this package** (a dynamically imported chunk in `dist/`). There is **no** supported option to load `createNeko` from a remote URL or a separate script tag—only the bundled runtime, unless you assign **`globalThis.createNeko`** yourself first (in browsers usually **`window.createNeko`**; advanced / tests).

**Peer dependency:** `vue` ^3.4 or ^3.5.

**Runtime:** Node.js **24+** (Active LTS line; see `engines` in `package.json`).

## What this package offers

| Capability              | Details                                                                                                                                                                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Typed engine API**    | `NekoOptions`, `NekoInstance`, `BehaviorMode`, `BehaviorModes`, `DEFAULT_NEKO_BEHAVIOR_CYCLE`, `NEKOJS_SPRITE_SIZE` — aligned with **`createNeko`**.                                                                                                |
| **Bundled runtime**     | Engine lives in **`dist/`** as a separate chunk; your bundler loads it via **dynamic `import`** (no extra HTTP URL in this API). Same chunk **`loadNekoRuntime()`** / **`useNeko`** pull in.                                                         |
| **`<NekoPet />`**       | Declarative wrapper: placement (**`start-corner`**, **`anchor-selector`**), **`mode`** (`follow` / `rest`), engine tuning (**`speed`**, **`fps`**, **`behavior-mode`**, **`behavior-cycle`**, **`cursor-standoff-px`**, …), motion gate, **`debug`**. |
| **`useNeko()`**         | Same options as **`NekoPet`** plus **`anchorRef`**; returns **`instance`**, **`isReady`**, **`error`**, **`skippedForReducedMotion`**, **`mode`**, **`petInteractionAwake`**, **`setMode`**, **`destroy`**, etc. Calls **`loadNekoRuntime()`** internally. |
| **`loadNekoRuntime()`** | Returns **`Promise<CreateNekoFn>`** — the typed **`createNeko`** factory. **Browser:** if **`globalThis.createNeko`** already exists (tests / custom setup), resolves to that; else **one shared promise** dynamic-imports the bundled runtime once. **Not in browser (e.g. SSR):** rejects immediately with a clear error (do not call on the server). |
| **Placement helpers**   | **`NekoStartCorner`**, **`NekoPlacementInput`**, **`cornerToStartXY`**, **`resolveStartPosition`** — corner / anchor → **`startX`** / **`startY`**. In **`useNeko`**, a **`ResizeObserver`** is attached only when **`anchorRef`** is set (not for **`anchorSelector`** alone). |
| **Motion & a11y**       | `prefersReducedMotion()`; composable and component skip the pet when user prefers reduced motion (with opt-out on `NekoPet`).                                                                                                                       |
| **Lifecycle**           | Unmount → `stop()` + `destroy()`; bundled runtime removes listeners via **`AbortController`**.                                                                                                                                                      |
| **Debug**               | `nekoVueDebug()` for optional placement / recreate logging.                                                                                                                                                                                         |

## Source layout (this repo)

Library code under **`src/`** is grouped by role. **`vite.config.ts`** **`pack.entry`** maps **`src/index.ts`** plus **`src/entries/*.ts`** to published **`dist/*.mjs`**; **`pack.exports: false`** leaves **`package.json` `exports`** as the source of truth (see [Subpath imports](#subpath-imports)).

| Folder               | Role                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`src/types/`**     | Shared TypeScript types and constants (`NekoOptions`, `BehaviorMode`, `DEFAULT_NEKO_BEHAVIOR_CYCLE`, `LoadNekoRuntimeOptions`, `Window` augmentation). |
| **`src/runtime/`**   | Engine: `nekojsRuntime.ts`, `nekoSpritesData.ts`, `loadNekoRuntime.ts`.                                                                                |
| **`src/vue/`**       | `useNeko.ts`, `NekoPet.ts` (`defineComponent`, not an SFC).                                                                                            |
| **`src/placement/`** | Corner / anchor → `startX` / `startY` resolution.                                                                                                      |
| **`src/utils/`**     | `prefersReducedMotion`, `nekoVueDebug`.                                                                                                                |
| **`src/entries/`**   | Thin barrels for **`neko-vue/types`**, **`/placement`**, **`/runtime`**, **`/vue`** (see **`vite.config.ts`** **`pack.entry`**).                         |
| **`src/index.ts`**   | Root public re-exports (full API).                                                                                                                     |
| **`src/env.d.ts`**   | Vite / client typings.                                                                                                                                 |

## Install

**Vue is a peer dependency** — `neko-vue` does not ship its own copy of Vue (that would risk two Vue runtimes in one app). In a normal Vue 3 app you already have **`vue`** in `package.json`, so add only this package:

```bash
npm install neko-vue
```

Same idea with **pnpm**, **Yarn**, or **Bun** (for example `pnpm add neko-vue`). Your app must satisfy **`vue` ^3.4 or ^3.5** (see `peerDependencies` in `package.json`); npm will warn if it’s missing.

**Greenfield / no Vue yet** — install both once:

```bash
npm install neko-vue vue
```

### Subpath imports

Besides the root entry (`neko-vue`), published builds expose **conditional exports** (`types` + `import`) for smaller, intent-specific entry edges:

| Import path              | Contents                                                                                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`neko-vue`**           | Full public API (root barrel).                                                                                                                                                     |
| **`neko-vue/types`**     | `BehaviorMode`, `BehaviorModes`, `DEFAULT_NEKO_BEHAVIOR_CYCLE`, `NEKOJS_SPRITE_SIZE`, `NekoOptions`, `NekoInstance`, `CreateNekoFn`, `LoadNekoRuntimeOptions` — no Vue, no loader. |
| **`neko-vue/placement`** | `cornerToStartXY`, `resolveStartPosition`, `NekoStartCorner`, `NekoPlacementInput` — no Vue.                                                                                       |
| **`neko-vue/runtime`**   | `loadNekoRuntime` only — pulls the bundled engine chunk when called.                                                                                                               |
| **`neko-vue/vue`**       | `useNeko`, `NekoPet`, `UseNekoOptions`, `NekoFollowMode` — **requires Vue**; still loads the engine when you create a pet.                                                         |

Your bundler decides how much code stays in the bundle; these subpaths make dependencies explicit and avoid importing the root barrel when you only need types or placement helpers.

## Practical usage guide

Use this section as the default path for integrating the pet. Deeper API notes follow under [Using in your project](#using-in-your-project).

### 1. Minimal setup (SPA)

The engine ships inside **`neko-vue`** (Vite/your bundler pulls a small runtime chunk). You do not add a CDN `<script>` for the pet. Mount **`NekoPet`** only in the browser (typical Vite/Vue SPA entry is already client-only):

```vue
<script setup lang="ts">
import { NekoPet } from "neko-vue";
</script>

<template>
  <NekoPet start-corner="bottom-right" />
</template>
```

In templates, use **kebab-case** for multi-word props (for example `start-corner`, `behavior-mode`, `behavior-cycle`, `cursor-standoff-px`, `anchor-selector`, `respect-reduced-motion`, `rest-until-first-pet-interaction`).

### 2. Choose `<NekoPet>` or `useNeko()`

| Use               | When                                                                                                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`<NekoPet />`** | You are happy with props and do not need a handle from `setup`. Anchoring to another element is limited to **`anchor-selector`** (a CSS selector string).                                |
| **`useNeko()`**   | You need **`anchorRef`** (template ref), **`instance` / `isReady` / `error`**, **`setMode`**, **`destroy`**, **`petInteractionAwake`**, or you want options built from **`computed()`**. |

`NekoPet` forwards props into `useNeko` internally; behavior is the same for shared options.

### 3. Start position (corner, coordinates, anchor)

- **Corner only:** `start-corner="bottom-right"` (also `top-left`, `top-right`, `bottom-left`). The pet snaps to that corner of the viewport minus the **32×32** sprite (`NEKOJS_SPRITE_SIZE`).
- **Mix corner + axis:** Set **`start-x`** or **`start-y`** for one axis and **`start-corner`** for the other; **`0`** is a valid coordinate.
- **Anchor to a DOM node:** In **`useNeko`**, pass **`anchorRef: useTemplateRef('box')`** (Vue 3.5+) or a plain **`ref`** to the element whose **top-left** should seed `startX`/`startY`. With **`NekoPet`**, pass **`anchor-selector`**. Creation waits until the element exists and has **non-zero** width and height.

Resolution per axis: **explicit `start-x` / `start-y` → anchor → corner → 0**.

### 4. `mode`: follow vs rest

- **`mode="follow"`** (default): chase and run behaviors; animation loop runs.
- **`mode="rest"`:** Pet stays at the **home** position (resolved once from placement options). The wrapper stops the loop after each `createNeko`.

Toggling placement-affecting options or `mode` may **destroy and recreate** the instance (there is no “teleport to x,y” on the live instance).

With **`useNeko`**, you can also call **`setMode('rest' | 'follow')`**, **`restAtOrigin()`**, or **`resumeFollow()`**, or bind a reactive **`mode`** inside **`computed(() => ({ … }))`** options.

### 5. Behavior modes (`BehaviorMode` enum)

**`behavior-mode`** / **`behaviorMode`** set the AI mode only for the **first** `createNeko` (and when the wrapper recreates for placement / `mode`, the **current** engine mode is kept — not this prop). Prefer the enum instead of raw numbers:

```ts
import { BehaviorMode } from "neko-vue";
// ChaseMouse, RunAwayFromMouse, RunAroundRandomly, PaceAroundScreen, BallChase, StayStill, ReturnHomeAndStay
```

After that, **only clicks on the pet** advance behavior (when **`allow-behavior-change`** is true, default when the prop is omitted on `NekoPet`). Default cycle order matches **`DEFAULT_NEKO_BEHAVIOR_CYCLE`**:
**chase → run away → random → pace → ball chase → stay still → return home & stay** → chase.

Set **`behaviorCycle`** in `useNeko` / `createNeko` or **`behavior-cycle`** on **`NekoPet`** to an ordered array of **`BehaviorMode`** values to replace that list (order = click order, wrapping after the last). Omitted or invalid-only arrays keep the default cycle. If the live mode is not in your list, the next click moves to the **first** entry (because `indexOf` is `-1`).

**Stay still** freezes the cat where it is. **Return home & stay** walks back to the spawn from `createNeko` (`startX` / `startY`), then holds there until the next click.

If you pass options as a **`computed(() => ({ … }))`** that closes over `behaviorMode`, changing that ref still **re-evaluates** the computed and can re-run the wrapper’s watcher — prefer a **`reactive`** options object (or keep `behaviorMode` outside the reactive object you pass to `useNeko`) if you mutate `behaviorMode` for other reasons without wanting a full reload.

### 6. Reduced motion

If the user prefers reduced motion, **`NekoPet`** and **`useNeko`** **skip** loading and creating the pet by default. From **`useNeko`**, check **`skippedForReducedMotion`**. To run anyway (only after your own consent UI), set **`:respect-reduced-motion="false"`** or **`respectReducedMotion: false`**.

### 7. SSR (Nuxt, custom SSR)

Never call **`useNeko`**, render **`NekoPet`**, or **`loadNekoRuntime`** on the server. Use a **`.client.vue`** component or **`<ClientOnly>`** (see [Nuxt 4](#4-nuxt-4) below).

### 8. When something looks wrong

Enable **`debug`** (`:debug="true"` on `NekoPet` or **`debug: true`** in `useNeko` options) for **`[neko-vue]`** logs (viewport, anchor rect, resolved coordinates, recreates). See [Troubleshooting](#6-troubleshooting).

---

## Using in your project

Start with the [Practical usage guide](#practical-usage-guide) above; the subsections here add framework-specific notes and reference detail.

### Requirements

- **Vue 3** (`^3.4` or `^3.5`) as a dependency; `neko-vue` lists Vue as a **peer dependency**.
- A **browser** environment on the code path that runs the pet. Do **not** call `useNeko`, `NekoPet`, or `loadNekoRuntime` during SSR without guarding for client-only execution (see Nuxt below).

### 1. Install and import

After installing, import the **component** and/or **composable** from the package name:

```ts
import { NekoPet, useNeko } from "neko-vue";
```

TypeScript picks up types from the published `dist` typings; no extra `@types` package is needed.

### 2. Choose how you integrate

| Approach                | When to use                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`<NekoPet />`**       | You want declarative props (`speed`, `start-corner`, `mode`, …) and minimal setup code.                                                                 |
| **`useNeko()`**         | You need a **handle** (`setMode`, `destroy`, refs to `instance` / `isReady` / `error`) or **`anchorRef`** to tie the start position to another element. |
| **`loadNekoRuntime()`** | Advanced: ensure a typed **`createNeko`** after the bundled runtime is loaded, or reuse an existing **`globalThis.createNeko`** (e.g. tests).            |

By default, **`loadNekoRuntime()`** loads the **bundled** engine (dynamic import, no extra network hop for the pet). If **`globalThis.createNeko`** is already a function when the loader runs, that implementation is used instead (typical in **tests** or custom setups).

### 3. Vite, Vue CLI, or a plain SPA

1. Install **`neko-vue`** (and **`vue`** if the project does not already depend on it).
2. Use **`NekoPet`** in any component that only runs on the client (typical SPA entry is client-only already):

```vue
<script setup lang="ts">
import { NekoPet } from "neko-vue";
</script>

<template>
  <NekoPet start-corner="bottom-right" />
</template>
```

3. If you prefer the composable, call **`useNeko()` inside `setup()`** (or `<script setup>`) — see the [Composable](#composable) section.

### 4. Nuxt 4

These notes match **[Nuxt 4](https://nuxt.com/)** (Vue 3). The pet is **browser-only**; keep it off the server render path.

1. **Install:** add **`neko-vue`** with your package manager (`npm install neko-vue`, `pnpm add neko-vue`, …). You do **not** need a Nuxt module for this library. Nuxt already depends on **Vue 3**.

2. **Client-only rendering** (pick one):
   - Put the pet in a component named **`*.client.vue`** under **`components/`**, or
   - Wrap it with **[`<ClientOnly>`](https://nuxt.com/docs/4.x/api/components/client-only)**.

For **`.client.vue`**, Nuxt only treats the file as client-only when you use **[auto-imports](https://nuxt.com/docs/4.x/guide/directory-structure/components#client-components)** or import from **`#components`**. Importing the file by **filesystem path** (e.g. `~/components/Foo.client.vue`) does **not** apply the client-only transform—use **`import { NekoPetClient } from '#components'`** or drop the import and use the auto-registered name.

```vue
<!-- components/NekoPetClient.client.vue -->
<script setup lang="ts">
import { NekoPet } from "neko-vue";
</script>

<template>
  <NekoPet start-corner="bottom-right" />
</template>
```

```vue
<!-- e.g. app/pages/index.vue (Nuxt 4 default `app/` layout) or pages/index.vue if you use a classic root `pages/` dir -->
<script setup lang="ts">
import { NekoPetClient } from "#components";
</script>

<template>
  <div>
    <ClientOnly>
      <NekoPetClient />
    </ClientOnly>
  </div>
</template>
```

Alternatively, omit the script import and use **`<NekoPetClient />`** if the file **`components/NekoPetClient.client.vue`** is picked up by Nuxt’s component scanner.

### 5. Global registration (optional)

If you want `NekoPet` everywhere without importing:

```ts
import { createApp } from "vue";
import { NekoPet } from "neko-vue";
import App from "./App.vue";

const app = createApp(App);
app.component("NekoPet", NekoPet);
app.mount("#app");
```

### 6. Troubleshooting

- **Nothing appears:** Open devtools → **Network** and confirm the library’s **runtime chunk** loads (status 200). Check **Console** for errors.
- **Reduced motion:** By default the pet is skipped when `prefers-reduced-motion: reduce` is set. Use **`respectReducedMotion: false`** (composable) or **`:respect-reduced-motion="false"`** (`NekoPet`) only if you intentionally override accessibility preferences.
- **Wrong start position on first paint:** Ensure the layout has non-zero width/height before the pet mounts; use **`startCorner`** / delayed mount, or **`anchorRef`** after the anchor element exists. If **`document.documentElement.clientWidth`** or **`window.innerHeight`** is **0** on the first recreate, corner math yields **`(0,0)`** until a later flush — check the console with **`debug: true`** (composable option or **`debug`** prop on **`NekoPet`**).
- **Debugging placement:** Set **`debug: true`** on **`useNeko` options** or **`:debug="true"`** on **`NekoPet`**. Logs are prefixed with **`[neko-vue]`** (viewport size, anchor rect, resolved `startX`/`startY`, and each recreate).

### 7. Composable + component mental model

| Idea                                        | In **neko-vue**                                                                        |
| ------------------------------------------- | -------------------------------------------------------------------------------------- |
| Core logic in a **composable**              | `useNeko(options)`                                                                     |
| Optional **declarative wrapper**            | `<NekoPet>` (props mirror composable options)                                          |
| Pass a **template ref** into the composable | `anchorRef: useTemplateRef('anchor')` (Vue 3.5+), or a plain `ref` on Vue 3.4          |
| Avoid **`window` / DOM during SSR**         | Do not mount the pet on the server; use **`.client.vue`** / `<ClientOnly>` (see above) |
| Toggle behavior with a **small ref**        | `mode` (`follow` / `rest`) or `respectReducedMotion`                                   |

**Vue 3.5+:** Prefer [`useTemplateRef`](https://vuejs.org/api/composition-api-helpers.html#usetemplateref) for elements you pass to **`anchorRef`**. On **Vue 3.4**, use `const anchor = ref<HTMLElement | null>(null)` and `ref="anchor"` on the element.

Pass **reactive options** with `computed(() => ({ …, mode: mode.value, anchorRef: anchor }))` when values like `mode` should update the pet without remounting the whole parent manually.

The sections below document **props**, **placement**, **`mode`**, and **advanced** APIs in more detail.

To **develop and test this library** (not only consume it), see [Test this repo locally](#test-this-repo-locally) under **Development**.

---

## Component

```vue
<script setup lang="ts">
import { BehaviorMode, NekoPet } from "neko-vue";
</script>

<template>
  <NekoPet
    :speed="24"
    :behavior-mode="BehaviorMode.ChaseMouse"
    start-corner="top-right"
    mode="rest"
  />
</template>
```

`NekoPet` is implemented as `defineComponent` (TypeScript) for reliable library builds; use it like any other Vue component. It **exposes** `{ instance }` (**`shallowRef<NekoInstance | null>`** from the internal **`useNeko`**). On the parent **`ref`**, Vue **unwraps** exposed refs, so **`childRef.instance`** matches the live pet handle from **`useNeko()`’s `instance`** (same timing: **`null`** until ready).

### `NekoPet` props (reference)

In **templates**, use **kebab-case** for multi-word names (Vue maps them to camelCase). Types below match **`NekoPet`** / **`UseNekoOptions`** / **`NekoOptions`**.

| Prop (script) | Template (kebab) | Type | Default | Summary |
| ------------- | ------------------ | ---- | ------- | ------- |
| **`speed`** | `speed` | `number` | _(omit)_ | Pixels per engine logic tick (`createNeko`; default **24**; engine logic ~5 ticks/sec). |
| **`fps`** | `fps` | `number` | _(omit)_ | Sprite animation frame rate (default in engine **120**). |
| **`behaviorMode`** | `behavior-mode` | `BehaviorMode` (number) | _(omit)_ | **Initial** mode at create; live mode changes by **clicking the pet** when `allowBehaviorChange` is true. |
| **`idleThreshold`** | `idle-threshold` | `number` | _(omit)_ | Idle distance in px (engine default **6**). |
| **`cursorStandoffPx`** | `cursor-standoff-px` | `number` | _(omit / 0)_ | Chase mode: minimum distance from pointer in px; **0** or omit = sit on cursor. |
| **`allowBehaviorChange`** | `allow-behavior-change` | `boolean` | **`undefined`** | **`undefined`** = omit field → engine default **`true`**. **`false`** disables click-to-cycle. |
| **`behaviorCycle`** | `behavior-cycle` | `BehaviorMode[]` | _(omit)_ | Pet-click order; omit for **`DEFAULT_NEKO_BEHAVIOR_CYCLE`**. |
| **`startX`** | `start-x` | `number` | _(omit)_ | Initial / home X (**0** valid). |
| **`startY`** | `start-y` | `number` | _(omit)_ | Initial / home Y (**0** valid). |
| **`autoStart`** | `auto-start` | `boolean` | **`true`** | After `createNeko`, run the loop unless **`mode="rest"`** or **`false`**. |
| **`respectReducedMotion`** | `respect-reduced-motion` | `boolean` | **`true`** | Skip pet when user prefers reduced motion. |
| **`startCorner`** | `start-corner` | `string` | _(omit)_ | **`top-left`** \| **`top-right`** \| **`bottom-left`** \| **`bottom-right`** for axes without `startX`/`startY`. |
| **`anchorSelector`** | `anchor-selector` | `string` | _(omit)_ | `document.querySelector` for anchor; waits for non-zero layout. Prefer **`anchorRef`** in **`useNeko`**. |
| **`mode`** | `mode` | **`follow`** \| **`rest`** | **`follow`** | **`follow`** = loop runs; **`rest`** = stop at resolved home after create. |
| **`restUntilFirstPetInteraction`** | `rest-until-first-pet-interaction` | `boolean` | **`undefined`** | First pointer-down on sprite wakes **`follow`** without consuming first cycle step. |
| **`debug`** | `debug` | `boolean` | **`false`** | **`[neko-vue]`** console logs for placement / recreates. |

**`allowBehaviorChange`:** Omit the prop to keep the **engine default** (`true`). A plain optional `Boolean` prop in Vue would otherwise become `false` when unset; here the default is explicitly `undefined`, and options passed to `createNeko` omit `undefined` fields so engine defaults apply.

### Options at a glance

| Area                                      | Keys                                                                                                                                                                                                                  |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Engine (`createNeko` / `NekoOptions`)** | **`speed`**, **`fps`**, **`behaviorMode`** (initial only; live mode changes via pet clicks), **`idleThreshold`**, **`cursorStandoffPx`**, **`behaviorCycle`**, **`allowBehaviorChange`**, **`startX`** / **`startY`** |
| **Placement (wrapper)**                   | **`startCorner`**, **`anchorRef`** (`useNeko` only) or **`anchorSelector`** (`NekoPet`)                                                                                                                               |
| **Loop & motion gate**                    | **`mode`** (`follow` / `rest`), **`autoStart`**, **`respectReducedMotion`**, **`restUntilFirstPetInteraction`**                                                                                                       |
| **Diagnostics**                           | **`debug`** (`[neko-vue]` logs for placement / recreates)                                                                                                                                                             |

Changing most engine or placement fields (including **`behaviorCycle`** and **`cursorStandoffPx`**) **recreates** the pet from `useNeko`; **`behaviorMode`** in options does **not** (it is only used for the first create and when leaving the first-click gate).

## Composable

```vue
<script setup lang="ts">
import { BehaviorMode, useNeko } from "neko-vue";
import { computed, ref } from "vue";

const mode = ref<"follow" | "rest">("follow");

const {
  setMode,
  restAtOrigin,
  resumeFollow,
  mode: currentMode,
} = useNeko(
  computed(() => ({
    speed: 24,
    behaviorMode: BehaviorMode.ChaseMouse,
    startCorner: "bottom-right",
    mode: mode.value,
  })),
);
// restAtOrigin() / resumeFollow() / setMode('rest' | 'follow')
// readonly currentMode when driving imperatively; or toggle `mode` ref as above
</script>
```

### `useNeko()` return value (reference)

| Name | What it is |
| ---- | ----------- |
| **`instance`** | **`ShallowRef<NekoInstance \| null>`** — set after load + `createNeko`; **`null`** before ready, after **`destroy`**, or while skipped for reduced motion / deferred anchor. |
| **`error`** | **`Ref<Error \| null>`** — load / `createNeko` failure; cleared at the start of each recreate attempt. |
| **`isReady`** | **`Ref<boolean>`**, **`true`** once `createNeko` succeeded for the current mount cycle. |
| **`skippedForReducedMotion`** | **`Ref<boolean>`**, **`true`** when the pet was skipped because the user prefers reduced motion (default gate on). |
| **`mode`** | Readonly ref: current **`follow`** / **`rest`**; drive with **`setMode`**, **`restAtOrigin`**, **`resumeFollow`**, or a reactive **`mode`** in options. |
| **`petInteractionAwake`** | Readonly ref; with **`restUntilFirstPetInteraction`**, **`true`** after the first pointer-down on the sprite wakes **`follow`**. |
| **`setMode`**, **`restAtOrigin`**, **`resumeFollow`**, **`destroy`** | Imperative controls (see [Follow vs rest (`mode`)](#follow-vs-rest-mode) in the composable section below). |

**Custom click cycle and pointer standoff** (same options on **`NekoPet`** as props):

```ts
import { BehaviorMode, useNeko } from "neko-vue";
import { computed, ref } from "vue";

const mode = ref<"follow" | "rest">("follow");

useNeko(
  computed(() => ({
    startCorner: "bottom-right",
    mode: mode.value,
    cursorStandoffPx: 48,
    behaviorCycle: [
      BehaviorMode.ChaseMouse,
      BehaviorMode.StayStill,
      BehaviorMode.ReturnHomeAndStay,
    ],
  })),
);
```

**Anchor + `useTemplateRef` (Vue 3.5+):**

```vue
<script setup lang="ts">
import { useNeko } from "neko-vue";
import { computed, ref, useTemplateRef } from "vue";

const anchor = useTemplateRef<HTMLDivElement>("anchor");
const mode = ref<"follow" | "rest">("follow");

useNeko(
  computed(() => ({
    anchorRef: anchor,
    mode: mode.value,
  })),
);
</script>

<template>
  <div ref="anchor" class="my-anchor">Pet spawns at this box’s top-left.</div>
</template>
```

### Start position

- **`startX` / `startY`** — passed through to `createNeko` (remember `0` is valid).
- **`startCorner`** — `top-left` | `top-right` | `bottom-left` | `bottom-right`; fills axes that `startX`/`startY` leave out, using `document.documentElement.clientWidth` and `window.innerHeight` minus `NEKOJS_SPRITE_SIZE` (32).
- **`anchorRef`** (in `setup`) or **`anchorSelector`** (on `NekoPet`) — use the element’s top-left in viewport space when coordinates are omitted. If you pass either one, **`createNeko` waits** until the matched element exists and has **positive width and height** (`getBoundingClientRect()`, with `offsetWidth` / `offsetHeight` as a fallback) so the pet does not spawn at a bogus position while the anchor is still mounting or collapsed.
- **`ResizeObserver`** (in **`useNeko`** only): attached when **`anchorRef`** points at an element, so layout changes on that node can trigger a recreate. There is **no** observer for **`anchorSelector`** alone.

Resolution order per axis: **explicit coordinate → anchor → corner → 0**.

### Pointer standoff (`cursorStandoffPx`)

- **`cursorStandoffPx`** on **`useNeko`** options, **`cursor-standoff-px`** on **`NekoPet`**, or the same field on **`createNeko`** / **`NekoOptions`**: when **greater than zero**, chase mode keeps at least that many CSS pixels between the pet’s movement anchor and the pointer (the cat stops short instead of sitting on the cursor). Omit the field or use **`0`** for the original snap-to-pointer behavior.

### Behavior click cycle (`behaviorCycle`)

- **`behaviorCycle`** on **`useNeko`** / **`NekoOptions`** / **`createNeko`**, or **`behavior-cycle`** on **`NekoPet`**: ordered **`BehaviorMode[]`** for pet clicks. Omit to use **`DEFAULT_NEKO_BEHAVIOR_CYCLE`**. Changing this option recreates the instance (like other engine options in the composable fingerprint).
- Invalid or out-of-range entries are **dropped** by the bundled runtime; if nothing valid remains, the **default** cycle is used. The same **`BehaviorMode`** may appear **more than once** if you want the pet to revisit a step.

### Follow vs rest (`mode`)

- **`follow`** — chase / run behaviors (animation loop running).
- **`rest`** — pet stays at the **resolved home** position (loop stopped via `stop()` after each `createNeko`).

**`createNeko` always calls `start()`**; this library immediately calls **`stop()`** when `mode === 'rest'` or `autoStart === false`, and **`start()`** when `mode === 'follow'` and `autoStart !== false` (a second `start()` is a no-op).

Returning to home after the cat has moved uses a **fresh instance** (destroy + create) whenever options or mode change, because there is **no “teleport to x,y”** API on the instance.

**`restUntilFirstPetInteraction`:** When `true` (composable option or **`rest-until-first-pet-interaction`** on **`NekoPet`**), the pet starts **still** (`rest`). The **first** pointer down on the sprite is handled so the cat **wakes into chase** without consuming the built-in click-to-cycle step; **later** pointer downs advance your **`behaviorCycle`** (or the default cycle). The composable exposes **`petInteractionAwake`** (readonly ref) so you can reflect that state in the UI. While waiting for the first interaction, **`behaviorMode`** is temporarily forced to **`BehaviorMode.StayStill`** internally; your own **`behaviorMode`** applies after wake (or the engine default chase if omitted).

## Manual load + `createNeko`

Use this when you call **`createNeko`** outside **`useNeko`** / **`NekoPet`** (e.g. a custom lifecycle).

- If **`globalThis.createNeko`** already exists, **`loadNekoRuntime()`** resolves to it immediately (no import).
- Otherwise it performs a **one-time** dynamic import of the bundled runtime (same code path as **`useNeko`**).

```ts
import { loadNekoRuntime } from "neko-vue";

const createNeko = await loadNekoRuntime();
const neko = createNeko({ speed: 24 });
neko.start();
```

**`LoadNekoRuntimeOptions`** today only supports **`timeoutMs`** (default **30000**), used when waiting on the bundled import—for example `await loadNekoRuntime({ timeoutMs: 60_000 })` on very slow devices.

## Nuxt / SSR

The pet runtime is **browser-only**. Do not run **`loadNekoRuntime`**, **`useNeko`**, or mount **`NekoPet`** on the server. In **Nuxt 4**, use a **`*.client.vue`** component (with [auto-import or `#components`](https://nuxt.com/docs/4.x/guide/directory-structure/components#client-components)) and/or [`<ClientOnly>`](https://nuxt.com/docs/4.x/api/components/client-only). See [Nuxt 4](#4-nuxt-4) above.

## Motion preferences

By default, `useNeko` and `NekoPet` **do nothing** when the user has **prefers-reduced-motion: reduce** (no bundled runtime import and no `createNeko`). You get `skippedForReducedMotion === true` from `useNeko`, or use `:respect-reduced-motion="false"` on `NekoPet` to ignore the preference (offer your own UI consent first).

You can also call `prefersReducedMotion()` from this package to branch in templates or plugins.

## Compared to GIF “one-file neko” implementations

This package uses **`createNeko`** with fixed **32×32** sprites, not a GIF sprite sheet or arbitrary pixel sizes. Use `NEKOJS_SPRITE_SIZE` (32) when computing corners or layout.

## Bundled runtime & HMR

The library loads the engine with a **single shared** dynamic import (your app’s bundler emits a separate chunk; there is no runtime option to swap in another script URL).

On unmount, the wrapper calls **`stop()`** then **`destroy()`**. The bundled runtime’s **`destroy()`** also clears the interval and aborts document/window listeners. Hot reload may briefly leave extra instances depending on how your dev server remounts; a full refresh clears them.

**Playground:** Each demo route mounts **one** pet. If HMR leaves a stray instance after editing, refresh the page.

## Credits

Desktop pet behavior and sprites draw on **[nekojs](https://github.com/louisabraham/nekojs)** by Louis Abraham — thank you for the original idea and implementation.

## License

- **Wrapper source in this repository** is under the [MIT License](./LICENSE).
- **Bundled pet runtime** in `dist/` is subject to the **third-party** terms described in that file (GNU GPLv3). Read `LICENSE` before redistributing.

## Development

### Test this repo locally

Use this when you are working **in this repository** and want to verify changes before publishing.

#### 1. Automated tests and checks

From the **repo root** (after `vp install`):

```bash
vp test
```

Runs Vitest against **`loadNekoRuntime`**, `useNeko`, and `NekoPet` (tests set **`window.createNeko`** mocks; happy-dom), including checks that optional fields are not sent as `undefined`, that **`behaviorCycle`** / **`cursorStandoffPx`** reach `createNeko` when set, that anchor `ResizeObserver` does not recreate the pet when the layout size is unchanged, and that **`createNeko` is deferred** until an anchor element has non-zero layout when `anchorRef` is used.

```bash
vp run check
vp run check:playground
```

Or **`bun run check:all`** — library paths first, then **`playground/src`** and **`playground/vite.config.ts`** (bare **`vp check`** would typecheck the playground against root `node_modules` and fail). Runs format, lint, and TypeScript via Vite+.

```bash
vp pack
```

Produces **`dist/`** (ESM + `.d.mts`). The playground and any `file:` consumer need a successful pack.

**CI:** Pushes and pull requests against **`main`** run [`.github/workflows/ci.yml`](./.github/workflows/ci.yml): **`actions/checkout@v6`**, **`voidzero-dev/setup-vp`** (Node **24**), **`npm install --prefix playground`**, **`vp run check && vp run check:playground`**, **`vp test`**, **`vp pack`**.

#### 2. Visual / manual test in the browser (playground)

The **[playground](./playground/)** app aliases **`neko-vue`** to **`../src/index.ts`** in **`playground/vite.config.ts`** so local edits hit the library source without reinstalling. Published consumers still use **`dist/`** via **`package.json` `exports`**. The playground uses **Vue Router** so each integration style has its **own route** (one pet on screen at a time):

| Route             | Demo file               | What it shows                                                                                           |
| ----------------- | ----------------------- | ------------------------------------------------------------------------------------------------------- |
| **`/`**           | `DemoNekoPet.vue`       | **`<NekoPet />`**, live stats via **`ref` + exposed `instance`**                                        |
| **`/composable`** | `DemoUseNekoAnchor.vue` | **`useNeko`** + **`anchorRef`** + extra composable flags in the panel                                   |
| **`/customize`**  | `DemoCustomize.vue`     | Sandbox: placement, **`behaviorCycle`**, **`cursorStandoffPx`**, and other options — **Apply** respawns |

**One-off:**

```bash
vp pack
bun install --cwd playground
bun run playground:dev
```

Open **http://localhost:5175** (browser may open automatically). Use the nav links to switch demos; each page explains **still → click the cat → cycle behaviors** on the pet itself. The pet runtime is loaded from the **bundled** library chunk (no extra network request).

**While editing the library**, use two terminals:

```bash
# Terminal A — rebuild dist on change
vp pack --watch

# Terminal B — Vite dev server
bun run playground:dev
```

Refresh the browser after each rebuild (or rely on Vite HMR for playground code only; **`dist/`** changes need a refresh).

More detail: [playground/README.md](./playground/README.md).

#### 3. Try it inside another Vue app on your machine

- **Option A — `npm pack` / `pnpm pack`:** From the repo root, run `vp pack`, then `npm pack` (or equivalent). In your app, install the generated `.tgz` (e.g. `npm install ../path/to/neko-vue-0.1.0.tgz`; the filename matches **`version`** in root `package.json`).
- **Option B — `file:` dependency:** Point your app’s `package.json` at the folder that contains a built **`dist/`** (same as publishing layout).

Ensure **`vp pack`** has been run so `exports` and types resolve.

### Package entry shape

**neko-vue** is one npm package with a root export (`"."` → `dist/index.mjs`) plus conditional **`exports`** subpaths **`/types`**, **`/placement`**, **`/runtime`**, **`/vue`** (each with **`types`** + **`import`**) — see [Subpath imports](#subpath-imports). A dedicated **Nuxt module** would still typically be a **separate package** if you want zero-config Nuxt integration beyond the steps in [Nuxt 4](#4-nuxt-4).

---

### Maintainer commands (summary)

```bash
vp install
vp test
vp pack
vp run check
vp run check:playground
```
