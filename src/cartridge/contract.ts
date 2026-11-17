// THE CARTRIDGE CONTRACT. Each of Amir's games runs inside the world as a cartridge: the game's own code, rules,
// controls, camera, menus, HUD and look, on the world's three.js, renderer and frame loop. Every game port codes
// against this file; docs/CARTRIDGES.md has the rules. Change it only with the lead's agreement.
import type * as THREE from 'three';

export type CartridgeQuality = 'low' | 'mid' | 'high';

/** What the world hands a game while it runs. */
export interface CartridgeHost {
  /** The world's three.js (r186). A cartridge build points `import 'three'` at it (src/cartridge/three-shim.js in the
   *  game's repo), so the game and the world share one three: never bundle a second copy. */
  readonly THREE: typeof THREE;
  /** The world's renderer; its canvas fills the page. On mount, set whatever the game needs on it (tone mapping,
   *  output colour space, shadow map, clear colour, autoClear, pixel ratio, size). The host saves the world's settings
   *  before mount and puts them back after unmount. Never dispose it, never replace or remove its canvas, never call
   *  forceContextLoss. A game with its own WebGL2 code draws with renderer.getContext() and calls
   *  renderer.resetState() after its own GL calls. */
  readonly renderer: THREE.WebGLRenderer;
  /** renderer.domElement. Pointer and touch events land on it. */
  readonly canvas: HTMLCanvasElement;
  /** The game's own DOM layer over the canvas, for its menus and HUD. It and everything in it are removed on exit. */
  readonly ui: HTMLElement;
  /** Where this game's files are served from, ending in '/'. Every file the game loads at run time starts here. */
  readonly base: string;
  /** The page's one AudioContext (made on the visitor's click into the game, so it may play at once). Connect
   *  everything the game plays to `out`; the host fades it in and out. Never close ctx. */
  readonly audio: { readonly ctx: AudioContext; readonly out: AudioNode };
  readonly quality: CartridgeQuality;
  /** True on a touch-first device. */
  readonly touch: boolean;
  /** Back to the world. Call it from the game's own quit / leave / exit-to-desktop actions. */
  exit(): void;
  /** A small JSON-safe store for the game's own saves and settings (localStorage under `dw.game.<id>.<key>`). */
  save(key: string, value: unknown): void;
  load<T>(key: string): T | null;
}

export interface Cartridge {
  /** Build the game and land on its menu, as when the real game opens. Resolve when the first frame can be drawn.
   *  Call `progress` with 0..1 as files load (it drives the host's loading bar). */
  mount(host: CartridgeHost, progress: (fraction: number) => void): Promise<void>;
  /** One frame, from the world's loop: `dt` seconds (clamped to 0.1), `now` = performance.now(). Draw the final picture
   *  to the screen (render target null). Never start a requestAnimationFrame loop of your own. */
  frame(dt: number, now: number): void;
  /** The page changed size (CSS pixels) or pixel ratio. Also called once right after mount resolves. */
  resize(width: number, height: number, dpr: number): void;
  /** The visitor left. Free everything the game made: geometries, materials, textures, render targets, workers,
   *  timers, event listeners, audio nodes, DOM, styles. The world takes the renderer back right after. */
  unmount(): void;
}

/** What a cartridge module (`cartridge.js`) exports. */
export interface CartridgeModule {
  default: () => Cartridge;
  meta: {
    id: string;
    title: string;
    /** Where the build came from: repo, branch and commit. */
    source: string;
  };
}
