import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import { computed, defineComponent, h, nextTick, reactive, ref } from "vue";
import { __resetNekoLoaderForTests, loadNekoRuntime } from "../src/runtime/loadNekoRuntime.ts";
import { cornerToStartXY } from "../src/placement/nekoPlacement.ts";
import NekoPet from "../src/vue/NekoPet.ts";
import { prefersReducedMotion } from "../src/utils/prefersReducedMotion.ts";
import {
  BEHAVIOR_MODE_LABELS,
  BEHAVIOR_MODES_IN_ORDER,
  BehaviorMode,
  NEKOJS_SPRITE_SIZE,
  behaviorModeEnumName,
} from "../src/types/index.ts";
import { readViewportBounds } from "../src/runtime/nekoViewport.ts";
import { createNeko } from "../src/runtime/nekojsRuntime.ts";
import { useNeko } from "../src/vue/useNeko.ts";

type NekoWithLayout = {
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  start(): void;
  stop(): void;
  destroy(): void;
};

/** Vitest infers `mock.calls` as empty tuples; cast after asserting the mock ran. */
type CreateNekoCallArgs = [options: Record<string, unknown>];

/** Coalesced resize uses `requestAnimationFrame`; flush before asserting layout. */
function flushAnimationFrames(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

describe("loadNekoRuntime", () => {
  beforeEach(() => {
    __resetNekoLoaderForTests();
    delete window.createNeko;
    document.head.replaceChildren();
  });

  afterEach(() => {
    __resetNekoLoaderForTests();
    delete window.createNeko;
    document.head.replaceChildren();
  });

  test("resolves existing global createNeko without importing the bundle", async () => {
    const create = vi.fn(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      destroy: vi.fn(),
    }));
    window.createNeko = create;

    const fn = await loadNekoRuntime();
    expect(fn).toBe(create);
  });
});

