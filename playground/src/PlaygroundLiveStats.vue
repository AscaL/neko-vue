<script setup lang="ts">
export type LiveStatLine = { label: string; value: string };

withDefaults(
  defineProps<{
    behavior: string;
    /** Spawn / home top-left from `createNeko` (`startX`, `startY`). */
    startPosition: string;
    /** Current interpolated top-left. */
    position: string;
    /** Extra rows (e.g. composable `isReady`, gate state). */
    lines?: readonly LiveStatLine[];
    /** Tighter padding and type (e.g. customize sandbox). */
    compact?: boolean;
    /** Wider label column for long option keys (Customize “all options” list). */
    wideLabels?: boolean;
  }>(),
  { compact: false, wideLabels: false },
);
</script>

<template>
  <aside
    class="live"
    :class="{ 'live--compact': compact, 'live--wide-labels': wideLabels }"
    aria-label="Live engine stats"
  >
    <h3 class="live-title">Live engine</h3>
    <p v-if="!compact" class="live-note">
      Playground-only readout; polls the bundled runtime instance.
    </p>
    <dl class="live-dl">
      <div class="row">
        <dt>Behavior</dt>
        <dd>{{ behavior }}</dd>
      </div>
      <div class="row">
        <dt>Start (spawn)</dt>
        <dd>{{ startPosition }}</dd>
      </div>
      <div class="row">
        <dt>Position (live)</dt>
        <dd>{{ position }}</dd>
      </div>
      <template v-for="(row, i) in lines" :key="i">
        <div class="row">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </template>
    </dl>
  </aside>
</template>

<style scoped>
.live {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
}
.live-title {
  margin: 0 0 0.35rem;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
}
.live-note {
  margin: 0 0 0.65rem;
  font-size: 0.75rem;
  color: #94a3b8;
  line-height: 1.4;
}
.live-dl {
  margin: 0;
  font-family: ui-monospace, monospace;
  font-size: 0.8rem;
}
.row {
  display: grid;
  grid-template-columns: minmax(7rem, 10rem) 1fr;
  gap: 0.35rem 0.75rem;
  padding: 0.2rem 0;
  border-top: 1px solid #e2e8f0;
}
.row:first-of-type {
  border-top: none;
  padding-top: 0;
}
dt {
  margin: 0;
  color: #64748b;
  font-weight: 500;
}
dd {
  margin: 0;
  color: #0f172a;
  word-break: break-word;
}
.live--compact {
  margin-top: 0.5rem;
  padding: 0.4rem 0.55rem;
  border-radius: 6px;
}
.live--compact .live-title {
  margin-bottom: 0.2rem;
  font-size: 0.65rem;
  letter-spacing: 0.03em;
}
.live--compact .live-dl {
  font-size: 0.68rem;
}
.live--compact .row {
  grid-template-columns: minmax(5.25rem, 7rem) 1fr;
  gap: 0.15rem 0.4rem;
  padding: 0.12rem 0;
}
.live--compact.live--wide-labels .row {
  grid-template-columns: minmax(7rem, 11rem) 1fr;
}
</style>
