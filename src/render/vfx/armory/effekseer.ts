import * as THREE from 'three';
import { ASSET_BASE } from './assetBase';

/**
 * The Armory's Effekseer effects (`efk_*`: the Effekseer sample pack, CC0) in the game: one Effekseer for WebGL
 * runtime (v1.80.7, MIT) for the page, the adapter's own stand-in for the Armory's `fxlib/lib/effekseer/
 * EffekseerRuntime.js` (scripts/engine/armory/vendor.mts maps that module here; same `getEffekseer(ctx)` API).
 *
 *  - **Loaded only when an effect needs it.** The runtime (169 KB of script, 1.4 MB of WebAssembly) is fetched the first
 *    time an Effekseer effect is built (the Forge's first try of one), never otherwise.
 *  - **Drawn inside the game's scene pass,** depth-tested against the fighters, under the bloom and the look like every
 *    other effect: a sentinel (an empty triangle, last in the transparent queue) in the host's root calls back once a
 *    frame for the game camera, Effekseer draws into the target bound then, and three's state cache is reset and the
 *    target rebound, three's documented way to hand the context back.
 *  - **No background capture.** The Armory resolved the frame into a copy for Effekseer's distortion materials, reading
 *    three's internal texture handles. The game skips it: a distortion layer draws without what is behind it.
 *  - **Its clock** is the frame's: Effekseer counts in 60 fps frames.
 */

interface EfkHandle {
  readonly exists: boolean;
  stop(): void;
  setLocation(x: number, y: number, z: number): void;
  setRotation(x: number, y: number, z: number): void;
  setScale(x: number, y: number, z: number): void;
  setSpeed(s: number): void;
  setAllColor(r: number, g: number, b: number, a: number): void;
}
interface EfkEffect { readonly isLoaded?: boolean }
interface EfkContext {
  init(gl: WebGLRenderingContext | WebGL2RenderingContext, settings: { instanceMaxCount: number; squareMaxCount: number }): void;
  setRestorationOfStatesFlag(on: boolean): void;
  loadEffect(path: string, scale: number, onload: () => void, onerror: (message: string, url: string) => void): EfkEffect;
  play(effect: EfkEffect, x: number, y: number, z: number): EfkHandle | null;
  update(frames: number): void;
  setProjectionMatrix(m: ArrayLike<number>): void;
  setCameraMatrix(m: ArrayLike<number>): void;
  draw(): void;
}
interface EfkModule { initRuntime(wasm: string, onload: () => void, onerror: () => void): void; createContext(): EfkContext }

const RUNTIME = () => `${ASSET_BASE}fxlib/effekseer/`;
let runtime: Promise<EfkModule> | undefined;

/** The script and its WebAssembly, once a page. */
function loadRuntime(): Promise<EfkModule> {
  return runtime ??= new Promise<EfkModule>((resolve, reject) => {
    const w = window as unknown as { effekseer?: EfkModule };
    const init = () => w.effekseer!.initRuntime(`${RUNTIME()}effekseer.wasm`, () => resolve(w.effekseer!), () => reject(new Error('Effekseer: its WebAssembly runtime failed to start')));
    if (w.effekseer) { init(); return; }
    const script = document.createElement('script');
    script.src = `${RUNTIME()}effekseer.min.js`;
    script.async = true;
    script.onload = init;
    script.onerror = () => reject(new Error('Effekseer: its runtime script failed to load'));
    document.head.appendChild(script);
  });
}

/** What the runtime needs of the scene: its renderer and camera once a frame has been drawn (ArmoryHost). */
export interface EffekseerHost { readonly root: THREE.Object3D; readonly renderer?: THREE.WebGLRenderer; readonly gameCamera?: THREE.Camera }

class EffekseerRuntime {
  private context?: EfkContext;
  private starting?: Promise<void>;
  private restoring = false;
  private readonly effects = new Map<string, { effect?: EfkEffect; loaded: boolean; failed: boolean }>();
  private readonly live = new Set<EfkHandle>();
  private last = -1;
  private drawn = -1;
  globalScale = 1;

