import {
  type MaybeRefOrGetter,
  onBeforeUnmount,
  onMounted,
  readonly,
  ref,
  shallowRef,
  toValue,
  watch,
  watchEffect,
} from "vue";
import { nekoVueDebug } from "../utils/debugLog.ts";
import { loadNekoRuntime } from "../runtime/loadNekoRuntime.ts";
import {
  type NekoPlacementInput,
  type NekoStartCorner,
  resolveStartPosition,
} from "../placement/nekoPlacement.ts";
import { prefersReducedMotion } from "../utils/prefersReducedMotion.ts";
import {
  BehaviorMode,
  isBehaviorMode,
  type NekoInstance,
  type NekoOptions,
} from "../types/index.ts";

/** Whether the pet chases the pointer or stays at the resolved start position. */
export type NekoFollowMode = "follow" | "rest";

/**
 * Options for {@link useNeko}. Includes all {@link NekoOptions} fields plus placement and
 * wrapper-only flags. Omitted fields are left unset so engine defaults apply where applicable.
 *
 * **`behaviorMode`** is read for the **first** create and when leaving the pet-interaction gate; it
 * is **not** part of the recreate fingerprint. Live mode changes come from **clicking the pet**.
 * If you wrap options in **`computed(() => ({ … }))`** and include `behaviorMode`, changing it still
 * invalidates that computed and may re-run internal watchers — use **`reactive`** for the options
 * object if you need to mutate `behaviorMode` without that effect.
 */
export type UseNekoOptions = NekoOptions & {
  /**
   * When true (default), run the animation loop after `createNeko`.
   * The engine’s `createNeko` always calls `start()` internally; when this is false or `mode` is `rest`,
   * we call `stop()` immediately after creation.
   */
  autoStart?: boolean;
  /**
   * When true (default), do not load or create the pet if the user prefers reduced motion
   * (see {@link prefersReducedMotion}). Set false to always run (e.g. user override).
   */
  respectReducedMotion?: boolean;
  /** Place the pet at a viewport corner unless `startX` / `startY` override that axis. */
  startCorner?: NekoStartCorner;
  /**
   * Use this element’s top-left (viewport) for `startX`/`startY` when those are omitted.
   * When set, **`createNeko` is deferred** until the element is non-null and
   * `getBoundingClientRect()` has **positive width and height** (avoids a bogus spawn while the anchor is still mounting or collapsed).
   */
  anchorRef?: MaybeRefOrGetter<HTMLElement | null | undefined>;
  /**
   * `document.querySelector` (client only). Prefer `anchorRef` in `setup`.
   * Uses the same **layout gate** as `anchorRef`: no create until a match exists with non-zero size.
   */
  anchorSelector?: string;
  /** `follow` = chase; `rest` = remain at resolved home position (animation loop stopped). */
  mode?: MaybeRefOrGetter<NekoFollowMode>;
  /** When true, logs placement and lifecycle to the console with prefix `[neko-vue]`. */
  debug?: boolean;
  /**
   * When true, the pet starts **still** (`rest`) with a one-time setup so the **first** pointer down
   * on the sprite wakes **follow** (chase) **without** consuming the built-in click-to-cycle step.
   * Further pointer downs use the full click cycle (through stay still and return home & stay).
   *
   * While waiting for that first interaction, `behaviorMode` is forced to {@link BehaviorMode.StayStill} so the
   * engine idles even if a frame runs before the wrapper calls `stop()`; we intercept the first pointer instead.
   * `allowBehaviorChange` is forced **true** during the wait so the sprite stays clickable.
   */
  restUntilFirstPetInteraction?: boolean;
};

function pickNekoOptions(o: UseNekoOptions): NekoOptions {
  const {
    autoStart: _a,
    respectReducedMotion: _r,
    startCorner: _c,
    anchorRef: _ar,
    anchorSelector: _as,
    mode: _m,
    debug: _d,
    restUntilFirstPetInteraction: _wake,
    ...neko
  } = o;
  return neko;
}

function resolveAnchorElement(o: UseNekoOptions): HTMLElement | null {
  if (o.anchorRef != null) {
    const el = toValue(o.anchorRef as MaybeRefOrGetter<HTMLElement | null | undefined>);
    if (el) {
      return el;
    }
  }
  if (o.anchorSelector && typeof document !== "undefined") {
    return document.querySelector(o.anchorSelector);
  }
  return null;
}

