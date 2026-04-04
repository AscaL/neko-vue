import type { NekoInstance } from "../../src/types/index";
import { BehaviorMode } from "../../src/types/index";
import { onMounted, onUnmounted, ref } from "vue";

const BEHAVIOR_LABELS: Record<BehaviorMode, string> = {
  [BehaviorMode.ChaseMouse]: "Chase pointer",
  [BehaviorMode.RunAwayFromMouse]: "Run away",
  [BehaviorMode.RunAroundRandomly]: "Random wander",
  [BehaviorMode.PaceAroundScreen]: "Pace edges",
  [BehaviorMode.BallChase]: "Ball chase",
  [BehaviorMode.StayStill]: "Stay still",
  [BehaviorMode.ReturnHomeAndStay]: "Return home & stay",
};

function formatBehavior(mode: number | undefined): string {
  if (mode === undefined) return "—";
  const label = BEHAVIOR_LABELS[mode as BehaviorMode];
  return label ? `${label} (${mode})` : `Unknown (${mode})`;
}

/**
 * Live readout for playground demos: polls the engine instance each animation frame.
 */
export function useNekoHud(getInstance: () => NekoInstance | null | undefined) {
  const hudBehavior = ref("—");
  const hudStartPosition = ref("—");
  const hudPosition = ref("—");

  let rafId = 0;
  let active = false;

  function frame() {
    if (!active) {
      return;
    }
    const inst = getInstance();
    if (!inst) {
      hudBehavior.value = "—";
      hudStartPosition.value = "—";
      hudPosition.value = "—";
    } else {
      hudBehavior.value = formatBehavior(inst.behaviorMode);
      const hx = inst.homeX;
      const hy = inst.homeY;
      hudStartPosition.value =
        hx !== undefined && hy !== undefined ? `${Math.round(hx)}, ${Math.round(hy)}` : "—";
      const x = inst.x;
      const y = inst.y;
      hudPosition.value =
        x !== undefined && y !== undefined ? `${Math.round(x)}, ${Math.round(y)}` : "—";
    }
    rafId = requestAnimationFrame(frame);
  }

  onMounted(() => {
    active = true;
    rafId = requestAnimationFrame(frame);
  });
  onUnmounted(() => {
    active = false;
    cancelAnimationFrame(rafId);
  });

  return { hudBehavior, hudStartPosition, hudPosition };
}