  constructor(private readonly host: EffekseerHost) {
    // The sentinel: three points at the origin, nothing rasterised; its callback is the draw.
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3));
    const sentinel = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ depthWrite: false, depthTest: false, transparent: true }));
    sentinel.name = 'EffekseerSentinel';
    sentinel.frustumCulled = false;
    sentinel.renderOrder = 1e9;
    sentinel.onAfterRender = (renderer, _scene, camera) => this.draw(renderer, camera);
    host.root.add(sentinel);
  }

  /** Starts the runtime once the game has drawn a frame (its renderer is known then). */
  start() {
    if (this.context || this.starting || !this.host.renderer) return;
    const renderer = this.host.renderer;
    // A context lost and given back (GameRenderer) has none of the runtime's buffers, textures or shaders: they were
    // made by its own GL calls, which three does not know to make again. A new runtime context loads every effect anew.
    if (!this.restoring) { this.restoring = true; renderer.domElement.addEventListener('webglcontextrestored', () => this.restart()); }
    this.starting = loadRuntime().then(module => {
      const ctx = module.createContext();
      ctx.init(renderer.getContext(), { instanceMaxCount: 4000, squareMaxCount: 20000 });
      ctx.setRestorationOfStatesFlag(false);
      // Its own GL calls (shaders, buffers) leave the context bound as three does not know: three's caches set back, as after
      // each of its draws (below). A room's load starts it before the room's compile now (startEffekseer).
      renderer.resetState();
      this.context = ctx;
      for (const [path, entry] of this.effects) if (!entry.effect) this.load(path, entry);
    }).catch(error => { console.warn(error); this.starting = undefined; });
  }

  private restart() {
    this.live.clear(); this.context = undefined; this.starting = undefined;
    for (const entry of this.effects.values()) { entry.effect = undefined; entry.loaded = false; entry.failed = false; }
    this.start();
  }

  private load(path: string, entry: { effect?: EfkEffect; loaded: boolean; failed: boolean }) {
    entry.effect = this.context!.loadEffect(`${RUNTIME()}fx/${path}`, 1, () => { entry.loaded = true; }, (message, url) => { entry.failed = true; console.warn(`Effekseer: ${message} ${url}`); });
  }

  /** Starts loading an effect (relative to the samples' folder). Idempotent. */
  preload(path: string) {
    let entry = this.effects.get(path);
    if (!entry) {
      entry = { loaded: false, failed: false };
      this.effects.set(path, entry);
      if (this.context) this.load(path, entry);
    }
    this.start();
    return entry;
  }

  isLoaded(path: string) { const entry = this.effects.get(path); return !!entry && (entry.loaded || !!entry.effect?.isLoaded); }

  /** Plays a loaded effect; null while it (or the runtime) is still loading: the ability tries again next frame. */
  play(path: string, x: number, y: number, z: number): EfkHandle | null {
    const entry = this.preload(path);
    if (!this.context || !entry.effect || !(entry.loaded || entry.effect.isLoaded)) return null;
    const handle = this.context.play(entry.effect, x, y, z);
    if (handle) this.live.add(handle);
    return handle;
  }

  stop(handle: EfkHandle | null | undefined) {
    if (!handle) return;
    try { handle.stop(); } catch { /* already gone */ }
    this.live.delete(handle);
  }

  stopAll() { for (const handle of [...this.live]) this.stop(handle); }

  /** Resolves when it is up and every effect asked of it has loaded or failed, or at `until` (performance.now()). */
  loaded(until: number): Promise<void> {
    return new Promise(resolve => {
      const check = () => {
        const done = !!this.context && [...this.effects.values()].every(e => e.loaded || e.failed || !!e.effect?.isLoaded);
        if (done || performance.now() >= until) resolve(); else setTimeout(check, 25);
      };
      check();
    });
  }

  /** Once a frame, for the game camera only: advance, then draw what is playing into the target bound now. */
  private draw(renderer: THREE.WebGLRenderer, camera: THREE.Camera) {
    if (!this.host.renderer) return;
    if (camera !== this.host.gameCamera) return;
    const now = performance.now() / 1000;
    if (now === this.drawn) return;
    this.drawn = now;
    this.start();
    const ctx = this.context;
    if (!ctx) return;
    const dt = this.last < 0 ? 0 : Math.min(.1, Math.max(0, now - this.last));
    this.last = now;
    ctx.update(dt * 60);
    for (const handle of this.live) if (!handle.exists) this.live.delete(handle);
    if (!this.live.size) return;
    const target = renderer.getRenderTarget();
    const gl = renderer.getContext();
    // Effekseer uploads its textures between frames with whatever pixel-store state three left: the defaults back.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    renderer.state.buffers.color.setMask(true);
    ctx.setProjectionMatrix(camera.projectionMatrix.elements);
    ctx.setCameraMatrix(camera.matrixWorldInverse.elements);
    ctx.draw();
    renderer.resetState();
    // resetState() puts the pixel-store defaults back on the GPU but empties three's cache of them, so the next partial
    // texture upload (the grass clumps', every frame the lens moves) asked the browser for three of them with
    // getParameter: a synchronous round trip to the GPU process each, which waits on the frame's queued draws - 5% of the
    // main thread in a Training fight with effects up. They are all zero; saying so refills the cache.
    const gl2 = gl as WebGL2RenderingContext;
    if (gl2.UNPACK_ROW_LENGTH !== undefined) for (const name of [gl2.UNPACK_ROW_LENGTH, gl2.UNPACK_IMAGE_HEIGHT, gl2.UNPACK_SKIP_PIXELS, gl2.UNPACK_SKIP_ROWS, gl2.UNPACK_SKIP_IMAGES]) renderer.state.pixelStorei(name, 0);
    renderer.setRenderTarget(target);
  }
}

