<script setup lang="ts">
import {
  BEHAVIOR_MODES_IN_ORDER,
  BEHAVIOR_MODE_LABELS,
  BehaviorMode,
  DEFAULT_NEKO_BEHAVIOR_CYCLE,
  formatBehaviorMode,
  isBehaviorMode,
  useNeko,
  type NekoStartCorner,
  type UseNekoOptions,
} from "../../src/index";
import { computed, reactive, ref, useTemplateRef } from "vue";
import CustomizeLiveHud from "./CustomizeLiveHud.vue";
import type { LiveStatLine } from "./PlaygroundLiveStats.vue";

type PlacementKind = "corner" | "explicit" | "anchor";
type AnchorBindingKind = "ref" | "selector";
type AllowBehavior = "omit" | "on" | "off";

interface FormState {
  placement: PlacementKind;
  /** When placement is anchor: use the template ref box or a CSS selector string. */
  anchorBinding: AnchorBindingKind;
  /** Used when `anchorBinding === "selector"` (e.g. `#neko-playground-anchor`). */
  anchorSelector: string;
  startCorner: NekoStartCorner | "";
  startX: number;
  startY: number;
  behaviorMode: BehaviorMode;
  followMode: "follow" | "rest";
  speed: number;
  fps: number;
  idleOmit: boolean;
  idleThreshold: number;
  /** 0 = omit (snap to cursor); positive values passed to createNeko */
  cursorStandoffPx: number;
  restUntilFirstPet: boolean;
  respectReducedMotion: boolean;
  autoStart: boolean;
  debug: boolean;
  allowBehavior: AllowBehavior;
  behaviorCycleCustom: boolean;
  behaviorCycle: BehaviorMode[];
}

const CORNERS: { value: NekoStartCorner; label: string }[] = [
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
];

const BEHAVIORS: { value: BehaviorMode; label: string }[] = BEHAVIOR_MODES_IN_ORDER.map(
  (value) => ({
    value,
    label: BEHAVIOR_MODE_LABELS[value],
  }),
);

function labelForBehavior(m: BehaviorMode): string {
  return BEHAVIOR_MODE_LABELS[m];
}

function moveCycleUp(index: number): void {
  if (index <= 0) {
    return;
  }
  const a = draft.behaviorCycle;
  const t = a[index]!;
  a[index] = a[index - 1]!;
  a[index - 1] = t;
}

function moveCycleDown(index: number): void {
  const a = draft.behaviorCycle;
  if (index >= a.length - 1) {
    return;
  }
  const t = a[index]!;
  a[index] = a[index + 1]!;
  a[index + 1] = t;
}

function removeCycleStep(index: number): void {
  if (draft.behaviorCycle.length <= 1) {
    return;
  }
  draft.behaviorCycle.splice(index, 1);
}

const addCycleValue = ref<string | number>("");

function appendCycleStep(): void {
  const raw = addCycleValue.value;
  if (raw === "" || raw === null || raw === undefined) {
    return;
  }
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  if (!isBehaviorMode(n)) {
    return;
  }
  draft.behaviorCycle.push(n);
  addCycleValue.value = "";
}

function defaultForm(): FormState {
  return {
    placement: "corner",
    anchorBinding: "ref",
    anchorSelector: "#neko-playground-anchor",
    startCorner: "bottom-right",
    startX: 100,
    startY: 100,
    behaviorMode: BehaviorMode.ChaseMouse,
    followMode: "follow",
    speed: 24,
    fps: 120,
    idleOmit: true,
    idleThreshold: 6,
    cursorStandoffPx: 0,
    restUntilFirstPet: false,
    respectReducedMotion: false,
    autoStart: true,
    debug: import.meta.env.DEV,
    allowBehavior: "omit",
    behaviorCycleCustom: false,
    behaviorCycle: [...DEFAULT_NEKO_BEHAVIOR_CYCLE],
  };
}

const draft = reactive<FormState>(defaultForm());
const applied = ref<FormState>({ ...defaultForm() });

const anchor = useTemplateRef<HTMLDivElement>("anchor");

function snapshot(): FormState {
  return {
    ...draft,
    behaviorCycle: [...draft.behaviorCycle],
  };
}

