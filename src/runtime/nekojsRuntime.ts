/**
 * Typed pet runtime. Inspired by [nekojs](https://github.com/louisabraham/nekojs); licensing in
 * repo `LICENSE`. Sprite data in `./nekoSpritesData.ts`.
 */
import { createProcessOriginalTick, NekoState } from "./nekoEngineMovement.ts";
import { readViewportBounds } from "./nekoViewport.ts";
import { NEKO_SPRITES } from "./nekoSpritesData.ts";
import {
  BEHAVIOR_MODE_LABELS,
  BehaviorMode,
  DEFAULT_NEKO_BEHAVIOR_CYCLE,
  isBehaviorMode,
  NEKOJS_SPRITE_SIZE,
  type NekoEngineApi,
  type NekoEngineState,
  type NekoInstance,
  type NekoOptions,
} from "../types/index.ts";

const SPRITE_SIZE = NEKOJS_SPRITE_SIZE;

function normalizeBehaviorCycle(raw: NekoOptions["behaviorCycle"]): readonly BehaviorMode[] {
  const fallback = (): BehaviorMode[] => [...DEFAULT_NEKO_BEHAVIOR_CYCLE];
  if (!raw?.length) {
    return fallback();
  }
  const out: BehaviorMode[] = [];
  for (const m of raw) {
    if (isBehaviorMode(m)) {
      out.push(m);
    }
  }
  return out.length > 0 ? out : fallback();
}