describe("useNeko", () => {
  /** happy-dom often reports 0×0 rects; anchor layout gate reads inline sizes for tests. */
  let restoreGbcr: (() => void) | undefined;

  beforeEach(() => {
    __resetNekoLoaderForTests();
    delete window.createNeko;
    const spy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const w = Number.parseFloat(this.style.width) || this.offsetWidth;
        const h = Number.parseFloat(this.style.height) || this.offsetHeight;
        const width = Number.isFinite(w) ? w : 0;
        const height = Number.isFinite(h) ? h : 0;
        return {
          x: 0,
          y: 0,
          width,
          height,
          top: 0,
          left: 0,
          right: width,
          bottom: height,
          toJSON: () => ({}),
        } as DOMRect;
      });
    restoreGbcr = () => {
      spy.mockRestore();
    };
  });

  afterEach(() => {
    restoreGbcr?.();
    restoreGbcr = undefined;
    __resetNekoLoaderForTests();
    delete window.createNeko;
  });

  test("calls start, then destroy on unmount", async () => {
    const start = vi.fn();
    const destroy = vi.fn();
    window.createNeko = vi.fn(() => ({ start, stop: vi.fn(), destroy }));

    const Child = defineComponent({
      setup() {
        useNeko(() => ({ speed: 12 }));
        return () => h("div");
      },
    });

    const wrapper = mount(Child);
    await vi.waitFor(() => {
      expect(start).toHaveBeenCalledTimes(1);
    });
    expect(window.createNeko).toHaveBeenCalled();

    wrapper.unmount();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  test("defers createNeko until anchor exists with non-zero layout", async () => {
    const create = vi.fn(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      destroy: vi.fn(),
    }));
    window.createNeko = create;

    const showAnchor = ref(false);
    const anchor = ref<HTMLDivElement | null>(null);

    const Child = defineComponent({
      setup() {
        useNeko(
          computed(() => ({
            speed: 12,
            anchorRef: anchor,
          })),
        );
        return () =>
          showAnchor.value
            ? h("div", { ref: anchor, style: { width: "40px", height: "30px" } })
            : h("div", { class: "placeholder" });
      },
    });

    const wrapper = mount(Child);
    await nextTick();
    expect(create).not.toHaveBeenCalled();

    showAnchor.value = true;
    await nextTick();
    await nextTick();
    await vi.waitFor(() => {
      expect(create).toHaveBeenCalledTimes(1);
    });

    wrapper.unmount();
  });

  test("skips createNeko when reduced motion is preferred", async () => {
    const matchMedia = vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      media: query,
      matches: query === "(prefers-reduced-motion: reduce)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const create = vi.fn(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      destroy: vi.fn(),
    }));
    window.createNeko = create;

    const Child = defineComponent({
      setup() {
        return useNeko(() => ({ speed: 12 }));
      },
      template: "<div />",
    });

    const wrapper = mount(Child);
    await vi.waitFor(() => {
      expect(
        (wrapper.vm as unknown as { skippedForReducedMotion: boolean }).skippedForReducedMotion,
      ).toBe(true);
    });

    expect(prefersReducedMotion()).toBe(true);
    expect(create).not.toHaveBeenCalled();

    matchMedia.mockRestore();
  });

  test("mode rest calls stop after create", async () => {
    const stop = vi.fn();
    const start = vi.fn();
    window.createNeko = vi.fn(() => ({ start, stop, destroy: vi.fn() }));

    const Child = defineComponent({
      setup() {
        useNeko(() => ({ speed: 12, mode: "rest" }));
        return () => h("div");
      },
    });

    mount(Child);
    await vi.waitFor(() => {
      expect(stop).toHaveBeenCalled();
    });
    expect(window.createNeko).toHaveBeenCalled();
  });

  test("createNeko payload omits undefined optional fields", async () => {
    const create = vi.fn(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      destroy: vi.fn(),
    }));
    window.createNeko = create;

    const Child = defineComponent({
      setup() {
        useNeko(() => ({
          speed: 12,
          allowBehaviorChange: undefined,
          fps: undefined,
        }));
        return () => h("div");
      },
    });

    mount(Child);
    await vi.waitFor(() => {
      expect(create).toHaveBeenCalledTimes(1);
    });
    const calls = create.mock.calls as unknown as CreateNekoCallArgs[];
    expect(calls[0]).toBeDefined();
    const opts = calls[0]![0];
    expect(opts).not.toHaveProperty("allowBehaviorChange");
    expect(opts).not.toHaveProperty("fps");
    expect(opts).toEqual(
      expect.objectContaining({
        speed: 12,
        startX: expect.any(Number),
        startY: expect.any(Number),
      }),
    );
  });

  test("passes behaviorCycle to createNeko when set", async () => {
    const create = vi.fn(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      destroy: vi.fn(),
    }));
    window.createNeko = create;

    const cycle = [BehaviorMode.ChaseMouse, BehaviorMode.StayStill, BehaviorMode.ReturnHomeAndStay];
    const Child = defineComponent({
      setup() {
        useNeko(() => ({ speed: 12, behaviorCycle: cycle }));
        return () => h("div");
      },
    });

    mount(Child);
    await vi.waitFor(() => {
      expect(create).toHaveBeenCalledTimes(1);
    });
    const calls = create.mock.calls as unknown as CreateNekoCallArgs[];
    expect(calls[0]![0]).toMatchObject({ behaviorCycle: cycle });
  });

  test("passes cursorStandoffPx to createNeko when set", async () => {
    const create = vi.fn(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      destroy: vi.fn(),
    }));
    window.createNeko = create;

    const Child = defineComponent({
      setup() {
        useNeko(() => ({ speed: 12, cursorStandoffPx: 48 }));
        return () => h("div");
      },
    });

    mount(Child);
    await vi.waitFor(() => {
      expect(create).toHaveBeenCalledTimes(1);
    });
    const calls = create.mock.calls as unknown as CreateNekoCallArgs[];
    expect(calls[0]![0]).toMatchObject({ cursorStandoffPx: 48 });
  });

  test("reactive behaviorMode changes do not recreate the pet", async () => {
    const create = vi.fn(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      destroy: vi.fn(),
      behaviorMode: BehaviorMode.ChaseMouse,
    }));
    window.createNeko = create;
    const opts = reactive({ speed: 12, behaviorMode: BehaviorMode.ChaseMouse });
    const Child = defineComponent({
      setup() {
        useNeko(() => opts);
        return () => h("div");
      },
    });
    mount(Child);
    await vi.waitFor(() => {
      expect(create).toHaveBeenCalledTimes(1);
    });
    opts.behaviorMode = BehaviorMode.PaceAroundScreen;
    await nextTick();
    await nextTick();
    expect(create).toHaveBeenCalledTimes(1);
  });

  test("anchor ResizeObserver firing twice with same rect does not recreate neko", async () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        cb: ResizeObserverCallback;
        constructor(cb: ResizeObserverCallback) {
          this.cb = cb;
        }
        observe() {
          this.cb([], this as unknown as ResizeObserver);
          this.cb([], this as unknown as ResizeObserver);
        }
        disconnect() {}
      },
    );

    const create = vi.fn(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      destroy: vi.fn(),
    }));
    window.createNeko = create;

    const Child = defineComponent({
      setup() {
        const anchor = ref<HTMLDivElement | null>(null);
        useNeko(() => ({
          speed: 12,
          anchorRef: anchor,
        }));
        return () =>
          h("div", {
            ref: anchor,
            style: { width: "100px", height: "40px" },
          });
      },
    });

    mount(Child);
    await vi.waitFor(() => {
      expect(create).toHaveBeenCalledTimes(1);
    });

    vi.unstubAllGlobals();
  });

  test("restUntilFirstPetInteraction uses stayStill gate then recreates after mousedown on .neko", async () => {
    const create = vi.fn(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      destroy: vi.fn(),
      behaviorMode: BehaviorMode.StayStill,
    }));
    window.createNeko = create;

    const Child = defineComponent({
      setup() {
        useNeko(() => ({
          speed: 12,
          restUntilFirstPetInteraction: true,
        }));
        return () => h("div");
      },
    });

    const wrapper = mount(Child);
    await vi.waitFor(() => {
      expect(create).toHaveBeenCalledTimes(1);
    });

    const calls = create.mock.calls as unknown as CreateNekoCallArgs[];
    expect(calls[0]![0].behaviorMode).toBe(BehaviorMode.StayStill);
    expect(calls[0]![0].allowBehaviorChange).toBe(true);

    const pet = document.createElement("div");
    pet.className = "neko";
    document.body.appendChild(pet);
    try {
      pet.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      await vi.waitFor(() => {
        expect(create).toHaveBeenCalledTimes(2);
      });
      const second = calls[1]![0];
      expect(second.behaviorMode).toBe(BehaviorMode.ChaseMouse);
    } finally {
      pet.remove();
      wrapper.unmount();
    }
  });

  test("restUntilFirstPetInteraction: after wake, showBehaviorOnClick hint appears on next pet mousedown", async () => {
    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      value: 800,
    });
    vi.stubGlobal("innerHeight", 600);
    window.createNeko = createNeko;

    const anchor = ref<HTMLDivElement | null>(null);
    const Child = defineComponent({
      setup() {
        useNeko(
          computed(() => ({
            anchorRef: anchor,
            speed: 20,
            behaviorMode: BehaviorMode.ChaseMouse,
            restUntilFirstPetInteraction: true,
            showBehaviorOnClick: true,
            respectReducedMotion: false,
          })),
        );
        return () =>
          h("div", {
            ref: anchor,
            style: { width: "100px", height: "40px" },
          });
      },
    });

    const wrapper = mount(Child);
    await vi.waitFor(() => {
      expect(document.querySelector(".neko")).toBeTruthy();
    });

    document
      .querySelector(".neko")!
      .dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));

    await flushAnimationFrames();
    await nextTick();
    await nextTick();

    const petAfterWake = document.querySelector(".neko");
    expect(petAfterWake).toBeTruthy();
    petAfterWake!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      const hint = document.querySelector(".neko-behavior-hint");
      expect(hint?.textContent).toBe(BEHAVIOR_MODE_LABELS[BehaviorMode.RunAwayFromMouse]);
      expect(hint).toBeInstanceOf(HTMLElement);
      expect((hint as HTMLElement).style.visibility).toBe("visible");
    });

    wrapper.unmount();
  });
});

