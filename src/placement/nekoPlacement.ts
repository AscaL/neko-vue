import { nekoVueDebug } from "../utils/debugLog.ts";
import { NEKOJS_SPRITE_SIZE } from "../types/index.ts";

/** Viewport corner used to derive `startX` / `startY` (wrapper-only). */
export type NekoStartCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export function cornerToStartXY(
  corner: NekoStartCorner,
  spriteSize: number = NEKOJS_SPRITE_SIZE,
  debug = false,
): { startX: number; startY: number } {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  nekoVueDebug(debug, "cornerToStartXY viewport", {
    corner,
    spriteSize,
    documentElementClientWidth: vw,
    windowInnerHeight: vh,
    note: "If vw/vh are 0, corner math collapses to 0 — expect a second recreate after layout.",
  });
  switch (corner) {
    case "top-left":
      return { startX: 0, startY: 0 };
    case "top-right":
      return {
        startX: Math.max(0, vw - spriteSize),
        startY: 0,
      };
    case "bottom-left":
      return {
        startX: 0,
        startY: Math.max(0, vh - spriteSize),
      };
    case "bottom-right":
      return {
        startX: Math.max(0, vw - spriteSize),
        startY: Math.max(0, vh - spriteSize),
      };
  }
}

export type NekoPlacementInput = {
  startX?: number;
  startY?: number;
  startCorner?: NekoStartCorner;
  /** Resolved element (e.g. from `anchorRef` or `querySelector`). */
  anchorElement?: HTMLElement | null;
};

/**
 * Resolves `startX` / `startY` for `createNeko`. Explicit coordinates win per axis.
 * Then anchor top-left (when element is given). Then corner for any axis still unset.
 */
export function resolveStartPosition(
  input: NekoPlacementInput,
  debug = false,
): {
  startX: number;
  startY: number;
} {
  nekoVueDebug(debug, "resolveStartPosition input", {
    startX: input.startX,
    startY: input.startY,
    startCorner: input.startCorner,
    hasAnchor: Boolean(input.anchorElement),
  });

  let startX = input.startX;
  let startY = input.startY;

  const el = input.anchorElement;
  if (el) {
    const r = el.getBoundingClientRect();
    nekoVueDebug(debug, "resolveStartPosition anchor rect", {
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
    });
    if (startX === undefined) {
      startX = Math.round(r.left);
    }
    if (startY === undefined) {
      startY = Math.round(r.top);
    }
  }

  if (input.startCorner !== undefined) {
    const c = cornerToStartXY(input.startCorner, NEKOJS_SPRITE_SIZE, debug);
    if (startX === undefined) {
      startX = c.startX;
    }
    if (startY === undefined) {
      startY = c.startY;
    }
  }

  const out = {
    startX: startX ?? 0,
    startY: startY ?? 0,
  };
  nekoVueDebug(debug, "resolveStartPosition result", out);
  return out;
}
