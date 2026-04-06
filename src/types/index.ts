/** Sprite edge length in CSS pixels for viewport bounds (see runtime `readViewportBounds`). */
export const NEKOJS_SPRITE_SIZE = 32 as const;

/**
 * Pet behavior / AI mode. Numeric values **must** match the bundled engine (`src/runtime/nekoEngineMovement.ts`).
 * Click cycles through {@link NekoOptions.behaviorCycle} when `allowBehaviorChange` is true.
 */
export enum BehaviorMode {
  /** Follow the pointer. */
  ChaseMouse = 0,
  /** Flee from the pointer. */
  RunAwayFromMouse = 1,
  /** Wander randomly. */
  RunAroundRandomly = 2,
  /** Walk the screen edges. */
  PaceAroundScreen = 3,
  /** Ball-style chase (engine: run-around mode). */
  BallChase = 4,
  /** Hold the current position (no wandering). */
  StayStill = 5,
  /**
   * Walk back to the spawn position from `createNeko` options, then stay there until the next mode.
   * Last step when clicking through the behavior cycle.
   */
  ReturnHomeAndStay = 6,
}

/** Ordered list passed to `createNeko` / pet-click rotation. */
export type BehaviorCycle = readonly BehaviorMode[];

/**
 * Every {@link BehaviorMode} exactly once, ascending by engine id **0 … 6** (canonical order).
 * The default click cycle follows this sequence end-to-end.
 */
export const BEHAVIOR_MODES_IN_ORDER = [
  BehaviorMode.ChaseMouse,
  BehaviorMode.RunAwayFromMouse,
  BehaviorMode.RunAroundRandomly,
  BehaviorMode.PaceAroundScreen,
  BehaviorMode.BallChase,
  BehaviorMode.StayStill,
  BehaviorMode.ReturnHomeAndStay,
] as const satisfies readonly BehaviorMode[];

const VALID_BEHAVIOR_MODES: ReadonlySet<BehaviorMode> = new Set(BEHAVIOR_MODES_IN_ORDER);

/** True if `n` is a known engine behavior id ({@link BehaviorMode}). */
export function isBehaviorMode(n: unknown): n is BehaviorMode {
  return typeof n === "number" && Number.isInteger(n) && VALID_BEHAVIOR_MODES.has(n);
}

/** Short camelCase aliases — same values as {@link BehaviorMode}, ordered like {@link BEHAVIOR_MODES_IN_ORDER}. */
export const BehaviorModes = {
  chase: BehaviorMode.ChaseMouse,
  runAway: BehaviorMode.RunAwayFromMouse,
  random: BehaviorMode.RunAroundRandomly,
  pace: BehaviorMode.PaceAroundScreen,
  ballChase: BehaviorMode.BallChase,
  stayStill: BehaviorMode.StayStill,
  returnHome: BehaviorMode.ReturnHomeAndStay,
} as const satisfies Record<string, BehaviorMode>;

/**
 * Default pet-click order when {@link NekoOptions.behaviorCycle} is omitted — same sequence as
 * {@link BEHAVIOR_MODES_IN_ORDER}.
 */
export const DEFAULT_NEKO_BEHAVIOR_CYCLE: BehaviorCycle = [...BEHAVIOR_MODES_IN_ORDER];

/**
 * Short user-facing label for each {@link BehaviorMode} (HUD, logs, selects). See also
 * {@link behaviorModeEnumName} for the TypeScript enum member name.
 */
export const BEHAVIOR_MODE_LABELS: Record<BehaviorMode, string> = {
  [BehaviorMode.ChaseMouse]: "Chase pointer",
  [BehaviorMode.RunAwayFromMouse]: "Run away",
  [BehaviorMode.RunAroundRandomly]: "Random wander",
  [BehaviorMode.PaceAroundScreen]: "Pace edges",
  [BehaviorMode.BallChase]: "Ball chase",
  [BehaviorMode.StayStill]: "Stay still",
  [BehaviorMode.ReturnHomeAndStay]: "Return home & stay",
};

