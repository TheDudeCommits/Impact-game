import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextGuard } from '../src/render/contextGuard';
import { GraphicsUnavailable, fixesFor, makeRenderer } from '../src/boot/webglFailure';
import { ErrorReporter, NOTICE_SEEN_KEY, lossDetails, type ReporterHost } from '../src/boot/errorReports';
import { signatureOf } from '../src/game/errorReport';
import { RETRY_WAITS, retried } from '../src/loading/assetVersions';
import { HICCUP_MESSAGE, isHiccup, showStartFailure, startFailure } from '../src/ui/startFailure';
import { PROBES, recovery, servedEntry } from '../src/loading/staleBuild';
import { REJOIN_WINDOW, saveRejoin, takeRejoin } from '../src/boot/rejoin';
import { NOTICE_DELAY, watchGraphicsReset } from '../src/ui/graphicsNotice';
import { beforeLossReload, reloadIfNotRestored, RESTORE_WAIT } from '../src/boot/pageLife';
import { PHONE_CAP, textureCapFor } from '../src/render/textureCap';

/** The stability pass (2 November 2026), from the live error log: a WebGL context that could not be made, downloads that
 *  failed on the way, Player Two's stale chunks, and lost contexts mid-match. */

const canvas = () => { const target = new EventTarget(); return Object.assign(target, { fire: (type: string) => target.dispatchEvent(new Event(type)) }); };
const tick = () => new Promise(done => setTimeout(done, 0));

describe('a lost context: compiles wait, uploads skip', () => {
  it('skips compile and initTexture while lost, and a compileAsync caught by a loss settles then', async () => {
    const c = canvas(), guard = new ContextGuard(c);
    let compiled = 0, uploaded = 0, release!: () => void;
    const renderer = guard.guard({
      compile: () => { compiled++; return new Set(['m']); },
      compileAsync: (scene: unknown) => new Promise(done => { release = () => done(scene); }),
      initTexture: () => { uploaded++; },
    });
    renderer.initTexture(); expect(uploaded).toBe(1);
    const pending = renderer.compileAsync('scene' as never);
    c.fire('webglcontextlost');
    await expect(pending).resolves.toBe('scene');
    expect(renderer.compile()).toEqual(new Set()); expect(compiled).toBe(0);
    renderer.initTexture(); expect(uploaded).toBe(1);
    await expect(renderer.compileAsync('other' as never)).resolves.toBe('other');
    c.fire('webglcontextrestored');
    renderer.compile(); renderer.initTexture(); expect([compiled, uploaded]).toEqual([1, 2]);
    release();
  });

  it('whole() waits for the restore, and starts again when the context is lost before the work is done', async () => {
    const c = canvas(); let lost = false;
    const guard = new ContextGuard(c, () => lost);
    let runs = 0; const finish: (() => void)[] = [];
    lost = true; // the context's own word comes before its event
    const done = guard.whole(() => { runs++; return new Promise<string>(ok => finish.push(() => ok(`run ${runs}`))); });
    await tick(); expect(runs).toBe(0);
    c.fire('webglcontextlost'); lost = false; c.fire('webglcontextrestored');
    await tick(); expect(runs).toBe(1);
    c.fire('webglcontextlost'); finish[0]();
    await tick(); expect(runs).toBe(1);
    c.fire('webglcontextrestored');
    await tick(); expect(runs).toBe(2);
    finish[1]();
    await expect(done).resolves.toBe('run 2');
  });

  it('whole() passes on an error that is not the loss', async () => {
    const guard = new ContextGuard(canvas());
    await expect(guard.whole(async () => { throw new Error('bad scene'); })).rejects.toThrow('bad scene');
  });

  it('GameRenderer compiles through it and guards its renderer', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('src/render/GameRenderer.ts', 'utf8');
    expect(src).toMatch(/this\.context\.guard\(this\.renderer\)/);
    expect(src).toMatch(/async compileScene\([^)]*\)\{[\s\S]{0,300}await this\.context\.whole\(/);
    expect(src).toMatch(/powerPreference:gentle\?'default':'high-performance'/);
  });
});

