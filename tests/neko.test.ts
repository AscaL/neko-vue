import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import { computed, defineComponent, h, nextTick, reactive, ref } from "vue";
import { __resetNekoLoaderForTests, loadNekoRuntime } from "../src/runtime/loadNekoRuntime.ts";
import { cornerToStartXY } from "../src/placement/nekoPlacement.ts";
import NekoPet from "../src/vue/NekoPet.ts";
import { prefersReducedMotion } from "../src/utils/prefersReducedMotion.ts";
import { BehaviorMode } from "../src/types/index.ts";
import { createNeko } from "../src/runtime/nekojsRuntime.ts";
import { useNeko } from "../src/vue/useNeko.ts";

type NekoWithLayout = {
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  destroy(): void;
  stop(): void;
};

/** Vitest infers `mock.calls` as empty tuples; cast after asserting the mock ran. */
type CreateNekoCallArgs = [options: Record<string, unknown>];

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
      expect(second.behaviorMode).toBeUndefined();
    } finally {
      pet.remove();
      wrapper.unmount();
    }
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

describe("Neko resize", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("clamps position and home into the new viewport when the window shrinks", () => {
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

    expect(neko.x).toBe(168);
    expect(neko.y).toBe(368);
    expect(neko.homeX).toBe(168);
    expect(neko.homeY).toBe(368);

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
