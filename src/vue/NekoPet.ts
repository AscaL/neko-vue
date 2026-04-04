import { type DefineComponent, type PropType, computed, defineComponent, h } from "vue";
import type { NekoStartCorner } from "../placement/nekoPlacement.ts";
import type { BehaviorCycle, BehaviorMode } from "../types/index.ts";
import { type NekoFollowMode, useNeko } from "./useNeko.ts";

/**
 * Public props for {@link NekoPet}. **Per-property JSDoc is what TypeScript shows when consumers hover
 * a prop or this type** in another repo; it is not inferred from the runtime `props` object below.
 * Enum-level docs (e.g. {@link BehaviorMode}) appear when you hover the type name or “Go to type”.
 */
export interface NekoPetPublicProps {
  /** Pixels per engine logic tick (omit → default **24**). */
  speed?: number;
  /** Sprite animation frame rate (omit → default **120**). */
  fps?: number;
  /**
   * Initial {@link BehaviorMode} at create time. Clicks on the pet change the live mode when
   * {@link allowBehaviorChange} is true; updating this prop does not recreate or override the
   * current mode. **Hover {@link BehaviorMode}** for the full enum / engine contract.
   */
  behaviorMode?: BehaviorMode;
  /**
   * Distance (px) at which the pet counts as idle for behavior logic (engine default **6** when omitted).
   */
  idleThreshold?: number;
  /**
   * Chase mode: minimum distance from the pointer in px (omit or **0** = snap to cursor).
   */
  cursorStandoffPx?: number;
  /**
   * When true, pet clicks cycle {@link BehaviorMode}. Omit or `undefined` so the field is not sent to
   * the engine (default **true**). Use `default: undefined` on the component so Vue does not coerce
   * “missing” to `false`.
   */
  allowBehaviorChange?: boolean;
  /**
   * Pet-click mode order when {@link allowBehaviorChange} is true. Omit for {@link DEFAULT_NEKO_BEHAVIOR_CYCLE}.
   */
  behaviorCycle?: BehaviorCycle;
  /** Initial X in viewport pixels. `0` is valid; omit → **0**. */
  startX?: number;
  /** Initial Y in viewport pixels. `0` is valid; omit → **0**. */
  startY?: number;
  /**
   * When true (default), keep the animation loop running after `createNeko`. When false or when
   * {@link mode} is `rest`, the wrapper calls `stop()` right after creation.
   */
  autoStart?: boolean;
  /**
   * When true (default), skip the pet if the user prefers reduced motion. Set `false` only after
   * explicit consent if you need to override.
   */
  respectReducedMotion?: boolean;
  /**
   * Viewport corner for any axis where {@link startX} / {@link startY} are omitted.
   */
  startCorner?: NekoStartCorner;
  /**
   * `document.querySelector` for an anchor (client only). Waits for non-zero layout. Prefer
   * {@link useNeko}'s `anchorRef` when you have a template ref.
   */
  anchorSelector?: string;
  /**
   * `follow` — chase / run (loop on). `rest` — stay at resolved home (loop stopped after create).
   */
  mode?: NekoFollowMode;
  /**
   * When true, start in `rest`; first pointer-down on the sprite switches to `follow` without consuming
   * the first click-cycle step. While waiting, {@link behaviorMode} is forced to {@link BehaviorMode.StayStill}.
   */
  restUntilFirstPetInteraction?: boolean;
  /** Log placement / recreate steps with prefix `[neko-vue]`. */
  debug?: boolean;
}

/**
 * Mounts the desktop pet on the client. Renders a minimal hidden root node for Vue; the engine draws
 * **viewport-fixed** on `document` — not as a child of your layout. Placement is **lifecycle + options**
 * (`startX` / `startY`, `startCorner`, `anchorRef` / `anchorSelector`); a true DOM parent for the sprite
 * would require upstream engine changes.
 */
