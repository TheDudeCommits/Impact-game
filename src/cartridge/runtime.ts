// The cartridge runtime: what the game's code calls instead of the page's own globals while Impact runs inside Dude's
// dude-world as a cartridge (src/cartridge/index.ts, docs: the site's docs/CARTRIDGES.md).
//
// The cartridge build (vite.cartridge.config.ts, scripts/build/cartridgePlugin.ts) points the game's own calls here:
// its timers and animation frames, the listeners it puts on the page, the observers it starts, its storage, its fetches,
// the globals it hangs on window, its page roots (document.body, document.documentElement) and every '/assets/' address
// in its code. So everything the game starts is known, the world's frame loop drives it (frame()), and end() stops all of
// it. The game's own build (vite.config.ts) never rewrites anything: there `rt.hosted` stays false and nothing changes.
//
// LIVE (src/cartridge/live.ts, the world's src/core/live.ts): the game plays in the same frames as the world, which draws
// its own picture before and after the game's. Then (`begin(host, true)`) nothing of three's shared state is swapped in
// for the game (the world would draw with it), and only what three uploads inside the game's own calls (`within`) is the
// game's to let go: the world's uploads in between are the world's.
import type { CartridgeHost } from './contract';
import type * as THREE_NS from 'three';

type Three = typeof THREE_NS;
type Listener = { target: EventTarget; type: string; fn: EventListenerOrEventListenerObject; options: boolean | AddEventListenerOptions | undefined };

// The page's own, kept before anything can wrap them.
const page = globalThis as typeof globalThis & { requestIdleCallback?: typeof requestIdleCallback; cancelIdleCallback?: typeof cancelIdleCallback };
const realSetTimeout = page.setTimeout.bind(page), realClearTimeout = page.clearTimeout.bind(page);
const realSetInterval = page.setInterval.bind(page), realClearInterval = page.clearInterval.bind(page);
const realIdle = page.requestIdleCallback?.bind(page), realCancelIdle = page.cancelIdleCallback?.bind(page);
const realFetch = page.fetch.bind(page);

/** Storage for the game's settings and progress through the host's save/load (localStorage under dw.game.impact.*),
 *  with the Storage interface the game's code already speaks. `session`: kept in memory for the page's life. */
class HostStorage implements Storage {
  private keys: string[] | null = null;
  private readonly memory = new Map<string, string>();
  constructor(private readonly prefix: string, private readonly session: boolean, private readonly host: () => CartridgeHost | undefined) {}
  private index(): string[] {
    if (this.session) return [...this.memory.keys()];
    return this.keys ??= this.host()?.load<string[]>(`${this.prefix}keys`) ?? [];
  }
  get length() { return this.index().length; }
  key(i: number) { return this.index()[i] ?? null; }
  getItem(key: string): string | null {
    if (this.session) return this.memory.get(key) ?? null;
    const value = this.host()?.load<string>(`${this.prefix}${key}`);
    return typeof value === 'string' ? value : null;
  }
  setItem(key: string, value: string) {
    value = String(value);
    if (this.session) { this.memory.set(key, value); return; }
    const host = this.host(); if (!host) return;
    host.save(`${this.prefix}${key}`, value);
    const keys = this.index(); if (!keys.includes(key)) { keys.push(key); host.save(`${this.prefix}keys`, keys); }
  }
  removeItem(key: string) {
    if (this.session) { this.memory.delete(key); return; }
    const host = this.host(); if (!host) return;
    host.save(`${this.prefix}${key}`, null);
    const keys = this.index(), at = keys.indexOf(key); if (at >= 0) { keys.splice(at, 1); host.save(`${this.prefix}keys`, keys); }
  }
  clear() { for (const key of [...this.index()]) this.removeItem(key); }
  [name: string]: unknown;
}

/** three's shared state a game may change (shader chunks, the shader libraries' uniforms, a few prototypes): the world's
 *  as it was before the game came in, and the game's own changes, put back for each visit (a module's change runs once,
 *  when the module is first loaded, and the world must have its own back in between). */
