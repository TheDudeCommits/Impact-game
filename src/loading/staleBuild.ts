
const GUARD = 'jump-stale-reload', RESUME = 'jump-stale-resume';
const CHECK_EVERY = 60_000, START_WAIT = 1500;

/** The browser's words for a module script that would not load: Chrome's, Firefox's and Safari's for a dynamic import,
 *  Vite's for a stylesheet it preloads, and Safari's and Chrome's for a page served where a script was expected. */
const CHUNK = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|is not a valid JavaScript MIME type|Failed to load module script/i;

const words = (error: unknown): string => typeof error === 'string' ? error : error && typeof error === 'object' ? String((error as { message?: unknown }).message ?? '') : '';

/** A lazy chunk of this build that did not load (the error itself, or what it was caused by). */
export function isChunkError(error: unknown): boolean {
  if (!error) return false;
  if (CHUNK.test(words(error))) return true;
  const cause = typeof error === 'object' ? (error as { cause?: unknown }).cause : undefined;
  return cause !== undefined && cause !== error && isChunkError(cause);
}

/** A file under /assets/ that answered 404: a model or image this build names and the live one no longer has (three's
 *  loaders say `fetch for "<url>" responded with 404: …`). */
export function isMissingAsset(error: unknown): boolean {
  const response = error && typeof error === 'object' ? (error as { response?: { status?: unknown; url?: unknown } }).response : undefined;
  if (response?.status === 404 && typeof response.url === 'string') return /\/assets\//.test(response.url);
  return /fetch for "[^"]*\/assets\/[^"]*" responded with 404\b/.test(words(error));
}