/**
 * Enum member name for a mode (e.g. `ChaseMouse`), not the numeric id — useful for logs and IDE-friendly strings.
 */
export function behaviorModeEnumName(mode: BehaviorMode): string {
  const name = BehaviorMode[mode];
  return typeof name === "string" ? name : String(mode);
}

/**
 * Single-line description: `ChaseMouse — Chase pointer`. Omits raw `0…6` ids. Use for HUD / debug.
 */
export function formatBehaviorMode(mode: BehaviorMode | undefined): string {
  if (mode === undefined) {
    return "—";
  }
  return `${behaviorModeEnumName(mode)} — ${BEHAVIOR_MODE_LABELS[mode]}`;
}

/**
 * Builds a {@link BehaviorCycle} with a stable public type (avoids inferred `0 | 2 | …` unions on literals).
 */
export function behaviorCycleOf(...modes: BehaviorMode[]): BehaviorCycle {
  return modes;
}

/**
 * Options for `createNeko` (see runtime / `loadNekoRuntime`).
 *
 * Numeric defaults use **nullish coalescing** (`??`): omit or pass `undefined` for engine defaults;
 * **`0` is a real value** for `speed`, `fps`, `idleThreshold`, `startX`, and `startY` on this interface.
 * Bounds: `visualViewport` width/height (when available and positive) or else
 * `document.documentElement.clientWidth` / `window.innerHeight`, each minus {@link NEKOJS_SPRITE_SIZE}
 * (see runtime `readViewportBounds`).
 */
export interface NekoOptions {
  /**
   * Pixels per logic tick (default **24** when omitted; logic runs ~5 ticks/sec).
   */
  speed?: number;
  /**
   * Nominal display rate (default **120** when omitted). The bundled engine steps `update()` from
   * `requestAnimationFrame` using `1000 / fps` ms between steps.
   */
  fps?: number;
  /**
   * Initial {@link BehaviorMode} when the instance is **created**. Clicks on the pet cycle the
   * live mode in the engine; changing this option later does **not** recreate the pet or override
   * the current mode (see wrapper behavior).
   */
  behaviorMode?: BehaviorMode;
  /**
   * Distance at which the pet is considered idle (default **6** when omitted; **`0` is allowed**).
   */
  idleThreshold?: number;
  /**
   * In {@link BehaviorMode.ChaseMouse}, keep at least this many CSS pixels between the pet’s
   * movement anchor and the pointer (default / omitted: 0 = original “hug the cursor” behavior).
   */
  cursorStandoffPx?: number;
  /**
   * Whether clicking the pet cycles behavior (default: true).
   */
  allowBehaviorChange?: boolean;
  /**
   * Ordered modes advanced on each pet click when {@link allowBehaviorChange} is true. Order is
   * click order (wraps after the last). Omit to use {@link DEFAULT_NEKO_BEHAVIOR_CYCLE}. Non-integer
   * or unknown ids are ignored; if none remain, the default cycle is used.
   */
  behaviorCycle?: BehaviorCycle;
  /**
   * Initial X position. `0` is valid; omit for default `0`.
   */
  startX?: number;
  /**
   * Initial Y position. `0` is valid; omit for default `0`.
   */
  startY?: number;
  /**
   * Called after each pet click advances the live {@link behaviorMode} (when
   * {@link allowBehaviorChange} is true). Receives the **new** mode. Captured when the instance is
   * created; changing this reference in `useNeko` options triggers recreate (use a stable function
   * if you want to avoid that).
   */
  onBehaviorModeChange?: (mode: BehaviorMode) => void;
  /**
   * When true, a short built-in label appears above the sprite with the new behavior’s
   * {@link BEHAVIOR_MODE_LABELS} text after each successful click cycle step.
   */
  showBehaviorOnClick?: boolean;
}

/**
 * Minimal handle returned by {@link createNeko} / {@link loadNekoRuntime}. The bundled engine may
 * expose additional helpers (e.g. `isIdle`).
 */
