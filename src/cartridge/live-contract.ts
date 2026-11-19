// THE LIVE CONTRACT. Each of Dude's games plays live inside the world, at its own place: an ongoing match on the game's
// own code, rules and bots, standing in the world and drawn through the world's camera like everything else. A visitor
// who walks in takes over one of its players. From that moment the game's own camera, controls, HUD and sound carry
// them, until they leave (Esc, the Leave button, or the game's own quit), and the world takes them back where they are.
// No doors, no menus, no loading screens, nothing to click. docs/LIVE.md has the rules; every game port codes against
// this file (a copy sits in each game's src/cartridge/live-contract.ts). Change it only with the lead's agreement.
import type * as THREE from 'three';

export type LiveQuality = 'low' | 'mid' | 'high';

/** What the world hands a live game. */
export interface LiveHost {
  /** The world's three.js (r186). A live build points `import 'three'` at it (three-shim.js): one three on the page. */
  readonly THREE: typeof THREE;
  /** The world's renderer. Never create another renderer, canvas or GL context, never dispose it or change its size.
   *  draw() may set what it needs (shadow map, sorting, clipping) and puts it back before it returns. */
  readonly renderer: THREE.WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  /** The game's own DOM layer (its HUD, its call-outs). The world hides it while the visitor watches and shows it while
   *  they play. Everything in it goes when the game unmounts. Pointer events reach it only while the visitor plays. */
  readonly ui: HTMLElement;
  /** Where the game's files are served from, ending in '/'. Every file the game loads at run time starts here. */
  readonly base: string;
  /** The page's AudioContext (it may stay suspended until the visitor's first click or key) and the game's bus. Connect
   *  everything the game plays to `out`: the world sets it at the venue, falling off with distance, while the visitor
   *  watches, and brings it close while they play. Never close ctx, never make another. */
  readonly audio: { readonly ctx: AudioContext; readonly out: AudioNode };
  readonly quality: LiveQuality;
  /** True on a touch-first device. */
  readonly touch: boolean;
  /** Is the visitor playing (between join() and leave())? */
  readonly playing: boolean;
  /** The game's own quit: the visitor wants out. The world calls leave() and takes them back. */
  exit(): void;
  /** A small JSON-safe store for the game's settings (localStorage under `dw.game.<id>.<key>`). */
  save(key: string, value: unknown): void;
  load<T>(key: string): T | null;
  /** Who walks in. The player the visitor takes over becomes them, drawn in the game's own style; leave() gives the
   *  bot its own look back. */
  readonly visitor: LiveLikeness;
}

/**
 * The visitor's own character: what they look like and what they wear, as data each game draws in its own art and
 * character style. Hoop It makes them a chibi, Impact a fighter: the same person in every game, with their hair, their
 * face and every item they wear as it really is. A game maps what it already has (its own curly hairdo, its own high-tops),
 * builds what it lacks from these colours and words in its own manner, and never swaps an item for a different one.
 * Colours are '#rrggbb'. URLs are absolute.
 */
export interface LiveLikeness {
  /** What the game calls them on its name plates, its HUD and its scoreboard. */
  name: string;
  /** Fair olive skin. */
  skin: string;
  /** The iris. */
  eyes: string;
  /** Thick, straight, dark. */
  brows: string;
  /** Light stubble along the jaw and chin (a tint over the skin), or null. */
  stubble: string | null;
  /** A cheerful face: a friendly closed smile, never a scowl. */
  mood: 'cheerful';
  hair: {
    /** Tight curls piled on top and over the brow, the sides and back faded short (a skin fade at the bottom). */
    style: 'curly-top-fade';
    /** The curls: silver. */
    color: string;
    /** Deep between the curls. */
    shade: string;
    /** The faded sides, where they start (they fade into the skin below). */
    fade: string;
  };
  outfit: {
    /** A zip-up bomber, worn open over the tee, with a shirt collar and ribbed cuffs and hem. */
    jacket: {
      style: 'skyline-bomber';
      /** Light from the collar over the shoulders and chest, down to the skyline. */
      top: string;
      /** A city skyline in silhouette across the chest, the back and the upper sleeves: the buildings rise out of the
       *  dark half into the light one. Everything below it is `bottom`, the sleeves from just above the elbow. */
      bottom: string;
      /** The cuffs and the hem band. */
      rib: string;
      /** The zip, two silver lines down the open front. */
      zip: string;
      /** The back: `word` in heavy slab serif capitals over the emblem, the banner under it. */
      word: string;
      /** The emblem: a bull's head seen from the front, red, with white horns curving up, black eyes and nostrils, in a
       *  black outline. A small one sits on the left chest. */
      emblem: string;
      horns: string;
      /** A ribbon banner under the emblem, white capitals on red. */
      banner: string;
      bannerColor: string;
    };
    /** The tee under the open jacket. */
    shirt: string;
    /** Loose joggers, gathered in a cuff at the ankle. */
    pants: { style: 'joggers'; color: string };
    /** High-top basketball shoes: white side panels and toe box, red toe cap, heel, eyestay and collar, a black swoosh
     *  arc down each side, black laces, a white midsole on a red outsole. */
    shoes: { style: 'hi-top'; base: string; overlay: string; swoosh: string; laces: string; sole: string; outsole: string };
  };
  /** Pictures of them on a transparent ground: the face and shoulders (a portrait for a HUD plate or a card) and the
   *  front and back views (the reference every drawing of them follows). */
  pictures: { portrait: string; front: string; back: string };
  /** Their own rigged 3D model (glTF): one skinned mesh in metres, facing +z, soles on y = 0, rigged with HISSATSU's
   *  Tripo skeleton names (Hip, Spine01, Head, L_Upperarm...). For a game whose characters are full-size people: it
   *  wears the game's own materials and plays the game's own animations, retargeted. */
  model: string;
}