function applySettings(): void {
  applied.value = snapshot();
}

function resetForm(): void {
  Object.assign(draft, defaultForm());
  applied.value = snapshot();
}

function preset(name: string): void {
  const d = defaultForm();
  if (name === "nekopet-like") {
    d.placement = "corner";
    d.startCorner = "bottom-right";
    d.restUntilFirstPet = true;
    d.followMode = "follow";
    d.behaviorMode = BehaviorMode.ChaseMouse;
  } else if (name === "anchor-like") {
    d.placement = "anchor";
    d.anchorBinding = "ref";
    d.followMode = "follow";
    d.speed = 20;
    d.restUntilFirstPet = true;
    d.behaviorMode = BehaviorMode.ChaseMouse;
  } else if (name === "explicit-center") {
    d.placement = "explicit";
    d.startX = 200;
    d.startY = 200;
    d.followMode = "follow";
    d.behaviorMode = BehaviorMode.StayStill;
  }
  Object.assign(draft, d);
  applySettings();
}

function buildOptions(state: FormState): UseNekoOptions {
  const o: UseNekoOptions = {
    speed: state.speed,
    fps: state.fps,
    mode: state.followMode,
    behaviorMode: state.behaviorMode,
    restUntilFirstPetInteraction: state.restUntilFirstPet,
    respectReducedMotion: state.respectReducedMotion,
    autoStart: state.autoStart,
    debug: state.debug,
  };

  if (state.allowBehavior === "on") {
    o.allowBehaviorChange = true;
  } else if (state.allowBehavior === "off") {
    o.allowBehaviorChange = false;
  }

  if (!state.idleOmit) {
    o.idleThreshold = state.idleThreshold;
  }

  if (state.cursorStandoffPx > 0) {
    o.cursorStandoffPx = state.cursorStandoffPx;
  }

  if (state.behaviorCycleCustom && state.behaviorCycle.length > 0) {
    o.behaviorCycle = [...state.behaviorCycle];
  }

  if (state.placement === "corner" && state.startCorner) {
    o.startCorner = state.startCorner;
  }
  if (state.placement === "explicit") {
    o.startX = state.startX;
    o.startY = state.startY;
  }
  if (state.placement === "anchor") {
    if (state.anchorBinding === "selector" && state.anchorSelector.trim()) {
      o.anchorSelector = state.anchorSelector.trim();
    } else {
      o.anchorRef = anchor;
    }
  }

  return o;
}

function placementSummary(state: FormState): string {
  switch (state.placement) {
    case "corner":
      return `corner / startCorner: ${state.startCorner}`;
    case "explicit":
      return `explicit / startX,Y: ${state.startX}, ${state.startY}`;
    case "anchor":
      if (state.anchorBinding === "selector" && state.anchorSelector.trim()) {
        return `anchor / anchorSelector: ${state.anchorSelector.trim()}`;
      }
      return "anchor / anchorRef (template)";
    default:
      return state.placement;
  }
}

function effectiveAllowBehaviorLine(state: FormState): string {
  if (state.allowBehavior === "omit") {
    return "omit → engine default true";
  }
  return state.allowBehavior === "on" ? "true" : "false";
}

function effectiveIdleLine(state: FormState): string {
  return state.idleOmit ? "omit → engine default 6" : String(state.idleThreshold);
}

function effectiveCursorStandoffLine(state: FormState): string {
  return state.cursorStandoffPx > 0 ? `${state.cursorStandoffPx}px` : "omit → 0 (under pointer)";
}

function behaviorCycleLine(state: FormState): string {
  if (!state.behaviorCycleCustom || state.behaviorCycle.length === 0) {
    return "default (7-step, omitted in payload)";
  }
  return state.behaviorCycle.map((m) => formatBehaviorMode(m)).join(" → ");
}

