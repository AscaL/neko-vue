import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    environment: "happy-dom",
  },
  pack: {
    entry: {
      index: "src/index.ts",
      types: "src/entries/types.ts",
      placement: "src/entries/placement.ts",
      runtime: "src/entries/runtime.ts",
      vue: "src/entries/vue.ts",
    },
    dts: {
      tsgo: true,
    },
    /** Keep `package.json` `exports` manual so each subpath includes `types` + `import`. */
    exports: false,
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
