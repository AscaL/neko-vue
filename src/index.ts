export type {
  CreateNekoFn,
  LoadNekoRuntimeOptions,
  NekoInstance,
  NekoOptions,
} from "./types/index.ts";
export {
  BehaviorMode,
  BehaviorModes,
  DEFAULT_NEKO_BEHAVIOR_CYCLE,
  NEKOJS_SPRITE_SIZE,
} from "./types/index.ts";
export { nekoVueDebug } from "./utils/debugLog.ts";
export { loadNekoRuntime } from "./runtime/loadNekoRuntime.ts";
export { prefersReducedMotion } from "./utils/prefersReducedMotion.ts";
export {
  cornerToStartXY,
  type NekoStartCorner,
  resolveStartPosition,
} from "./placement/nekoPlacement.ts";
export { useNeko, type NekoFollowMode, type UseNekoOptions } from "./vue/useNeko.ts";
export { default as NekoPet } from "./vue/NekoPet.ts";
