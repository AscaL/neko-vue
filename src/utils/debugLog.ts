/** Opt-in `console` helper; prefix keeps DevTools filter easy. */
export function nekoVueDebug(enabled: boolean, label: string, ...args: unknown[]): void {
  if (enabled) {
    console.log(`[neko-vue] ${label}`, ...args);
  }
}
