<script setup lang="ts">
import { BehaviorMode, formatBehaviorMode, NekoPet } from "../../src/index";
import type { NekoInstance } from "../../src/types/index";
import { computed, ref, useTemplateRef, unref, type Ref } from "vue";
import PlaygroundLiveStats from "./PlaygroundLiveStats.vue";
import { useNekoHud } from "./useNekoHud";

const debugPlacement = import.meta.env.DEV;

const petRef = useTemplateRef<{ instance: Ref<NekoInstance | null> }>("pet");
const { hudBehavior, hudStartPosition, hudPosition } = useNekoHud(() =>
  unref(petRef.value?.instance),
);

/** Last payload from {@link NekoPet}'s `behaviorModeChange` emit (same timing as `onBehaviorModeChange`). */
const lastEmitLabel = ref("—");

function onPetBehaviorModeChange(mode: BehaviorMode): void {
  lastEmitLabel.value = formatBehaviorMode(mode);
}

const emitStatLines = computed(() => [
  {
    label: "@behavior-mode-change (last)",
    value: lastEmitLabel.value,
  },
]);
</script>

<template>
  <section class="demo">
    <h2><code>&lt;NekoPet /&gt;</code> — declarative</h2>
    <p class="lede">
      Configure the pet with props only — no <code>setup</code> handle required. This demo uses
      <code>start-corner="bottom-right"</code> and <code>rest-until-first-pet-interaction</code> so
      the first interaction is calm, then chase.
    </p>
    <p class="hint">
      <strong>Try it:</strong> the cat starts frozen until you <strong>click it</strong> — that
      wakes chase. Further <strong>clicks on the cat</strong> cycle behavior (seven steps): chase →
      run away → random → pace → ball chase → stay still → return home &amp; stay → … A short
      built-in label (<code>show-behavior-on-click</code>) appears above the sprite on each cycle
      step; the live panel records the last <code>@behavior-mode-change</code> emit. Changing
      <code>behavior-mode</code> in code only affects the <em>first</em> create; after that, only
      clicks change mode. Here <strong>home</strong> is the bottom-right corner spawn.
    </p>
    <p class="api-note">
      This page uses <code>ref="pet"</code> on <code>NekoPet</code> and the component’s exposed
      <code>instance</code> ref (same handle as <code>useNeko()</code>) to drive the live panel
      below — useful when you stay declarative but still need the engine for debugging or UI.
    </p>
    <NekoPet
      ref="pet"
      start-corner="bottom-right"
      rest-until-first-pet-interaction
      show-behavior-on-click
      :debug="debugPlacement"
      @behavior-mode-change="onPetBehaviorModeChange"
    />
    <PlaygroundLiveStats
      :behavior="hudBehavior"
      :start-position="hudStartPosition"
      :position="hudPosition"
      :lines="emitStatLines"
    />
  </section>
</template>

<style scoped>
.demo {
  margin-bottom: 2rem;
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
.api-note {
  line-height: 1.45;
  margin: 0 0 1rem;
  font-size: 0.85rem;
  color: #475569;
  padding: 0.5rem 0.65rem;
  background: #f1f5f9;
  border-radius: 6px;
  border-left: 3px solid #94a3b8;
}
code {
  font-size: 0.95em;
}
</style>
