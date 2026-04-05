import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const playgroundDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
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
    // Alias points at ../src — allow repo root so Vite can read the library and its imports.
    fs: {
      allow: [playgroundDir, repoRoot],
    },
  },
});
