/**
 * Typed pet runtime. Inspired by [nekojs](https://github.com/louisabraham/nekojs); licensing in
 * repo `LICENSE`. Sprite data in `./nekoSpritesData.ts`.
 */
import { NEKO_SPRITES } from "./nekoSpritesData.ts";
import {
  BehaviorMode,
  DEFAULT_NEKO_BEHAVIOR_CYCLE,
  formatBehaviorMode,
  isBehaviorMode,
  type NekoEngineApi,
  type NekoEngineState,
  type NekoInstance,
  type NekoOptions,
} from "../types/index.ts";

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

// Animation states (matching original Neko.h enum)
const NekoState = {
  STOP: 0,
  WASH: 1,
  SCRATCH: 2,
  YAWN: 3,
  SLEEP: 4,
  AWAKE: 5,
  U_MOVE: 6, // Up
  D_MOVE: 7, // Down
  L_MOVE: 8, // Left
  R_MOVE: 9, // Right
  UL_MOVE: 10, // Up-Left
  UR_MOVE: 11, // Up-Right
  DL_MOVE: 12, // Down-Left
  DR_MOVE: 13, // Down-Right
  U_CLAW: 14, // Clawing upward (at top boundary)
  D_CLAW: 15, // Clawing downward (at bottom boundary)
  L_CLAW: 16, // Clawing left (at left boundary)
  R_CLAW: 17, // Clawing right (at right boundary)
};

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

// Animation timing constants (in frames)
const STOP_TIME = 4;
const WASH_TIME = 10;
const SCRATCH_TIME = 4;
const YAWN_TIME = 3;
const AWAKE_TIME = 3;
const CLAW_TIME = 10;

/** Sprite edge length in CSS pixels. */
const SPRITE_SIZE = 32;

/**
 * Viewport-fixed sprite pet: chase behaviors, `start` / `stop` / `destroy` lifecycle.
 * Functional factory (closure over mutable state); document listeners use `AbortController`.
 */
