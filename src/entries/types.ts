/**
 * Subpath: `neko-vue/types` — engine-facing types, enums, and constants (no Vue, no loader).
 */
export type {
  BehaviorCycle,
  CreateNekoFn,
  LoadNekoRuntimeOptions,
  NekoInstance,
  NekoOptions,
} from "../types/index.ts";
export {
  BEHAVIOR_MODES_IN_ORDER,
  BEHAVIOR_MODE_LABELS,
  BehaviorMode,
  BehaviorModes,
  behaviorCycleOf,
  behaviorModeEnumName,
  DEFAULT_NEKO_BEHAVIOR_CYCLE,
  formatBehaviorMode,
  isBehaviorMode,
  NEKOJS_SPRITE_SIZE,
} from "../types/index.ts";
