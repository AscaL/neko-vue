<script setup lang="ts">
import type { NekoInstance } from "../../src/types/index";
import type { LiveStatLine } from "./PlaygroundLiveStats.vue";
import PlaygroundLiveStats from "./PlaygroundLiveStats.vue";
import { useNekoHud } from "./useNekoHud";

/**
 * Owns {@link useNekoHud} so rAF updates re-render only this subtree — not sibling forms with
 * open &lt;select&gt; dropdowns (parent would otherwise patch every frame).
 */
const props = defineProps<{
  /** Unwrapped `useNeko` instance from the parent (same object each frame; x/y mutate in place). */
  instance: NekoInstance | null;
  lines?: readonly LiveStatLine[];
}>();

const { hudBehavior, hudStartPosition, hudPosition } = useNekoHud(() => props.instance);
</script>

<template>
  <PlaygroundLiveStats
    compact
    wide-labels
    :behavior="hudBehavior"
    :start-position="hudStartPosition"
    :position="hudPosition"
    :lines="lines"
  />
</template>
