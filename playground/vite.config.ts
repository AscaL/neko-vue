import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const nekoVueEntry = fileURLToPath(new URL("../src/index.ts", import.meta.url));

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "neko-vue": nekoVueEntry,
    },
  },
  server: {
    port: 5175,
    open: true,
  },
});