class ThreeState {
  private world?: { chunks: Record<string, string>; lib: Map<string, Record<string, unknown>>; uniformsLib: Map<string, Record<string, unknown>>; protos: Map<object, Map<PropertyKey, PropertyDescriptor>> };
  private game?: { chunks: Record<string, string>; lib: Map<string, Record<string, unknown>>; uniformsLib: Map<string, Record<string, unknown>>; protos: Map<object, Map<PropertyKey, PropertyDescriptor | undefined>> };
  private protos(T: Three): object[] {
    return [T.Skeleton.prototype, T.SkinnedMesh.prototype, T.Mesh.prototype, T.Object3D.prototype, T.BufferGeometry.prototype, T.Material.prototype,
      T.Texture.prototype, T.InstancedMesh.prototype, T.WebGLRenderer.prototype, T.Scene.prototype, T.Camera.prototype, T.PerspectiveCamera.prototype];
  }
  /** Before the game: the world's state; then the game's own changes from an earlier visit put back. */
  enter(T: Three) {
    const lib = new Map<string, Record<string, unknown>>(), uniformsLib = new Map<string, Record<string, unknown>>(), protos = new Map<object, Map<PropertyKey, PropertyDescriptor>>();
    for (const [name, shader] of Object.entries(T.ShaderLib) as [string, { uniforms?: Record<string, unknown> }][]) if (shader.uniforms) lib.set(name, { ...shader.uniforms });
    for (const [name, group] of Object.entries(T.UniformsLib) as [string, Record<string, unknown>][]) uniformsLib.set(name, { ...group });
    for (const proto of this.protos(T)) { const own = new Map<PropertyKey, PropertyDescriptor>(); for (const key of Reflect.ownKeys(proto)) own.set(key, Object.getOwnPropertyDescriptor(proto, key)!); protos.set(proto, own); }
    this.world = { chunks: { ...(T.ShaderChunk as unknown as Record<string, string>) }, lib, uniformsLib, protos };
    const game = this.game; if (!game) return;
    Object.assign(T.ShaderChunk, game.chunks);
    for (const [name, uniforms] of game.lib) Object.assign((T.ShaderLib as unknown as Record<string, { uniforms: Record<string, unknown> }>)[name].uniforms, uniforms);
    for (const [name, uniforms] of game.uniformsLib) Object.assign((T.UniformsLib as unknown as Record<string, Record<string, unknown>>)[name], uniforms);
    for (const [proto, own] of game.protos) for (const [key, descriptor] of own) { if (descriptor) Object.defineProperty(proto, key, descriptor); else delete (proto as Record<PropertyKey, unknown>)[key]; }
  }
  /** After the game: what it changed, kept for the next visit, and the world's own put back. */
  leave(T: Three) {
    const world = this.world; if (!world) return;
    const chunks: Record<string, string> = {}, current = T.ShaderChunk as unknown as Record<string, string>;
    for (const key of Object.keys(current)) if (current[key] !== world.chunks[key]) { chunks[key] = current[key]; if (key in world.chunks) current[key] = world.chunks[key]; else delete current[key]; }
    const lib = new Map<string, Record<string, unknown>>();
    for (const [name, shader] of Object.entries(T.ShaderLib) as [string, { uniforms?: Record<string, unknown> }][]) {
      const before = world.lib.get(name), now = shader.uniforms; if (!before || !now) continue;
      const added: Record<string, unknown> = {};
      for (const key of Object.keys(now)) if (now[key] !== before[key]) { added[key] = now[key]; if (key in before) now[key] = before[key]; else delete now[key]; }
      if (Object.keys(added).length) lib.set(name, added);
    }
    const uniformsLib = new Map<string, Record<string, unknown>>();
    for (const [name, group] of Object.entries(T.UniformsLib) as [string, Record<string, unknown>][]) {
      const before = world.uniformsLib.get(name); if (!before) continue;
      const added: Record<string, unknown> = {};
      for (const key of Object.keys(group)) if (group[key] !== before[key]) { added[key] = group[key]; if (key in before) group[key] = before[key]; else delete group[key]; }
      if (Object.keys(added).length) uniformsLib.set(name, added);
    }
    const protos = new Map<object, Map<PropertyKey, PropertyDescriptor | undefined>>();
    for (const [proto, before] of world.protos) {
      const changed = new Map<PropertyKey, PropertyDescriptor | undefined>();
      for (const key of Reflect.ownKeys(proto)) {
        const now = Object.getOwnPropertyDescriptor(proto, key)!, was = before.get(key);
        if (!was) { changed.set(key, now); delete (proto as Record<PropertyKey, unknown>)[key]; }
        else if (now.value !== was.value || now.get !== was.get || now.set !== was.set) { changed.set(key, now); Object.defineProperty(proto, key, was); }
      }
      for (const [key, was] of before) if (!Object.getOwnPropertyDescriptor(proto, key)) { changed.set(key, undefined); Object.defineProperty(proto, key, was); }
      if (changed.size) protos.set(proto, changed);
    }
    // (Merged over an earlier visit's: a change made once, at a module's first load, is only seen on the first visit.)
    const game = this.game ??= { chunks: {}, lib: new Map(), uniformsLib: new Map(), protos: new Map() };
    Object.assign(game.chunks, chunks);
    for (const [name, added] of lib) game.lib.set(name, { ...game.lib.get(name), ...added });
    for (const [name, added] of uniformsLib) game.uniformsLib.set(name, { ...game.uniformsLib.get(name), ...added });
    for (const [proto, changed] of protos) { const kept = game.protos.get(proto) ?? new Map(); for (const [key, d] of changed) kept.set(key, d); game.protos.set(proto, kept); }
    this.world = undefined;
  }
}

