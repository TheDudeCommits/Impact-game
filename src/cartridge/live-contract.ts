// THE LIVE CONTRACT. Each of Dude's games plays live inside the world, at its own place: an ongoing match on the game's
// own code, rules and bots, standing in the world and drawn through the world's camera like everything else. A visitor
// who walks in takes over one of its players. From that moment the game's own camera, controls, HUD and sound carry
// them, until they leave (Esc, the Leave button, or the game's own quit) or their match ends (round 9: LiveEvent 'end'),
// and the world takes them back where they are. Enter takes them on to the game's own site (round 9, src/games/portal.ts).
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
  /** The game's own quit: the visitor wants out. The world calls leave() and takes them back. (round 9: the end of the
   *  visitor's match is not a quit: emit 'end', and the world takes them out after the game's own result moment.) */
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
 *
 * (round 9, 2026-11-21) THE END OF THE VISITOR'S MATCH. Dude: "When a fight/match in any of the games ends, it should
 * finish and the visitors come out of the game. They can re-enter if they want." An 'end' while the visitor plays is
 * the end of their match: the world lets the game's own result moment play for `hold` seconds (its K.O. and victory
 * pose, the final buzzer and the score, the finish line), then takes them out (the leave, as Esc does: leave() is
 * called) and stands them just off the court, where "E Play again · Enter Full game" waits. Emit it once, the moment the
 * match is decided, with `side` the winner and `you` whether the visitor's side won (true) or lost (false); leave `you`
 * out only when nobody wins (a draw, a shift worked to its end). An 'end' within 3 s of the join is taken for the end of
 * the match they walked in on (a buzzer at the very moment they stepped on) and changes nothing. Never call exit() for
 * it, and put no buttons on the result moment (Rematch, Main menu): the world's prompt is the way back in.
 */