describe('the renderer that could not be made', () => {
  const parent = () => ({ querySelectorAll: () => [] as { remove(): void }[] }) as unknown as HTMLElement;
  it('is tried again gently, and a second failure shows the message, reports at once and stops the page', () => {
    const tries: boolean[] = [];
    expect(makeRenderer(gentle => { tries.push(gentle); return 'renderer'; }, parent(), () => {}, () => {})).toBe('renderer');
    expect(tries).toEqual([false]);
    tries.length = 0;
    expect(makeRenderer(gentle => { tries.push(gentle); if (!gentle) throw new Error('high-performance refused'); return 'gentle'; }, parent(), () => {}, () => {})).toBe('gentle');
    expect(tries).toEqual([false, true]);
    const told: unknown[] = []; let shown = 0;
    let thrown: unknown;
    try { makeRenderer(() => { throw new Error('Error creating WebGL context.'); }, parent(), (error, first) => told.push(error, first), () => { shown++; }); } catch (error) { thrown = error; }
    expect(thrown).toBeInstanceOf(GraphicsUnavailable); expect((thrown as GraphicsUnavailable).reported).toBe(true);
    expect(shown).toBe(1); expect(told).toHaveLength(2);
  });

  it('names the browser\'s own way to hardware acceleration', () => {
    expect(fixesFor('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36')[0]).toMatch(/Use graphics acceleration when available/);
    expect(fixesFor('Mozilla/5.0 (Windows NT 10.0; rv:140.0) Gecko/20100101 Firefox/140.0')[0]).toMatch(/Performance/);
    expect(fixesFor('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')[0]).toMatch(/Close other apps/);
    for (const agent of ['', 'x']) expect(fixesFor(agent)).toHaveLength(3);
  });
});

