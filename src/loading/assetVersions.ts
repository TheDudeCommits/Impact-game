import { SITE_BASE, siteUrl } from './siteBase';

// Inside a build served under a folder of its own (Player Two's /~<build>/), every file under /assets/ is asked for in
// the page's own folder (siteBase.ts), and the version list is not read at all: there the folder is the version, and a
// build's files never change at their address. At a site's root, all as before.
const LIST = '/asset-versions.json';
const PREFIXED = SITE_BASE !== '/';
const native = typeof window !== 'undefined' && typeof window.fetch === 'function' ? window.fetch.bind(window) : undefined;
let versions: Record<string, string> | null = null;
let reading: Promise<void> | null = null;
let readAt = -Infinity;

function read() {
  if (!native || PREFIXED) return Promise.resolve();
  readAt = performance.now();
  return reading ??= native(LIST)
    .then(r => r.ok && /json/.test(r.headers.get('content-type') ?? '') ? r.json() : null)
    .then((list: { files?: Record<string, string> } | null) => { if (list?.files) versions = list.files; })
    .catch(() => {})
    .finally(() => { reading = null; });
}

/** The list read again at a room's start, if it was last read over a minute ago. */
export function refreshAssetVersions() {
  if (performance.now() - readAt > 60_000) void read();
}

/** A same-origin /assets/ file's address with its content's hash, inside the page's folder; any other address as it is. */
export function versioned(url: string): string {
  return siteUrl(withVersion(url));
}
function withVersion(url: string): string {
  if (!versions || typeof location === 'undefined') return url;
  let u: URL; try { u = new URL(url, location.href); } catch { return url; }
  if (u.origin !== location.origin || u.search || !u.pathname.startsWith('/assets/')) return url;
  let file: string; try { file = decodeURIComponent(u.pathname.slice(1)); } catch { return url; }
  const v = versions[file]; if (!v) return url;
  return `${/^[a-z][a-z0-9+.-]*:/i.test(url) ? u.origin : ''}${u.pathname}?v=${v}${u.hash}`;
}

/** A path under /assets/, at the root or already inside the page's folder (a three loader's, siteBase.ts). */
const assetPath = (path: string) => path.startsWith('/assets/') || path.startsWith(`${SITE_BASE}assets/`);
function isAsset(url: string) {
  try { const u = new URL(url, location.href); return u.origin === location.origin && !u.search && assetPath(u.pathname); } catch { return false; }
}
/** A same-origin /assets/ address, its query or none: one a failed download of is tried again. */
function underAssets(url: string) {
  try { const u = new URL(url, location.href); return u.origin === location.origin && assetPath(u.pathname); } catch { return false; }
}

/** The waits before the second and the third try. */
export const RETRY_WAITS: readonly number[] = [400, 1200];
const aborted = (error: unknown) => !!error && typeof error === 'object' && (error as { name?: unknown }).name === 'AbortError';
/** `attempt` again after each of `waits` while it throws (not an abort) or answers 5xx; the last try's answer or error as
 *  it is. A 404 or any other answer under 500 is returned at once. */
export async function retried(attempt: () => Promise<Response>, signal?: AbortSignal | null, waits: readonly number[] = RETRY_WAITS,
  sleep = (ms: number) => new Promise<void>(done => setTimeout(done, ms))): Promise<Response> {
  for (let n = 0; ; n++) {
    try {
      const response = await attempt();
      if (response.status < 500 || n >= waits.length) return response;
      // (The failed answer's body let go: it holds the connection otherwise.)
      void response.body?.cancel().catch(() => {});
    } catch (error) {
      if (n >= waits.length || aborted(error) || signal?.aborted) throw error;
    }
    await sleep(waits[n]);
    if (signal?.aborted) throw signal.reason ?? new DOMException('The request was aborted.', 'AbortError');
  }
}

if (native && typeof location !== 'undefined') {
  void read();
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (method !== 'GET' || !underAssets(url)) return native(input, init);
    const go = () => {
      const next = siteUrl(isAsset(url) ? versioned(url) : url); if (next === url) return native(input, init);
      return native(input instanceof Request ? new Request(next, input) : next, init);
    };
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const waiting = reading;
    return waiting ? Promise.race([waiting, new Promise(done => setTimeout(done, 1500))]).then(() => retried(go, signal)) : retried(go, signal);
  };
}
