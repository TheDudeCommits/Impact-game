/** "Graphics reset — recovering…" while the WebGL context is lost on screen (the stability pass, 2 November 2026: 156
 *  losses on the live log, mostly iPhones mid-match). The canvas froze on its last frame with no word, and five seconds
 *  later the page reloaded (boot/pageLife.ts): now a small plain line says what is happening. Plain interface - a pill
 *  of the game's ink at the top, no flash, no motion - shown a quarter of a second into the loss (a GPU process that
 *  restarts gives the context back within about that: nothing to say), gone at the restore. A loss while the page is
 *  hidden says nothing until the page is shown again. */

/** How long a loss lasts before it is told. */
export const NOTICE_DELAY = 250;
export const NOTICE_TEXT = 'Graphics reset — recovering…';

type Host = { document: Pick<Document, 'hidden' | 'addEventListener'>; setTimeout(fn: () => void, ms: number): number; clearTimeout(id: number): void };

/** The notice's logic, apart from the page: `show(true)` / `show(false)`. */
export function watchGraphicsReset(canvas: Pick<EventTarget, 'addEventListener'>, show: (on: boolean) => void, page: Host = window, delay = NOTICE_DELAY) {
  let lost = false, timer: number | undefined, on = false;
  const set = (next: boolean) => { if (next !== on) { on = next; show(next); } };
  const disarm = () => { if (timer !== undefined) page.clearTimeout(timer); timer = undefined; };
  const arm = () => { if (lost && timer === undefined && !on && !page.document.hidden) timer = page.setTimeout(() => { timer = undefined; if (lost && !page.document.hidden) set(true); }, delay); };
  canvas.addEventListener('webglcontextlost', () => { lost = true; arm(); });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; disarm(); set(false); });
  page.document.addEventListener('visibilitychange', () => { if (page.document.hidden) disarm(); else arm(); });
}

/** The notice on the page, over everything but the stale-build banner. */
export function mountGraphicsNotice(canvas: Pick<EventTarget, 'addEventListener'>, parent: HTMLElement = document.body) {
  let el: HTMLElement | undefined;
  watchGraphicsReset(canvas, on => {
    if (!el) {
      el = document.createElement('div');
      el.className = 'graphics-reset'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
      el.textContent = NOTICE_TEXT;
      el.style.cssText = 'position:fixed;z-index:2147482000;top:max(12px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);padding:7px 16px;'
        + 'background:rgba(17,17,17,.88);color:#fff;border:2px solid #fff;border-radius:999px;font:700 14px/1.2 \'Barlow Condensed\',Barlow,system-ui,sans-serif;'
        + 'letter-spacing:.04em;white-space:nowrap;pointer-events:none';
      parent.append(el);
    }
    el.hidden = !on;
  });
}
