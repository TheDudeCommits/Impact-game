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
  /** (round 5, 2026-11-20) Where the world's lens is and how it moves, told every frame the world runs, whether the game is
   *  drawn, running or resting. A world older than this gives undefined (judge from draw() as before). */
  readonly lens?: LiveLens;
  /** (round 8, 2026-11-20) Tell the world a moment of the match (LiveEvent): the crowd round the venue cheers or groans and
   *  turns to look, birds lift off the roofs, a firework goes up at a match's end, the cheer carries across the island.
   *  Emit what the game already knows, as it happens, whether or not the visitor plays. A world older than this has no
   *  emit: call it as `host.emit?.(e)`. */
  emit?(e: LiveEvent): void;
  /** (round 8, 2026-11-21; roadmap S2) Wait for a slot of the world's frame budget (src/core/scheduler.ts): it resolves in
   *  the task that runs right after a frame has been drawn, with that frame's spare time ahead (a few ms, never in a
   *  quiet window such as the arrival or a join's glide). A game's mount awaits it between its steps (parse, build,
   *  compile, upload, the next fighter or ship) so that no step lands in a frame of its own: keep each step under about
   *  4 ms. A world older than this has no slot: call it as `await host.slot?.()`. */
  slot?(): Promise<void>;
}

/**
 * (round 8, 2026-11-20) A moment of the match the world answers (LiveHost.emit). JSON-safe; every field but `kind` is
 * optional. Emit each one once, when it happens (not every frame while it shows).
 */
export interface LiveEvent {
  /** 'score': a point, a basket, a goal, the lead taken in a race. 'big': a big play that isn't a score (a block, a parry,
   *  a long combo, a near miss, an ultimate). 'miss': an airball, a whiff, a shot off the post (the crowd groans).
   *  'knockout': someone down (a K.O., a ship sunk, a pod wrecked, a death). 'round': a round, a half or a lap ended.
   *  'boss': a boss came on or went down. 'start': a match started. 'end': a match ended (`side` won). */
  kind: 'score' | 'big' | 'miss' | 'knockout' | 'round' | 'boss' | 'start' | 'end';
  /** The side it was for (0 or 1, in the order of status().sides), when it has one. */
  side?: 0 | 1;
  /** How big a moment, 0..1: a free throw 0.3, a dunk 0.8, a knockout or match point 1 (default 0.5). */
  weight?: number;
  /** The visitor's own player did it. */
  you?: boolean;
  /** Where it happened, court space (the crowd turns toward it; a burst goes up there). Default: the court's centre. */
  at?: { x: number; y: number; z: number };
  /** A word or two for logs and captions: "dunk", "goal", "K.O.", "lap 3". */
  label?: string;
}

/**
 * The world's lens as one game sees it (round 5, 2026-11-20). draw() shows the lens only while the game is in view: out
 * of view (behind the visitor's back, behind the Plaza's dome, or resting far off) a game saw nothing, judged the visitor
 * near while the world kept its match running, and began its sound work under a flight past it with its court behind
 * the lens. This is told for every live game every frame, in view or not: read it wherever the game judges where the
 * visitor is or how they move (update, a timer). Values are this frame's, before the camera moves for it.
 */
