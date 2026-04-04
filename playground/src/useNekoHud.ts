import type { NekoInstance } from "../../src/types/index";
import { formatBehaviorMode } from "../../src/types/index";
import { onMounted, onUnmounted, ref } from "vue";

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
      hudBehavior.value = formatBehaviorMode(inst.behaviorMode);
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