function finiteOpt(n: number | undefined, fallback: number): number {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

/**
 * Legacy C-style names exposed on `globalThis` — numeric values match {@link BehaviorMode}
 * (engine / original Action enum).
 */
const NekoJsBehaviorMode = {
  CHASE_MOUSE: BehaviorMode.ChaseMouse,
  RUN_AWAY_FROM_MOUSE: BehaviorMode.RunAwayFromMouse,
  RUN_AROUND_RANDOMLY: BehaviorMode.RunAroundRandomly,
  PACE_AROUND_SCREEN: BehaviorMode.PaceAroundScreen,
  RUN_AROUND: BehaviorMode.BallChase,
  STAY_STILL: BehaviorMode.StayStill,
  RETURN_HOME_AND_STAY: BehaviorMode.ReturnHomeAndStay,
} as const;

/**
 * Viewport-fixed sprite pet: chase behaviors, `start` / `stop` / `destroy` lifecycle.
 * Functional factory (closure over mutable state); document listeners use `AbortController`.
 */
function buildNekoEngine(options: NekoOptions = {}): NekoEngineApi {
  const listenersAbort = new AbortController();
  const s = {} as NekoEngineState;

  let resizeRafId = 0;
  function scheduleResizeClamp(): void {
    if (resizeRafId !== 0) {
      cancelAnimationFrame(resizeRafId);
    }
    resizeRafId = requestAnimationFrame(() => {
      resizeRafId = 0;
      clampLayoutToViewport();
    });
  }

  let processOriginalTick: () => void;

  function setState(newState: number): void {
    s.tickCount = 0;
    s.stateCount = 0;
    s.state = newState;
  }

  function updateSprite(): void {
    if (s.spriteImages.length === 0) return;

    let frameIndex: number;
    if (s.state === NekoState.SLEEP) {
      frameIndex = s.animationTable[s.state][(s.tickCount >> 2) & 0x1];
    } else {
      frameIndex = s.animationTable[s.state][s.tickCount & 0x1];
    }

    const url = s.spriteImages[frameIndex];
    if (url) {
      s.spriteImg.src = url;
    }
  }

  function updatePosition(): void {
    s.element.style.left = Math.round(s.x) + "px";
    s.element.style.top = Math.round(s.y) + "px";
  }

  function update(): void {
    const originalFPS = 5;
    s.tickAccumulator += originalFPS / s.fps;

    while (s.tickAccumulator >= 1) {
      s.tickAccumulator -= 1;
      s.prevLogicX = s.logicX;
      s.prevLogicY = s.logicY;
      processOriginalTick();
    }

    if (!Number.isFinite(s.tickAccumulator)) {
      s.tickAccumulator = 0;
    }
    const t = s.tickAccumulator;
    s.x = s.prevLogicX + (s.logicX - s.prevLogicX) * t;
    s.y = s.prevLogicY + (s.logicY - s.prevLogicY) * t;
    if (!Number.isFinite(s.x) || !Number.isFinite(s.y)) {
      s.x = Number.isFinite(s.logicX) ? s.logicX : 0;
      s.y = Number.isFinite(s.logicY) ? s.logicY : 0;
    }

    updatePosition();
  }

  let rafAccumMs = 0;
  let rafLastTs = 0;

  function animationFrameLoop(ts: number): void {
    if (!s.running) return;
    if (rafLastTs === 0) rafLastTs = ts;
    const delta = ts - rafLastTs;
    rafLastTs = ts;
    rafAccumMs += delta;
    const frameMs = 1000 / s.fps;
    while (rafAccumMs >= frameMs) {
      rafAccumMs -= frameMs;
      update();
    }
    s.animationFrameId = requestAnimationFrame(animationFrameLoop);
  }

  /**
   * Keeps the sprite, home, chase targets, and ball inside the viewport after resize. Re-clamps
   * placement home so growing the window restores intended spawn.
   */
  function clampLayoutToViewport(): void {
    const { boundsWidth: bw, boundsHeight: bh } = readViewportBounds(SPRITE_SIZE);
    s.boundsWidth = bw;
    s.boundsHeight = bh;

    const clamp = (v: number, max: number): number =>
      max <= 0 ? 0 : Math.max(0, Math.min(max, Number.isFinite(v) ? v : 0));

    const hx = clamp(s.placementHomeX, bw);
    const hy = clamp(s.placementHomeY, bh);
    s.homeX = hx;
    s.homeY = hy;

    // Always snap logic + display to clamped placement so shrink/grow matches resolved home for
    // every behavior (running or stopped).
    s.logicX = hx;
    s.logicY = hy;
    s.prevLogicX = s.logicX;
    s.prevLogicY = s.logicY;
    s.x = s.logicX;
    s.y = s.logicY;
    s.tickAccumulator = 0;

    const footX = s.logicX + SPRITE_SIZE / 2;
    const footY = s.logicY + SPRITE_SIZE - 1;
    s.targetX = footX;
    s.targetY = footY;
    s.oldTargetX = footX;
    s.oldTargetY = footY;

    if (s.ballActive) {
      s.ballX = clamp(s.ballX, bw);
      s.ballY = clamp(s.ballY, bh);
    }

    updatePosition();
  }

  function init(): void {
    s.element = document.createElement("div");
    s.element.className = "neko";
    // The pet is a decorative, mouse-only widget appended to <body> (outside any
    // landmark and not keyboard-focusable). Hide the whole subtree from the
    // accessibility tree so it doesn't trip axe `image-alt`/`region` checks or add
    // noise for assistive tech.
    s.element.setAttribute("aria-hidden", "true");
    s.element.style.cssText = `
      position: fixed;
      width: ${SPRITE_SIZE}px;
      height: ${SPRITE_SIZE}px;
      image-rendering: pixelated;
      pointer-events: ${s.allowBehaviorChange ? "auto" : "none"};
      cursor: ${s.allowBehaviorChange ? "pointer" : "default"};
      z-index: 999999;
      left: ${s.x}px;
      top: ${s.y}px;
      margin: 0;
      padding: 0;
      border: none;
      background: transparent;
      overflow: visible;
      box-sizing: border-box;
      user-select: none;
      -webkit-user-select: none;
    `;

    const img = document.createElement("img");
    img.alt = ""; // decorative sprite — empty alt + aria-hidden ancestor keep it out of the a11y tree
    img.style.cssText = `
      width: 100%;
      height: 100%;
      background: transparent;
      border: none;
      margin: 0;
      padding: 0;
      max-width: none;
      max-height: none;
      display: block;
      box-sizing: border-box;
      user-select: none;
      -webkit-user-select: none;
      -webkit-user-drag: none;
      pointer-events: none;
    `;
    s.element.appendChild(img);
    s.spriteImg = img;

    document.body.appendChild(s.element);

    const signal = listenersAbort.signal;

    if (s.allowBehaviorChange) {
      s.element.addEventListener(
        "mousedown",
        (e) => {
          e.stopPropagation();
          e.preventDefault();
          setState(NekoState.AWAKE);
          cycleBehavior();
        },
        { signal },
      );
    }

    document.addEventListener(
      "mousemove",
      (e) => {
        s.mouseX = e.clientX;
        s.mouseY = e.clientY;
        s.hasMouseMoved = true;
      },
      { signal },
    );

    window.addEventListener("resize", scheduleResizeClamp, { signal });
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", scheduleResizeClamp, { signal });
      vv.addEventListener("scroll", scheduleResizeClamp, { signal });
    }

    s.targetX = s.x + SPRITE_SIZE / 2;
    s.targetY = s.y + SPRITE_SIZE - 1;
    s.oldTargetX = s.targetX;
    s.oldTargetY = s.targetY;
    updatePosition();

    s.running = false;
    s.animationFrameId = null;
  }

  function clearBehaviorHint(): void {
    if (s.behaviorHintTimeoutId !== null) {
      clearTimeout(s.behaviorHintTimeoutId);
      s.behaviorHintTimeoutId = null;
    }
    if (s.behaviorHintEl?.parentNode === s.element) {
      s.element.removeChild(s.behaviorHintEl);
    }
    s.behaviorHintEl = null;
  }

  function flashBehaviorHint(): void {
    if (s.behaviorHintTimeoutId !== null) {
      clearTimeout(s.behaviorHintTimeoutId);
      s.behaviorHintTimeoutId = null;
    }
    if (!s.behaviorHintEl) {
      const el = document.createElement("div");
      el.className = "neko-behavior-hint";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      el.style.cssText = [
        "position:absolute",
        "left:0",
        "bottom:100%",
        "margin-bottom:4px",
        "padding:2px 6px",
        "font-size:11px",
        "line-height:1.2",
        "font-family:system-ui,sans-serif",
        "background:rgba(0,0,0,0.78)",
        "color:#fff",
        "border-radius:3px",
        "pointer-events:none",
        "white-space:nowrap",
        "z-index:1",
        "max-width:min(240px,70vw)",
        "overflow:hidden",
        "text-overflow:ellipsis",
      ].join(";");
      s.element.appendChild(el);
      s.behaviorHintEl = el;
    }
    s.behaviorHintEl.textContent = BEHAVIOR_MODE_LABELS[s.behaviorMode];
    s.behaviorHintEl.style.visibility = "visible";

    s.behaviorHintTimeoutId = window.setTimeout(() => {
      s.behaviorHintTimeoutId = null;
      if (s.behaviorHintEl) {
        s.behaviorHintEl.style.visibility = "hidden";
      }
    }, 2200);
  }

  function cycleBehavior(): void {
    const behaviors = s.behaviorCycle;
    if (behaviors.length === 0) {
      return;
    }
    const currentIndex = behaviors.indexOf(s.behaviorMode);
    const prevMode = behaviors[currentIndex]!;
    const nextIndex = (currentIndex + 1) % behaviors.length;
    const nextMode = behaviors[nextIndex]!;
    s.behaviorMode = nextMode;

    if (prevMode === BehaviorMode.BallChase && nextMode !== BehaviorMode.BallChase) {
      s.ballActive = false;
      s.ballX = 0;
      s.ballY = 0;
      s.ballVX = 0;
      s.ballVY = 0;
    }

    if (nextMode === BehaviorMode.RunAroundRandomly) {
      s.actionCount = 0;
      s.targetX = Math.random() * s.boundsWidth;
      s.targetY = Math.random() * s.boundsHeight;
      s.oldTargetX = s.targetX;
      s.oldTargetY = s.targetY;
    }

    if (s.state === NekoState.SLEEP) {
      setState(NekoState.AWAKE);
    }

    s.onBehaviorModeChange?.(s.behaviorMode);
    if (s.showBehaviorOnClick) {
      flashBehaviorHint();
    }
  }

  /** One-time: populate `s` from options, then `init()` (DOM + listeners). */
  function configure(options: NekoOptions = {}) {
    const fpsOpt = options.fps;
    s.fps = typeof fpsOpt === "number" && Number.isFinite(fpsOpt) && fpsOpt > 0 ? fpsOpt : 120;
    const speedOpt = options.speed;
    s.speed =
      typeof speedOpt === "number" && Number.isFinite(speedOpt) && speedOpt >= 0 ? speedOpt : 24;
    s.behaviorMode =
      options.behaviorMode !== undefined && isBehaviorMode(options.behaviorMode)
        ? options.behaviorMode
        : BehaviorMode.ChaseMouse;
    const idleOpt = options.idleThreshold;
    s.idleThreshold =
      typeof idleOpt === "number" && Number.isFinite(idleOpt) && idleOpt >= 0 ? idleOpt : 6;
    const standoff = options.cursorStandoffPx;
    s.cursorStandoffPx =
      typeof standoff === "number" && Number.isFinite(standoff) && standoff > 0 ? standoff : 0;

    s.state = NekoState.STOP;
    s.tickCount = 0;
    s.stateCount = 0;
    s.tickAccumulator = 0;

    s.x = finiteOpt(options.startX, 0);
    s.y = finiteOpt(options.startY, 0);
    s.homeX = s.x;
    s.homeY = s.y;
    s.placementHomeX = s.homeX;
    s.placementHomeY = s.homeY;
    s.logicX = s.x;
    s.logicY = s.y;
    s.prevLogicX = s.x;
    s.prevLogicY = s.y;
    s.targetX = s.x;
    s.targetY = s.y;
    s.oldTargetX = s.x;
    s.oldTargetY = s.y;
    s.moveDX = 0;
    s.moveDY = 0;

    const { boundsWidth, boundsHeight } = readViewportBounds(SPRITE_SIZE);
    s.boundsWidth = boundsWidth;
    s.boundsHeight = boundsHeight;

    s.mouseX = null;
    s.mouseY = null;
    s.hasMouseMoved = false;

    s.spriteImages = [];
    s.allowBehaviorChange = options.allowBehaviorChange !== false;
    s.behaviorCycle = normalizeBehaviorCycle(options.behaviorCycle);
    s.onBehaviorModeChange = options.onBehaviorModeChange;
    s.showBehaviorOnClick = options.showBehaviorOnClick === true;
    s.behaviorHintEl = null;
    s.behaviorHintTimeoutId = null;

    s.animationTable = [
      [28, 28],
      [25, 28],
      [26, 27],
      [29, 29],
      [30, 31],
      [0, 0],
      [1, 2],
      [9, 10],
      [13, 14],
      [5, 6],
      [15, 16],
      [3, 4],
      [11, 12],
      [7, 8],
      [17, 18],
      [23, 24],
      [21, 22],
      [19, 20],
    ];

    s.cornerIndex = 0;
    s.ballX = 0;
    s.ballY = 0;
    s.ballVX = 0;
    s.ballVY = 0;
    s.ballActive = false;
    s.actionCount = 0;
    s.lastMoveDX = 0;
    s.lastMoveDY = 0;

    processOriginalTick = createProcessOriginalTick(s, { setState, updateSprite });

    init();

    if (s.behaviorMode === BehaviorMode.RunAroundRandomly) {
      s.actionCount = 0;
      s.targetX = Math.random() * s.boundsWidth;
      s.targetY = Math.random() * s.boundsHeight;
      s.oldTargetX = s.targetX;
      s.oldTargetY = s.targetY;
      updatePosition();
    }
  }

  function start(): void {
    if (s.running) return;
    s.running = true;
    rafAccumMs = 0;
    rafLastTs = 0;
    s.animationFrameId = requestAnimationFrame(animationFrameLoop);
  }

  function stop(): void {
    s.running = false;
    if (s.animationFrameId !== null) {
      cancelAnimationFrame(s.animationFrameId);
      s.animationFrameId = null;
    }
  }

  function setSprites(sprites: readonly string[]): void {
    s.spriteImages = [...sprites];
    updateSprite();
  }

  function isIdle(): boolean {
    return (
      s.state === NekoState.STOP ||
      s.state === NekoState.WASH ||
      s.state === NekoState.SCRATCH ||
      s.state === NekoState.YAWN ||
      s.state === NekoState.SLEEP ||
      s.state === NekoState.AWAKE
    );
  }

  function destroy(): void {
    stop();
    clearBehaviorHint();
    if (resizeRafId !== 0) {
      cancelAnimationFrame(resizeRafId);
      resizeRafId = 0;
    }
    listenersAbort.abort();
    if (s.element?.parentNode) {
      s.element.parentNode.removeChild(s.element);
    }
  }

  configure(options);

  return {
    start,
    stop,
    destroy,
    setSprites,
    isIdle,
    get behaviorMode() {
      return s.behaviorMode;
    },
    get x() {
      return s.x;
    },
    get y() {
      return s.y;
    },
    get homeX() {
      return s.homeX;
    },
    get homeY() {
      return s.homeY;
    },
  };
}

/**
 * Creates a pet, wires bundled sprites, and calls `start`.
 *
 * @param options - Engine options; see {@link NekoOptions}. Omit for defaults.
 * @returns The running instance (`start` already called).
 */
export function createNeko(options?: NekoOptions): NekoInstance {
  const pet = buildNekoEngine(options ?? {});
  pet.setSprites(NEKO_SPRITES);
  pet.start();
  return pet;
}

function installNekoGlobals(): void {
  if (typeof globalThis === "undefined" || typeof document === "undefined") return;
  const w = globalThis as typeof globalThis & {
    Neko?: (opts?: NekoOptions) => NekoEngineApi;
    NekoState?: typeof NekoState;
    BehaviorMode?: typeof NekoJsBehaviorMode;
    createNeko?: typeof createNeko;
  };
  w.Neko = (opts?: NekoOptions) => buildNekoEngine(opts ?? {});
  w.NekoState = NekoState;
  w.BehaviorMode = NekoJsBehaviorMode;
  w.createNeko = createNeko;
}

installNekoGlobals();
