/** Sprite edge length in CSS pixels for viewport bounds (`clientWidth/innerHeight - this`). */
export const NEKOJS_SPRITE_SIZE = 32 as const;

/**
 * Pet behavior / AI mode. Values match the engine; click cycles when `allowBehaviorChange` is true.
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

/** Short camelCase aliases — same values as {@link BehaviorMode}. */
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
 * Default pet-click order when {@link NekoOptions.behaviorCycle} is omitted (full classic cycle).
 */
export const DEFAULT_NEKO_BEHAVIOR_CYCLE: readonly BehaviorMode[] = [
  BehaviorMode.ChaseMouse,
  BehaviorMode.RunAwayFromMouse,
  BehaviorMode.RunAroundRandomly,
  BehaviorMode.PaceAroundScreen,
  BehaviorMode.BallChase,
  BehaviorMode.StayStill,
  BehaviorMode.ReturnHomeAndStay,
];

/**
 * Options for {@link createNeko}.
 *
 * Note: coordinates use `options.startX || 0`, so `0` is valid; omitting `startX`/`startY`
 * falls back to `0`. Horizontal bounds use `document.documentElement.clientWidth -
 * {@link NEKOJS_SPRITE_SIZE}`; vertical uses `window.innerHeight - {@link NEKOJS_SPRITE_SIZE}`.
 */
export interface NekoOptions {
  /**
   * Pixels per logic tick (default: 24; logic runs ~5 ticks/sec).
   */
  speed?: number;
  /**
   * Render frame rate (default: 120).
   */
  fps?: number;
  /**
   * Initial {@link BehaviorMode} when the instance is **created**. Clicks on the pet cycle the
   * live mode in the engine; changing this option later does **not** recreate the pet or override
   * the current mode (see wrapper behavior).
   */
  behaviorMode?: BehaviorMode;
  /**
   * Distance at which the pet is considered idle (default: 6).
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
   * or out-of-range values are ignored; if none remain, the default cycle is used.
   */
  behaviorCycle?: readonly BehaviorMode[];
  /**
   * Initial X position. `0` is valid; omit for default `0`.
   */
  startX?: number;
  /**
   * Initial Y position. `0` is valid; omit for default `0`.
   */
  startY?: number;
}

/**
 * Minimal handle returned by {@link createNeko} / {@link loadNekoRuntime}. The concrete {@link Neko}
 * class may expose additional helpers (e.g. `isIdle`).
 */
export interface NekoInstance {
  /** Starts or resumes the animation interval. */
  start(): void;
  /** Stops the interval without removing the pet from the DOM. */
  stop(): void;
  /** Stops the loop, removes listeners, and deletes the pet element. */
  destroy(): void;
  /**
   * Current engine behavior mode (updated when the user clicks the pet if `allowBehaviorChange` is
   * true). The bundled `Neko` class implements this; mocks may omit it.
   */
  behaviorMode?: BehaviorMode;
  /** Current X in viewport pixels (bundled `Neko` implements). */
  x?: number;
  /** Current Y in viewport pixels (bundled `Neko` implements). */
  y?: number;
  /**
   * Spawn / home top-left from `createNeko` (`startX` / `startY`); return-home uses this. Bundled
   * `Neko` implements.
   */
  homeX?: number;
  homeY?: number;
}

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