describe("NekoPet", () => {
  beforeEach(() => {
    __resetNekoLoaderForTests();
    delete window.createNeko;
  });

  afterEach(() => {
    __resetNekoLoaderForTests();
    delete window.createNeko;
  });

  test("does not pass allowBehaviorChange to createNeko when prop is omitted", async () => {
    const create = vi.fn(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      destroy: vi.fn(),
    }));
    window.createNeko = create;

    mount(NekoPet);
    await vi.waitFor(() => {
      expect(create).toHaveBeenCalledTimes(1);
    });
    const calls = create.mock.calls as unknown as CreateNekoCallArgs[];
    expect(calls[0]).toBeDefined();
    const opts = calls[0]![0];
    expect(opts).not.toHaveProperty("allowBehaviorChange");
  });
});

describe("Neko behavior click notify", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("onBehaviorModeChange receives new mode after pet mousedown", () => {
    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      value: 800,
    });
    vi.stubGlobal("innerHeight", 600);

    const onBehaviorModeChange = vi.fn();
    const neko = createNeko({
      behaviorMode: BehaviorMode.StayStill,
      allowBehaviorChange: true,
      onBehaviorModeChange,
    });

    const el = document.querySelector(".neko");
    expect(el).toBeTruthy();
    el!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));

    expect(onBehaviorModeChange).toHaveBeenCalledTimes(1);
    expect(onBehaviorModeChange).toHaveBeenCalledWith(BehaviorMode.ReturnHomeAndStay);

    neko.destroy();
  });

  test("showBehaviorOnClick renders hint then destroy removes it", () => {
    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      value: 800,
    });
    vi.stubGlobal("innerHeight", 600);

    const neko = createNeko({
      behaviorMode: BehaviorMode.StayStill,
      allowBehaviorChange: true,
      showBehaviorOnClick: true,
    });

    document
      .querySelector(".neko")!
      .dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));

    const hint = document.querySelector(".neko-behavior-hint");
    expect(hint?.textContent).toBe(BEHAVIOR_MODE_LABELS[BehaviorMode.ReturnHomeAndStay]);

    neko.destroy();
    expect(document.querySelector(".neko-behavior-hint")).toBeNull();
  });
});