export interface NekoInstance {
  /** Starts or resumes the `requestAnimationFrame` animation loop. */
  start(): void;
  /** Stops the animation loop without removing the pet from the DOM. */
  stop(): void;
  /** Stops the loop, removes listeners, and deletes the pet element. */
  destroy(): void;
  /**
   * Current engine behavior mode (updated when the user clicks the pet if `allowBehaviorChange` is
   * true). The bundled engine implements this; mocks may omit it.
   */
  behaviorMode?: BehaviorMode;
  /** Current X in viewport pixels (bundled engine). */
  x?: number;
  /** Current Y in viewport pixels (bundled engine). */
  y?: number;
  /**
   * Spawn / home top-left from `createNeko` (`startX` / `startY`); return-home uses this. Bundled
   * engine implements.
   */
  homeX?: number;
  homeY?: number;
  /**
   * Bundled engine only — whether the sprite is in a stationary / idle animation state.
   * Test mocks may omit.
   */
  isIdle?(): boolean;
  /**
   * Bundled engine only — assign PNG/Data URL frames for the sprite. Used internally by `createNeko`.
   * Test mocks may omit.
   */
  setSprites?(sprites: readonly string[]): void;
}

/** All mutable fields for the viewport-fixed pet engine (closure-scoped; used by `nekojsRuntime`). */
export type NekoEngineState = {
  fps: number;
  speed: number;
  behaviorMode: BehaviorMode;
  idleThreshold: number;
  state: number;
  tickCount: number;
  stateCount: number;
  x: number;
  y: number;
  logicX: number;
  logicY: number;
  prevLogicX: number;
  prevLogicY: number;
  targetX: number;
  targetY: number;
  oldTargetX: number;
  oldTargetY: number;
  moveDX: number;
  moveDY: number;
  boundsWidth: number;
  boundsHeight: number;
  mouseX: number | null;
  mouseY: number | null;
  hasMouseMoved: boolean;
  element: HTMLDivElement;
  spriteImg: HTMLImageElement;
  spriteImages: string[];
  allowBehaviorChange: boolean;
  animationTable: [number, number][];
  cornerIndex: number;
  ballX: number;
  ballY: number;
  ballVX: number;
  ballVY: number;
  /** Set when ball-chase mode has spawned the invisible ball; cleared when leaving that mode. */
  ballActive: boolean;
  running: boolean;
  animationFrameId: number | null;
  tickAccumulator: number;
  actionCount: number;
  lastMoveDX: number;
  lastMoveDY: number;
  cursorStandoffPx: number;
  behaviorCycle: readonly BehaviorMode[];
  /** Initial spawn/home from options; re-clamped on resize so the viewport can grow again. */
  placementHomeX: number;
  placementHomeY: number;
  homeX: number;
  homeY: number;
  /** From {@link NekoOptions.onBehaviorModeChange}; invoked after each click cycle step. */
  onBehaviorModeChange?: (mode: BehaviorMode) => void;
  /** From {@link NekoOptions.showBehaviorOnClick}. */
  showBehaviorOnClick: boolean;
  /** Built-in behavior label element; cleaned up in `destroy`. */
  behaviorHintEl: HTMLDivElement | null;
  /** Browser timer id from `window.setTimeout` (numeric in DOM typings). */
  behaviorHintTimeoutId: number | null;
};

/** Full engine handle: {@link NekoInstance} plus internal helpers (`setSprites`, `isIdle`). */
export type NekoEngineApi = NekoInstance & {
  setSprites(sprites: readonly string[]): void;
  isIdle(): boolean;
};

export type CreateNekoFn = (options?: NekoOptions) => NekoInstance;

export interface LoadNekoRuntimeOptions {
  /** Abort if the bundled runtime has not loaded within this time (ms). Default: 30000. */
  timeoutMs?: number;
}

declare global {
  interface Window {
    createNeko?: CreateNekoFn;
  }
}