const runtimes = new WeakMap<object, EffekseerRuntime>();
let current: EffekseerHost | undefined;
/** The host the next `getEffekseer` belongs to (ArmoryHost sets it while it builds an effect type). */
export function effekseerHost(host: EffekseerHost | undefined) { current = host; }

/** Resolves when the scene's Effekseer runtime (when an effect built in it uses one) is up and has loaded, or failed,
 *  every effect asked of it; or at `until` (performance.now()). */
export function effekseerLoaded(host: EffekseerHost, until: number): Promise<void> {
  const runtime = runtimes.get(host);
  // Started here too: its own start waits for the first frame drawn with the game's camera, which a room's load has not
  // made yet (fxStage.ts `effekseer`).
  runtime?.start();
  return runtime?.loaded(until) ?? Promise.resolve();
}

/** The runtime's script and WebAssembly fetched now, when an effect built in the scene uses it - nothing on the GPU here: the
 *  context starts with startEffekseer (a room's load, once it has the renderer and camera: FxStage.prefetchEffekseer) or in
 *  fxStage.ts `effekseer`. A room's load asks for them beside its models instead of after its compile, where the sound bank
 *  has the line (the performance sweep, 24 October 2026). */
export function prefetchEffekseer(host: EffekseerHost): void {
  if (runtimes.has(host)) void loadRuntime().catch(() => { /* reported where the runtime starts */ });
}

/** The scene's runtime started now (its host given the renderer and camera first: ArmoryHost.seen), when an effect built in it
 *  uses one: its script, WebAssembly and every effect's files then load beside the room's models (the performance sweep, 24
 *  October 2026), not after the room's compile, when the sound bank has the line. fxStage.ts `effekseer` still waits for them. */
export function startEffekseer(host: EffekseerHost): void { runtimes.get(host)?.start(); }

/** The Armory's `getEffekseer(ctx)`: the runtime of the scene the ability is built in. */
export function getEffekseer(_ctx?: unknown): EffekseerRuntime {
  const host = current;
  if (!host) throw new Error('Effekseer: no Armory host is building an effect');
  let rt = runtimes.get(host);
  if (!rt) { rt = new EffekseerRuntime(host); runtimes.set(host, rt); }
  return rt;
}
