/**
 * True when the user has requested less motion (OS / browser setting).
 * Safe on SSR (returns false) and when `matchMedia` is missing.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  } catch {
    return false;
  }
}