describe('reports that do not wait for the notice, and a lost context\'s facts', () => {
  const host = (store: Record<string, string>, sent: string[]): ReporterHost => ({ send: (_url, body) => { sent.push(body); }, read: key => store[key] ?? null, agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', path: () => '/', build: '0123456789ab', server: () => 'https://match.example', automated: false });
  it('sends an urgent report before the first-visit notice has been seen; holds any other', () => {
    const sent: string[] = [], reporter = new ErrorReporter(host({}, sent), 'tab0000001');
    expect(reporter.report('error', new Error('later'))).toBe('held');
    expect(reporter.report('webgl', new Error('Error creating WebGL context.'), 'renderer', undefined, true)).toBe('sent');
    expect(sent).toHaveLength(1);
  });
  it('sends the facts of a loss as its lines, one group whatever they say', () => {
    const sent: string[] = [], reporter = new ErrorReporter(host({ [NOTICE_SEEN_KEY]: '2' }, sent), 'tab0000001');
    const listeners: (() => void)[] = [];
    let facts = lossDetails({ gpu: 'Apple GPU', quality: 'low', fighters: 2, memory: { geometries: 120, textures: 34 }, images: { count: 20, bytes: 83 * 1048576, largest: 1024 }, seconds: 83.4, host: 'impact.playertwo.cc' });
    reporter.watchCanvas({ addEventListener: (_type: string, listener: () => void) => { listeners.push(listener); } } as never, () => false, () => facts);
    listeners[0]();
    const body = JSON.parse(sent[0]);
    expect(body.kind).toBe('webgl');
    expect(body.stack.split('\n')).toEqual(['gpu: Apple GPU', 'quality: low', 'fighters: 2', 'gpu memory: 34 textures, 120 geometries', 'images: 20, 83.0 MB, largest 1024 px', 'seconds since load: 83', 'host: impact.playertwo.cc']);
    const one = signatureOf(body);
    facts = lossDetails({ gpu: 'Adreno (TM) 740', seconds: 9, host: 'game.example.com' });
    expect(signatureOf({ ...body, stack: facts.join('\n') }).id).toBe(one.id);
  });
});

describe('a download that failed on the way is tried again', () => {
  const answer = (status: number) => new Response(status === 204 ? null : 'x', { status });
  const nap = () => Promise.resolve();
  it('after a network error or a 5xx, twice, and not after a 404', async () => {
    expect(RETRY_WAITS).toHaveLength(2);
    let n = 0;
    const flaky = () => { n++; if (n === 1) return Promise.reject(new TypeError('Failed to fetch')); if (n === 2) return Promise.resolve(answer(503)); return Promise.resolve(answer(200)); };
    expect((await retried(flaky, undefined, RETRY_WAITS, nap)).status).toBe(200); expect(n).toBe(3);
    n = 0; expect((await retried(() => { n++; return Promise.resolve(answer(502)); }, undefined, RETRY_WAITS, nap)).status).toBe(502); expect(n).toBe(3);
    n = 0; expect((await retried(() => { n++; return Promise.resolve(answer(404)); }, undefined, RETRY_WAITS, nap)).status).toBe(404); expect(n).toBe(1);
    n = 0; await expect(retried(() => { n++; return Promise.reject(new TypeError('Failed to fetch')); }, undefined, RETRY_WAITS, nap)).rejects.toThrow('Failed to fetch'); expect(n).toBe(3);
  });
  it('never after an abort', async () => {
    let n = 0; const abort = new AbortController(); abort.abort();
    await expect(retried(() => { n++; return Promise.reject(new DOMException('aborted', 'AbortError')); }, undefined, RETRY_WAITS, nap)).rejects.toThrow('aborted'); expect(n).toBe(1);
    n = 0; await expect(retried(() => { n++; return Promise.reject(new TypeError('Failed to fetch')); }, abort.signal, RETRY_WAITS, nap)).rejects.toThrow(); expect(n).toBe(1);
  });
  it('goes through the page\'s fetch for /assets/ files, versioned or not, and leaves others alone', async () => {
    const seen: string[] = [];
    let fail = 1;
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url; seen.push(url);
      if (url === '/asset-versions.json') return new Response('{}', { headers: { 'content-type': 'application/json' } });
      if (url.startsWith('/assets/') && fail-- > 0) throw new TypeError('Failed to fetch');
      if (url.startsWith('/api/')) throw new TypeError('Failed to fetch');
      return new Response('ok');
    });
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    try {
      vi.stubGlobal('window', { fetch }); vi.stubGlobal('location', new URL('https://game.example.com/'));
      vi.resetModules();
      await import('../src/loading/assetVersions');
      const w = (globalThis as unknown as { window: { fetch: typeof globalThis.fetch } }).window;
      const model = w.fetch('/assets/fighters/taisei-kr1.glb?x=1');
      await vi.advanceTimersByTimeAsync(2000);
      expect((await model).ok).toBe(true);
      await expect(w.fetch('/api/economy/me')).rejects.toThrow('Failed to fetch');
      expect(seen.filter(url => url.includes('taisei'))).toHaveLength(2);
      expect(seen.filter(url => url.includes('/api/'))).toHaveLength(1);
    } finally { vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules(); }
  });
});

describe('what a failed start says', () => {
  it('a download in words, with RETRY; a chunk with RETRY that reloads; a refusal as it is', () => {
    for (const words of ['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.', 'fetch for "/assets/x.glb" responded with 503: Service Unavailable'])
      expect(isHiccup(new TypeError(words)), words).toBe(true);
    expect(isHiccup(new TypeError('Cannot read properties of undefined'))).toBe(false);
    expect(startFailure(new TypeError('Failed to fetch'))).toEqual({ message: HICCUP_MESSAGE, retry: 'start' });
    expect(startFailure(new TypeError('Failed to fetch dynamically imported module: https://impact.playertwo.cc/assets/x.js'))).toEqual({ message: HICCUP_MESSAGE, retry: 'reload' });
    expect(startFailure(new Error('Enter the 6-digit room code.'))).toEqual({ message: 'Enter the 6-digit room code.' });
    expect(HICCUP_MESSAGE).not.toMatch(/Failed to fetch/);
  });
  it('shows RETRY only where it can start again', () => {
    const calls: string[] = [];
    const hud = { error: (m: string) => calls.push(`error ${m}`), retryable: (m: string, retry: () => void) => { calls.push(`retry ${m}`); retry(); } };
    showStartFailure(hud, new TypeError('Failed to fetch'), () => calls.push('again'));
    showStartFailure(hud, new TypeError('Failed to fetch'));
    showStartFailure(hud, new TypeError('Importing a module script failed.'), undefined, () => calls.push('reload'));
    expect(calls).toEqual([`retry ${HICCUP_MESSAGE}`, 'again', `error ${HICCUP_MESSAGE}`, `retry ${HICCUP_MESSAGE}`, 'reload']);
  });
});