/** User configured an anchor (ref or selector) — wait for a real, non-collapsed box before `createNeko`. */
function wantsAnchorBinding(o: UseNekoOptions): boolean {
  return o.anchorRef != null || Boolean(o.anchorSelector);
}

function isAnchorLaidOutForCreate(anchorEl: HTMLElement | null): boolean {
  if (!anchorEl) {
    return false;
  }
  const r = anchorEl.getBoundingClientRect();
  const w = r.width > 0 ? r.width : anchorEl.offsetWidth;
  const h = r.height > 0 ? r.height : anchorEl.offsetHeight;
  return w > 0 && h > 0;
}

function buildPlacementInput(o: UseNekoOptions): NekoPlacementInput {
  return {
    startX: o.startX,
    startY: o.startY,
    startCorner: o.startCorner,
    anchorElement: resolveAnchorElement(o),
  };
}

/** The engine treats a missing key as its default; strip `undefined` so we never override with implicit Vue prop values. */
function omitUndefinedNekoFields(opts: NekoOptions): NekoOptions {
  return Object.fromEntries(Object.entries(opts).filter(([, v]) => v !== undefined)) as NekoOptions;
}

function buildCreateOptions(o: UseNekoOptions, petGateClosed: boolean): NekoOptions {
  const debug = o.debug === true;
  const base = pickNekoOptions(o);
  const { startX, startY } = resolveStartPosition(buildPlacementInput(o), debug);
  let merged: NekoOptions = { ...base, startX, startY };
  if (petGateClosed && o.restUntilFirstPetInteraction) {
    merged = {
      ...merged,
      behaviorMode: BehaviorMode.StayStill,
      allowBehaviorChange: true,
    };
  }
  return omitUndefinedNekoFields(merged);
}

function readInstanceBehaviorMode(inst: NekoInstance | null): BehaviorMode | undefined {
  if (!inst) {
    return undefined;
  }
  const v = inst.behaviorMode;
  return isBehaviorMode(v) ? v : undefined;
}

/**
 * `behaviorMode` in options is only for **initial** create; reactive changes must not recreate.
 * On recreate (anchor/layout/mode…), keep the live engine mode unless we just left the
 * `restUntilFirstPetInteraction` gate (then set the parent’s `behaviorMode` if provided, else
 * **ChaseMouse** explicitly — same as the engine default, but visible in debug logs).
 */
function applyBehaviorModeForRecreate(
  nekoOpts: NekoOptions,
  raw: UseNekoOptions,
  petGateClosed: boolean,
  priorBm: BehaviorMode | undefined,
  leavingPetGate: boolean,
): void {
  if (petGateClosed && raw.restUntilFirstPetInteraction) {
    return;
  }
  if (leavingPetGate) {
    if (raw.behaviorMode !== undefined) {
      nekoOpts.behaviorMode = raw.behaviorMode;
    } else {
      // Explicit default so debug payloads match the engine (omitting the key also meant ChaseMouse).
      nekoOpts.behaviorMode = BehaviorMode.ChaseMouse;
    }
    return;
  }
  if (priorBm !== undefined) {
    nekoOpts.behaviorMode = priorBm;
  }
}

function anchorElementRectKey(el: Element): string {
  const r = el.getBoundingClientRect();
  return [r.left, r.top, r.width, r.height].map((n) => Math.round(n * 100) / 100).join(",");
}

/**
 * Create a pet instance on mount and destroy it on unmount.
 * Options may be reactive; when they change, the previous instance is destroyed and a new one is created.
 *
 * **Viewport-fixed pet:** the sprite lives on `document`, not under your component tree. This composable
 * only manages **lifecycle** and **placement inputs** (`startX`/`startY`, corners, anchor); it does not
 * reparent the engine’s DOM without upstream support.
 *
 * The engine’s `createNeko` always calls `start()`; this composable may call `stop()` right after to honor
 * `autoStart`, `mode: 'rest'`, or both.
 */
