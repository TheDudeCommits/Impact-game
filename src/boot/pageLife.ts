export function reloadWhenRestored(page: Pick<Window, 'addEventListener' | 'location'>): void {
  page.addEventListener('pageshow', event => { if ((event as PageTransitionEvent).persisted) page.location.reload(); });
}

/** What runs just before that reload (main.ts: an online match's room kept for the page that comes back, boot/rejoin.ts). */
let beforeReload: () => void = () => {};
export function beforeLossReload(run: () => void) { beforeReload = run; }

/** How long a visible page waits for a lost WebGL context to come back before it loads itself again. A GPU process
 *  that restarts gives it back within a second or two (Chrome); iOS Safari may never, and a page left on a dead canvas
 *  shows a frozen frame with no way out but the reload button. */
export const RESTORE_WAIT = 5000;
type Host = Pick<Window, 'location' | 'setTimeout' | 'clearTimeout'> & { document: Pick<Document, 'hidden' | 'addEventListener'> };
/** The game's canvas, lost and not given back: three keeps the page through the loss and rebuilds when the browser
 *  restores it (GameRenderer); this is for a context that does not return. Time hidden does not count - iOS takes the
 *  context of a page in the background and may give it back when it is shown again - so the wait runs only while the
 *  page is visible, and a page is never reloaded behind the player's back. */
export function reloadIfNotRestored(canvas: Pick<EventTarget, 'addEventListener'>, page: Host, wait = RESTORE_WAIT): void {
  let lost = false, timer: number | undefined;
  const disarm = () => { if (timer !== undefined) page.clearTimeout(timer); timer = undefined; };
  const reload = () => { try { beforeReload(); } catch { /* the reload matters more */ } page.location.reload(); };
  const arm = () => { if (lost && timer === undefined && !page.document.hidden) timer = page.setTimeout(() => { timer = undefined; if (lost && !page.document.hidden) reload(); }, wait); };
  canvas.addEventListener('webglcontextlost', () => { lost = true; arm(); });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; disarm(); });
  page.document.addEventListener('visibilitychange', () => { if (page.document.hidden) disarm(); else arm(); });
}
