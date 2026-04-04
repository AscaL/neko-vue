<script setup lang="ts">
import { BehaviorMode, useNeko } from "../../src/index";
import { computed, unref, useTemplateRef } from "vue";
import PlaygroundLiveStats from "./PlaygroundLiveStats.vue";
import { useNekoHud } from "./useNekoHud";

/** Vue 3.5+: `useTemplateRef` for the anchor. On Vue 3.4 use `ref<HTMLElement | null>(null)` + `ref="anchor"`. */
const anchor = useTemplateRef<HTMLDivElement>("anchor");

const { petInteractionAwake, instance, isReady, skippedForReducedMotion } = useNeko(
  computed(() => ({
    anchorRef: anchor,
    mode: "follow",
    speed: 20,
    /** After the first-click gate, first create uses stay-still; wake recreates with chase (HUD shows “Chase pointer”). */
    behaviorMode: BehaviorMode.ChaseMouse,
    restUntilFirstPetInteraction: true,
    debug: import.meta.env.DEV,
  })),
);

const { hudBehavior, hudStartPosition, hudPosition } = useNekoHud(() => unref(instance));

const extraLines = computed(() => [
  { label: "isReady", value: isReady.value ? "yes" : "no" },
  { label: "skipped (motion)", value: skippedForReducedMotion.value ? "yes" : "no" },
  {
    label: "first-click gate",
    value: petInteractionAwake.value ? "awake" : "waiting",
  },
]);
</script>

<template>
  <section class="demo">
    <h2><code>useNeko</code> — composable + anchor</h2>
    <p class="lede">
      Pass <code>anchorRef</code> from <code>useTemplateRef</code> (Vue 3.5+). Resolved spawn
      <code>startX</code>/<code>startY</code> follow the dashed box’s <strong>top-left</strong> in
      the viewport; if the box moves or resizes, the pet can recreate to match (see
      <code>ResizeObserver</code> in the library).
    </p>
    <p class="hint">
      <strong>Try it:</strong> the cat should sit <strong>still</strong> on the anchor until the
      first <strong>pointer down on the cat</strong> — then it
      <strong>chases the pointer</strong> (<code>BehaviorMode.ChaseMouse</code> after wake). Move
      the cat, then keep <strong>clicking the cat</strong> until
      <strong>return home &amp; stay</strong> (last of seven) — it walks back to this box’s corner.
      Only clicks change behavior; recreates from layout keep the current mode. The live panel shows
      gate state and composable flags.
    </p>
    <div ref="anchor" class="anchor" aria-hidden="true">Spawn anchor (top-left of this box)</div>
    <PlaygroundLiveStats
      :behavior="hudBehavior"
      :start-position="hudStartPosition"
      :position="hudPosition"
      :lines="extraLines"
    />
  </section>
</template>

<style scoped>
.demo {
  margin-bottom: 2rem;
  padding-top: 0.25rem;
}
.lede {
  line-height: 1.55;
  margin: 0 0 0.75rem;
  color: #1e293b;
}
.hint {
  line-height: 1.5;
  margin: 0 0 0.75rem;
  font-size: 0.95rem;
  color: #333;
}
.anchor {
  display: inline-block;
  margin-top: 0.5rem;
  margin-bottom: 0.25rem;
  padding: 1.5rem 2rem;
  border: 2px dashed #888;
  border-radius: 8px;
  background: #f6f6f6;
  font-size: 0.85rem;
  color: #444;
}
code {
  font-size: 0.95em;
}
</style>
