# nekojsRuntime — plan & status

## Implemented (done)

| Area              | Where                                                          | Notes                                                                                                                                        |
| ----------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Movement split    | [`nekoEngineMovement.ts`](./src/runtime/nekoEngineMovement.ts) | `createProcessOriginalTick`, `NekoState`, behaviors, `runTowards`, `calcDirection`.                                                          |
| Viewport bounds   | [`nekoViewport.ts`](./src/runtime/nekoViewport.ts)             | `readViewportBounds()` — `visualViewport` when width/height are positive, else `clientWidth` / `innerHeight`.                                |
| Main loop         | [`nekojsRuntime.ts`](./src/runtime/nekojsRuntime.ts)           | `requestAnimationFrame` + ms accumulator vs `1000 / fps`; `animationFrameId` on state (replaces `setInterval`).                              |
| Resize coalescing | same                                                           | Cancel + schedule one rAF per burst; `window` **resize** + `visualViewport` **resize** / **scroll** share the same scheduler.                |
| Sprite `<img>`    | `NekoEngineState.spriteImg`                                    | Set in `init()`; no `querySelector` per frame.                                                                                               |
| Ball state        | `ballActive`                                                   | Set when ball spawns in ball-chase; cleared when leaving that mode in `cycleBehavior`; resize clamps ball only if active.                    |
| Run-away fallback | `nekoEngineMovement`                                           | Magic `32` → `NEKOJS_SPRITE_SIZE`.                                                                                                           |
| Resize placement  | `clampLayoutToViewport`                                        | **All** behaviors + running/rest: `home` and sprite snap to **initial placement** clamped into current bounds.                               |
| State init        | `configure()`                                                  | `actionCount`, `lastMoveDX`, `lastMoveDY` initialized so `NekoEngineState` matches runtime before the first tick.                            |
| Tests             | [`tests/neko.test.ts`](./tests/neko.test.ts)                   | Resize (`flushAnimationFrames` + behavior matrix); **behavior click notify** (callback + `.neko-behavior-hint` + destroy).                   |
| Types             | [`src/types/index.ts`](./src/types/index.ts)                   | `NekoOptions.onBehaviorModeChange` / `showBehaviorOnClick`; `NekoInstance` optional `isIdle` / `setSprites`; rAF JSDoc.                      |
| Vue props JSDoc   | [`src/vue/NekoPet.ts`](./src/vue/NekoPet.ts)                   | `fps`, **`showBehaviorOnClick`**, emits typing.                                                                                              |
| Docs              | [`README.md`](./README.md)                                     | Viewport / rAF / resize / anchor gate; click → **`onBehaviorModeChange`** / **`@behavior-mode-change`** / **`showBehaviorOnClick`**.         |
| Behavior click UX | [`nekojsRuntime.ts`](./src/runtime/nekojsRuntime.ts)           | **`cycleBehavior`** invokes callback + optional hint node (`role="status"`, `aria-live="polite"`); **`clearBehaviorHint`** in **`destroy`**. |
| `NekoPet`         | [`NekoPet.ts`](./src/vue/NekoPet.ts)                           | Prop **`showBehaviorOnClick`**; emit **`behaviorModeChange`** via stable handler into **`useNeko`**.                                         |
| `useNeko`         | [`useNeko.ts`](./src/vue/useNeko.ts)                           | Recreate watch includes **`onBehaviorModeChange`** / **`showBehaviorOnClick`**; stable-callback JSDoc.                                       |

## Dropped / superseded

- **`clampLogicOnly` / `behaviorClampsLogicOnlyWhileRunning`** — Removed. Resize always snaps to clamped placement for every mode.

## Refactor review

**What improved**

- **Separation:** DOM, listeners, rAF, resize, and `clampLayoutToViewport` stay in `nekojsRuntime.ts`; pure tick/behavior logic lives in `nekoEngineMovement.ts`; bounds read is isolated in `nekoViewport.ts`.
- **Lifecycle:** `AbortController` still tears down listeners; `destroy()` cancels pending resize rAF, the main loop, and behavior-hint timeouts / nodes.
- **Tests:** Resize and behavior matrix reduce regressions on viewport math and placement.

**Residual coupling / limits**

- **`createProcessOriginalTick` takes full `NekoEngineState`** — movement is not a small immutable model; it mutates the same blob `nekojsRuntime` owns. Fine for one engine; a deeper split would introduce facades or tick context objects.
- **`normalizeBehaviorCycle` stays in `nekojsRuntime`** — only `configure` needs it; could move next to movement if you want all cycle parsing in one module.
- **Mouse vs visual viewport:** `mousemove` uses `clientX`/`clientY`; bounds can come from `visualViewport` size. On some mobile layouts, pointer and bounds can disagree slightly — only worth revisiting if reports show drift.
- **Resize snaps the sprite** — intentional product rule; chase users get a teleport to clamped home on every layout event. Documented in README.
- **`package.json` `sideEffects: false`** — the bundle entry still runs `installNekoGlobals()` on import; the dynamic import path is the supported one. Don’t rely on static imports of `nekojsRuntime` without checking tree-shaking.

**rAF loop**

- First frame uses `rafLastTs === 0` so initial `delta` is 0; stepping starts from the second callback. Usually harmless.
- Background tabs: rAF is throttled by the browser (slower pet, not wrong physics).

## Optional follow-ups (not scheduled)

- **Hint customization** — Duration, CSS class, or i18n override for built-in **`showBehaviorOnClick`** (today: fixed ~2.2s, inline styles, **`BEHAVIOR_MODE_LABELS`**).
- **Page Visibility** — Pause rAF when `document.hidden`; resume on visible.
- **Mid-flight chase test** — Export `update()` for tests or stub `requestAnimationFrame` synchronously to assert resize after many logic ticks without timing flakes.
- **`readViewportBounds` as public API** — Only if consumers need the same bounds math as the engine (currently internal).
- **Further splits** — e.g. `normalizeBehaviorCycle` + `finiteOpt` into `nekoEngineOptions.ts` if `nekojsRuntime.ts` grows again.
- **Anchor + `placementHome*`** — Vue recreate recomputes placement from anchor/corners; engine `placementHome*` is fixed at first `configure`. Already consistent for static anchors; document if dynamic anchor + resize interaction needs a product decision.

## Verification

- `vp test` — resize + behavior matrix + **behavior click notify** in `tests/neko.test.ts`.
- `vp run check` — package root (`vp run check`, not bare `vp check` on the whole tree per `AGENTS.md`).
- Manual: playground, mobile / DevTools with `visualViewport`, ball mode + resize.
