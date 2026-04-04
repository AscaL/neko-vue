# neko-vue playground

Small Vue app to **see** the pet in the browser.

`vite.config.ts` aliases **`neko-vue`** to the parent **`src/index.ts`** so you do not need `npm link` or a workspace install of the library. Demo `.vue` files import from **`../../src/index.ts`** (same entry); you can switch to the package name if you add `paths` in `tsconfig`.

**Vue Router** splits demos onto **separate routes** so only **one** neko instance is mounted at a time:

| Route             | File                    | What it shows                                                                                                                                                                                                |
| ----------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`/`**           | `DemoNekoPet.vue`       | **`<NekoPet />`** — corner spawn, rest-until-first-click, seven modes; **`ref` + exposed `instance`** and **`useNekoHud`** for the live panel.                                                               |
| **`/composable`** | `DemoUseNekoAnchor.vue` | **`useNeko`** + **`anchorRef`** + **`useTemplateRef`**; live panel adds **`isReady`**, reduced-motion skip, and first-click gate.                                                                            |
| **`/customize`**  | `DemoCustomize.vue`     | **Sandbox:** form for placement (corner / explicit / anchor), motion, behavior (incl. **`cursorStandoffPx`**, custom **`behaviorCycle`**), debug — **Apply** recreates the pet via **`useNeko`** + live HUD. |

Shared UI: **`PlaygroundLiveStats.vue`** (presentation) and **`useNekoHud.ts`** (rAF polling of `NekoInstance`).

`App.vue` holds the shared header, nav (`RouterLink`s), and `<RouterView />`.

## Run

From the **repository root**:

1. Build the library (the package resolves **`dist/`** via `package.json` `exports`):

   ```bash
   vp pack
   ```

2. Install playground dependencies once:

   ```bash
   bun install --cwd playground
   ```

   (Or `cd playground` then `vp install` / `bun install`.)

3. Start the dev server:

   ```bash
   bun run playground:dev
   ```

   Or from **`playground/`**: `bun run dev`.

The dev server defaults to **http://localhost:5175** and tries to open the browser automatically.

## Notes

- Run **`vp pack --watch`** in one terminal and the playground dev server in another while you change the library; refresh the browser after each rebuild.
- Automated checks stay **`vp test`** / **`vp check`** at the repo root (no need to open the playground for those).
- If HMR leaves a stray pet, do a full **refresh**; each route is meant to own a single instance.