class Runtime {
  /** True from the first mount on: the game runs inside the world. */
  hosted = false;
  /** A live game (begin(host, true)): it shares every frame with the world. */
  live = false;
  /** How deep inside the game's own calls the page is (a live game's `within`): only then is a GPU upload the game's. */
  private inside = 0;
  /** Run `fn` as the game: what three uploads for it meanwhile is the game's (a live game; a cartridge's is all its own). */
  within<T>(fn: () => T): T { this.inside++; try { return fn(); } finally { this.inside--; } }
  /** Between a visit's end and the next mount: what a late callback of the last visit asks for is refused. */
  private dead = false;
  host?: CartridgeHost;
  /** Where the game's files are served from, ending in '/': the host's `base`. */
  base = '/';
  /** The game's page roots inside host.ui: `html` stands for document.documentElement, `body` for document.body, `app`
   *  for the page's #app (the game's root). */
  html?: HTMLElement; body?: HTMLElement; app?: HTMLElement;
  three?: Three;
  readonly local: Storage = new HostStorage('ls.', false, () => this.host);
  readonly session: Storage = new HostStorage('ss.', true, () => this.host);

  // ---- addresses -------------------------------------------------------------------------------------------------
  /** A '/assets/...' address inside the host's base; any other as it is. */
  asset = (url: string): string => typeof url === 'string' && url.startsWith('/assets/') ? `${this.base}${url.slice(1)}` : url;
  /** A JSON module's value (its big parts come as JSON.parse("...")): every '/assets/' string in it, and key, rebased. */
  json = <T>(value: T): T => this.rebase(value) as T;
  private rebase(value: unknown): unknown {
    if (typeof value === 'string') return this.asset(value);
    if (Array.isArray(value)) { for (let i = 0; i < value.length; i++) value[i] = this.rebase(value[i]); return value; }
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      for (const key of Object.keys(record)) {
        const each = this.rebase(record[key]);
        if (key.startsWith('/assets/')) { delete record[key]; record[this.asset(key)] = each; } else record[key] = each;
      }
    }
    return value;
  }
  /** An address the game may fetch: inside its base (or data:/blob:). Anything else is a server, which the demo never calls. */
  resolve = (raw: string): string | undefined => {
    if (/^(data|blob):/i.test(raw)) return raw;
    let url: URL; try { url = new URL(this.asset(raw), this.base); } catch { return undefined; }
    return url.href.startsWith(this.base) ? url.href : undefined;
  };
  fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = this.resolve(raw);
    if (!url || this.dead) return Promise.reject(new TypeError(`offline demo: ${raw} is not fetched`));
    this.requested?.add(url);
    const go = realFetch(input instanceof Request ? new Request(url, input) : url, init).then(response =>
      // A file the demo does not ship, answered with a page (a dev server's fallback): what a static host says, a 404.
      response.ok && /text\/html/i.test(response.headers.get('content-type') ?? '') && !/\.html?(?:[?#]|$)/i.test(url) ? new Response(null, { status: 404, statusText: 'Not Found' }) : response);
    // A JSON file's own '/assets/' addresses, inside the base too.
    return /\.json(?:[?#]|$)/i.test(url) ? go.then(response => this.jsonBase(response)) : go;
  };
  private async jsonBase(response: Response): Promise<Response> {
    if (!response.ok) return response;
    const text = await response.text();
    return new Response(text.split('"/assets/').join(`"${this.base}assets/`), { status: response.status, statusText: response.statusText, headers: response.headers });
  }
  /** Every address the game fetched (`?impact-assets` on the page): what the demo ships. */
  requested?: Set<string>;

  // ---- one loop: the game's animation frames run from the world's frame --------------------------------------------
  private frames = new Map<number, FrameRequestCallback>();
  private nextFrame = 1;
  raf = (callback: FrameRequestCallback): number => { if (this.dead) return 0; const id = this.nextFrame++; this.frames.set(id, callback); return id; };
  caf = (id: number) => { this.frames.delete(id); };
  /** Runs every animation frame the game asked for, as the browser would: the ones asked for meanwhile wait for the next. */
  frame(now: number) {
    const due = this.frames; if (!due.size) return;
    this.frames = new Map();
    for (const callback of due.values()) { try { callback(now); } catch (error) { console.error('Impact frame:', error); } }
  }

  // ---- timers ------------------------------------------------------------------------------------------------------
  private timeouts = new Set<ReturnType<typeof setTimeout>>();
  private intervals = new Set<ReturnType<typeof setInterval>>();
  private idles = new Map<number, ReturnType<typeof setTimeout> | number>();
  private nextIdle = 1;
  setTimeout = (handler: TimerHandler, ms?: number, ...args: unknown[]): ReturnType<typeof setTimeout> => {
    if (this.dead) return 0 as unknown as ReturnType<typeof setTimeout>;
    const id = realSetTimeout(() => { this.timeouts.delete(id); if (typeof handler === 'function') (handler as (...a: unknown[]) => void)(...args); }, ms);
    this.timeouts.add(id); return id;
  };
  clearTimeout = (id?: ReturnType<typeof setTimeout> | number) => { if (id === undefined) return; this.timeouts.delete(id as ReturnType<typeof setTimeout>); realClearTimeout(id as ReturnType<typeof setTimeout>); };
  setInterval = (handler: TimerHandler, ms?: number, ...args: unknown[]): ReturnType<typeof setInterval> => {
    if (this.dead) return 0 as unknown as ReturnType<typeof setInterval>;
    const id = realSetInterval(() => { if (typeof handler === 'function') (handler as (...a: unknown[]) => void)(...args); }, ms);
    this.intervals.add(id); if (this.importing) this.moduleIntervals.push({ handler, ms, args }); return id;
  };
  clearInterval = (id?: ReturnType<typeof setInterval> | number) => { if (id === undefined) return; this.intervals.delete(id as ReturnType<typeof setInterval>); realClearInterval(id as ReturnType<typeof setInterval>); };
  requestIdleCallback = (callback: IdleRequestCallback, options?: IdleRequestOptions): number => {
    if (this.dead) return 0;
    const id = this.nextIdle++;
    const run = (deadline: IdleDeadline) => { this.idles.delete(id); callback(deadline); };
    this.idles.set(id, realIdle ? realIdle(run, options) : realSetTimeout(() => run({ didTimeout: true, timeRemaining: () => 0 }), 1));
    return id;
  };
  cancelIdleCallback = (id: number) => { const handle = this.idles.get(id); if (handle === undefined) return; this.idles.delete(id); if (realCancelIdle && typeof handle === 'number') realCancelIdle(handle); else realClearTimeout(handle as ReturnType<typeof setTimeout>); };

  // ---- listeners and observers -------------------------------------------------------------------------------------
  private listeners: Listener[] = [];
  /** While the game's modules first load: what they start then runs once a page, so each later visit starts it again. */
  importing = false;
  private moduleListeners: Listener[] = [];
  private moduleIntervals: { handler: TimerHandler; ms?: number; args: unknown[] }[] = [];
  /** A listener the game puts on anything outside its own interface - the window, the document, the world's canvas,
   *  a media query, the audio context - is noted, and taken off when the visit ends. */
  on = (target: EventTarget | null | undefined, type: string, fn: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) => {
    if (!target || !fn) return;
    if (this.dead && this.outside(target)) return;
    (target as EventTarget).addEventListener(type, fn, options);
    if (!this.outside(target)) return;
    this.listeners.push({ target, type, fn, options });
    if (this.importing) this.moduleListeners.push({ target, type, fn, options });
  };
  off = (target: EventTarget | null | undefined, type: string, fn: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) => {
    if (!target || !fn) return;
    (target as EventTarget).removeEventListener(type, fn, options);
    const capture = typeof options === 'boolean' ? options : !!options?.capture;
    const at = this.listeners.findIndex(l => l.target === target && l.type === type && l.fn === fn && (typeof l.options === 'boolean' ? l.options : !!l.options?.capture) === capture);
    if (at >= 0) this.listeners.splice(at, 1);
    const kept = this.moduleListeners.findIndex(l => l.target === target && l.type === type && l.fn === fn);
    if (kept >= 0) this.moduleListeners.splice(kept, 1);
  };
  private outside(target: EventTarget): boolean {
    if (typeof EventTarget === 'undefined' || !(target instanceof EventTarget)) return false;          // three's own dispatchers die with their objects
    if (typeof AbortSignal !== 'undefined' && target instanceof AbortSignal) return false;
    if (typeof Node !== 'undefined' && target instanceof Node) {
      if (target === document || target === document.documentElement || target === document.body) return true;
      return target.isConnected && !this.host?.ui.contains(target);
    }
    return true;
  }
  private observers: { disconnect(): void }[] = [];
  /** An observer the game starts: disconnected when the visit ends. */
  keep = <T extends { disconnect(): void }>(observer: T): T => { this.observers.push(observer); return observer; };

  // ---- globals the game hangs on window (its checks' handles) -------------------------------------------------------
  private globals = new Set<string>();
  global = (name: string, value: unknown) => { this.globals.add(name); (page as unknown as Record<string, unknown>)[name] = value; return value; };
  assignGlobals = (values: object) => { for (const name of Object.keys(values)) this.globals.add(name); return Object.assign(page, values); };
  defineGlobal = (name: string, descriptor: PropertyDescriptor) => { this.globals.add(name); return Object.defineProperty(page, name, { ...descriptor, configurable: true }); };
  /** location.reload and the address bar's history belong to the world's page: never the game's. */
  reload = () => { console.warn('Impact asked to reload the page; the demo does not.'); };
  history = { replaceState() {}, pushState() {}, back() {}, forward() {}, go() {}, get state() { return null; }, get length() { return 1; } };

  // ---- the game's stylesheets ----------------------------------------------------------------------------------------
  private css: string[] = [];
  private styles: HTMLStyleElement[] = [];
  private cssOn = false;
  /** A stylesheet of the game's (already scoped under [data-game="impact"] by the build), in the order its modules load. */
  addCss = (text: string) => { const fixed = text.replace(/url\((['"]?)\/assets\//g, (_, quote: string) => `url(${quote}${this.base}assets/`); this.css.push(fixed); if (this.cssOn) this.inject(fixed); };
  private inject(text: string) {
    const style = document.createElement('style'); style.dataset.impact = ''; style.textContent = text;
    // (Each before the game's roots, after the ones before it: the order its modules loaded them in.)
    (this.host?.ui ?? document.head).insertBefore(style, this.html ?? null); this.styles.push(style);
  }

  // ---- the GPU: everything the game uploads is let go when it leaves -------------------------------------------------
  private gpu = new Set<{ dispose?: () => void }>();
  private unwatchGpu?: () => void;
  private watchGpu(T: Three) {
    const proto = T.EventDispatcher.prototype as unknown as { addEventListener: (type: string, fn: unknown) => void; removeEventListener: (type: string, fn: unknown) => void };
    const add = proto.addEventListener, remove = proto.removeEventListener, gpu = this.gpu, mine = () => !this.live || this.inside > 0;
    // three's renderer listens for 'dispose' on every texture, geometry, material, render target and instanced mesh it
    // uploads: whatever gets one while the game is in (a live game: inside its own calls) is the game's.
    proto.addEventListener = function (this: { dispose?: () => void }, type: string, fn: unknown) { if (type === 'dispose' && mine()) gpu.add(this); return add.call(this, type, fn); };
    proto.removeEventListener = function (this: { dispose?: () => void; _listeners?: Record<string, unknown[]> }, type: string, fn: unknown) {
      const out = remove.call(this, type, fn); if (type === 'dispose' && !this._listeners?.dispose?.length) gpu.delete(this); return out; };
    this.unwatchGpu = () => { proto.addEventListener = add; proto.removeEventListener = remove; };
  }
  private releaseGpu() {
    for (const object of [...this.gpu]) { try { object.dispose?.(); } catch { /* already gone */ } }
    this.gpu.clear();
  }

  // ---- the world's renderer: what the game sets on the instance itself, put back ------------------------------------
  private rendererOwn?: Map<string, PropertyDescriptor | undefined>;
  private debugChecks = true;

  private readonly threeState = new ThreeState();

  /** A visit begins: everything above starts noting, the game's page roots go into host.ui. `live`: a live game (above). */
  begin(host: CartridgeHost, live = false) {
    this.host = host; this.base = host.base; this.hosted = true; this.dead = false; this.three = host.THREE; this.live = live; this.inside = 0;
    if (typeof location === 'object' && /[?&]impact-assets\b/.test(location.search)) { this.requested ??= new Set(); performance.setResourceTimingBufferSize?.(20000); }
    const T = host.THREE;
    if (!live) this.threeState.enter(T);
    this.watchGpu(T);
    // (A live game's addresses are all rebased as it is built - every '/assets/' string, template and JSON value - so the
    // page's default loading manager stays the world's.)
    if (!live) T.DefaultLoadingManager.setURLModifier(url => this.asset(url));
    const r = host.renderer as unknown as Record<string, unknown>;
    this.rendererOwn = new Map(Object.keys(r).map(key => [key, Object.getOwnPropertyDescriptor(r, key)]));
    this.debugChecks = host.renderer.debug.checkShaderErrors;
    // html > body > #app, as the game's page had them (scoped CSS maps html, body, :root and #app onto these).
    const html = document.createElement('div'); html.className = 'ik-html';
    const body = document.createElement('div'); body.className = 'ik-body';
    const app = document.createElement('div'); app.id = 'ik-app';
    body.append(app); html.append(body); host.ui.append(html);
    this.html = html; this.body = body; this.app = app;
    const base = document.createElement('style'); base.dataset.impact = 'frame';
    // The world's canvas is under host.ui: the game's roots let the pointer through to it, as #app did round its canvas,
    // and every direct child takes the pointer back as the page's did (0-specificity, so any rule of the game's wins).
    base.textContent = `[data-game="impact"]>.ik-html,[data-game="impact"] .ik-body,[data-game="impact"] #ik-app{position:absolute;inset:0;pointer-events:none;overflow:hidden}
:where([data-game="impact"] #ik-app)>*,:where([data-game="impact"] .ik-body)>:where(:not(#ik-app)){pointer-events:auto}`;
    host.ui.insertBefore(base, html); this.styles.push(base);
    this.cssOn = true; for (const text of this.css) this.inject(text);
    // What the game's modules started as they first loaded, started again for this visit.
    for (const l of this.moduleListeners) { l.target.addEventListener(l.type, l.fn, l.options); this.listeners.push(l); }
    for (const i of this.moduleIntervals) this.setInterval(i.handler, i.ms, ...i.args);
  }

  /** The visit ends: every timer, frame, listener, observer, global, stylesheet and GPU resource of the game's goes. */
  end() {
    this.dead = true;
    for (const id of this.timeouts) realClearTimeout(id); this.timeouts.clear();
    for (const id of this.intervals) realClearInterval(id); this.intervals.clear();
    for (const id of [...this.idles.keys()]) this.cancelIdleCallback(id);
    this.frames.clear();
    for (const l of this.listeners.splice(0)) { try { l.target.removeEventListener(l.type, l.fn, l.options); } catch { /* gone */ } }
    for (const o of this.observers.splice(0)) { try { o.disconnect(); } catch { /* gone */ } }
    for (const name of this.globals) { try { delete (page as unknown as Record<string, unknown>)[name]; } catch { /* kept */ } }
    this.globals.clear();
    this.cssOn = false; for (const style of this.styles.splice(0)) style.remove();
    this.html?.remove(); this.html = this.body = this.app = undefined;
    const host = this.host, T = this.three;
    if (host && T) {
      if (!this.live) T.DefaultLoadingManager.setURLModifier(undefined as unknown as (url: string) => string);
      const r = host.renderer as unknown as Record<string, unknown>;
      // (A live game never touches the instance, and the world goes on using it meanwhile: what is on it now is the world's.)
      if (!this.live) for (const key of Object.keys(r)) if (!this.rendererOwn?.has(key)) delete r[key];
      if (!this.live) for (const [key, d] of this.rendererOwn ?? []) if (d && typeof d.value === 'function' && r[key] !== d.value) Object.defineProperty(r, key, d);
      host.renderer.debug.checkShaderErrors = this.debugChecks;
      this.releaseGpu();
      this.unwatchGpu?.(); this.unwatchGpu = undefined;
      if (!this.live) this.threeState.leave(T);
    }
  }
}

export const rt = new Runtime();