export interface LiveEvent {
  /** 'score': a point, a basket, a goal, the lead taken in a race. 'big': a big play that isn't a score (a block, a parry,
   *  a long combo, a near miss, an ultimate). 'miss': an airball, a whiff, a shot off the post (the crowd groans).
   *  'knockout': someone down (a K.O., a ship sunk, a pod wrecked, a death). 'round': a round, a half or a lap ended.
   *  'boss': a boss came on or went down. 'start': a match started. 'end': a match ended (`side` won); while the visitor
   *  plays, the end of their match (round 9: see above). */
  kind: 'score' | 'big' | 'miss' | 'knockout' | 'round' | 'boss' | 'start' | 'end';
  /** The side it was for (0 or 1, in the order of status().sides), when it has one. On 'end': the side that won. */
  side?: 0 | 1;
  /** How big a moment, 0..1: a free throw 0.3, a dunk 0.8, a knockout or match point 1 (default 0.5). */
  weight?: number;
  /** The visitor's own player did it. On 'end' (round 9): the visitor's side won (true) or lost (false); left out when
   *  the visitor isn't playing or nobody won. Never "the visitor is playing" (a lost voyage would read as won). */
  you?: boolean;
  /** (round 9) 'end' only: the seconds the game's own result moment needs before the world takes the visitor out (default
   *  4, at most 12). Its camera, HUD and sound stay the game's meanwhile, and the visitor's keys still reach it. */
  hold?: number;
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
   *  when it can't right now (a replay, a cut scene): the world asks again next frame.
   *  (round 9) Start a fresh match for them: the game's own start (its round intro, tip-off, kick-off, countdown), every
   *  side whole and the score at nought, so they play a whole match to its 'end' (LiveEvent). The bots' match in progress
   *  is let go. A game that can't hands over the match in progress and says so (docs/LIVE.md, its row in "The end of the
   *  match"). The world owns Escape (leave) and Enter (the full game) while a game is played: bind neither in play. */
  join(at: THREE.Vector3, yaw: number): boolean;
  /** The game's own camera while the visitor plays (scene space). The world films everything through it. */
  readonly camera: THREE.PerspectiveCamera;
  /** The visitor left: the bots take that player back. Returns where the player stands and faces (court space). (round 9)
   *  Also called once the visitor's match has ended and its `hold` has passed, and as Enter takes them to the full game. */
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
  /**
   * (round 9, lead) The game's own colour grade, as its site applies it in its post stack (which never runs in the world):
   * while the visitor plays it, the world's film steps back to a plain picture (no grade, no ink of its own) and lays
   * this grade on instead, so the game reads as its site does. Hoop It's and Foot It's Splash look: sat 1.18, con 1.1,
   * lift (0.015, 0.01, 0), gain (1.03, 1, 0.95), vignette 0.28, grain 0.035. All optional: a missing value is neutral
   * (sat 1, con 1, lift 0, gain 1, vig 0, grain 0). Read at the join. (The film's use of it lands with the heat track's
   * src/look/pipeline.ts; until then it is declared only.)
   * The world lays it on as Hoop It's renderer does (render/renderer.ts, a post effect), in this order, then the vignette
   * and the grain:
   *   c = max(mix(luma709(c), c, sat), 0);   c = max((c - 0.2) * con + 0.2, 0);   c = c * gain + lift * (1 - c)
   * in the `space` the game grades in: 'linear' (before the encode: Hoop It, Foot It; the default) or 'display' (after its
   * tone map: the Cruise's colour script).
   */
  grade?: {
    /** saturation about Rec. 709 luma, 1 plain */ sat?: number;
    /** contrast about 0.2, 1 plain */ con?: number;
    /** lifted toward, scaled by (1 - c) */ lift?: readonly [number, number, number];
    /** each channel multiplied */ gain?: readonly [number, number, number];
    /** a vignette's darkness (postprocessing's VignetteEffect, offset 0.32), 0 none */ vig?: number;
    /** film grain strength, 0 none */ grain?: number;
    /** where the game grades: 'linear' (default) or 'display' */ space?: 'linear' | 'display';
    /**
     * (round 9, lead) Whose formula: 'splash' (the default: Hoop It's, above) or 'cinematic' (Thrustline's
     * src/render/post/cinematicShaders.ts, display space after exposure, its tone map and the sRGB encode):
     *   c = pow(max(c * gain + lift, 0), 1 / gamma)          (lift added, not scaled)
     *   c = mix(luma709(c), c, sat);   c = (c - 0.5) * con + 0.5     (contrast about 0.5)
     *   c += (shadow - 0.5) * (1 - smoothstep(0, .55, luma)) * amount + (highlight - 0.5) * smoothstep(.45, 1, luma) * amount
     *   v = smoothstep(.35, 1.15, length((uv - .5) * vec2(aspect, 1)) * 1.12);   c = mix(c, c * vigColor, v * vig)
     *   c += (hash - .5) * grain;   clamp
     */
    formula?: 'splash' | 'cinematic';
    // (round 9, lead) the rest of a cinematic grade (Thrustline's CinematicLook SUNSCAR: exposure 1.06, gamma
    // [1.02, 1, 0.97], split 0.28 with shadow [0.46, 0.43, 0.60] and highlight [0.64, 0.53, 0.40], a vignette tinted
    // [0.36, 0.24, 0.42], bloom 0.62 over 0.92). Applied first (exposure), and after the gain (gamma, then the split
    // tone, then the vignette's colour); bloom sets the film's own bloom while it is played. All optional, neutral if left out.
    /** exposure multiplier, 1 plain */ exposure?: number;
    /** per-channel gamma (c = pow(c, 1 / gamma)), 1 plain */ gamma?: readonly [number, number, number];
    /** split toning: shadows toward `shadow`, highlights toward `highlight`, by `amount` */
    split?: { amount: number; shadow: readonly [number, number, number]; highlight: readonly [number, number, number] };
    /** the vignette's colour (black if left out) */ vigColor?: readonly [number, number, number];
    /** the film's bloom while it is played: strength and threshold */ bloom?: { strength: number; threshold: number };
  };
  /**
   * (round 9, lead) The game's lens response this frame, which its own post chain draws on its site (Thrustline's
   * GameApp.updateLens: a speed blur, chromatic aberration, a flash on a boost or an impact): asked every frame while the
   * visitor plays it, and laid on by the film. Each 0..1; null or absent: none. Optional. (The film's use of it lands
   * after the heat track's pipeline; until then it is declared only.)
   */
  lens?(): { blur: number; chroma: number; flash: number } | null;
}

/** What a live module (`live.js`) exports. */
export interface LiveModule {
  default: () => LiveGame;
  meta: { id: string; title: string; source: string };
}