export interface LiveLens {
  /** The lens in court space: the game's own units, the court's centre at the origin, y up. (A screen game: from its
   *  screen's foot, world metres.) */
  readonly at: THREE.Vector3;
  /** How far the lens is from the court's centre (court units). */
  readonly distance: number;
  /** How fast it moves (court units a second), judged over a quarter second or more. A cut (a teleport, the map's travel,
   *  the camera taken into a game) is no motion. */
  readonly speed: number;
  /** The visitor is flying: in flight (Space held), or the lens moving faster than anyone runs or slides (a camera
   *  flight, the fly-in). A flight passes; it is no arrival, and no time for heavy work. */
  readonly flying: boolean;
  /** performance.now() of the frame it was last told (a stale one: the world's frames have stopped). */
  readonly time: number;
  /** Where the visitor stands, in the same court space (their avatar's feet; while they play a game, where they will stand
   *  again), and how far that is from the court's centre. Behind the title the lens flies round the island while the
   *  visitor waits at the Overlook's rail: a game near where they will arrive judges by the nearer of the two. */
  readonly visitor: THREE.Vector3;
  readonly visitorDistance: number;
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
    /** The cut. 'tousled-curls' (since 2026-11-19): medium-length tousled curly waves swept back and up with soft volume,
     *  a couple of loose locks over the brow, the sides and back full and curly over the ears and down to the nape, no
     *  fade. 'curly-top-fade' (before): tight curls piled on top, the sides and back faded short into the skin. */
    style: 'tousled-curls' | 'curly-top-fade';
    /** The curls: silver-platinum. */
    color: string;
    /** Deep between the curls. */
    shade: string;
    /** The faded sides, where they start ('curly-top-fade' only). */
    fade?: string;
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
  /** (round 8, 2026-11-20; roadmap S11) The world's own copy of `model`, fetched and parsed once for the visitor's avatar:
   *  what GLTFLoader gives for it (scene, animations, and userData with its manifest). Take the model from here rather
   *  than loading `model` again (each copy was 14 to 21 MB of download and parse and a 4096² texture on the GPU, some
   *  85 MB). It is shared with the world's avatar: clone it (SkeletonUtils.clone) and never dispose, re-parent or change
   *  what it holds. A material of the game's own may use its textures as they are (never change their settings); a
   *  geometry may take attributes of the game's own beside its own (never change those it has: one to change, the game
   *  clones). A world older than this has none: load `model`. */
  gltf?: () => Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[]; userData: Record<string, unknown> }>;
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
  /**
   * How big the game is in this picture (2026-11-19): the pixels of `target` that one metre of the court spans (court
   * units, the game's own metres) where the game's floor comes nearest the camera (its court a margin wider, or its
   * `area`). A level-of-detail hint: hundreds when the visitor stands on the court, about 4 for the Courts seen from the
   * Overlook. A game may leave out, while it is small, what can't be told apart at that size: its own shadow maps (or
   * draw them less often), outline shells under a pixel thick, props and effects of a pixel or two. It draws everything
   * as before above a size it chose, and puts things back as soon as it grows again (the visitor walks up, or plays).
   * The world passes it in every draw and feed; a game built against an older world gets undefined: draw everything.
   */
  readonly pxPerMetre?: number;
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
  /** (round 8, 2026-11-20) The visitor is coming (`at`: where they stand, court space) or has gone again (null). The world
   *  calls it once as they come within NOTICE_IN (12 m) of the court's edge, and with null once they are NOTICE_OUT (22 m)
   *  clear, fly off, or join. Acknowledge them the game's own way: the nearest bot looks up and waves, the Knight salutes,
   *  the ship sounds its horn. Never stop the match for it. Optional. */
  notice?(at: THREE.Vector3 | null): void;
  /** The page changed size (CSS pixels) or pixel ratio: size the HUD and the camera's aspect, never the renderer. */
  resize(width: number, height: number, dpr: number): void;
  /** The game is put away. Free everything it made: geometries, materials, textures, render targets, workers, timers,
   *  listeners, audio nodes, DOM, styles, window globals, and any change to three's shared state. */
  unmount(): void;
  status?(): LiveStatus | null;
  /**
   * A 2D game plays on one of the Plaza's screens instead of standing in the world (2026-11-19): it draws its own picture,
   * through its own camera, into the screen's target; walking up into the screen hands the visitor a player (join), the
   * world's camera filling the frame with the screen while the game's own controls, HUD (`host.ui`) and sound carry them;
   * Esc steps them back out (leave). For such a game `court` and `camera` are unused: give a 1 x 1 court at the origin.
   * While the visitor plays, the world puts the screen's place on the page on `host.ui` as the CSS properties
   * --dw-screen-left, --dw-screen-top, --dw-screen-width and --dw-screen-height (px), so a HUD that frames the game's
   * picture (Cell Hell's spreadsheet window) can lie exactly on the screen.
   */
  screen?: {
    /** The picture's size in pixels while the visitor plays (about 16:9: the world sizes the screen's target to it; the
     *  screen's size on the page at the world's pixel ratio is sharp). Read every frame: it may change with the page. */
    readonly width: number; readonly height: number;
    /** Draw the game's picture into `target` (the world cleared it). Put back whatever renderer state it changes. */
    draw(target: THREE.WebGLRenderTarget): void;
  };
}

/** What a live module (`live.js`) exports. */
export interface LiveModule {
  default: () => LiveGame;
  meta: { id: string; title: string; source: string };
}