function buildNekoEngine(options: NekoOptions = {}): NekoEngineApi {
  const listenersAbort = new AbortController();
  const s = {} as NekoEngineState;

  /** One-time: populate `s` from options, then `init()` (DOM + listeners). */
  function configure(options: NekoOptions = {}) {
    // Configuration
    s.fps = options.fps ?? 120; // Target FPS (default 120 for smooth movement)
    // Original used 16 pixels/tick for 640x480 screens (~2.5% of width)
    // Modern screens are ~3x larger, so default to 24 for similar feel
    s.speed = options.speed ?? 24;
    s.behaviorMode =
      options.behaviorMode !== undefined && isBehaviorMode(options.behaviorMode)
        ? options.behaviorMode
        : BehaviorMode.ChaseMouse;
    s.idleThreshold = options.idleThreshold ?? 6; // Original m_dwIdleSpace = 6
    const standoff = options.cursorStandoffPx;
    s.cursorStandoffPx =
      typeof standoff === "number" && Number.isFinite(standoff) && standoff > 0 ? standoff : 0;

    // State
    s.state = NekoState.STOP;
    s.tickCount = 0; // Increments every frame (like m_uTickCount)
    s.stateCount = 0; // Increments every 2 original ticks (like m_uStateCount)

    // Position (display position for smooth rendering)
    s.x = options.startX ?? 0;
    s.y = options.startY ?? 0;
    s.homeX = s.x;
    s.homeY = s.y;
    // Logic position (updated at original 5 FPS tick rate)
    s.logicX = s.x;
    s.logicY = s.y;
    // Previous logic position (for interpolation)
    s.prevLogicX = s.x;
    s.prevLogicY = s.y;
    // Target tracking
    s.targetX = s.x;
    s.targetY = s.y;
    s.oldTargetX = s.x;
    s.oldTargetY = s.y;
    // Movement deltas (preserved like m_nDX, m_nDY in original)
    s.moveDX = 0;
    s.moveDY = 0;

    // Bounds - clientWidth excludes scrollbar, innerHeight is viewport height
    s.boundsWidth = Math.max(0, document.documentElement.clientWidth - SPRITE_SIZE);
    s.boundsHeight = Math.max(0, window.innerHeight - SPRITE_SIZE);

    // Mouse tracking - null until first mouse event
    // This prevents neko from running somewhere before user moves mouse
    s.mouseX = null;
    s.mouseY = null;
    s.hasMouseMoved = false;

    // DOM element (assigned in init())
    s.spriteImages = [];
    s.allowBehaviorChange = options.allowBehaviorChange !== false; // Default true
    s.behaviorCycle = normalizeBehaviorCycle(options.behaviorCycle);

    // Animation lookup table (maps state to sprite indices)
    // Format: [frame1_index, frame2_index]
    // These MUST match the original C++ m_nAnimation table EXACTLY
    // From Neko.cpp lines 40-57:
    s.animationTable = [
      [28, 28], // STOP: m_nAnimation[STOP][0]=28, [1]=28
      [25, 28], // WASH: m_nAnimation[WASH][0]=25, [1]=28
      [26, 27], // SCRATCH: m_nAnimation[SCRATCH][0]=26, [1]=27
      [29, 29], // YAWN: m_nAnimation[YAWN][0]=29, [1]=29
      [30, 31], // SLEEP: m_nAnimation[SLEEP][0]=30, [1]=31
      [0, 0], // AWAKE: m_nAnimation[AWAKE][0]=0, [1]=0
      [1, 2], // U_MOVE: m_nAnimation[U_MOVE][0]=1, [1]=2
      [9, 10], // D_MOVE: m_nAnimation[D_MOVE][0]=9, [1]=10
      [13, 14], // L_MOVE: m_nAnimation[L_MOVE][0]=13, [1]=14
      [5, 6], // R_MOVE: m_nAnimation[R_MOVE][0]=5, [1]=6
      [15, 16], // UL_MOVE: m_nAnimation[UL_MOVE][0]=15, [1]=16
      [3, 4], // UR_MOVE: m_nAnimation[UR_MOVE][0]=3, [1]=4
      [11, 12], // DL_MOVE: m_nAnimation[DL_MOVE][0]=11, [1]=12
      [7, 8], // DR_MOVE: m_nAnimation[DR_MOVE][0]=7, [1]=8
      [17, 18], // U_CLAW: m_nAnimation[U_CLAW][0]=17, [1]=18
      [23, 24], // D_CLAW: m_nAnimation[D_CLAW][0]=23, [1]=24
      [21, 22], // L_CLAW: m_nAnimation[L_CLAW][0]=21, [1]=22
      [19, 20], // R_CLAW: m_nAnimation[R_CLAW][0]=19, [1]=20
    ];

    // Additional state for behaviors
    s.cornerIndex = 0;
    s.ballX = 0;
    s.ballY = 0;
    s.ballVX = 0;
    s.ballVY = 0;

    init();
  }

  /**
   * Keeps the sprite, home, chase targets, and ball inside the viewport after `innerWidth` /
   * `innerHeight` change. Without this, a still pet (or `stop()`ped `rest` mode) can remain off-screen
   * with no ticks to clamp position.
   */
  function clampLayoutToViewport(): void {
    const bw = Math.max(0, document.documentElement.clientWidth - SPRITE_SIZE);
    const bh = Math.max(0, window.innerHeight - SPRITE_SIZE);
    s.boundsWidth = bw;
    s.boundsHeight = bh;

    const clamp = (v: number, max: number): number =>
      max <= 0 ? 0 : Math.max(0, Math.min(max, v));

    s.homeX = clamp(s.homeX, bw);
    s.homeY = clamp(s.homeY, bh);

    s.logicX = clamp(s.logicX, bw);
    s.logicY = clamp(s.logicY, bh);
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

    if (!(s.ballX === 0 && s.ballY === 0)) {
      s.ballX = clamp(s.ballX, bw);
      s.ballY = clamp(s.ballY, bh);
    }

    updatePosition();
  }

  function init(): void {
    // Create the neko element with defensive styles to prevent global CSS interference
    s.element = document.createElement("div");
    s.element.className = "neko";
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

    // Create image element with defensive styles to prevent global CSS interference
    const img = document.createElement("img");
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

    document.body.appendChild(s.element);

    // Click to cycle through behaviors
    // Use mousedown instead of click - click requires mouseup on same element,
    // which fails if the cat moves between mousedown and mouseup
    const signal = listenersAbort.signal;

    if (s.allowBehaviorChange) {
      s.element.addEventListener(
        "mousedown",
        (e) => {
          e.stopPropagation();
          e.preventDefault(); // Prevent text selection
          // Make cat appear surprised/awake
          setState(NekoState.AWAKE);
          cycleBehavior();
        },
        { signal },
      );
    }

    // Track mouse position - set flag on first move
    document.addEventListener(
      "mousemove",
      (e) => {
        s.mouseX = e.clientX;
        s.mouseY = e.clientY;
        s.hasMouseMoved = true;
      },
      { signal },
    );

    // Update bounds on resize and clamp layout so the sprite stays reachable (incl. when `stop()`ped).
    window.addEventListener("resize", () => clampLayoutToViewport(), { signal });

    // Keep initial `startX` / `startY` (placement / corners / anchor). Do not randomize — callers
    // rely on resolved coordinates; random spawn would ignore `createNeko` options.
    s.targetX = s.x + SPRITE_SIZE / 2;
    s.targetY = s.y + SPRITE_SIZE - 1;
    s.oldTargetX = s.targetX;
    s.oldTargetY = s.targetY;
    updatePosition();

    // Animation loop
    s.running = false;
    s.intervalId = null;
  }

  /** Starts the render / logic interval (runs at `fps`). */
  function start(): void {
    if (s.running) return;
    s.running = true;

    // Calculate interval from FPS
    // Higher FPS = smoother movement while maintaining same speed
    const interval = 1000 / s.fps;
    s.intervalId = setInterval(() => {
      update();
    }, interval);
  }

  /** Stops the interval; does not remove the DOM node or reset position. */
  function stop(): void {
    s.running = false;
    if (s.intervalId) {
      clearInterval(s.intervalId);
      s.intervalId = null;
    }
  }

  /** Assigns PNG data URLs for animation frames (see `NEKO_SPRITES` in `./nekoSpritesData.ts`). */
  function setSprites(sprites: readonly string[]): void {
    s.spriteImages = [...sprites];
    updateSprite();
  }

  function updateSprite(): void {
    if (s.spriteImages.length === 0) return;

    // Get the current animation frame index
    // Uses tickCount which is scaled to match original 5 FPS timing
    let frameIndex: number;
    if (s.state === NekoState.SLEEP) {
      // Slower animation for sleep (toggles every 4 ticks in original = 800ms)
      frameIndex = s.animationTable[s.state][(s.tickCount >> 2) & 0x1];
    } else {
      // Normal animation speed (toggles every tick in original = 200ms)
      frameIndex = s.animationTable[s.state][s.tickCount & 0x1];
    }

    // Update the image
    const img = s.element.querySelector("img");
    if (img && s.spriteImages[frameIndex]) {
      img.src = s.spriteImages[frameIndex];
    }
  }

  function updatePosition(): void {
    s.element.style.left = Math.round(s.x) + "px";
    s.element.style.top = Math.round(s.y) + "px";
  }

  function update(): void {
    // Track time accumulator for original tick timing
    // Original runs at 5 FPS (200ms per tick), we run at s.fps
    // We need to accumulate fractional ticks and process when we hit a full tick
    const originalFPS = 5;
    s.tickAccumulator += originalFPS / s.fps;

    // Process as many original ticks as have accumulated
    while (s.tickAccumulator >= 1) {
      s.tickAccumulator -= 1;
      // Save previous position before processing tick
      s.prevLogicX = s.logicX;
      s.prevLogicY = s.logicY;
      processOriginalTick();
    }

    // Smooth interpolation between logic positions
    // tickAccumulator represents progress (0-1) towards next tick
    const t = s.tickAccumulator;
    s.x = s.prevLogicX + (s.logicX - s.prevLogicX) * t;
    s.y = s.prevLogicY + (s.logicY - s.prevLogicY) * t;

    // Update display position every frame
    updatePosition();
  }

  function processOriginalTick(): void {
    // This runs at the original 5 FPS equivalent timing
    // Increment tick counter (like m_uTickCount)
    s.tickCount++;
    if (s.tickCount >= 9999) s.tickCount = 0;

    // Increment state counter every 2 ticks (like original)
    if (s.tickCount % 2 === 0) {
      s.stateCount++;
    }

    // Update behavior based on mode
    switch (s.behaviorMode) {
      case BehaviorMode.ChaseMouse:
        chaseMouse();
        break;
      case BehaviorMode.RunAwayFromMouse:
        runAwayFromMouse();
        break;
      case BehaviorMode.RunAroundRandomly:
        runRandomly();
        break;
      case BehaviorMode.PaceAroundScreen:
        paceAroundScreen();
        break;
      case BehaviorMode.BallChase:
        runAround();
        break;
      case BehaviorMode.StayStill:
        stayStillBehavior();
        break;
      case BehaviorMode.ReturnHomeAndStay:
        returnHomeAndStayBehavior();
        break;
    }

    // Update animation frame
    updateSprite();
  }

  function chaseMouse(): void {
    // Don't chase until mouse has moved at least once
    if (!s.hasMouseMoved) {
      // Just idle in place - pass target that results in zero movement
      runTowards(s.logicX + SPRITE_SIZE / 2, s.logicY + SPRITE_SIZE - 1);
      return;
    }
    const mx = s.mouseX;
    const my = s.mouseY;
    if (mx === null || my === null) return;

    const footX = s.logicX + SPRITE_SIZE / 2;
    const footY = s.logicY + SPRITE_SIZE - 1;
    const standoff = s.cursorStandoffPx;
    if (standoff <= 0) {
      runTowards(mx, my);
      return;
    }

    const vx = mx - footX;
    const vy = my - footY;
    const d = Math.sqrt(vx * vx + vy * vy);
    if (d <= standoff || d === 0) {
      runTowards(footX, footY);
      return;
    }
    const sx = mx - (vx / d) * standoff;
    const sy = my - (vy / d) * standoff;
    runTowards(sx, sy);
  }

  function runAwayFromMouse(): void {
    // Don't run away until mouse has moved
    if (!s.hasMouseMoved) {
      runTowards(s.logicX + SPRITE_SIZE / 2, s.logicY + SPRITE_SIZE - 1);
      return;
    }

    const mx = s.mouseX;
    const my = s.mouseY;
    if (mx === null || my === null) return;

    // Original uses m_dwIdleSpace * 16 as the trigger distance
    const dwLimit = s.idleThreshold * 16;
    const xdiff = s.logicX + SPRITE_SIZE / 2 - mx;
    const ydiff = s.logicY + SPRITE_SIZE / 2 - my;

    if (Math.abs(xdiff) < dwLimit && Math.abs(ydiff) < dwLimit) {
      // Mouse cursor is too close - run away
      const dLength = Math.sqrt(xdiff * xdiff + ydiff * ydiff);
      let targetX, targetY;
      if (dLength !== 0) {
        targetX = s.logicX + (xdiff / dLength) * dwLimit;
        targetY = s.logicY + (ydiff / dLength) * dwLimit;
      } else {
        targetX = targetY = 32;
      }
      runTowards(targetX, targetY);
      // Skip awake animation like original
      if (s.state === NekoState.AWAKE) {
        calcDirection(targetX - s.logicX, targetY - s.logicY);
      }
    } else {
      // Keep running to current target (idle in place)
      runTowards(s.targetX, s.targetY);
    }
  }

  function runRandomly(): void {
    // Original: increments actionCount while sleeping, picks new target after idleSpace*10
    if (s.state === NekoState.SLEEP) {
      s.actionCount = (s.actionCount || 0) + 1;
    }
    if ((s.actionCount || 0) > s.idleThreshold * 10) {
      s.actionCount = 0;
      s.targetX = Math.random() * s.boundsWidth;
      s.targetY = Math.random() * s.boundsHeight;
      runTowards(s.targetX, s.targetY);
    } else {
      runTowards(s.targetX, s.targetY);
    }
  }

  function paceAroundScreen(): void {
    // Original checks if neko has stopped moving (m_nDX == 0 && m_nDY == 0)
    // We track this via lastMoveDX/DY
    if (s.lastMoveDX === 0 && s.lastMoveDY === 0) {
      s.cornerIndex = ((s.cornerIndex || 0) + 1) % 4;
    }

    // Corners offset by sprite size (matching original)
    // Target positions that result in neko stopping at the corners
    const corners = [
      [SPRITE_SIZE + SPRITE_SIZE / 2, SPRITE_SIZE + SPRITE_SIZE - 1],
      [SPRITE_SIZE + SPRITE_SIZE / 2, s.boundsHeight - SPRITE_SIZE + SPRITE_SIZE - 1],
      [
        s.boundsWidth - SPRITE_SIZE + SPRITE_SIZE / 2,
        s.boundsHeight - SPRITE_SIZE + SPRITE_SIZE - 1,
      ],
      [s.boundsWidth - SPRITE_SIZE + SPRITE_SIZE / 2, SPRITE_SIZE + SPRITE_SIZE - 1],
    ];

    const target = corners[s.cornerIndex || 0];
    runTowards(target[0], target[1]);
  }

  function runAround(): void {
    // Original ball physics with repelling from edges
    const dwBoundingBox = s.speed * 8;

    // Initialize ball if needed (matching original init)
    if (s.ballX === 0 && s.ballY === 0) {
      s.ballX = Math.random() * (s.boundsWidth - dwBoundingBox);
      s.ballY = Math.random() * (s.boundsHeight - dwBoundingBox);
      s.ballVX = (Math.random() < 0.5 ? 1 : -1) * (s.speed / 2) + 1;
      s.ballVY = (Math.random() < 0.5 ? 1 : -1) * (s.speed / 2) + 1;
    }

    // Move invisible ball
    s.ballX += s.ballVX;
    s.ballY += s.ballVY;

    // Repel from edges (original logic)
    if (s.ballX < dwBoundingBox) {
      if (s.ballX > 0) s.ballVX++;
      else s.ballVX = -s.ballVX;
    } else if (s.ballX > s.boundsWidth - dwBoundingBox) {
      if (s.ballX < s.boundsWidth) s.ballVX--;
      else s.ballVX = -s.ballVX;
    }

    if (s.ballY < dwBoundingBox) {
      if (s.ballY > 0) s.ballVY++;
      else s.ballVY = -s.ballVY;
    } else if (s.ballY > s.boundsHeight - dwBoundingBox) {
      if (s.ballY < s.boundsHeight) s.ballVY--;
      else s.ballVY = -s.ballVY;
    }

    runTowards(s.ballX, s.ballY);
  }

  /** Idle in place at the current logic position (same target pattern as "wait for mouse"). */
  function stayStillBehavior(): void {
    runTowards(s.logicX + SPRITE_SIZE / 2, s.logicY + SPRITE_SIZE - 1);
  }

  /** Move toward spawn, then idle there. */
  function returnHomeAndStayBehavior(): void {
    const targetX = s.homeX + SPRITE_SIZE / 2;
    const targetY = s.homeY + SPRITE_SIZE - 1;
    const dx = targetX - s.logicX - SPRITE_SIZE / 2;
    const dy = targetY - s.logicY - SPRITE_SIZE + 1;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance <= s.speed) {
      s.logicX = s.homeX;
      s.logicY = s.homeY;
      s.prevLogicX = s.homeX;
      s.prevLogicY = s.homeY;
    }
    runTowards(targetX, targetY);
  }

  function setState(newState: number): void {
    // Reset counters on state change (like original SetState)
    s.tickCount = 0;
    s.stateCount = 0;
    s.state = newState;
  }

  function runTowards(targetX: number, targetY: number): void {
    // Store old target for MoveStart check
    s.oldTargetX = s.targetX;
    s.oldTargetY = s.targetY;
    s.targetX = targetX;
    s.targetY = targetY;

    // Calculate distance to target (using logic position, not display position)
    const dx = targetX - s.logicX - SPRITE_SIZE / 2; // Stop in middle of cursor
    const dy = targetY - s.logicY - SPRITE_SIZE + 1; // Just above cursor
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Calculate movement delta (like original m_nDX, m_nDY)
    // Store on `s` so they persist across ticks
    // IMPORTANT: Use integers like original to prevent direction flickering
    // which causes state resets and prevents wall clawing
    if (distance !== 0) {
      if (distance <= s.speed) {
        // Less than top speed - jump the gap
        s.moveDX = Math.trunc(dx);
        s.moveDY = Math.trunc(dy);
      } else {
        // More than top speed - run at top speed
        s.moveDX = Math.trunc((s.speed * dx) / distance);
        s.moveDY = Math.trunc((s.speed * dy) / distance);
      }
    } else {
      s.moveDX = 0;
      s.moveDY = 0;
    }

    // Store for paceAroundScreen check
    s.lastMoveDX = s.moveDX;
    s.lastMoveDY = s.moveDY;

    // Check if target moved (MoveStart equivalent)
    const moveStart = !(
      s.oldTargetX >= s.targetX - s.idleThreshold &&
      s.oldTargetX <= s.targetX + s.idleThreshold &&
      s.oldTargetY >= s.targetY - s.idleThreshold &&
      s.oldTargetY <= s.targetY + s.idleThreshold
    );

    // State machine (matching original RunTowards switch)
    switch (s.state) {
      case NekoState.STOP:
        if (moveStart) {
          setState(NekoState.AWAKE);
        } else if (s.stateCount >= STOP_TIME) {
          // Check for wall scratching using preserved moveDX/moveDY
          if (s.moveDX < 0 && s.logicX <= 0) {
            setState(NekoState.L_CLAW);
          } else if (s.moveDX > 0 && s.logicX >= s.boundsWidth) {
            setState(NekoState.R_CLAW);
          } else if (s.moveDY < 0 && s.logicY <= 0) {
            setState(NekoState.U_CLAW);
          } else if (s.moveDY > 0 && s.logicY >= s.boundsHeight) {
            setState(NekoState.D_CLAW);
          } else {
            setState(NekoState.WASH);
          }
        }
        break;

      case NekoState.WASH:
        if (moveStart) {
          setState(NekoState.AWAKE);
        } else if (s.stateCount >= WASH_TIME) {
          setState(NekoState.SCRATCH);
        }
        break;

      case NekoState.SCRATCH:
        if (moveStart) {
          setState(NekoState.AWAKE);
        } else if (s.stateCount >= SCRATCH_TIME) {
          setState(NekoState.YAWN);
        }
        break;

      case NekoState.YAWN:
        if (moveStart) {
          setState(NekoState.AWAKE);
        } else if (s.stateCount >= YAWN_TIME) {
          setState(NekoState.SLEEP);
        }
        break;

      case NekoState.SLEEP:
        if (moveStart) {
          setState(NekoState.AWAKE);
        }
        break;

      case NekoState.AWAKE:
        if (s.stateCount >= AWAKE_TIME + Math.floor(Math.random() * 20)) {
          calcDirection(s.moveDX, s.moveDY);
        }
        break;

      case NekoState.U_MOVE:
      case NekoState.D_MOVE:
      case NekoState.L_MOVE:
      case NekoState.R_MOVE:
      case NekoState.UL_MOVE:
      case NekoState.UR_MOVE:
      case NekoState.DL_MOVE:
      case NekoState.DR_MOVE:
        // Calculate new position using preserved moveDX/moveDY
        let newX = s.logicX + s.moveDX;
        let newY = s.logicY + s.moveDY;
        const wasOutside =
          newX <= 0 || newX >= s.boundsWidth || newY <= 0 || newY >= s.boundsHeight;

        // Update direction
        calcDirection(s.moveDX, s.moveDY);

        // Clamp position
        newX = Math.max(0, Math.min(s.boundsWidth, newX));
        newY = Math.max(0, Math.min(s.boundsHeight, newY));
        const notMoved = newX === s.logicX && newY === s.logicY;

        // Stop if we can't go further
        if (wasOutside && notMoved) {
          setState(NekoState.STOP);
        } else {
          s.logicX = newX;
          s.logicY = newY;
        }
        break;

      case NekoState.U_CLAW:
      case NekoState.D_CLAW:
      case NekoState.L_CLAW:
      case NekoState.R_CLAW:
        if (moveStart) {
          setState(NekoState.AWAKE);
        } else if (s.stateCount >= CLAW_TIME) {
          setState(NekoState.SCRATCH);
        }
        break;

      default:
        setState(NekoState.STOP);
        break;
    }
  }

  function calcDirection(dx: number, dy: number): void {
    // Calculate direction based on movement delta (like original CalcDirection)
    let newState: number;

    if (dx === 0 && dy === 0) {
      newState = NekoState.STOP;
    } else {
      const largeX = dx;
      const largeY = -dy; // Y is inverted
      const length = Math.sqrt(largeX * largeX + largeY * largeY);
      const sinTheta = largeY / length;

      const sinPiPer8 = 0.3826834323651;
      const sinPiPer8Times3 = 0.9238795325113;

      if (dx > 0) {
        if (sinTheta > sinPiPer8Times3) {
          newState = NekoState.U_MOVE;
        } else if (sinTheta > sinPiPer8) {
          newState = NekoState.UR_MOVE;
        } else if (sinTheta > -sinPiPer8) {
          newState = NekoState.R_MOVE;
        } else if (sinTheta > -sinPiPer8Times3) {
          newState = NekoState.DR_MOVE;
        } else {
          newState = NekoState.D_MOVE;
        }
      } else {
        if (sinTheta > sinPiPer8Times3) {
          newState = NekoState.U_MOVE;
        } else if (sinTheta > sinPiPer8) {
          newState = NekoState.UL_MOVE;
        } else if (sinTheta > -sinPiPer8) {
          newState = NekoState.L_MOVE;
        } else if (sinTheta > -sinPiPer8Times3) {
          newState = NekoState.DL_MOVE;
        } else {
          newState = NekoState.D_MOVE;
        }
      }
    }

    if (s.state !== newState) {
      setState(newState);
    }
  }

  /** @returns True when the sprite is in a stationary / idle animation state. */
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

  function cycleBehavior(): void {
    const behaviors = s.behaviorCycle;
    const currentIndex = behaviors.indexOf(s.behaviorMode);
    const nextIndex = (currentIndex + 1) % behaviors.length;
    s.behaviorMode = behaviors[nextIndex]!;

    // Reset state to wake the cat up if sleeping
    if (s.state === NekoState.SLEEP) {
      setState(NekoState.AWAKE);
    }

    const nextMode = behaviors[nextIndex]!;
    console.log(`Neko behavior: ${formatBehaviorMode(nextMode)}`);
  }

  /**
   * Stops the animation loop, removes listeners, and drops the pet node from the document.
   * Safe to call more than once.
   */
  function destroy(): void {
    stop();
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
