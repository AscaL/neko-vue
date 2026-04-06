/**
 * Logic ticks, behaviors, and movement state machine for the bundled pet engine.
 */
import { BehaviorMode, NEKOJS_SPRITE_SIZE, type NekoEngineState } from "../types/index.ts";

const SPRITE_SIZE = NEKOJS_SPRITE_SIZE;

// Animation states (matching original Neko.h enum)
export const NekoState = {
  STOP: 0,
  WASH: 1,
  SCRATCH: 2,
  YAWN: 3,
  SLEEP: 4,
  AWAKE: 5,
  U_MOVE: 6,
  D_MOVE: 7,
  L_MOVE: 8,
  R_MOVE: 9,
  UL_MOVE: 10,
  UR_MOVE: 11,
  DL_MOVE: 12,
  DR_MOVE: 13,
  U_CLAW: 14,
  D_CLAW: 15,
  L_CLAW: 16,
  R_CLAW: 17,
} as const;

const STOP_TIME = 4;
const WASH_TIME = 10;
const SCRATCH_TIME = 4;
const YAWN_TIME = 3;
const AWAKE_TIME = 3;
const CLAW_TIME = 10;

export type MovementTickDeps = {
  setState: (n: number) => void;
  updateSprite: () => void;
};

export function createProcessOriginalTick(s: NekoEngineState, deps: MovementTickDeps): () => void {
  const { setState, updateSprite } = deps;

  function chaseMouse(): void {
    if (!s.hasMouseMoved) {
      runTowards(s.logicX + SPRITE_SIZE / 2, s.logicY + SPRITE_SIZE - 1);
      return;
    }
    const mx = s.mouseX;
    const my = s.mouseY;
    if (mx === null || my === null) return;

    const footX = s.logicX + SPRITE_SIZE / 2;
    const footY = s.logicY + SPRITE_SIZE - 1;
    if (!Number.isFinite(footX) || !Number.isFinite(footY)) {
      runTowards(SPRITE_SIZE / 2, SPRITE_SIZE - 1);
      return;
    }
    if (!Number.isFinite(mx) || !Number.isFinite(my)) {
      runTowards(footX, footY);
      return;
    }

    const standoff = s.cursorStandoffPx;
    if (standoff <= 0) {
      runTowards(mx, my);
      return;
    }

    const vx = mx - footX;
    const vy = my - footY;
    const d = Math.sqrt(vx * vx + vy * vy);
    if (!Number.isFinite(d) || d === 0 || d <= standoff) {
      runTowards(footX, footY);
      return;
    }
    const sx = mx - (vx / d) * standoff;
    const sy = my - (vy / d) * standoff;
    runTowards(sx, sy);
  }

  function runAwayFromMouse(): void {
    if (!s.hasMouseMoved) {
      runTowards(s.logicX + SPRITE_SIZE / 2, s.logicY + SPRITE_SIZE - 1);
      return;
    }

    const mx = s.mouseX;
    const my = s.mouseY;
    if (mx === null || my === null) return;
    if (!Number.isFinite(mx) || !Number.isFinite(my)) {
      runTowards(s.logicX + SPRITE_SIZE / 2, s.logicY + SPRITE_SIZE - 1);
      return;
    }

    const dwLimit = s.idleThreshold * 16;
    const xdiff = s.logicX + SPRITE_SIZE / 2 - mx;
    const ydiff = s.logicY + SPRITE_SIZE / 2 - my;

    if (Number.isFinite(dwLimit) && Math.abs(xdiff) < dwLimit && Math.abs(ydiff) < dwLimit) {
      const dLength = Math.sqrt(xdiff * xdiff + ydiff * ydiff);
      let targetX: number;
      let targetY: number;
      if (Number.isFinite(dLength) && dLength > 0) {
        targetX = s.logicX + (xdiff / dLength) * dwLimit;
        targetY = s.logicY + (ydiff / dLength) * dwLimit;
      } else {
        targetX = targetY = SPRITE_SIZE;
      }
      runTowards(targetX, targetY);
      if (s.state === NekoState.AWAKE) {
        calcDirection(targetX - s.logicX, targetY - s.logicY);
      }
    } else {
      runTowards(s.targetX, s.targetY);
    }
  }

  function runRandomly(): void {
    const footX = s.logicX + SPRITE_SIZE / 2;
    const footY = s.logicY + SPRITE_SIZE - 1;
    const dx = s.targetX - footX;
    const dy = s.targetY - footY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const arrived = Number.isFinite(dist) && dist <= Math.max(s.speed * 2, s.idleThreshold * 4);

    /* Skip wash/yawn/sleep/claw chains: they stall for many logic ticks and feel like “stopped”. */
    const idleOrBlockedAnimation =
      s.state === NekoState.WASH ||
      s.state === NekoState.SCRATCH ||
      s.state === NekoState.YAWN ||
      s.state === NekoState.SLEEP ||
      s.state === NekoState.U_CLAW ||
      s.state === NekoState.D_CLAW ||
      s.state === NekoState.L_CLAW ||
      s.state === NekoState.R_CLAW;

    if (arrived || idleOrBlockedAnimation) {
      s.actionCount = 0;
      s.targetX = Math.random() * s.boundsWidth;
      s.targetY = Math.random() * s.boundsHeight;
    }

    runTowards(s.targetX, s.targetY);
  }

  function paceAroundScreen(): void {
    if (s.lastMoveDX === 0 && s.lastMoveDY === 0) {
      s.cornerIndex = ((s.cornerIndex || 0) + 1) % 4;
    }

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
    const dwBoundingBox = s.speed * 8;

    if (!s.ballActive) {
      s.ballX = Math.random() * (s.boundsWidth - dwBoundingBox);
      s.ballY = Math.random() * (s.boundsHeight - dwBoundingBox);
      s.ballVX = (Math.random() < 0.5 ? 1 : -1) * (s.speed / 2) + 1;
      s.ballVY = (Math.random() < 0.5 ? 1 : -1) * (s.speed / 2) + 1;
      s.ballActive = true;
    }

    s.ballX += s.ballVX;
    s.ballY += s.ballVY;

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

  function stayStillBehavior(): void {
    runTowards(s.logicX + SPRITE_SIZE / 2, s.logicY + SPRITE_SIZE - 1);
  }

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

  function calcDirection(dx: number, dy: number): void {
    let newState: number;

    if (dx === 0 && dy === 0) {
      newState = NekoState.STOP;
    } else {
      const largeX = dx;
      const largeY = -dy;
      const length = Math.sqrt(largeX * largeX + largeY * largeY);
      if (!Number.isFinite(length) || length <= 0) {
        newState = NekoState.STOP;
      } else {
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
    }

    if (s.state !== newState) {
      setState(newState);
    }
  }

  function runTowards(targetX: number, targetY: number): void {
    const footX = s.logicX + SPRITE_SIZE / 2;
    const footY = s.logicY + SPRITE_SIZE - 1;
    if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
      targetX = footX;
      targetY = footY;
    }

    s.oldTargetX = s.targetX;
    s.oldTargetY = s.targetY;
    s.targetX = targetX;
    s.targetY = targetY;

    const dx = targetX - s.logicX - SPRITE_SIZE / 2;
    const dy = targetY - s.logicY - SPRITE_SIZE + 1;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (Number.isFinite(distance) && distance > 0) {
      if (distance <= s.speed) {
        s.moveDX = Math.trunc(dx);
        s.moveDY = Math.trunc(dy);
      } else {
        s.moveDX = Math.trunc((s.speed * dx) / distance);
        s.moveDY = Math.trunc((s.speed * dy) / distance);
      }
    } else {
      s.moveDX = 0;
      s.moveDY = 0;
    }

    s.lastMoveDX = s.moveDX;
    s.lastMoveDY = s.moveDY;

    const moveStart = !(
      s.oldTargetX >= s.targetX - s.idleThreshold &&
      s.oldTargetX <= s.targetX + s.idleThreshold &&
      s.oldTargetY >= s.targetY - s.idleThreshold &&
      s.oldTargetY <= s.targetY + s.idleThreshold
    );

    switch (s.state) {
      case NekoState.STOP:
        if (moveStart) {
          setState(NekoState.AWAKE);
        } else if (s.stateCount >= STOP_TIME) {
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
      case NekoState.DR_MOVE: {
        let newX = s.logicX + s.moveDX;
        let newY = s.logicY + s.moveDY;
        const wasOutside =
          newX <= 0 || newX >= s.boundsWidth || newY <= 0 || newY >= s.boundsHeight;

        calcDirection(s.moveDX, s.moveDY);

        newX = Math.max(0, Math.min(s.boundsWidth, newX));
        newY = Math.max(0, Math.min(s.boundsHeight, newY));
        const notMoved = newX === s.logicX && newY === s.logicY;

        if (wasOutside && notMoved) {
          setState(NekoState.STOP);
        } else {
          s.logicX = newX;
          s.logicY = newY;
        }
        break;
      }

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

  function processOriginalTick(): void {
    s.tickCount++;
    if (s.tickCount >= 9999) s.tickCount = 0;

    if (s.tickCount % 2 === 0) {
      s.stateCount++;
    }

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

    updateSprite();
  }

  return processOriginalTick;
}