/** Rows reflecting the last-applied form → `useNeko` payload (static until Apply). */
function appliedOptionRows(state: FormState): LiveStatLine[] {
  return [
    { label: "placement", value: placementSummary(state) },
    { label: "mode (option)", value: state.followMode },
    { label: "speed", value: String(state.speed) },
    { label: "fps", value: String(state.fps) },
    { label: "autoStart", value: state.autoStart ? "true" : "false" },
    { label: "respectReducedMotion", value: state.respectReducedMotion ? "true" : "false" },
    { label: "debug", value: state.debug ? "true" : "false" },
    {
      label: "restUntilFirstPetInteraction",
      value: state.restUntilFirstPet ? "true" : "false",
    },
    {
      label: "behaviorMode (initial)",
      value: formatBehaviorMode(state.behaviorMode),
    },
    { label: "allowBehaviorChange", value: effectiveAllowBehaviorLine(state) },
    { label: "idleThreshold", value: effectiveIdleLine(state) },
    { label: "cursorStandoffPx", value: effectiveCursorStandoffLine(state) },
    { label: "behaviorCycle", value: behaviorCycleLine(state) },
  ];
}

const nekoOptions = computed(() => buildOptions(applied.value));

const { instance, isReady, skippedForReducedMotion, petInteractionAwake, error, mode } =
  useNeko(nekoOptions);

const hudLines = computed((): LiveStatLine[] => [
  { label: "mode (live)", value: mode.value },
  ...appliedOptionRows(applied.value),
  { label: "isReady", value: isReady.value ? "yes" : "no" },
  { label: "skipped (motion)", value: skippedForReducedMotion.value ? "yes" : "no" },
  {
    label: "first-click gate",
    value: applied.value.restUntilFirstPet
      ? petInteractionAwake.value
        ? "awake"
        : "waiting"
      : "off",
  },
  ...(error.value ? [{ label: "error", value: error.value.message }] : []),
]);
</script>

