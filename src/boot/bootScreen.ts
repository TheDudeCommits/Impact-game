/** The loading page's end. index.html's #boot - the mark, the boiling focus lines,
 *  the name and the bar that follows the page's files as they arrive - stands over the game until the home screen is
 *  ready: then its bar fills, it fades in a third of a second and is gone (its own inline script, window.__bootDone). An
 *  error before that takes it away at once, so whatever the page shows instead (boot/webglFailure.ts) is seen. */
export function bootDone() {
  try { (globalThis as { __bootDone?: () => void }).__bootDone?.(); } catch { /* the page carries on without it */ }
}
