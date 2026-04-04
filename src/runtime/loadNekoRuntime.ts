import type { CreateNekoFn, LoadNekoRuntimeOptions } from "../types/index.ts";

function isBrowser(): boolean {
  return typeof document !== "undefined";
}

function getCreateNekoFromGlobal(): CreateNekoFn | undefined {
  if (typeof globalThis === "undefined") return undefined;
  const fn = (globalThis as Window & typeof globalThis).createNeko;
  return typeof fn === "function" ? fn : undefined;
}

let bundledLoadPromise: Promise<CreateNekoFn> | null = null;

/**
 * Dynamically imports the bundled typed runtime (`./nekojsRuntime.ts`). Defines `window.createNeko`.
 */
async function importBundledNeko(): Promise<CreateNekoFn> {
  await import("./nekojsRuntime.ts");
  const fn = getCreateNekoFromGlobal();
  if (!fn) {
    throw new Error("neko-vue: bundled neko.js did not define `createNeko`.");
  }
  return fn;
}

/**
 * Ensures `createNeko` exists on `globalThis`: uses a global if already present, otherwise loads the
 * **bundled** runtime (dynamic import, no network). Used internally by {@link useNeko}; consumers
 * normally rely on `useNeko` / `<NekoPet>` only.
 */
export function loadNekoRuntime(options: LoadNekoRuntimeOptions = {}): Promise<CreateNekoFn> {
  if (!isBrowser()) {
    return Promise.reject(
      new Error(
        "neko-vue: loadNekoRuntime() can only run in a browser (no `document`). Use <ClientOnly> / `.client` components in Nuxt.",
      ),
    );
  }

  const existingFn = getCreateNekoFromGlobal();
  if (existingFn) {
    return Promise.resolve(existingFn);
  }

  const timeoutMs = options.timeoutMs ?? 30_000;

  if (!bundledLoadPromise) {
    bundledLoadPromise = Promise.race([
      importBundledNeko(),
      new Promise<CreateNekoFn>((_, reject) => {
        window.setTimeout(() => {
          reject(new Error(`neko-vue: timed out after ${timeoutMs}ms loading bundled neko.js`));
        }, timeoutMs);
      }),
    ]).catch((err) => {
      bundledLoadPromise = null;
      throw err;
    });
  }

  return bundledLoadPromise;
}

/** @internal Reset loader state between tests. */
export function __resetNekoLoaderForTests(): void {
  bundledLoadPromise = null;
}
