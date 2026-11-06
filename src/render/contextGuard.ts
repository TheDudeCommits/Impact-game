/** The WebGL context, lost and given back (the stability pass, 2 November 2026: 156 "graphics context lost" reports on
 *  the live log, mostly iPhone Safari mid-match, and 9 "shaderSource must be an instance of WebGLShader").
 *
 *  three keeps a page through a lost context (it prevents the default, so the browser may give the context back) and
 *  draws nothing meanwhile: `render` returns at once. Its `compile` does not look: on a lost context `createShader`
 *  answers null and the next call, `shaderSource(null, ...)`, throws - a room's load or a warm-up that compiled during
 *  a loss threw that, and a `compileAsync` caught mid-loss polled its programs for ever (a lost program's link status
 *  reads null, never true). GameRenderer.compileScene waits here for the context to come back and compiles then; any
 *  other compile or upload while it is lost (an effect's warm-up, a ground grid's texture) is skipped, and is done at its
 *  first draw after the restore, as three rebuilds everything it still holds. */

type Listener = (type: string, listener: () => void) => void;
export interface GuardedRenderer {
  compile(...args: never[]): unknown;
  compileAsync(...args: never[]): Promise<unknown>;
  initTexture(...args: never[]): void;
}

export class ContextGuard {
  private flag = false;
  private readonly restoredWaiters: (() => void)[] = [];
  /** The next loss, one promise for every waiter (made when first asked for). */
  private loss?: { promise: Promise<void>; resolve: () => void };
  /** `canvas`: the context's canvas; `isLost`: the context's own word (`gl.isContextLost()`), which turns before the
   *  event's task runs. */
  constructor(canvas: { addEventListener: Listener }, private readonly isLost: () => boolean = () => false) {
    canvas.addEventListener('webglcontextlost', () => { this.flag = true; const loss = this.loss; this.loss = undefined; loss?.resolve(); });
    canvas.addEventListener('webglcontextrestored', () => { this.flag = false; for (const done of this.restoredWaiters.splice(0)) done(); });
  }
  /** Lost and not yet given back. */
  get lost() { return this.flag || this.isLost(); }
  /** At once while the context is there; else when it is given back (never, if it is not: the page reloads, pageLife.ts). */
  restored(): Promise<void> {
    if (!this.lost) return Promise.resolve();
    // (Lost by the context's word before its event: the restore follows that event.)
    return new Promise(done => this.restoredWaiters.push(done));
  }
  /** The next loss. */
  nextLoss(): Promise<void> {
    if (!this.loss) { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); this.loss = { promise, resolve }; }
    return this.loss.promise;
  }

  /** `work` once the context is there, again from the start whenever the context is lost before it settles (or it throws
   *  because it was): what it built for the lost context is gone, and three builds anew on the restore. */
  async whole<T>(work: () => Promise<T>): Promise<T> {
    for (;;) {
      await this.restored();
      let result: { value: T } | undefined;
      try {
        const loss = this.nextLoss().then(() => undefined);
        result = await Promise.race([work().then(value => ({ value })), loss]);
      } catch (error) { if (!this.lost) throw error; }
      if (result && !this.lost) return result.value;
    }
  }

  /** The renderer's compiles and uploads, skipped while the context is lost: `compile` builds nothing (an empty set, as
   *  for a scene with nothing new), `compileAsync` resolves at once - and, caught by a loss, resolves then instead of
   *  waiting for ever - and `initTexture` uploads nothing. */
  guard<R extends GuardedRenderer>(renderer: R): R {
    const compile = renderer.compile.bind(renderer) as (...args: unknown[]) => unknown;
    const compileAsync = renderer.compileAsync.bind(renderer) as (...args: unknown[]) => Promise<unknown>;
    const initTexture = renderer.initTexture.bind(renderer) as (...args: unknown[]) => void;
    (renderer as { compile: unknown }).compile = (...args: unknown[]) => this.lost ? new Set() : compile(...args);
    (renderer as { compileAsync: unknown }).compileAsync = (...args: unknown[]) => {
      if (this.lost) return Promise.resolve(args[0]);
      return Promise.race([compileAsync(...args), this.nextLoss().then(() => args[0])]);
    };
    (renderer as { initTexture: unknown }).initTexture = (...args: unknown[]) => { if (!this.lost) initTexture(...args); };
    return renderer;
  }
}