describe("Neko resize", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Layout viewport (not visualViewport): matches engine fallback in tests. */
  function stubLayoutViewport(clientWidth: number, innerHeight: number): void {
    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      value: clientWidth,
    });
    vi.stubGlobal("innerHeight", innerHeight);
  }

  async function dispatchResize(): Promise<void> {
    window.dispatchEvent(new Event("resize"));
    await flushAnimationFrames();
  }

  /** Same clamp as {@link readViewportBounds} + engine placement clamp. */
  function clampedHome(startX: number, startY: number): { hx: number; hy: number } {
    const { boundsWidth: bw, boundsHeight: bh } = readViewportBounds(NEKOJS_SPRITE_SIZE);
    const clamp = (v: number, max: number): number =>
      max <= 0 ? 0 : Math.max(0, Math.min(max, Number.isFinite(v) ? v : 0));
    return { hx: clamp(startX, bw), hy: clamp(startY, bh) };
  }

  function expectLayoutMatchesClampedHome(
    neko: NekoWithLayout,
    startX: number,
    startY: number,
  ): void {
    const { hx, hy } = clampedHome(startX, startY);
    expect(neko.homeX).toBe(hx);
    expect(neko.homeY).toBe(hy);
    expect(neko.x).toBe(hx);
    expect(neko.y).toBe(hy);
  }

  const cornerPlacement = { startX: 980, startY: 550 };

  test("clamps position and home into the new viewport when the window shrinks", async () => {
    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      value: 1000,
    });
    vi.stubGlobal("innerHeight", 600);

    const neko = createNeko({
      startX: 980,
      startY: 550,
      behaviorMode: BehaviorMode.StayStill,
    }) as NekoWithLayout;
    neko.stop();

    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      value: 200,
    });
    vi.stubGlobal("innerHeight", 400);
    window.dispatchEvent(new Event("resize"));
    await flushAnimationFrames();

    expect(neko.x).toBe(168);
    expect(neko.y).toBe(368);
    expect(neko.homeX).toBe(168);
    expect(neko.homeY).toBe(368);

    neko.destroy();
  });

  test("restores placement when the viewport grows after a shrink (rest / stopped)", async () => {
    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      value: 1000,
    });
    vi.stubGlobal("innerHeight", 600);

    const neko = createNeko({
      startX: 980,
      startY: 550,
      behaviorMode: BehaviorMode.StayStill,
    }) as NekoWithLayout;
    neko.stop();

    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      value: 200,
    });
    vi.stubGlobal("innerHeight", 400);
    window.dispatchEvent(new Event("resize"));
    await flushAnimationFrames();

    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      value: 1000,
    });
    vi.stubGlobal("innerHeight", 600);
    window.dispatchEvent(new Event("resize"));
    await flushAnimationFrames();

    expect(neko.homeX).toBe(968);
    expect(neko.homeY).toBe(550);
    expect(neko.x).toBe(968);
    expect(neko.y).toBe(550);

    neko.destroy();
  });

  describe("behavior matrix (placement snaps to clamped home on resize)", () => {
    for (const mode of BEHAVIOR_MODES_IN_ORDER) {
      const label = behaviorModeEnumName(mode);

      test(`stopped — ${label}: shrink then full grow restores toward placement`, async () => {
        stubLayoutViewport(1000, 600);
        const neko = createNeko({
          ...cornerPlacement,
          behaviorMode: mode,
          allowBehaviorChange: false,
        }) as NekoWithLayout;
        neko.stop();

        stubLayoutViewport(200, 400);
        await dispatchResize();
        expectLayoutMatchesClampedHome(neko, cornerPlacement.startX, cornerPlacement.startY);

        stubLayoutViewport(1000, 600);
        await dispatchResize();
        expect(neko.homeX).toBe(968);
        expect(neko.homeY).toBe(550);
        expect(neko.x).toBe(968);
        expect(neko.y).toBe(550);

        neko.destroy();
      });

      test(`running — ${label}: same shrink/grow as stopped (sprite follows clamped home)`, async () => {
        stubLayoutViewport(1000, 600);
        const neko = createNeko({
          ...cornerPlacement,
          behaviorMode: mode,
          allowBehaviorChange: false,
        }) as NekoWithLayout;

        stubLayoutViewport(200, 400);
        await dispatchResize();
        expectLayoutMatchesClampedHome(neko, cornerPlacement.startX, cornerPlacement.startY);

        stubLayoutViewport(1000, 600);
        await dispatchResize();
        expect(neko.x).toBe(968);
        expect(neko.y).toBe(550);

        neko.destroy();
      });
    }
  });

  test("interior placement unchanged when still inside bounds after shrink", async () => {
    stubLayoutViewport(800, 600);
    const neko = createNeko({
      startX: 100,
      startY: 80,
      behaviorMode: BehaviorMode.StayStill,
      allowBehaviorChange: false,
    }) as NekoWithLayout;
    neko.stop();

    stubLayoutViewport(400, 300);
    await dispatchResize();
    expect(neko.x).toBe(100);
    expect(neko.y).toBe(80);

    neko.destroy();
  });

  test("sequential shrinks keep snapping to tighter clamped home", async () => {
    stubLayoutViewport(1000, 600);
    const neko = createNeko({
      ...cornerPlacement,
      behaviorMode: BehaviorMode.ChaseMouse,
      allowBehaviorChange: false,
    }) as NekoWithLayout;
    neko.stop();

    stubLayoutViewport(500, 500);
    await dispatchResize();
    expect(neko.x).toBe(468);
    expect(neko.homeX).toBe(468);
    expect(neko.y).toBe(468);
    expect(neko.homeY).toBe(468);

    stubLayoutViewport(200, 400);
    await dispatchResize();
    expect(neko.x).toBe(168);
    expect(neko.y).toBe(368);

    neko.destroy();
  });

  test("partial grow moves toward placement up to new bounds (not only full restore)", async () => {
    stubLayoutViewport(1000, 600);
    const neko = createNeko({
      ...cornerPlacement,
      behaviorMode: BehaviorMode.ReturnHomeAndStay,
      allowBehaviorChange: false,
    }) as NekoWithLayout;
    neko.stop();

    stubLayoutViewport(200, 400);
    await dispatchResize();
    expect(neko.x).toBe(168);
    expect(neko.y).toBe(368);

    stubLayoutViewport(500, 500);
    await dispatchResize();
    expect(neko.x).toBe(468);
    expect(neko.y).toBe(468);

    neko.destroy();
  });

  test("minimal viewport clamps to maximum valid top-left", async () => {
    stubLayoutViewport(1000, 600);
    const neko = createNeko({
      ...cornerPlacement,
      behaviorMode: BehaviorMode.StayStill,
      allowBehaviorChange: false,
    }) as NekoWithLayout;
    neko.stop();

    stubLayoutViewport(48, 48);
    await dispatchResize();
    expect(neko.x).toBe(16);
    expect(neko.y).toBe(16);
    expect(neko.homeX).toBe(16);
    expect(neko.homeY).toBe(16);

    neko.destroy();
  });
});

describe("cornerToStartXY", () => {
  test("top-right uses viewport minus sprite size", () => {
    vi.stubGlobal("innerHeight", 800);
    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      value: 600,
    });
    expect(cornerToStartXY("top-right", 32)).toEqual({
      startX: 568,
      startY: 0,
    });
  });
});