/** One draw of the game into the world's picture. */
export interface LiveView {
  /** The world's camera, carried into the game's scene space: its matrices and projection are set. Draw with it. */
  readonly camera: THREE.PerspectiveCamera;
  /** The world's colour and depth target this frame (null: the screen). Draw over what is there: never clear. */
  readonly target: THREE.WebGLRenderTarget | null;
  /** The world's fog. Put it on the game's scene while it draws (and take it off), so the game sits in the same air. */
  readonly fog: THREE.Fog | THREE.FogExp2 | null;
  /** The world's light, for a game that follows it: 0 at night .. 1 at full day, and the sun's direction (scene space). */
  readonly daylight: number;
  readonly sunDir: THREE.Vector3;
}

/** The court: the game's playing surface. Metres, y up, the surface's centre at the origin. */
export interface LiveCourt {
  /** Where the court lies inside the game's scene this frame (identity when the scene never moves). The world keeps the
   *  court still on its venue and carries the scene to match. */
  readonly matrix: THREE.Matrix4;
  /** Walking into this box (court space, x and z) hands the visitor a player. */
  readonly bounds: { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
}

/** The match as the world's signs show it (the cage's scoreboard, a ring's banner). */
export interface LiveStatus {
  /** Each side's name and score. */
  sides: [{ name: string; score: number; color: string }, { name: string; score: number; color: string }];
  /** A short line: the clock, the round, what's on ("FIRST TO 11", "ROUND 2"). */
  line: string;
}

export interface LiveGame {
  /** Build the game's world and start its ongoing match with every seat played by the game's own bots. Nothing on
   *  screen yet: no menus, no title, no HUD. Resolve when the match can be drawn. `progress` takes 0..1. */
  mount(host: LiveHost, progress: (fraction: number) => void): Promise<void>;
  /** One frame of the game: `dt` seconds (clamped to 0.1), `now` = performance.now(). The match runs whether or not the
   *  visitor plays. When a match ends, the next one starts by itself. Never start a requestAnimationFrame loop. */
  update(dt: number, now: number): void;
  /** Draw the game's scene (players, ball, court, effects) from `view.camera` into `view.target`, over the world. */
  draw(view: LiveView): void;
  readonly court: LiveCourt;
  /** The visitor walked onto the court at `at` (court space), facing `yaw` (court space, 0 = +z): hand them a player.
   *  From now the game reads its own controls for that player, its HUD shows, its camera follows them. Return false
   *  when it can't right now (a replay, a cut scene): the world asks again next frame. */
  join(at: THREE.Vector3, yaw: number): boolean;
  /** The game's own camera while the visitor plays (scene space). The world films everything through it. */
  readonly camera: THREE.PerspectiveCamera;
  /** The visitor left: the bots take that player back. Returns where the player stands and faces (court space). */
  leave(): { at: THREE.Vector3; yaw: number };
  /** Where the visitor's player is now (court space; null when nobody plays): the world lights them up as they turn into it. */
  you?(): THREE.Vector3 | null;
  /** The page changed size (CSS pixels) or pixel ratio: size the HUD and the camera's aspect, never the renderer. */
  resize(width: number, height: number, dpr: number): void;
  /** The game is put away. Free everything it made: geometries, materials, textures, render targets, workers, timers,
   *  listeners, audio nodes, DOM, styles, window globals, and any change to three's shared state. */
  unmount(): void;
  status?(): LiveStatus | null;
}

/** What a live module (`live.js`) exports. */
export interface LiveModule {
  default: () => LiveGame;
  meta: { id: string; title: string; source: string };
}
