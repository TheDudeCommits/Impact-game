/** Code that only a mode or a fighter needs, in chunks of its own, out of the entry.
 *
 *  The home screen needs none of the old cast's own effects, the arcade's HUD and effects, or a fighter's signature layer; in
 *  the entry they were about a third of the code every first visit downloaded and parsed before the home could be drawn. Each
 *  is a `lazyCode` now: fetched (and built) the first time a room or a mode asks for it, and at idle once the home is up
 *  (`prefetchAtIdle`, main.ts), so entering a mode finds it already in and waits for nothing. A room's load waits for what it
 *  needs (`get`) beside its models and stage, which take far longer; until then nothing of it is on screen, so nothing is
 *  drawn any differently.
 *
 *  The page's performance timeline gets `jump:lazy-asked:<name>` when each one is first asked for (at idle, or by a room or a
 *  mode that found it not in yet) and `jump:lazy-ready:<name>` when it is in. */
export interface LazyCode<T> {
  /** The thing, once it is in (else undefined): for the frame's calls, which have nothing to draw before a room has loaded. */
  readonly now: T | undefined;
  /** Fetch and build it if no one has yet; a failed fetch (a dropped line, a release that replaced the chunk) is tried again
   *  on the next ask. */
  get(): Promise<T>;
}
const mark = (name: string) => { try { performance.mark(name); } catch { /* no timeline */ } };

export function lazyCode<T>(name: string, load: () => Promise<T>): LazyCode<T> {
  let pending: Promise<T> | undefined, value: T | undefined;
  return {
    get now() { return value; },
    get() {
      if (value !== undefined) return Promise.resolve(value);
      if (!pending) mark(`jump:lazy-asked:${name}`);
      return pending ??= load().then(made => { value = made; mark(`jump:lazy-ready:${name}`); return made; }, error => { pending = undefined; throw error; });
    },
  };
}

/** Each `work` once the page has loaded and the browser is idle, one after another (a dropped one is let go: whoever needs it
 *  asks again). Called once the home is ready. */
export function prefetchAtIdle(works: readonly (() => Promise<unknown>)[]) {
  const idle = (globalThis as { requestIdleCallback?: (go: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
  const next = (i: number) => {
    if (i >= works.length) return;
    const go = () => { void works[i]().catch(() => {}).then(() => next(i + 1)); };
    if (idle) idle(go, { timeout: 2000 }); else setTimeout(go, 50);
  };
  const begin = () => next(0);
  if (typeof document === 'undefined' || document.readyState === 'complete') begin();
  else { let done = false; const once = () => { if (!done) { done = true; begin(); } }; window.addEventListener('load', once, { once: true }); setTimeout(once, 3000); }
}