const pathOf = (src: string) => src.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, '').split(/[?#]/, 1)[0];

/** The build a page runs: its first module script's path (Vite's hashed entry, `/assets/index-….js`; the dev server's
 *  own `/@vite/client`, which never changes). */
export function entryOf(html: string): string | undefined {
  for (const tag of html.match(/<script\b[^>]*>/gi) ?? []) {
    if (!/\btype\s*=\s*["']?module\b/i.test(tag)) continue;
    const src = /\bsrc\s*=\s*["']?([^"'\s>]+)/i.exec(tag)?.[1];
    if (src) return pathOf(src);
  }
  return undefined;
}

/** An entry's own file (Vite's hashed `index-….js` names the build), wherever the page names it from: `/assets/`,
 *  `./assets/`, or Player Two's `/~<build>/assets/`. Its host writes the build's prefix into the page a player's frame
 *  plays, and not into the page the probe reads, so comparing whole paths found a "newer" build on every first start
 *  there: the tab reloaded and the first FIGHT was lost. */
const fileOf = (src: string) => pathOf(src).split('/').pop() ?? '';
/** Whether the site serves another build than the one running - only when both are known. */
export function buildChanged(running: string | undefined, served: string | undefined): boolean {
  return !!running && !!served && fileOf(running) !== fileOf(served);
}

export interface ReloadGuard { from: string; at: number }
/** Whether this tab may reload away from `running`: not if it already did once from this build (the reload brought the
 *  same build back), nor within 15 s of the last one. */
export function mayReload(running: string | undefined, guard: ReloadGuard | null, now = Date.now()): boolean {
  if (!running) return false;
  if (!guard) return true;
  return guard.from !== running && now - guard.at > 15_000;
}

const session = (() => { try { return typeof sessionStorage === 'object' ? sessionStorage : undefined; } catch { return undefined; } })();
const readJson = <T>(key: string): T | null => { try { return JSON.parse(session?.getItem(key) ?? 'null') as T | null; } catch { return null; } };
const writeJson = (key: string, value: unknown) => { try { session?.setItem(key, JSON.stringify(value)); return session?.getItem(key) === JSON.stringify(value); } catch { return false; } };

/** The build this page runs: its own entry script. */
export function runningEntry(): string | undefined {
  if (typeof document !== 'object') return undefined;
  const src = document.querySelector('script[type="module"][src]')?.getAttribute('src');
  return src ? pathOf(src) : undefined;
}

export type Result = 'changed' | 'same' | 'unknown';
let checkedAt = -Infinity, checking: Promise<Result> | null = null, stale = false, reloading = false;

export const PROBES: readonly (readonly [string, RequestInit])[] = [
  ['/', { cache: 'no-store', credentials: 'same-origin' }],
  ['/index.html', { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' }],
];
/** The probe that answered last: asked first next time. */
let probeFirst = 0;

/** The entry of the page the site serves now, by the first probe that tells (undefined: none could). */
export async function servedEntry(ask: (url: string, init: RequestInit) => Promise<Response> = (url, init) => fetch(url, init)): Promise<string | undefined> {
  const order = PROBES.map((_, i) => (i + probeFirst) % PROBES.length);
  for (const i of order) {
    try {
      const response = await ask(...PROBES[i]);
      const served = response.ok && /html/.test(response.headers.get('content-type') ?? '') ? entryOf(await response.text()) : undefined;
      if (served) { probeFirst = i; return served; }
    } catch { /* the next probe */ }
  }
  return undefined;
}

/** Asks the site which build it serves now, at most once a minute unless `force`d. A newer build is remembered. */
function check(force = false): Promise<Result> {
  if (stale) return Promise.resolve('changed');
  if (checking) return checking;
  if (!force && performance.now() - checkedAt < CHECK_EVERY) return Promise.resolve('same');
  if (typeof fetch !== 'function' || typeof location !== 'object') return Promise.resolve('unknown');
  checkedAt = performance.now();
  return checking = servedEntry()
    .then(served => { if (buildChanged(runningEntry(), served)) { stale = true; return 'changed' as const; } return served ? 'same' as const : 'unknown' as const; })
    .catch(() => 'unknown' as const)
    .finally(() => { checking = null; });
}

/** What a failed chunk or missing file of this build does, by what the site was found to serve: a newer build reloads,
 *  unless a match is on (it waits for the next start); a site that could not be asked reloads too, once, unless a match is
 *  on or the browser is offline (a reload would fail); the same build still served is reported (no reload can cure it). */
export function recovery(served: Result, inMatch: boolean, online: boolean): 'reload' | 'wait' | 'report' {
  if (served === 'changed') return inMatch ? 'wait' : 'reload';
  if (served === 'unknown' && !inMatch && online) return 'reload';
  return 'report';
}

/** The banner the reload goes under. */
function notice(known = true) {
  if (typeof document !== 'object' || document.querySelector('.stale-notice')) return;
  const el = document.createElement('div');
  el.className = 'stale-notice'; el.setAttribute('role', 'status');
  // (A reload because nothing could tell which build is live says only that it reloads.)
  el.innerHTML = known ? '<b>NEW VERSION</b><span>Updating to the latest version…</span>' : '<b>RELOADING</b><span>Loading the game again…</span>';
  document.body.append(el);
}

/** Reloads onto the new build, once: the home's chosen fighter and mode card kept for the page that comes back. */
function reload(known = true): boolean {
  if (reloading) return true;
  const running = runningEntry();
  if (!mayReload(running, readJson<ReloadGuard>(GUARD)) || !writeJson(GUARD, { from: running, at: Date.now() })) return false;
  reloading = true;
  const pressed = (selector: string) => document.querySelector<HTMLElement>(`${selector}[aria-pressed="true"]`);
  writeJson(RESUME, { fighter: pressed('.home-fighter')?.dataset.fighter, mode: pressed('.home-mode')?.dataset.mode });
  notice(known);
  setTimeout(() => location.reload(), 900);
  return true;
}

/** Whether a match is on (main.ts): a stale build found then waits for the next start. */
let inMatch: () => boolean = () => false;
export function watchMatch(on: () => boolean) { inMatch = on; }

/** Before a start: a newer build reloads the tab instead (true), asked at most once a minute and never waited on for
 *  more than a second and a half. */
export async function beforeStart(): Promise<boolean> {
  const result = await Promise.race([check(), new Promise<Result>(done => setTimeout(() => done('unknown'), START_WAIT))]);
  return result === 'changed' && reload();
}

let unrecovered: (error: unknown) => void = () => {};
export function whenUnrecovered(report: (error: unknown) => void) { unrecovered = report; }

/** A start (or anything else) that failed: a chunk or asset of an older build reloads onto the new one (true), unless
 *  a match is on. Any other failure, or the same build still served, is the caller's to report (false). */
export async function recover(error: unknown): Promise<boolean> {
  if (reloading) return true;
  if (!isChunkError(error) && !isMissingAsset(error)) return false;
  const served = await check(true);
  const next = recovery(served, inMatch(), typeof navigator !== 'object' || navigator.onLine !== false);
  // (A newer build found mid-match waits for the next start: that is not a failure.)
  if (next === 'wait') return false;
  if (next === 'reload' && reload(served === 'changed')) return true;
  unrecovered(error);
  return false;
}

/** After the reload: the fighter and the mode card chosen before it, picked again on the home. */
export function restoreSelection(root: ParentNode = document) {
  const saved = readJson<{ fighter?: string; mode?: string }>(RESUME);
  try { session?.removeItem(RESUME); } catch { /* nothing kept */ }
  if (!saved) return;
  const press = (selector: string, value: string | undefined) => { if (value && /^[\w-]+$/.test(value)) root.querySelector<HTMLElement>(selector.replace('?', value))?.click(); };
  press('.home-mode[data-mode="?"]', saved.mode);
  press('.home-fighter[data-fighter="?"]', saved.fighter);
}

if (typeof window === 'object' && typeof document === 'object') {
  // Vite's preload helper reports any lazy chunk of this build that failed, the import's own rejection included.
  window.addEventListener('vite:preloadError', event => { void recover((event as Event & { payload?: unknown }).payload); });
  window.addEventListener('unhandledrejection', event => { if (isChunkError(event.reason)) void recover(event.reason); });
  // Back in view: has a release gone out meanwhile? (Answered at the next start.)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void check(); });
}