describe('a stale tab on Player Two', () => {
  it('reloads onto a newer build, waits for the next start in a match, reloads once when nothing can tell, and reports the rest', () => {
    expect(recovery('changed', false, true)).toBe('reload');
    expect(recovery('changed', true, true)).toBe('wait');
    expect(recovery('unknown', false, true)).toBe('reload');
    expect(recovery('unknown', false, false)).toBe('report');
    expect(recovery('unknown', true, true)).toBe('report');
    expect(recovery('same', false, true)).toBe('report');
  });
  it('asks /index.html with no Referer and no cookies when / cannot tell, and asks it first after that', async () => {
    const asked: [string, RequestInit][] = [];
    const playerTwo = async (url: string, init: RequestInit) => {
      asked.push([url, init]);
      if (url === '/') return new Response('No such file.', { status: 404, headers: { 'content-type': 'text/plain' } });
      return new Response('<script src="https://playertwo.lol/sdk/v1.js"></script><script type="module" crossorigin src="/assets/index-NEW.js"></script>', { headers: { 'content-type': 'text/html; charset=utf-8' } });
    };
    expect(await servedEntry(playerTwo)).toBe('/assets/index-NEW.js');
    expect(asked.map(([url]) => url)).toEqual(['/', '/index.html']);
    expect(asked[1][1]).toMatchObject({ cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
    asked.length = 0;
    expect(await servedEntry(playerTwo)).toBe('/assets/index-NEW.js');
    expect(asked.map(([url]) => url)).toEqual(['/index.html']);
    expect(await servedEntry(async () => { throw new TypeError('Failed to fetch'); })).toBeUndefined();
    expect(PROBES[0][0]).toBe('/');
  });
});

describe('an online match kept across the reload of a lost context', () => {
  const store = () => { const data = new Map<string, string>(); return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); } }; };
  it('keeps the token and the start, taken once, and only while the room can still hold the seat', () => {
    const s = store(), start = ['taisei', 'match', 'Fighter', { kind: 'duel', access: 'online' }];
    expect(saveRejoin('room1:token', start, s, 1000)).toBe(true);
    expect(takeRejoin(s, 1000 + REJOIN_WINDOW - 1)).toEqual({ token: 'room1:token', start, at: 1000 });
    expect(takeRejoin(s, 1000)).toBeUndefined();
    saveRejoin('room1:token', start, s, 1000);
    expect(takeRejoin(s, 1000 + REJOIN_WINDOW + 1)).toBeUndefined();
    s.setItem('jump-rejoin', '{"token":"x","start":[],"at":1}'); expect(takeRejoin(s, 1)).toBeUndefined();
    // Training's start has no access: kept as null, given back as undefined (Network.connect's default).
    saveRejoin('room1:token', ['taisei', 'training', 'Fighter', undefined], s, 1000);
    expect(takeRejoin(s, 1000)?.start).toEqual(['taisei', 'training', 'Fighter', undefined]);
    s.setItem('jump-rejoin', 'not json'); expect(takeRejoin(s, 1)).toBeUndefined();
    expect(takeRejoin(undefined)).toBeUndefined();
  });
  it('is saved just before the reload, and network.ts reconnects by it', async () => {
    vi.useFakeTimers();
    try {
      const order: string[] = [];
      const doc = Object.assign(new EventTarget(), { hidden: false });
      const c = canvas();
      beforeLossReload(() => order.push('kept'));
      reloadIfNotRestored(c, { document: doc, location: { reload: () => order.push('reload') }, setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms) as unknown as number, clearTimeout: (t: number) => clearTimeout(t) } as never);
      c.fire('webglcontextlost'); vi.advanceTimersByTime(RESTORE_WAIT + 1);
      expect(order).toEqual(['kept', 'reload']);
    } finally { beforeLossReload(() => {}); vi.useRealTimers(); }
    const { readFileSync } = await import('node:fs');
    const net = readFileSync('src/network.ts', 'utf8');
    expect(net).toMatch(/if\(resume\)activeRoom=await client\.reconnect\(resume\);/);
    expect(net).toMatch(/if\(room===this\.kept\)\{this\.kept=null;return;\}/);
    // Every room the page plays online holds a dropped seat for the reconnect.
    for (const [file, call] of [['src/server/ArenaRoom.ts', 'allowReconnection(client, RECONNECTION_SECONDS)'], ['src/server/SurvivalRoom.ts', 'allowReconnection(client, COOP_RECONNECTION_SECONDS)'],
      ['src/server/objectives/ObjectiveRoom.ts', 'allowReconnection(client,15)'], ['src/server/moba/RiftRoom.ts', 'allowReconnection(client,20)']])
      expect(readFileSync(file, 'utf8'), file).toContain(call);
  });
});

