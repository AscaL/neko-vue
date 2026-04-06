import { NEKOJS_SPRITE_SIZE } from "../types/index.ts";

/**
 * Layout viewport bounds for the fixed pet: max top-left X/Y so the sprite stays fully visible.
 * Uses {@link Window.visualViewport} when available (mobile URL bar / pinch), else
 * `document.documentElement.clientWidth` and `window.innerHeight`.
 */
export function readViewportBounds(spriteSize: number = NEKOJS_SPRITE_SIZE): {
  boundsWidth: number;
  boundsHeight: number;
} {
  const vv = typeof window !== "undefined" ? window.visualViewport : undefined;
  if (vv && vv.width > 0 && vv.height > 0) {
    return {
      boundsWidth: Math.max(0, vv.width - spriteSize),
      boundsHeight: Math.max(0, vv.height - spriteSize),
    };
  }
  return {
    boundsWidth: Math.max(0, document.documentElement.clientWidth - spriteSize),
    boundsHeight: Math.max(0, window.innerHeight - spriteSize),
  };
}