export default defineComponent({
  name: "NekoPet",
  props: {
    speed: Number,
    fps: Number,
    /**
     * Initial {@link BehaviorMode} at create time. Clicks on the pet change the live mode when
     * {@link allowBehaviorChange} is true; updating this prop does not recreate or override the
     * current mode.
     */
    behaviorMode: Number as PropType<BehaviorMode | undefined>,
    /**
     * Distance (px) at which the pet counts as idle for behavior logic (engine default: 6).
     */
    idleThreshold: Number,
    /**
     * Chase mode: stay at least this many pixels from the pointer (omit or 0 for default snap-to-cursor).
     */
    cursorStandoffPx: Number,
    /**
     * When clicking the pet may cycle {@link BehaviorMode}. Omit this prop to use the engine default
     * (`true`). A plain optional boolean prop would be `false` when absent; here `default: undefined`
     * so `createNeko` omits the field and engine defaults apply.
     */
    allowBehaviorChange: {
      type: Boolean,
      default: undefined,
    },
    /**
     * Pet-click mode order when {@link allowBehaviorChange} is true. Omit for the bundled default
     * seven-step cycle.
     */
    behaviorCycle: Array as PropType<BehaviorCycle | undefined>,
    /** Initial X in viewport pixels. `0` is valid; the engine treats omitted as `0`. */
    startX: Number,
    /** Initial Y in viewport pixels. `0` is valid; the engine treats omitted as `0`. */
    startY: Number,
    /**
     * When true (default), keep the animation loop running after `createNeko`. The engine always calls
     * `start()` inside `createNeko`; when false or when {@link mode} is `rest`, the wrapper calls
     * `stop()` right after creation.
     */
    autoStart: { type: Boolean, default: true },
    /**
     * When true (default), skip loading and creating the pet if the user prefers reduced motion
     * (see {@link prefersReducedMotion}). Set false to always run (e.g. after explicit user consent).
     */
    respectReducedMotion: { type: Boolean, default: true },
    /**
     * Place the pet at a viewport corner for any axis where {@link startX} / {@link startY} are omitted.
     */
    startCorner: String as PropType<NekoStartCorner | undefined>,
    /**
     * `document.querySelector` for an anchor element (client only). When set, `startX`/`startY` for
     * omitted axes use the element’s top-left in viewport space. `createNeko` waits until a match exists
     * with positive width and height. Prefer {@link useNeko}'s `anchorRef` in script when you have a ref.
     */
    anchorSelector: String,
    /**
     * `follow` — chase / run behaviors (loop running). `rest` — stay at the resolved home position
     * (loop stopped after each create).
     */
    mode: {
      type: String as PropType<NekoFollowMode>,
      default: "follow",
    },
    /**
     * When true, start in `rest`; the first pointer down on the sprite switches to `follow` without
     * consuming the engine’s first click-to-cycle step. Later clicks use the full cycle (including stay still and return home).
     * While waiting, {@link behaviorMode} is forced to {@link BehaviorMode.StayStill} and
     * {@link allowBehaviorChange} to true so the sprite stays clickable.
     */
    restUntilFirstPetInteraction: {
      type: Boolean,
      default: undefined,
    },
    /** Log placement and recreate steps to the console with prefix `[neko-vue]`. */
    debug: { type: Boolean, default: false },
  },
  setup(props, { expose }) {
    const nekoOptions = computed(() => ({
      speed: props.speed,
      fps: props.fps,
      behaviorMode: props.behaviorMode,
      idleThreshold: props.idleThreshold,
      cursorStandoffPx: props.cursorStandoffPx,
      allowBehaviorChange: props.allowBehaviorChange,
      behaviorCycle: props.behaviorCycle,
      startX: props.startX,
      startY: props.startY,
      autoStart: props.autoStart,
      respectReducedMotion: props.respectReducedMotion,
      startCorner: props.startCorner,
      anchorSelector: props.anchorSelector || undefined,
      mode: props.mode,
      restUntilFirstPetInteraction: props.restUntilFirstPetInteraction,
      debug: props.debug,
    }));

    const { instance } = useNeko(nekoOptions);
    expose({ instance });

    return () =>
      h("span", {
        class: "neko-vue-root",
        "aria-hidden": true,
      });
  },
}) as DefineComponent<NekoPetPublicProps>;