export function useNeko(options: MaybeRefOrGetter<UseNekoOptions | undefined> = {}) {
  const instance = shallowRef<NekoInstance | null>(null);
  const error = ref<Error | null>(null);
  const isReady = ref(false);
  const skippedForReducedMotion = ref(false);
  const modeRef = ref<NekoFollowMode>("follow");
  const anchorLayoutTick = ref(0);
  /** After first pet pointer-down when `restUntilFirstPetInteraction` is enabled. */
  const petInteractionAwake = ref(false);
  /** True while the live instance was created under the pet-interaction gate (ball-chase wait). */
  const petGateSpawnedInstance = ref(false);

  let stopModeWatch: (() => void) | undefined;
  let stopMainWatch: (() => void) | undefined;
  let stopWakeOptionWatch: (() => void) | undefined;
  let mountGen = 0;

  onMounted(() => {
    stopModeWatch = watch(
      () => toValue(options)?.mode,
      (m) => {
        if (m !== undefined) {
          modeRef.value = toValue(m);
        }
      },
      { immediate: true },
    );

    stopWakeOptionWatch = watch(
      () => toValue(options)?.restUntilFirstPetInteraction === true,
      (enabled) => {
        if (!enabled) {
          petInteractionAwake.value = false;
        }
      },
    );

    watchEffect((onCleanup) => {
      const raw = toValue(options) ?? {};
      if (raw.restUntilFirstPetInteraction !== true || petInteractionAwake.value) {
        return;
      }
      if (typeof document === "undefined") {
        return;
      }
      const onPointerDown = (e: MouseEvent) => {
        const pet = document.querySelector(".neko");
        const t = e.target;
        if (!pet || !(t instanceof Node) || !(pet === t || pet.contains(t))) {
          return;
        }
        e.preventDefault();
        e.stopImmediatePropagation();
        petInteractionAwake.value = true;
      };
      document.addEventListener("mousedown", onPointerDown, true);
      onCleanup(() => {
        document.removeEventListener("mousedown", onPointerDown, true);
      });
    });

    watchEffect((onCleanup) => {
      const raw = toValue(options) ?? {};
      const el =
        raw.anchorRef != null
          ? toValue(raw.anchorRef as MaybeRefOrGetter<HTMLElement | null | undefined>)
          : null;
      if (!el || typeof ResizeObserver === "undefined") {
        return;
      }
      let lastRectKey = anchorElementRectKey(el);
      const ro = new ResizeObserver(() => {
        const next = anchorElementRectKey(el);
        if (next === lastRectKey) {
          return;
        }
        lastRectKey = next;
        anchorLayoutTick.value++;
      });
      ro.observe(el);
      onCleanup(() => {
        ro.disconnect();
      });
    });

    stopMainWatch = watch(
      () => {
        const raw = toValue(options) ?? {};
        const anchorEl = resolveAnchorElement(raw);
        const rect = anchorEl?.getBoundingClientRect();
        return {
          mode: modeRef.value,
          anchorTick: anchorLayoutTick.value,
          anchorRect: rect ? { x: rect.x, y: rect.y, w: rect.width, h: rect.height } : null,
          petInteractionAwake: petInteractionAwake.value,
          restUntilFirstPetInteraction: raw.restUntilFirstPetInteraction === true,
          speed: raw.speed,
          fps: raw.fps,
          // `behaviorMode` omitted: option is initial-only; live mode changes only via pet clicks.
          idleThreshold: raw.idleThreshold,
          cursorStandoffPx: raw.cursorStandoffPx,
          behaviorCycle: JSON.stringify(raw.behaviorCycle ?? null),
          allowBehaviorChange: raw.allowBehaviorChange,
          startCorner: raw.startCorner,
          startX: raw.startX,
          startY: raw.startY,
          autoStart: raw.autoStart,
          respectReducedMotion: raw.respectReducedMotion,
          anchorSelector: raw.anchorSelector,
          debug: raw.debug,
        };
      },
      async () => {
        const gen = ++mountGen;
        const raw = toValue(options) ?? {};
        const debug = raw.debug === true;

        nekoVueDebug(debug, "recreate:enter", {
          gen,
          modeRef: modeRef.value,
          optionsMode:
            raw.mode !== undefined
              ? toValue(raw.mode as MaybeRefOrGetter<NekoFollowMode>)
              : undefined,
          clientWidth:
            typeof document !== "undefined" ? document.documentElement.clientWidth : null,
          innerHeight: typeof window !== "undefined" ? window.innerHeight : null,
        });

        error.value = null;
        isReady.value = false;

        const priorBm = readInstanceBehaviorMode(instance.value);
        const wasPetGateInstance = petGateSpawnedInstance.value;
        const petGateClosed =
          raw.restUntilFirstPetInteraction === true && !petInteractionAwake.value;
        const leavingPetGate =
          wasPetGateInstance &&
          petInteractionAwake.value &&
          priorBm === BehaviorMode.StayStill &&
          !petGateClosed;

        if (instance.value) {
          instance.value.stop();
          instance.value.destroy();
          instance.value = null;
        }

        const { autoStart = true, respectReducedMotion: respectMotion = true } = raw;

        if (respectMotion && prefersReducedMotion()) {
          if (gen !== mountGen) {
            return;
          }
          skippedForReducedMotion.value = true;
          error.value = null;
          return;
        }

        skippedForReducedMotion.value = false;

        if (wantsAnchorBinding(raw)) {
          const anchorEl = resolveAnchorElement(raw);
          if (!isAnchorLaidOutForCreate(anchorEl)) {
            const r = anchorEl?.getBoundingClientRect();
            nekoVueDebug(debug, "recreate:defer anchor layout", {
              hasEl: Boolean(anchorEl),
              width: r?.width ?? null,
              height: r?.height ?? null,
            });
            return;
          }
        }

        const effectiveMode: NekoFollowMode = petGateClosed ? "rest" : modeRef.value;
        const nekoOpts = buildCreateOptions(raw, petGateClosed);
        applyBehaviorModeForRecreate(nekoOpts, raw, petGateClosed, priorBm, leavingPetGate);

        nekoVueDebug(debug, "recreate:createNeko options (payload)", {
          ...nekoOpts,
          _effectiveMode: effectiveMode,
          _autoStart: autoStart,
          _gen: gen,
          _petGateClosed: petGateClosed,
        });

        try {
          const create = await loadNekoRuntime();
          if (gen !== mountGen) {
            const stray = create(nekoOpts);
            stray.stop();
            stray.destroy();
            return;
          }
          const nekoInstance = create(nekoOpts);
          if (gen !== mountGen) {
            nekoInstance.stop();
            nekoInstance.destroy();
            return;
          }
          instance.value = nekoInstance;

          const shouldRun = effectiveMode === "follow" && autoStart !== false;
          if (shouldRun) {
            nekoInstance.start();
          } else {
            nekoInstance.stop();
          }

          nekoVueDebug(debug, "recreate:instance ready", {
            shouldRun,
            startX: nekoOpts.startX,
            startY: nekoOpts.startY,
            behaviorMode: nekoOpts.behaviorMode,
          });

          isReady.value = true;
          petGateSpawnedInstance.value = petGateClosed;
        } catch (e) {
          if (gen !== mountGen) {
            return;
          }
          error.value = e instanceof Error ? e : new Error(String(e));
        }
      },
      { flush: "post", immediate: true },
    );
  });

  onBeforeUnmount(() => {
    stopModeWatch?.();
    stopWakeOptionWatch?.();
    stopMainWatch?.();
    mountGen++;
    if (instance.value) {
      instance.value.stop();
      instance.value.destroy();
      instance.value = null;
    }
    isReady.value = false;
    skippedForReducedMotion.value = false;
    petInteractionAwake.value = false;
    petGateSpawnedInstance.value = false;
  });

  function setMode(m: NekoFollowMode): void {
    modeRef.value = m;
  }

  function destroy(): void {
    if (instance.value) {
      instance.value.stop();
      instance.value.destroy();
      instance.value = null;
    }
    isReady.value = false;
  }

  /**
   * Sets `mode` to `rest` (stops at the resolved home position after the next internal cycle).
   * If you pass a reactive `mode` in options, prefer updating that ref instead; it stays in sync via watch.
   */
  function restAtOrigin(): void {
    setMode("rest");
  }

  /** Sets `mode` to `follow`. */
  function resumeFollow(): void {
    setMode("follow");
  }

  return {
    /** Live `NekoInstance` after load and `createNeko`, or null before ready / after destroy. */
    instance,
    /** Set when runtime load or `createNeko` fails; cleared on successful recreate. */
    error,
    /** True once `createNeko` has run successfully for the current mount cycle. */
    isReady,
    /** True when the pet was skipped because `respectReducedMotion` matched user preference. */
    skippedForReducedMotion,
    /** Current `follow` / `rest` mode (readonly); drive with {@link setMode} or a reactive `mode` in options. */
    mode: readonly(modeRef),
    /** True after the first pet pointer-down when `restUntilFirstPetInteraction` is enabled. */
    petInteractionAwake: readonly(petInteractionAwake),
    /** Imperatively set `follow` or `rest` (updates internal `mode` ref used by the pet). */
    setMode,
    restAtOrigin,
    resumeFollow,
    /** Stop, destroy the instance, and clear ready state (does not tear down composable watchers). */
    destroy,
  };
}
