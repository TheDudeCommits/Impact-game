/** The window's size for the HUD's per-frame work, read when it changes rather than in every frame.
 *
 *  Chrome answers `innerWidth` / `innerHeight` - and an element's `clientWidth` - by bringing style and layout up to
 *  date first. Read after the frame's own DOM writes, each was a synchronous layout of the whole page, and the HUD read
 *  them all through the frame between its writes (the edge markers, the lock-on view, every damage number in its loop,
 *  the manga stamps, the touch controls): in a royale of twelve on a phone profile (Chrome, 4x CPU) the reads alone were
 *  about a tenth of the main thread's script time (s15 compat report). The size changes only with the window - a resize,
 *  a phone turned, the zoom, iOS's bars sliding - and the browser says so with `resize` before the next frame, so it is
 *  read then, once, at its first use after the change.
 *
 *  Where there is no window to listen to (the tests' Node), every call reads afresh, as the code did before. */
let listening = false, stale = true, w = 0, h = 0, pw = 0, ph = 0;
function read() {
  const g = globalThis as { innerWidth?: number; innerHeight?: number; document?: Document };
  w = g.innerWidth ?? 0; h = g.innerHeight ?? 0;
  const root = g.document?.documentElement;
  pw = root?.clientWidth || w; ph = root?.clientHeight || h;
  stale = false;
}
function fresh() {
  if (!listening) {
    const g = globalThis as { addEventListener?: Window['addEventListener']; visualViewport?: EventTarget | null };
    if (typeof g.addEventListener !== 'function') { read(); return; }
    listening = true;
    const mark = () => { stale = true; };
    g.addEventListener('resize', mark); g.addEventListener('orientationchange', mark); g.visualViewport?.addEventListener('resize', mark);
  }
  if (stale) read();
}
/** `innerWidth`, as of the last resize. */
export const viewWidth = () => { fresh(); return w; };
/** `innerHeight`, as of the last resize. */
export const viewHeight = () => { fresh(); return h; };
/** The page's own box (the root's client size: innerWidth can be wider on a phone, handheld.css), as of the last resize. */
export const pageWidth = () => { fresh(); return pw; };
export const pageHeight = () => { fresh(); return ph; };