<template>
  <div class="customize">
    <section class="intro">
      <h2>Customize</h2>
      <p class="lede">
        Every control maps to a <code>UseNeko</code> / <code>createNeko</code> option. Adjust
        fields, then <strong>Apply</strong> to destroy and recreate the pet with the new payload.
      </p>
      <div class="presets">
        <span class="presets-label">Presets</span>
        <button type="button" class="btn btn--ghost" @click="preset('nekopet-like')">
          NekoPet-like
        </button>
        <button type="button" class="btn btn--ghost" @click="preset('anchor-like')">
          Composable-like
        </button>
        <button type="button" class="btn btn--ghost" @click="preset('explicit-center')">
          Explicit + still
        </button>
      </div>
      <p class="presets-help">
        Presets only seed the form (corner + first-click gate, anchor + gate, explicit coords + stay
        still). Each still requires <strong>Apply</strong> if you changed something else first.
      </p>
    </section>

    <div class="layout">
      <form class="panel" @submit.prevent="applySettings">
        <div class="form-grid">
          <fieldset class="block">
            <legend>Placement</legend>
            <p class="opt-desc">
              Resolves the pet’s spawn / home position (viewport coordinates for the sprite’s
              top-left). The sprite is fixed to the document, not nested in your Vue tree.
            </p>
            <label class="radio">
              <input v-model="draft.placement" type="radio" value="corner" />
              Corner (<code>startCorner</code>)
            </label>
            <p class="opt-desc opt-desc--indented">
              Places at a viewport corner using the bundled sprite size so the cat stays inside the
              visible area. Explicit <code>startX</code> / <code>startY</code> override per axis
              when both are set.
            </p>
            <label class="radio">
              <input v-model="draft.placement" type="radio" value="explicit" />
              Explicit <code>startX</code> / <code>startY</code>
            </label>
            <p class="opt-desc opt-desc--indented">
              Pixel coordinates in viewport space. <code>0</code> is valid; omitted axes fall back
              to <code>0</code> in the engine.
            </p>
            <label class="radio">
              <input v-model="draft.placement" type="radio" value="anchor" />
              Anchor (<code>anchorRef</code> or <code>anchorSelector</code>)
            </label>
            <p class="opt-desc opt-desc--indented">
              Uses an element’s top-left in viewport space for any axis you don’t override with
              explicit coordinates. <code>createNeko</code> is deferred until the anchor exists and
              has non-zero width and height.
            </p>

            <div v-if="draft.placement === 'corner'" class="subfield">
              <label class="field">
                <span><code>startCorner</code></span>
                <select v-model="draft.startCorner">
                  <option v-for="c in CORNERS" :key="c.value" :value="c.value">
                    {{ c.label }}
                  </option>
                </select>
              </label>
              <p class="opt-desc">
                Which corner: horizontal position uses
                <code>document.documentElement.clientWidth</code>, vertical uses
                <code>window.innerHeight</code>, minus the sprite size (32px).
              </p>
            </div>

            <div v-if="draft.placement === 'explicit'" class="subfield row2">
              <label class="field">
                <span><code>startX</code></span>
                <input v-model.number="draft.startX" type="number" min="0" step="1" />
              </label>
              <label class="field">
                <span><code>startY</code></span>
                <input v-model.number="draft.startY" type="number" min="0" step="1" />
              </label>
              <p class="opt-desc">
                Home position for “return home” behavior and initial placement. Bounds in the engine
                use the same viewport width/height minus sprite size.
              </p>
            </div>

            <div v-if="draft.placement === 'anchor'" class="subfield">
              <p class="opt-desc">
                Prefer <strong>Template ref</strong> in Vue; use <strong>CSS selector</strong> when
                you only have a query string (same layout gate as ref).
              </p>
              <label class="radio">
                <input v-model="draft.anchorBinding" type="radio" value="ref" />
                Template ref — dashed box below (also has <code>id="neko-playground-anchor"</code>)
              </label>
              <label class="radio">
                <input v-model="draft.anchorBinding" type="radio" value="selector" />
                <code>anchorSelector</code> (<code>document.querySelector</code>)
              </label>
              <label v-if="draft.anchorBinding === 'selector'" class="field">
                <span>Selector string</span>
                <input
                  v-model="draft.anchorSelector"
                  type="text"
                  autocomplete="off"
                  spellcheck="false"
                  placeholder="#neko-playground-anchor"
                />
              </label>
              <p v-if="draft.anchorBinding === 'selector'" class="opt-desc">
                Must match the dashed box (default <code>#neko-playground-anchor</code>). Apply
                after editing so the composable picks up the option fingerprint.
              </p>
            </div>
          </fieldset>

          <fieldset class="block">
            <legend>Motion &amp; loop</legend>
            <p class="opt-desc">
              Wrapper-only flags on top of the engine: the runtime always calls
              <code>start()</code> inside <code>createNeko</code>; these options decide whether we
              immediately <code>stop()</code> again.
            </p>
            <label class="field">
              <span><code>mode</code> (follow / rest)</span>
              <select v-model="draft.followMode">
                <option value="follow">follow — animation loop runs (when autoStart is on)</option>
                <option value="rest">
                  rest — stop right after create; pet stays at resolved home
                </option>
              </select>
            </label>
            <p class="opt-desc">
              <strong>follow</strong> lets chase and run behaviors run.
              <strong>rest</strong> freezes at the spawn position until you change mode in code (not
              shown in this form).
            </p>
            <label class="field">
              <span><code>speed</code></span>
              <input v-model.number="draft.speed" type="number" min="1" max="200" step="1" />
            </label>
            <p class="opt-desc">
              Pixels per engine logic tick (default 24). Logic does not run every frame; higher
              values move the sprite faster when the behavior updates position.
            </p>
            <label class="field">
              <span><code>fps</code></span>
              <input v-model.number="draft.fps" type="number" min="5" max="240" step="1" />
            </label>
            <p class="opt-desc">
              Target render frame rate for the sprite animation (default 120). Lower values save
              work; very low values look choppy.
            </p>
            <label class="check">
              <input v-model="draft.autoStart" type="checkbox" />
              <span><code>autoStart</code></span>
            </label>
            <p class="opt-desc opt-desc--check">
              When unchecked, the wrapper calls <code>stop()</code> immediately after
              <code>createNeko</code>, even in <code>follow</code> mode, so nothing moves until you
              call <code>start()</code> yourself (outside this demo).
            </p>
            <label class="check">
              <input v-model="draft.restUntilFirstPet" type="checkbox" />
              <span><code>restUntilFirstPetInteraction</code></span>
            </label>
            <p class="opt-desc opt-desc--check">
              Starts in <code>rest</code> with <code>StayStill</code> so the cat waits at home. The
              <strong>first</strong> pointer-down on the sprite switches to <code>follow</code>
              <em>without</em> consuming the engine’s click-to-cycle step. Later clicks use the full
              behavior cycle. While waiting, <code>allowBehaviorChange</code> is forced
              <code>true</code> so the hit target stays clickable.
            </p>
            <label class="check">
              <input v-model="draft.respectReducedMotion" type="checkbox" />
              <span><code>respectReducedMotion</code></span>
            </label>
            <p class="opt-desc opt-desc--check">
              When checked (library default), if the user prefers reduced motion the composable
              skips loading and creating the pet entirely. Uncheck to always run (e.g. after
              explicit consent).
            </p>
          </fieldset>

          <fieldset class="block">
            <legend>Behavior (engine)</legend>
            <p class="opt-desc">
              Passed through to <code>createNeko</code>. Live mode changes come from
              <strong>clicking the pet</strong> when <code>allowBehaviorChange</code> is true;
              changing <code>behaviorMode</code> here only affects the <em>next</em> recreate (and
              leaving the first-interaction gate), not the current running mode.
            </p>
            <label class="field">
              <span><code>behaviorMode</code> (initial)</span>
              <select v-model.number="draft.behaviorMode">
                <option v-for="b in BEHAVIORS" :key="b.value" :value="b.value">
                  {{ b.label }} ({{ b.value }})
                </option>
              </select>
            </label>
            <ul class="behavior-legend">
              <li>
                <strong>Chase pointer</strong> — follow the cursor (subject to idle / standoff).
              </li>
              <li><strong>Run away</strong> — flee from the pointer.</li>
              <li><strong>Random wander</strong> — move unpredictably.</li>
              <li><strong>Pace edges</strong> — walk along the screen border.</li>
              <li><strong>Ball chase</strong> — ball-style chase in the engine.</li>
              <li><strong>Stay still</strong> — hold position until another mode.</li>
              <li>
                <strong>Return home &amp; stay</strong> — walk to spawn / home from options, then
                stay; last step in the default seven-click cycle.
              </li>
            </ul>
            <label class="field">
              <span><code>allowBehaviorChange</code></span>
              <select v-model="draft.allowBehavior">
                <option value="omit">Omit — engine default (<code>true</code>)</option>
                <option value="on">true — clicks cycle modes</option>
                <option value="off">false — clicks do not cycle</option>
              </select>
            </label>
            <p class="opt-desc">
              <strong>Omit</strong> — the key is not sent to <code>createNeko</code> at all (same
              idea as <code>NekoPet</code>’s optional prop). The bundled engine then applies its
              built-in default: clicks <em>do</em> cycle modes. <strong>true</strong> /
              <strong>false</strong> set that explicitly. With <strong>false</strong>, clicks no
              longer advance the cycle (and the sprite stops acting like a button in the engine);
              change sticks until you <strong>Apply</strong>
              again or otherwise recreate the pet.
            </p>
            <label class="check">
              <input v-model="draft.behaviorCycleCustom" type="checkbox" />
              <span>Custom <code>behaviorCycle</code></span>
            </label>
            <p class="opt-desc opt-desc--check">
              Ordered list of modes advanced on each pet click (wraps after the last). Omitting uses
              the classic seven-step default. Invalid entries are ignored; if nothing valid remains,
              the default cycle is used.
            </p>
            <div v-if="draft.behaviorCycleCustom" class="cycle-editor">
              <ol class="cycle-list">
                <li v-for="(m, i) in draft.behaviorCycle" :key="`${i}-${m}`" class="cycle-row">
                  <span class="cycle-label">{{ i + 1 }}. {{ labelForBehavior(m) }}</span>
                  <span class="cycle-actions">
                    <button
                      type="button"
                      class="btn btn--icon"
                      :disabled="i === 0"
                      aria-label="Move up"
                      @click="moveCycleUp(i)"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      class="btn btn--icon"
                      :disabled="i === draft.behaviorCycle.length - 1"
                      aria-label="Move down"
                      @click="moveCycleDown(i)"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      class="btn btn--icon"
                      :disabled="draft.behaviorCycle.length <= 1"
                      aria-label="Remove"
                      @click="removeCycleStep(i)"
                    >
                      ×
                    </button>
                  </span>
                </li>
              </ol>
              <div class="cycle-add">
                <select v-model="addCycleValue" class="cycle-add-select">
                  <option value="">Add mode…</option>
                  <option v-for="b in BEHAVIORS" :key="b.value" :value="b.value">
                    {{ b.label }}
                  </option>
                </select>
                <button type="button" class="btn btn--ghost" @click="appendCycleStep">Add</button>
              </div>
            </div>
            <label class="check">
              <input v-model="draft.idleOmit" type="checkbox" />
              <span>Omit <code>idleThreshold</code></span>
            </label>
            <p class="opt-desc opt-desc--check">
              When checked, the option is not sent so the engine uses its default (6px): distance at
              which the pet counts as “idle” for behavior logic.
            </p>
            <label v-if="!draft.idleOmit" class="field">
              <span><code>idleThreshold</code></span>
              <input v-model.number="draft.idleThreshold" type="number" min="0" step="1" />
            </label>
            <p v-if="!draft.idleOmit" class="opt-desc">
              Override idle distance in CSS pixels; affects how chase / movement decides it has
              “caught up” or can rest.
            </p>
            <label class="field">
              <span><code>cursorStandoffPx</code></span>
              <input
                v-model.number="draft.cursorStandoffPx"
                type="number"
                min="0"
                max="2000"
                step="1"
              />
            </label>
            <p class="opt-desc">
              In <strong>chase pointer</strong> mode, keep at least this many pixels between the
              pet’s anchor and the cursor. <code>0</code> or omit = classic “sit on the cursor”
              behavior; larger values stop the sprite short of the pointer (useful for visible
              offset).
            </p>
          </fieldset>

          <fieldset class="block">
            <legend>Debug</legend>
            <label class="check">
              <input v-model="draft.debug" type="checkbox" />
              <span><code>debug</code> — <code>[neko-vue]</code> console logs</span>
            </label>
            <p class="opt-desc opt-desc--check">
              Logs placement resolution, recreate reasons, and <code>createNeko</code> payloads
              (when enabled). Handy for understanding why the pet respawned or which coordinates
              were used.
            </p>
          </fieldset>

          <div class="actions form-grid__span">
            <button type="submit" class="btn btn--primary">Apply</button>
            <button type="button" class="btn" @click="resetForm">Reset</button>
          </div>
        </div>
      </form>

      <div class="preview">
        <p v-if="applied.placement === 'anchor'" class="anchor-hint">
          Spawn uses this box’s top-left (ref or <code>#neko-playground-anchor</code>). Click
          <strong>Apply</strong> after changing placement or selector.
        </p>
        <div
          v-if="applied.placement === 'anchor'"
          id="neko-playground-anchor"
          ref="anchor"
          class="anchor"
          aria-hidden="true"
        >
          Anchor
        </div>
        <p v-else class="anchor-hint muted">
          Anchor preview: choose placement “Anchor” and Apply to attach to the dashed box.
        </p>

        <p class="hud-legend">
          <strong>Live engine</strong>: behavior / spawn / position from the instance (rAF). Then
          <code>mode</code> (live), every option from the last <strong>Apply</strong>, and
          composable status (<code>isReady</code>, motion skip, first-click gate, errors).
        </p>
        <CustomizeLiveHud :instance="instance" :lines="hudLines" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.customize {
  margin-bottom: 1.25rem;
  font-size: 0.8125rem;
}
.intro h2 {
  margin: 0 0 0.25rem;
  font-size: 1.05rem;
}
.lede {
  margin: 0 0 0.5rem;
  line-height: 1.45;
  color: #1e293b;
  max-width: none;
  font-size: 0.8125rem;
}
.presets {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  margin-bottom: 0.75rem;
}
.presets-label {
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 500;
  margin-right: 0.15rem;
}
.presets-help {
  margin: 0 0 0.75rem;
  font-size: 0.68rem;
  line-height: 1.4;
  color: #64748b;
  max-width: 42rem;
}
.hud-legend {
  margin: 0.5rem 0 0.35rem;
  font-size: 0.68rem;
  line-height: 1.4;
  color: #64748b;
}
.layout {
  display: grid;
  gap: 0.85rem;
}
@media (min-width: 720px) {
  .layout {
    grid-template-columns: minmax(280px, 1fr) minmax(200px, 320px);
    align-items: start;
  }
}
.panel {
  margin: 0;
  padding: 0;
  border: none;
  min-width: 0;
}
.form-grid {
  display: grid;
  gap: 0.5rem;
}
@media (min-width: 520px) {
  .form-grid {
    grid-template-columns: 1fr 1fr;
    align-items: start;
  }
  .form-grid__span {
    grid-column: 1 / -1;
  }
}
.block {
  margin: 0 0 0.5rem;
  padding: 0.45rem 0.55rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
}
.block legend {
  padding: 0 0.25rem;
  font-weight: 600;
  font-size: 0.7rem;
  color: #334155;
}
.radio {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0.2rem 0;
  font-size: 0.8125rem;
  cursor: pointer;
}
.subfield {
  margin-top: 0.45rem;
  padding-top: 0.45rem;
  border-top: 1px solid #f1f5f9;
}
.row2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.45rem;
}
.row2 > .opt-desc {
  grid-column: 1 / -1;
}
.opt-desc {
  margin: 0.2rem 0 0.45rem;
  font-size: 0.68rem;
  line-height: 1.4;
  color: #64748b;
}
.opt-desc:last-child {
  margin-bottom: 0;
}
.opt-desc--indented {
  margin-left: 0.35rem;
  padding-left: 0.5rem;
  border-left: 2px solid #e2e8f0;
}
.opt-desc--check {
  margin: -0.1rem 0 0.35rem 1.6rem;
}
.behavior-legend {
  margin: 0 0 0.5rem;
  padding-left: 1.1rem;
  font-size: 0.68rem;
  line-height: 1.45;
  color: #64748b;
}
.behavior-legend li {
  margin: 0.15rem 0;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  margin: 0.3rem 0;
  font-size: 0.75rem;
}
.field span {
  color: #64748b;
  font-weight: 500;
}
.field input,
.field select {
  padding: 0.2rem 0.35rem;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  font: inherit;
  font-size: 0.8125rem;
}
.field .field-hint {
  color: #94a3b8;
  font-weight: 400;
  font-size: 0.68rem;
  line-height: 1.35;
}
.check {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  margin: 0.25rem 0;
  font-size: 0.75rem;
  cursor: pointer;
}
.check input {
  margin-top: 0.12rem;
}
.cycle-editor {
  margin: 0.35rem 0 0.5rem;
  padding: 0.4rem 0.45rem;
  border: 1px dashed #cbd5e1;
  border-radius: 6px;
  background: #f8fafc;
}
.cycle-list {
  margin: 0 0 0.45rem;
  padding-left: 1.15rem;
}
.cycle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.35rem;
  margin: 0.2rem 0;
  font-size: 0.75rem;
}
.cycle-actions {
  display: flex;
  flex-shrink: 0;
  gap: 0.15rem;
}
.btn--icon {
  min-width: 1.65rem;
  padding: 0.1rem 0.25rem;
  font-size: 0.75rem;
  line-height: 1.2;
}
.btn--icon:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.cycle-add {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}
.cycle-add-select {
  padding: 0.2rem 0.35rem;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  font: inherit;
  font-size: 0.8125rem;
  min-width: 10rem;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.5rem;
}
.btn {
  padding: 0.3rem 0.55rem;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: #fff;
  font: inherit;
  font-size: 0.8125rem;
  cursor: pointer;
}
.btn:hover {
  background: #f8fafc;
}
.btn--primary {
  background: #2563eb;
  border-color: #1d4ed8;
  color: #fff;
}
.btn--primary:hover {
  background: #1d4ed8;
}
.btn--ghost {
  font-size: 0.7rem;
  padding: 0.2rem 0.45rem;
}
.preview {
  min-width: 0;
}
.anchor-hint {
  font-size: 0.75rem;
  color: #475569;
  margin: 0 0 0.35rem;
}
.anchor-hint.muted {
  color: #94a3b8;
}
.anchor {
  display: inline-block;
  margin-bottom: 0.45rem;
  padding: 0.65rem 1rem;
  border: 2px dashed #888;
  border-radius: 6px;
  background: #f6f6f6;
  font-size: 0.75rem;
  color: #444;
}
code {
  font-size: 0.92em;
}
</style>