describe('"Graphics reset — recovering…"', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });
  const page = (hidden = false) => {
    const doc = Object.assign(new EventTarget(), { hidden }), shown: boolean[] = [], c = canvas();
    watchGraphicsReset(c, on => shown.push(on), { document: doc, setTimeout: (fn, ms) => setTimeout(fn, ms) as unknown as number, clearTimeout: t => clearTimeout(t) });
    return { c, doc, shown, show: (h: boolean) => { doc.hidden = h; doc.dispatchEvent(new Event('visibilitychange')); } };
  };
  it('shows a moment into a loss on screen and goes at the restore; a quick restore says nothing', () => {
    const p = page();
    p.c.fire('webglcontextlost'); vi.advanceTimersByTime(NOTICE_DELAY - 1); p.c.fire('webglcontextrestored'); vi.advanceTimersByTime(NOTICE_DELAY * 4);
    expect(p.shown).toEqual([]);
    p.c.fire('webglcontextlost'); vi.advanceTimersByTime(NOTICE_DELAY + 1); expect(p.shown).toEqual([true]);
    p.c.fire('webglcontextrestored'); expect(p.shown).toEqual([true, false]);
  });
  it('says nothing while the page is hidden, and shows when it is back with the context still lost', () => {
    const p = page(true);
    p.c.fire('webglcontextlost'); vi.advanceTimersByTime(NOTICE_DELAY * 10); expect(p.shown).toEqual([]);
    p.show(false); vi.advanceTimersByTime(NOTICE_DELAY + 1); expect(p.shown).toEqual([true]);
  });
});

describe('a phone\'s images', () => {
  it('are held to 1024 px at every quality; a tablet\'s and a desktop\'s follow the quality as before', () => {
    expect(PHONE_CAP).toBe(1024);
    for (const quality of ['low', 'medium', 'high'] as const) expect(textureCapFor(quality, true)).toBe(1024);
    expect([textureCapFor('low', false), textureCapFor('medium', false), textureCapFor('high', false)]).toEqual([1024, 2048, Infinity]);
  });
  it('the now-playing tag keeps off the MOVE stick in a fight on the touch controls', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync('src/ui/handheld.css', 'utf8');
    expect(css).toMatch(/:root\.touch-play body \.music-caption\.music-caption\{[^}]*bottom:auto;top:calc\(100px[^}]*pointer-events:none\}/);
  });
});
