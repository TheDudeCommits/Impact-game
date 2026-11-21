/**
 * Impact playing live inside dude.work (the world's src/core/live.ts, this game's ./live-contract.ts): the real game's
 * duel - its simulation, combat, bot AI, fighters, effects, sound - always on in the Gate Ring of the world's Ring
 * Terraces, on the world's three.js, renderer, frame loop and sound card. Both seats are the game's own bots; a set is
 * first to two rounds (DuelSet), and when one is decided the next starts by itself after a short beat: the winner stays
 * and the next of the demo's five original fighters steps in (loaded while the set before it runs). No title, no menus,
 * no VS screen, no results.
 *
 * A visitor walking onto the ring floor takes over the fighter nearest where they stepped on: from then Impact's own
 * follow camera (FollowCamera), controls (Input: keyboard, mouse, pad), HUD (./liveHud.ts) and sound carry them; Esc
 * (the world's) hands the fighter back to its bot. While the visitor watches, the world films the duel with its own
 * camera and the game's HUD stays hidden.
 *
 * The glue is main.ts's duel path (bootImpact: onSnapshot, applyCombatFrame, cinematics, the frame), cut to a duel on
 * this device: no stage (the world's ring is the floor), no sky, no post stack (the world's film pipeline inks and grades
 * the picture), no menus, nothing online.
 */
import * as THREE from 'three';
import type { LiveCourt, LiveEvent, LiveGame, LiveHost, LiveStatus, LiveView } from './live-contract';
import { rt } from './runtime';
import { RING, RING_BOUNDS, RingCollision, registerRing } from './liveRing';
import { LiveHud } from './liveHud';
import { cutoutsWaitFor } from '../ui/hud/cutout';
import { Likeness, type Worn } from './likeness';
import { FIGHTERS, loadSettings, type Settings } from '../config';
import { ArenaSimulation } from '../game/simulation';
import { DuelSet } from '../game/duel/DuelSet';
import { COMBO_HP, COMBO_STAMINA, MOVES, SIMULATION_HZ } from '../game/moves';
import { STAGES } from '../game/stages';
import type { CombatEvent, FighterId, GameSnapshot, PlayerInput, PlayerState } from '../game/types';
import { keptSkill } from '../boot/skill';
import { Targeting } from '../game/Targeting';
import { AutoLock } from '../game/autoLock';
import { rushMove, moveFor, AWAKENINGS } from '../game/awakening';
import { FighterLibrary, Fighter } from '../render/Fighter';
import { occlusionTwins } from '../render/OcclusionFade';
import { FollowCamera, hitTier } from '../render/FollowCamera';
import { CombatEffects, screenWorth } from '../render/CombatEffects';
import type { CastEffects } from '../render/castEffects';
import { StrikeTrails } from '../render/StrikeTrails';
import { AwakeningEffects } from '../render/AwakeningEffects';
import { ClashEffects } from '../render/ClashEffects';
import { AreaTelegraph, areaMoveOf, areaReady } from '../render/AreaTelegraph';
import { CombatTimeline } from '../render/CombatTimeline';
import { SIGNATURE } from '../render/signature/context';
import { bigBlowOf, cinematicBlowOf } from '../render/bigBlowEvent';
import { elementFor } from '../render/vfx/palette';
import { bodyCentre } from '../render/vfx/VfxKit';
import { loadInkImpacts } from '../render/vfx/SparkField';
import { setVfxLevel } from '../render/vfxLevel';
import { setToonLook, setToonResolution } from '../render/look/toonShading';
import { filmLookFor, filmOn, setFilmLook } from '../render/look/filmLook';
import { lookFor } from '../render/look/stageLooks';
import { skinnedBoundsOn } from '../render/skinnedBounds';
import { ViewKeys, movementMask } from '../render/viewKeys';
import { borrowedEvent, installTransplant, presentFighters, presentPlayers, presentSnapshot, slotNames, steadyBodies } from '../engine/client/transplant';
import { installBorrowedHurts } from '../engine/client/borrowedHurts';
import { installStyleMoves, stylesReady } from '../engine/client/styleMoves';
import { CombatAudio } from '../audio/CombatAudio';
import { DuelCaller, DuelWatch, announcerOn, duelCallerFiles } from '../audio/duelCaller';
import { HOME_VOICES, HOME_VOICE_SECONDS } from '../audio/HomeVoice';
import { UI_SFX } from '../originals/sfx';
import { displayMove } from '../originals/apply';
import { Input } from '../input';
import type { TouchControls } from '../input/touch';
import { pulseFor } from '../input/rumble';
import { DamageNumbers } from '../ui/DamageNumbers';
import { MangaImpact } from '../ui/MangaImpact';
import { CutIn, awakeningCutIn, cutInKey, cutInSide } from '../ui/CutIn';
import { VsSplash } from '../ui/VsSplash';
import { Letterbox } from '../ui/Letterbox';
import { roanEnabled } from '../render/look/roanPass';
import { bodyBulk } from '../render/CameraDirector';

/** The demo's five original fighters (src/originals/demo.ts DEMO.fighters): the only cast the duel deals. */
const ROSTER: readonly FighterId[] = ['taisei', 'kenzo', 'kuon', 'shiden', 'setsu'];
const SEATS = ['ring-a', 'ring-b'] as const;
const STEP = 1 / SIMULATION_HZ;
/** main.ts LOCAL_DELAY: the drawn frame one tick behind the newest. */
const LOCAL_DELAY = 1000 / 60;
/** dude.work (round 5): draws between looks through the scene for its instanced pools (emptyPools). */
const POOL_LOOK = 120;
/** dude.work (round 5): the ring's earshot (m from its middle, the world's lens): decoded within EAR_IN, let go beyond
 *  EAR_OUT, once the visitor has stayed near EAR_NEAR_MS or far EAR_FAR_MS (the courts' own rule since round 2). */
const EAR_IN = 90, EAR_OUT = 130, EAR_NEAR_MS = 1500, EAR_FAR_MS = 4000;
/** Seconds from a set's first frame to its first bell (LocalDuel waits 3; there is no VS screen to cover here). */
const INTRO = 2;
/** Seconds a decided set holds its winner's pose before the next one starts. */
const BETWEEN = 5;
/** (dude.work round 9) The visitor's set decided: its result moment, the 'end' event's hold (s), is the game's own finale
 *  from the end to where its page puts up the results (ui/results/finale.ts FINALE and finaleSeconds, the same numbers:
 *  the K.O. card and the winner's entry, their line from 1.9 s, held 0.3 s after it; 4 s at the least, 5.5 at the most,
 *  a line of unknown length taken as the roster's median 2.8 s). */
const FINALE = { least: 4, most: 5.5, lineAt: 1.9, after: .3, line: 2.8 };
/** (round 9) The visitor's decided set waits this much longer for the world to take them out (s) before the next set
 *  begins anyway, with them in it as before (a world older than round 9, or an end it took for the set they walked in on). */
const END_WAIT = 8;
/** dude.work round 8 (S14): under this many pixels a metre in every picture (LiveView.pxPerMetre: a fighter a few
 *  pixels tall) the duel's bodies and effects step TINY_HZ times a second, and its shadow map is drawn only when they
 *  have stepped. */
const TINY_PX = 2, TINY_HZ = 12;
/** Dev: ?impactgrave=0 disposes a body the moment it is let go, as before (to compare). */
const GRAVE_ON = typeof location !== 'object' || !/[?&]impactgrave=0\b/.test(location.search);
/** Dev: ?impacttiny=0 steps a tiny duel every frame, as before (to compare). */
const TINY_ON = typeof location !== 'object' || !/[?&]impacttiny=0\b/.test(location.search);
/** Most sim ticks one frame may run (a hitch is caught up over the next frames, not in one burst). */
const MOST_STEPS = 6;
const FIGHT_LINE = '/assets/audio/survival/announcer-fight.m4a';
const VICTORY_LINE = '/assets/audio/survival/announcer-victory.m4a', FLAWLESS_LINE = '/assets/audio/survival/announcer-flawless.m4a';
/** main.ts: how long after an exchange of blows the chase camera's combo shot holds. */
const LOCK_EXCHANGE_MS = 1100;
const REJECTIONS: Record<string, string> = { cooldown: 'NOT READY', stamina: 'NO STAMINA', 'ultimate-meter': 'ULTIMATE NOT CHARGED' };
/** dude.work round 8 (G2): the touch controls' pause and emote buttons left out (the world's Leave pill stands for pause). */
const TOUCH_CSS = '[data-game="impact"] .touch-controls :is([data-tc="pause"],[data-tc="emote"]),[data-game="impact"] .touch-controls .tc-wheel{display:none!important}';

export interface Running {
  readonly court: LiveCourt;
  readonly camera: THREE.PerspectiveCamera;
  update(dt: number, now: number): void;
  draw(view: LiveView): void;
  join(at: THREE.Vector3, yaw: number): boolean;
  leave(): { at: THREE.Vector3; yaw: number };
  you(): THREE.Vector3 | null;
  notice(at: THREE.Vector3 | null): void;
  resize(w: number, h: number): void;
  status(): LiveStatus | null;
  /** (dude.work round 9) The picture's grade as the game's site prints it (FILM_GRADE), for the world's film to lay on
   *  while the visitor plays (LiveGame.grade); none in the modern ART STYLE. */
  readonly grade: LiveGame['grade'];
  /** (dude.work round 9; tools only, never the world: its tools/doors.mjs --real) 'finish': while the visitor plays, their
   *  rival is knocked out as each round comes on, till the set is decided; 'state': where the set stands. */
  probe(what: string): unknown;
  dispose(): void;
}

/** One set on the ring: the game's own simulation and first-to-two rules (LocalDuel, both seats its bots). */
class RingSet {
  readonly set = new DuelSet();
  private startsAt: number;
  snapshot: GameSnapshot | null = null;
  constructor(readonly sim: ArenaSimulation, readonly pair: readonly [FighterId, FighterId]) {
    this.startsAt = sim.serverTime + INTRO;
  }
  static open(pair: readonly [FighterId, FighterId]): RingSet {
    const sim = new ArenaSimulation({ roomMode: 'match', stage: RING, collision: new RingCollision(), maxStamina: COMBO_STAMINA, maxHp: COMBO_HP });
    sim.addPlayer(SEATS[0], pair[0], FIGHTERS[pair[0]].name, true);
    sim.addPlayer(SEATS[1], pair[1], FIGHTERS[pair[1]].name, true);
    const ring = new RingSet(sim, pair);
    ring.publish();
    return ring;
  }
  /** One tick (LocalDuel.send): the visitor's command for their seat, if they play. */
  step(me: string | null, command: PlayerInput | undefined) {
    const sim = this.sim;
    if (me && command) {
      const actor = sim.actors.get(me);
      if (actor) sim.submitInput(me, { ...command, seq: actor.lastSeq + 1 });
    }
    sim.step(STEP);
    if (sim.status === 'waiting' && sim.serverTime >= this.startsAt && this.set.view.phase === 'playing' && this.set.startedAt === null) sim.startMatch();
    this.set.step(sim);
    this.publish();
  }
  private publish() {
    const snapshot = this.sim.snapshot(true);
    snapshot.lobby = { duel: true, visibility: 'public', hostId: null, canStart: false, startsAt: snapshot.status === 'waiting' ? this.startsAt : null, expiresAt: null, size: 2 };
    this.set.snapshot(snapshot);
    this.snapshot = snapshot;
  }
  /** The visitor takes `id` over (or gives it back to its bot). */
  seat(id: string, human: boolean) {
    const actor = this.sim.actors.get(id);
    if (!actor) return;
    actor.state.isBot = !human;
    actor.input = { seq: actor.lastSeq, moveX: 0, moveZ: 0, yaw: actor.state.yaw };
    if (human) this.sim.setPlayerSkill(id, keptSkill());
    else actor.nextBotThink = 0;
  }
  /** The visitor walks in: their fighter on its feet at full health and stamina, whatever the set had come to (Dude,
   *  2026-11-19: "in Impact, whenever I enter the ring, regardless of what stage the fight was in, the visitor should
   *  spawn at full health and stamina"). Down or out, it is stood up where it fell; nothing lingering from before. */
  freshen(id: string) {
    const a = this.sim.actors.get(id);
    if (!a) return;
    if (!a.state.alive) this.sim.revive(id, a.state.maxHp);
    a.state.hp = a.state.maxHp;
    a.state.stamina = a.state.maxStamina ?? a.state.stamina;
    delete a.statuses; delete a.state.status;
    this.publish();
  }
  get decided() { return this.set.view.phase === 'complete'; }
  dispose() { this.sim.dispose(); }
}

/**
 * (dude.work round 9) The film look's grade as the game's own site prints it (render/look/LookPost.ts: the film stage's
 * print in linear after the tone curve, reelPrint: saturation 1.06, contrast 1.1 about 0.18, cool shade and warm light,
 * the blacks lifted 0.035 toward a cool tint and the corners 0.45 darker; then the Gate Ring's stage grade on the encoded
 * picture, sunfall-arena's turned to the film's dusk, and the anime finish's S-curve and warm highlights; its grain 0.07
 * in the mids), for the world's film to lay on while the visitor plays (LiveGame.grade: the world's own grade steps back
 * to a plain picture). Of the world's two formulas 'splash' comes closer: fitted by least squares to the site's whole
 * grade over the live duel's pixels (every tenth of the brightness counted alike), 8.9 of 255 off on average against
 * 9.2 for 'cinematic' (19.0 with no grade). Its numbers: the fit's, rounded; the grain the site's in the mids. Its
 * blacks a little lifted and blue, its light warm (the gain), its vignette the print's. Without the split tone of the
 * print the mids come out a little warmer than the site's (the 'splash' formula has none).
 */
const FILM_GRADE: NonNullable<LiveGame['grade']> = {
  formula: 'splash', space: 'linear',
  sat: 1.09, con: 1.15, lift: [0.007, 0.008, 0.016], gain: [1.2, 1.05, 0.8], vig: 0.47, grain: 0.06,
};

/** (dude.work round 9) drawOnce's chunks: the things drawn for the first time in a slot, starting at ONCE_FIRST, each
 *  chunk's draw sizing the next to about ONCE_MS (a skinned thing's first draw, its bone texture and its materials' first
 *  use, is 1 to 3 ms; an afterimage pool is some 150 of them a fighter, a body with its form 30 to 60). */
const ONCE_FIRST = 6, ONCE_MS = 6, ONCE_MOST = 64;

/** The renderer stays the world's: the effects' calls on the game's own frame (impact frames, speed lines, the
 *  technique grade) belong to its post stack, which the world's film pipeline stands in for here. */
const NO_SCREEN = undefined;

export async function boot(host: LiveHost, root: HTMLElement, progress: (f: number) => void): Promise<Running> {
  registerRing();
  const settings: Settings = loadSettings();
  // (dude.work round 9) The ART STYLE, as the game's boot applies it before anything is drawn (main.ts): the film look, the
  // game's default since 20 Nov (render/look/filmLook.ts), unless the setting says the modern one. Of it the live duel takes
  // what is the fighters' and the effects' own: the cels' line, shade and sheen and their boil (toonShading.ts), the stage's
  // colour script in the light (stageLooks.ts), bodies drawn twelve times a second in neutral (filmDrawings.ts), effects on
  // twos and the film's impacts. The painted set, the painted far view and the film stage's final pass are the stage's and
  // the post's: the world's own place and film stand in for them. (Its class goes on the game's own page root: the
  // cartridge pass points document.documentElement there.)
  setFilmLook(filmLookFor(settings.artStyle));
  // The world's quality is the machine's (render/qualityTier.ts reads the host's): effects and shadows follow it.
  settings.quality = host.quality === 'high' ? 'high' : host.quality === 'mid' ? 'medium' : 'low';
  setVfxLevel(settings.vfx);
  const gl = host.renderer;
  // (dude.work round 8, roadmap S2) the world's frame budget (LiveHost.slot): the mount's heavy steps each wait for a slot
  // of it, so that none lands in a frame of its own; a world older than round 8 has none, and they run straight on
  const slot = host.slot ? () => host.slot!() : null;
  /** A job in steps (a generator), a step a slot. */
  async function inSteps<T>(steps: Generator<void, T, void>): Promise<T> {
    for (;;) { if (slot) await slot(); const s = steps.next(); if (s.done) return s.value; }
  }
  // (the HUD's cut-out stickers, made off the frame, a pass a slot: cutout.ts)
  cutoutsWaitFor(slot);
  /** (dude.work round 8, roadmap S2) Bodies made ahead, in slots, for the snapshot begin() is given (the first set's). */
  const made = new Map<string, Fighter>();

  // ---- the scene: the fighters, their effects and shadows; no stage, no sky, no background
  const scene = new THREE.Scene();
  scene.background = null;
  scene.matrixWorldAutoUpdate = true;
  const look = lookFor('sunfall-arena');
  setToonLook(look);
  setToonResolution(innerHeight * Math.min(2, devicePixelRatio || 1));
  const hemi = new THREE.HemisphereLight(look.hemi.sky, look.hemi.ground, look.hemi.intensity);
  const sun = new THREE.DirectionalLight(look.key.color, look.key.intensity);
  const fill = new THREE.DirectionalLight(look.fill.color, look.fill.intensity);
  fill.position.set(...look.fill.dir).multiplyScalar(40);
  const shadows = host.quality !== 'low';
  sun.castShadow = shadows;
  {
    const size = host.quality === 'high' ? 2048 : 1024, c = sun.shadow.camera;
    sun.shadow.mapSize.set(size, size);
    c.left = -11; c.right = 11; c.top = 11; c.bottom = -11; c.near = 1; c.far = 90;
    sun.shadow.bias = -0.0002; sun.shadow.normalBias = 0.025; sun.shadow.radius = 1.4;
  }
  scene.add(hemi, sun, sun.target, fill);
  // The fighters' shadows on the world's ring: a floor that draws only the shade (nothing else of it shows, and the
  // ink weight the world keeps in alpha is left as the ring painted it).
  const catcher = new THREE.Mesh(new THREE.CircleGeometry(10.4, 64).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({
    opacity: 0.5, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  }));
  catcher.position.y = 0.004; catcher.receiveShadow = true; catcher.renderOrder = -1; catcher.visible = shadows;
  scene.add(catcher);
  const keyDir = new THREE.Vector3(...look.key.dir).normalize();

  // the hand-drawn impact flipbooks (vfx/inkImpactAtlas.ts), which the game's own renderer fetches as it starts
  loadInkImpacts();
  const library = new FighterLibrary();
  const fighters = new Map<string, Fighter>();
  if (slot) await slot();
  const effects = new CombatEffects(scene);
  if (slot) await slot();
  const strikeTrails = new StrikeTrails(scene);
  const awakeningEffects = new AwakeningEffects(scene);
  const clashEffects = new ClashEffects(scene);
  const areaFx = new AreaTelegraph(scene, { small: host.touch });
  let castFx: CastEffects | undefined;
  const castLoad = import('../render/castEffects').then(m => (castFx = new m.CastEffects(scene)));
  const timeline = new CombatTimeline({ delayMs: LOCAL_DELAY });
  const followCam = new FollowCamera(new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.08, 900));
  const camera = followCam.camera;
  const audio = new CombatAudio({ byRoom: true });
  audio.setMix({ master: settings.volume, sfx: settings.sfxVolume, voice: settings.voiceVolume });
  const input = new Input(host.canvas);
  input.shared = true;
  input.enabled = false;
  input.sensitivity = settings.sensitivity;
  input.rumble.scale = settings.vibration;
  const viewKeys = new ViewKeys();
  const targeting = new Targeting(), autoLock = new AutoLock();
  if (slot) await slot();
  const hud = new LiveHud(root, settings);
  const damageNumbers = new DamageNumbers(root), manga = new MangaImpact(root);
  const cutIn = new CutIn(hud.root);
  cutIn.onShow = () => audio.ui(UI_SFX.cutIn, 0.4);
  // the FIGHT card at each bell, and the finisher's cinema bars (the visitor's alone, as host.ui is)
  const vsSplash = new VsSplash(hud.root), letterbox = new Letterbox(root);
  // (dude.work round 9) the Duel's announcer, as main.ts has it since the game's own 20 Nov (audio/duelCaller.ts: the Rift's
  // voice calling the round, FIGHT!, the K.O., first blood, counters, parries, guard breaks, long strings, a comeback and the
  // result, rarely and never over a fighter's own line); the visitor's own duel alone, as the FIGHT! and VICTORY! it takes
  // over were. Settings' ANNOUNCER off leaves the old FIGHT!, VICTORY! and FLAWLESS, as the game does.
  const duelCaller = new DuelCaller({ announce: (url, gain, delay) => audio.announce(url, gain, delay), sampleSeconds: url => audio.sampleSeconds(url), preload: urls => audio.preload(urls), takeBack: (owner, url) => audio.takeBack(owner, url), fighterLines: () => audio.fighterLines() });
  const duelWatch = new DuelWatch(duelCaller);
  let duelCalled = '';
  const duelCalls = (snapshot: GameSnapshot | null | undefined) => !!me && announcerOn() && !!snapshot?.duel && snapshot.players.length === 2;
  /** Once a frame while the visitor plays: the Duel's moments as drawn, its files fetched as his set starts (main.ts
   *  duelCommentary). */
  function duelCommentary(snapshot: GameSnapshot) {
    const set = duelCalls(snapshot) ? `${epoch}:${snapshot.duel!.set}` : '';
    if (set !== duelCalled) { duelCalled = set; duelCaller.reset(); duelWatch.reset(); if (set) audio.preload(duelCallerFiles()); }
    if (set) duelWatch.frame(snapshot);
  }
  vsSplash.onBeat = beat => {
    if (beat === 'fight') { audio.ui(UI_SFX.fight, .55, .05); if (duelCalls(ring?.snapshot)) duelCaller.say('fight', { delay: .08, queue: true }); else if (announcerOn()) audio.announce(FIGHT_LINE, .95, .08); audio.bell(); }
    else if (beat === 'fight-slam') audio.ui(UI_SFX.slam, .5);
  };
  manga.onKnockout = () => audio.ui(UI_SFX.ko, .5);
  manga.density = settings.effects;
  manga.bodies = (id, out) => { const f = fighters.get(id); if (!f) return false; bodyCentre(f, out); return true; };
  effects.settings = settings;
  effects.density = settings.effects;
  effects.screen = NO_SCREEN;
  SIGNATURE.screen = NO_SCREEN;
  areaFx.onSlam = (at, actorId, local) => { audio.cue('fx-land-heavy', at, local ? 0.5 : 0.32, 0.62, actorId, 1); };
  installTransplant({
    ensure: ids => library.ensure(ids),
    donor: state => library.has(state.fighter) ? library.create(state) : undefined,
    bodies: () => fighters.values(),
    effects: donors => {
      const ids = [...new Set([...(ring?.pair ?? []), ...donors])];
      return Promise.all([castLoad.then(cast => cast.load(ids)), effects.load(ids)]).then(() => {});
    },
    compile: () => compile(),
  });
  void installBorrowedHurts();
  void installStyleMoves();
  // the room's floor under a point (main.ts asks its collision): the ring's, y = 0, within the same reach
  SIGNATURE.floor = (_x, y) => (y > -0.5 && y < 5.999 ? 0 : undefined);

  // ---- the duel
  let ring: RingSet | null = null;
  let me: string | null = null;
  let targetId: string | null = null;
  let acc = 0, localClock = 0, lastEvent = 0;
  let duelRoundKey = '', introFor: number | null = null, victoryFor: string | null = null;
  let decidedAt = 0;
  let epoch = 0;
  /** (round 9, tools only: probe('finish')) the set's epoch whose rounds are being brought to their end */
  let finishing = -1;
  let ragdolls = false;
  let shownSelf: PlayerState | undefined;
  let lastHud = 0, markerHoldUntil = 0, lockExchangeAt = -Infinity;
  const drawn = { calls: 0, tris: 0 };
  const cutInSeen = new Map<string, string>();
  const numberAnchor = new THREE.Vector3(), marker = new THREE.Vector3();
  /** The world's lens in the game's scene, from the last draw (what the effects face while the visitor watches). */
  const lens = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.08, 900);
  const frustum = new THREE.Frustum(), viewProjection = new THREE.Matrix4();
  let rotation = Math.floor(Math.random() * ROSTER.length);
  /** (S14) the largest size the duel was drawn at since the last frame, when it was last drawn, the time gathered since
   *  its bodies last stepped, and whether they have stepped since its shadow map was last drawn */
  let seenPx = 0, seenAt = -Infinity, stepAcc = 0, stepped = true;
  const courtMatrix = new THREE.Matrix4();
  const lensOf = () => (me ? camera : lens);

  /** A fighter's files: its body and clips, its effects' and its techniques' files; and its sounds (waited for when
   *  `sound`: a challenger loads them all before it steps in; the first set's come in while the duel already runs). */
  const loaded = (ids: readonly FighterId[], sound = true) => Promise.all([
    library.ensure([...ids]),
    sound ? audio.prepare(ids) : (void audio.prepare(ids), undefined),
    effects.load([...ids]),
    castLoad.then(cast => cast.load([...ids])),
    stylesReady(),
  ]).then(() => {});

  function clearFighters() { for (const body of fighters.values()) drop(body); fighters.clear(); }
  /** A body let go (a new round, a new set): the visitor's likeness comes off it first (its geometries are kept). */
  function drop(body: Fighter) {
    if (worn?.fighter === body) { worn.remove(); worn = null; }
    // (dude.work round 8) out of the picture now, disposed two frames on: the bodies that take its place (the next round's,
    // the next set's) draw first with the same programs, which three releases with a body's last material and would build
    // again in the new body's first frame: every program of both fighters at every round's start
    if (!GRAVE_ON) { body.dispose(); dropTwins(body); return; }
    body.group.removeFromParent();
    (Fighter as unknown as { drawn: Set<Fighter> }).drawn.delete(body);
    leaving.push({ body, frames: 2 });
  }
  /** Bodies let go, waiting their two frames to be disposed (drop). */
  const leaving: { body: Fighter; frames: number }[] = [];
  function bury(all = false) {
    for (let i = leaving.length - 1; i >= 0; i--) {
      if (!all && --leaving[i].frames > 0) continue;
      const { body } = leaving[i];
      leaving.splice(i, 1);
      try { body.dispose(); } catch (error) { console.warn('Impact live: a body would not go', error); }
      dropTwins(body);
    }
  }
  /** (dude.work round 8, S14) A body's occlusion-fade twins (render/OcclusionFade.ts: a copy of each of its materials, its
   *  form's too, with the dither) let go with it. Fighter.dispose leaves them, which in the game's own page is nothing (they
   *  go with the body); here the cartridge runtime keeps every material the game had three upload until it is disposed,
   *  and each twin's shader edits hold its body: the body, its mixer, its rig and its clips' samplers stayed for the
   *  page's life, every round and every warmed challenger (the heap 5 to 20 MB up over eight sets). The runtime forgets
   *  them, undisposed: their programs live on (three releases a program only with its last material), so the next body of
   *  the same fighter fades with no program to build, and the body itself is collected. */
  function dropTwins(body: Fighter) {
    for (const { twin } of occlusionTwins(body)) rt.forget(twin);
  }
  /** (dude.work round 8) The occlusion-fade twins of `bodies` drawn once into a scene of their own, for compile() and
   *  firstUse(): the game's warm-up gives a warmed body hidden proxies drawn with them; a body that never was a warmed one
   *  (the first set's) faded in its first moment in the visitor's view, building its programs then. */
  function twinProxies(bodies: Iterable<Fighter>): THREE.Scene {
    const only = new THREE.Scene();
    for (const body of bodies) {
      for (const { twin, original } of occlusionTwins(body)) {
        let owner: THREE.Mesh | undefined;
        body.group.traverse(o => { const m = o as THREE.Mesh; if (!owner && m.isMesh && ([m.material].flat() as THREE.Material[]).includes(original)) owner = m; });
        if (!owner) continue;
        const proxy = owner.clone(false);
        proxy.material = twin;
        proxy.visible = false; proxy.castShadow = false; proxy.receiveShadow = false;
        only.add(proxy);
      }
    }
    return only;
  }
  function clearFlights() {
    audio.reset(); areaFx.reset(); effects.reset(); castFx?.reset(); awakeningEffects.reset(); clashEffects.reset(); manga.reset();
  }
  function bodiesFor(snapshot: GameSnapshot) {
    for (const p of snapshot.players) {
      if (p.enemy || !library.has(p.fighter)) continue;
      const have = fighters.get(p.id);
      if (have && have.bodyFighter !== p.fighter) { drop(have); fighters.delete(p.id); }
      if (!fighters.has(p.id)) {
        const ahead = made.get(p.id);
        made.delete(p.id);
        // (round 9: one made ahead for another fighter than the seat's now is let go, not left behind)
        if (ahead && ahead.bodyFighter !== p.fighter) letGo(ahead, ahead.bodyFighter as FighterId);
        const fighter = ahead && ahead.bodyFighter === p.fighter ? ahead : library.create(p);
        skinnedBoundsOn(fighter.group);
        fighters.set(p.id, fighter);
        scene.add(fighter.group);
      }
    }
    for (const [id, fighter] of fighters) if (!snapshot.players.some(p => p.id === id && !p.enemy)) { drop(fighter); fighters.delete(id); }
    wearMine();
  }

  // ---- the visitor's likeness (./likeness.ts): their own model, worn by the fighter they take over
  /** Loaded after the first set's files, and kept: the world's own parsed copy (host.visitor.gltf, dude.work round 8),
   *  else fetched (the world serves it; its browser usually has it already). */
  let likeness: Likeness | null = null;
  let worn: Worn | null = null;
  const visitor = host.visitor;
  /** The visitor's fighter wears them (as soon as the model is in; again on every new body of that seat). */
  function wearMine() {
    const own = me ? fighters.get(me) : undefined;
    if (worn && worn.fighter !== own) { unwear(); }
    if (!own || worn || !likeness) return;
    worn = rt.within(() => likeness!.wear(own));
    // (its dash ghosts are built again from the body it draws now)
    effects.kit.ghosts.forget(own);
    worn?.pose();
  }
  function unwear() {
    if (!worn) return;
    const body = worn.fighter;
    worn.remove(); worn = null;
    effects.kit.ghosts.forget(body);
  }
  function loadLikeness() {
    if (!visitor?.model || likeness) return;
    void Likeness.load(visitor, slot ?? undefined, gl, fn => rt.within(fn)).then(async loaded => {
      likeness = loaded;
      if (slot) await slot();
      // its materials compiled for the world's picture before anyone walks in; (dude.work round 8) and kept, so that its
      // programs live on for every join (a body worn and let go releases its own), each program's first use paid behind
      // the duel (firstUse), and its programs built again from inside draw() for each kind of picture it may first be worn
      // in (the world's, under its fog; a Plaza screen's, with none): the join's frame builds and asks nothing
      const copy = loaded.warm(), only = new THREE.Scene();
      only.add(copy.body);
      likenessWarm = { copy, only, built: new Set() };
      if (slot) await slot();
      await compile(only);
      await firstUse(only);
      wearMine();
    }).catch(error => console.warn('Impact live: the visitor\'s model did not load; they play the fighter as it is', error));
  }
  let likenessWarm: { copy: { body: THREE.Object3D; free(): void }; only: THREE.Scene; built: Set<string> } | null = null;
  /** (dude.work round 8) Each program of what `root` holds used once now, one a breath, once the GPU's process has linked
   *  it: three's first use of a program (its checks and its look-up of the program's uniforms and attributes) is a run of
   *  round trips to the GPU's process, each waiting for it to catch up, and it came in the first frame that drew with the
   *  program: the join's (40 to 70 ms at the visitor's first draw). */
  /** (dude.work round 10) the game has left (dispose): firstUse's rounds stop */
  let gone = false;
  /** (dude.work round 10) Its rounds stop once the game has left (dispose) or a program has been let go meanwhile (three
   *  deletes it with its last material, `program` then unset): a round still going as the world let the game go, 3 to 6 s
   *  after it went live, went on asking the GPU about programs its own leaving had deleted, a WebGL warning each ('attempt
   *  to use a deleted object'), a second each. */
  async function firstUse(root: THREE.Object3D) {
    type Program = { isReady?(): boolean; getUniforms?(): unknown; getAttributes?(): unknown; program?: unknown };
    const programs = new Set<Program>();
    root.traverse(o => {
      for (const m of [(o as THREE.Mesh).material].flat() as (THREE.Material | undefined)[]) {
        if (!m) continue;
        const props = gl.properties.get(m) as { programs?: Map<string, Program>; currentProgram?: Program };
        for (const p of props.programs?.values() ?? []) programs.add(p);
        if (props.currentProgram) programs.add(props.currentProgram);
      }
    });
    const kept = (p: Program) => !gone && p.program !== undefined;
    for (const p of programs) {
      for (let k = 0; k < 50 && kept(p) && p.isReady && !p.isReady(); k++) await new Promise(r => setTimeout(r, 20));
      if (gone) return;
      if (!kept(p)) continue;
      try { rt.within(() => { p.getUniforms?.(); p.getAttributes?.(); }); } catch { /* drawn later */ }
      await new Promise(r => setTimeout(r, 16));
    }
  }

  /** The materials of what the scene holds (or of `only`, lit as the scene is), compiled for the world's picture (a
   *  colour target, no tone mapping, the world's kind of fog) and linked off the frame (KHR_parallel_shader_compile), so
   *  the first frame that shows them has nothing left to build. The renderer is put back at once: only the linking is
   *  waited for. */
  async function compile(only?: THREE.Scene) {
    const rt0 = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true });
    const was = gl.getRenderTarget(), fog = scene.fog, shadow = gl.shadowMap.enabled;
    let linked: Promise<unknown> = Promise.resolve();
    try {
      rt.within(() => {
        gl.setRenderTarget(rt0);
        scene.fog = new THREE.Fog(0xd6e9f8, 160, 1150);
        gl.shadowMap.enabled = shadow && shadows;
        linked = gl.compileAsync(only ?? scene, lens, scene);
      });
    } finally { scene.fog = fog; gl.shadowMap.enabled = shadow; gl.setRenderTarget(was); }
    await linked.catch(() => undefined);
    rt0.dispose();
  }
  /** (dude.work round 9) A few pixels of the world's kind of picture (half floats, with depth) for drawOnce, its lens and
   *  the world's kind of fog (programs are built for the fog's kind). */
  let onceTarget: THREE.WebGLRenderTarget | null = null, onceDrawn = 0;
  const onceCam = new THREE.PerspectiveCamera(40, 1, 0.1, 60), onceFog = new THREE.Fog(0xd6e9f8, 160, 1150);
  const onGpu = (t: THREE.Texture) => (gl.properties.get(t) as { __version?: number }).__version === t.version;
  /** The pictures what `root` holds draws with, its hidden parts' included (a material's maps and its uniforms'), not yet on
   *  the GPU. */
  function picturesOf(root: THREE.Object3D): THREE.Texture[] {
    const out = new Set<THREE.Texture>();
    const take = (t: unknown) => { const x = t as THREE.Texture | null; if (x?.isTexture && x.image && !onGpu(x)) out.add(x); };
    root.traverse(o => {
      for (const m of [(o as THREE.Mesh).material].flat() as (THREE.Material & Record<string, unknown>)[]) {
        if (!m) continue;
        for (const k of Object.keys(m)) take(m[k]);
        for (const u of Object.values((m as { uniforms?: Record<string, { value?: unknown }> }).uniforms ?? {})) take(u?.value);
      }
    });
    return [...out];
  }
  /**
   * (dude.work round 9) Bodies drawn once, off stage, as the world's picture draws them, before the ring shows them: what
   * three does only at a body's first draw (its programs' first use, its vertex buffers, its morph and bone textures) done
   * in a slot of its own, and its pictures put on the GPU one a slot before that; its awakened form's too, hidden till an
   * awakening, whose programs compile() builds but whose pictures and buffers the world's warm-up (what is visible) never
   * reaches. A body first drawn in the ring did all of it in that frame. `whole`: everything the scene holds drawn with them
   * (the boot's: the effects shown for their warm-up too); else only these bodies, the rest of the ring left out of the draw
   * (its lights kept: each program is built for their number and kind).
   */
  async function drawOnce(bodies: readonly (Fighter | THREE.Object3D)[], whole = false) {
    const roots = bodies.map(b => (b instanceof Fighter ? b.group : b));
    for (const root of roots) for (const t of picturesOf(root)) {
      if (slot) await slot();
      rt.within(() => { if (!onGpu(t)) { try { gl.initTexture(t); } catch { /* drawn when first used instead */ } } });
    }
    // what is to be drawn: every drawable thing the roots hold, their hidden parts' too, and with `whole` all the scene shows;
    // a chunk of it a slot, each chunk's cost sizing the next (a whole body's first draw, 20 to 40 ms, in one slot was a
    // frame of its own: the hitch moved, not gone)
    const things = new Set<THREE.Object3D>();
    for (const root of roots) root.traverse(o => { if (drawable(o)) things.add(o); });
    if (whole) scene.traverseVisible(o => { if (drawable(o)) things.add(o); });
    const list = [...things];
    for (let i = 0, per = ONCE_FIRST; i < list.length;) {
      if (slot) await slot();
      const chunk = new Set(list.slice(i, i + per));
      i += per;
      const ms = rt.within(() => renderOnce(roots, chunk));
      per = Math.max(1, Math.min(ONCE_MOST, Math.round(per * ONCE_MS / Math.max(ms, 0.5))));
    }
    onceDrawn++;
  }
  /** One chunk of drawOnce: the roots in the scene (one made ahead, in none, put in for it), their hidden parts shown, every
   *  drawable thing but the chunk's hidden and nothing culled, drawn into the scratch picture; all of it put back. The
   *  render's milliseconds. */
  function renderOnce(roots: readonly THREE.Object3D[], chunk: ReadonlySet<THREE.Object3D>): number {
    onceTarget ??= new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true });
    const was = gl.getRenderTarget(), fog = scene.fog, shadow = gl.shadowMap.enabled, auto = gl.shadowMap.autoUpdate, needs = gl.shadowMap.needsUpdate;
    const added: THREE.Object3D[] = [], shown: THREE.Object3D[] = [], away: THREE.Object3D[] = [], culled: THREE.Object3D[] = [];
    try {
      for (const root of roots) {
        if (root !== scene && !root.parent) { scene.add(root); added.push(root); }
        root.traverse(o => { if (!o.visible) { o.visible = true; shown.push(o); } });
      }
      scene.traverse(o => { if (o.visible && drawable(o) && !chunk.has(o)) { o.visible = false; away.push(o); } });
      scene.traverseVisible(o => { if (o.frustumCulled) { o.frustumCulled = false; culled.push(o); } });
      const at = roots[0] && roots[0] !== scene ? roots[0].position : _onceAt.set(0, 0, 0);
      onceCam.position.set(at.x, at.y + 1.4, at.z + 5); onceCam.lookAt(at.x, at.y + 1, at.z); onceCam.updateMatrixWorld();
      scene.fog = onceFog;
      // (the shadow map as it stands: bound, not drawn again; drawn now only if there is none yet, the boot's, before the
      // duel's first frame: with no map its receivers would sample a texture three never uploads, a GL error each)
      gl.shadowMap.enabled = shadow && shadows; gl.shadowMap.autoUpdate = false; gl.shadowMap.needsUpdate = gl.shadowMap.enabled && sun.castShadow && !sun.shadow.map;
      gl.setRenderTarget(onceTarget);
      const t = performance.now();
      gl.render(scene, onceCam);
      return performance.now() - t;
    } catch (error) { console.warn('Impact live: bodies drawn once off stage (they draw as they come instead)', error); return 0; }
    finally {
      // (what was hidden and is hidden again last: a hidden part of a root is shown, then left out of a chunk not its own)
      for (const o of culled) o.frustumCulled = true;
      for (const o of away) o.visible = true;
      for (const o of shown) o.visible = false;
      for (const o of added) o.removeFromParent();
      scene.fog = fog; gl.shadowMap.enabled = shadow; gl.shadowMap.autoUpdate = auto; gl.shadowMap.needsUpdate = needs;
      gl.setRenderTarget(was);
    }
  }
  const _onceAt = new THREE.Vector3();
  const drawable = (o: THREE.Object3D) => !!((o as THREE.Mesh).isMesh || (o as THREE.Points).isPoints || (o as THREE.Line).isLine || (o as THREE.Sprite).isSprite);
  /**
   * (dude.work round 9) The effects' bodies built ahead and kept hidden at the scene's top till they are wanted (the
   * Guardian's spares, the dashes' afterimages, the Dune Oni's phantom, each one skinned), drawn once off stage as they
   * come (drawOnce: a chunk a slot, their pictures first): first shown in the ring, each had its first draw in
   * that frame, 35 to 53 ms of Impact's draw at a Guardian's every awakening, at a new set's first dash, at Kenzo's first
   * ultimate. Looked for once a second; what is hidden and holds nothing skinned is passed over for good.
   */
  const sparesSeen = new WeakSet<THREE.Object3D>();
  let sweeping = false, sweptAt = 0, sparesDrawn = 0;
  function sweepSpares(now: number) {
    if (sweeping || now - sweptAt < 1000) return;
    sweptAt = now;
    const fresh: THREE.Object3D[] = [];
    for (const o of scene.children) {
      if (o.visible || sparesSeen.has(o)) continue;
      let skinned = false;
      o.traverse(c => { if ((c as THREE.SkinnedMesh).isSkinnedMesh) skinned = true; });
      if (skinned) fresh.push(o); else sparesSeen.add(o);
    }
    if (!fresh.length) return;
    sweeping = true;
    void (async () => {
      try {
        // (still hidden and still in the scene: one taken meanwhile is the frame's own to draw)
        const still = fresh.filter(o => o.parent === scene && !o.visible);
        if (still.length) await drawOnce(still);
        for (const o of fresh) sparesSeen.add(o);
        sparesDrawn += still.length;
      } catch (error) { console.warn('Impact live: spares drawn once (they draw as they come instead)', error); }
      finally { sweeping = false; }
    })();
  }
  /** A body of `id` built, compiled and let go before it steps in (FighterLibrary.warmup's job, off the drawn scene). */
  async function warmBody(id: FighterId, pictures?: Set<THREE.Texture>) {
    warms.started++;
    // (far off, as FighterLibrary's own warm-up stands them: a body is one of Fighter.drawn for as long as it is kept, and a
    // swing measures its room against the drawn body nearest what it swings at)
    // (dude.work round 8, roadmap S2: its clips worked out a step a slot, its body made in a slot of its own and its rush plan
    // in the next: 85 to 90 ms of one frame before)
    await inSteps(library.prebake(id));
    const body = await inSteps(library.createSteps({ id: 'warm-' + id, name: 'Warmup', fighter: id, x: 1000, y: 0, z: 1000, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 100,
      action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0, target: null, alive: true, isBot: true, grounded: true, guarding: false,
      cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } }));
    if (slot) await slot();
    skinnedBoundsOn(body.group);
    const only = new THREE.Scene();
    only.add(body.group);
    body.group.traverse(o => { o.visible = true; });
    // (dude.work round 8, S14) the pictures its body draws with (the library's, shared by every body of the fighter: they
    // stay when this one goes), to be put on the GPU one a frame before it steps in (upload())
    if (pictures) body.group.traverse(o => {
      for (const m of [(o as THREE.Mesh).material].flat() as (THREE.Material & Record<string, unknown>)[]) {
        if (!m) continue;
        for (const k of Object.keys(m)) { const t = m[k] as THREE.Texture | null; if (t?.isTexture && t.image) pictures.add(t); }
      }
    });
    // (dude.work round 8, S14) kept, hidden and in no scene, until it steps in: its materials keep their programs alive for
    // the body that will (a body let go releases its programs, and the challenger's first frame built them again), and
    // its programs' first use is paid now, behind the set
    try { await compile(only); await firstUse(only); }
    catch (error) { letGo(body, id); throw error; }
    if (keptWarm) letGo(keptWarm.body, keptWarm.id);
    keptWarm = { id, body };
  }
  /** (dude.work round 9) The bodies a set about to begin will want, made ahead a step a slot (as the first set's are) and
   *  taken by begin's bodiesFor (`made`): the visitor's own set at his join (asked for as he comes near: notice), and the
   *  set after a decided one (while its winner's moment plays). A new set's two bodies made in its first frame took 70 to
   *  120 ms of it (the join's, and the frame the visitor came out in after his set: tools/doors.mjs). Two hidden bodies,
   *  in no scene, until then: their geometry and pictures are the library's, shared. */
  let preparing = '';
  /** (round 9) the visitor is near (notice): the ring's own pair kept made ahead for his join */
  let nearBy = false;
  const bodiesReady = (pair: readonly [FighterId, FighterId]) => made.get(SEATS[0])?.bodyFighter === pair[0] && made.get(SEATS[1])?.bodyFighter === pair[1];
  function prepareBodies(pair: readonly [FighterId, FighterId]) {
    const want = `${SEATS[0]}:${pair[0]},${SEATS[1]}:${pair[1]}`;
    // (one making at a time: a newer pair's waits for the making in flight to see it is not wanted and stop)
    if (preparing === want || bodiesReady(pair)) return;
    preparing = want;
    void (async () => {
      try {
        for (let i = 0; i < 2; i++) {
          const seat = SEATS[i], fighter = pair[i], have = made.get(seat);
          if (have && have.bodyFighter === fighter) continue;
          if (!library.has(fighter)) continue;
          // (far off, as a warmed body stands: a body is one of Fighter.drawn while it is kept, and a swing measures its room
          // against the drawn body nearest what it swings at; its first update in the ring puts it on its mark)
          const body = await inSteps(library.createSteps({ id: seat, name: FIGHTERS[fighter].name, fighter, x: 1000 + i * 10, y: 0, z: 1000, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 0,
            action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0, target: null, alive: true, isBot: true, grounded: true, guarding: false,
            cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } } as PlayerState));
          if (preparing !== want) { letGo(body, fighter); return; }
          const old = made.get(seat);
          if (old && old !== body) letGo(old, old.bodyFighter as FighterId);
          made.set(seat, body);
          // (and drawn once, off stage: its first frame in the ring has nothing left to put on the GPU)
          await drawOnce([body]);
          if (preparing !== want) return;
        }
      } finally { if (preparing === want) preparing = ''; }
    })().catch(error => console.warn('Impact live: bodies ahead', error));
  }
  /** The challenger's warmed body, kept until it has stepped in (begin) or another is chosen. */
  let keptWarm: { id: FighterId; body: Fighter } | null = null;
  /** (dude.work round 8, S14) A body built only to be compiled, let go for good, its occlusion twins with it (dropTwins),
   *  and counted (__impact.warms); its materials and its mixer are let go even if its dispose() throws (a throw here was
   *  swallowed). */
  const warms = { started: 0, built: 0, gone: 0, threw: 0, last: '' };
  function letGo(body: Fighter, id: FighterId) {
    warms.built++;
    dropTwins(body);
    try { body.dispose(); warms.gone++; return; }
    catch (error) { warms.threw++; warms.last = `${id}: ${String((error as Error)?.stack ?? error).slice(0, 300)}`; console.warn('Impact live: a warmed body would not go', id, error); }
    type Held = { outlineMaterials?: THREE.Material[]; awakenedForm?: Held; mixer: THREE.AnimationMixer; model: THREE.Object3D; group: THREE.Object3D };
    for (let b: Held | undefined = body as unknown as Held; b; b = b.awakenedForm) {
      for (const m of b.outlineMaterials ?? []) { try { m.dispose(); } catch { /* gone */ } }
      try { b.mixer.stopAllAction(); b.mixer.uncacheRoot(b.model); } catch { /* gone */ }
      b.group.removeFromParent();
    }
  }
  /** (dude.work round 8, S14) Pictures to put on the GPU, one each frame the duel runs (the challenger's: before, its
   *  first frame in the ring uploaded all of them at once, 20.7 MB in one measure's five seconds). */
  const uploads: THREE.Texture[] = [];
  let uploadsDone: (() => void) | null = null;
  function upload() {
    const t = uploads.shift();
    if (t) { try { gl.initTexture(t); } catch { /* drawn later */ } }
    if (!uploads.length && uploadsDone) { const done = uploadsDone; uploadsDone = null; done(); }
  }

  /** The fighter who steps in next: the next of the five not in the ring now. Its files come in while the set before
   *  it is fought; until they are in, the next set is a runback of this one. */
  let challenger: FighterId | null = null, challengerReady = false;
  function prepareChallenger() {
    const r = ring;
    if (challenger || !r) return;
    let next: FighterId = r.pair[0];
    for (let guard = 0; guard < ROSTER.length * 2; guard++) { rotation++; next = ROSTER[rotation % ROSTER.length]; if (!r.pair.includes(next)) break; }
    const chosen = challenger = next; challengerReady = false;
    const pictures = new Set<THREE.Texture>();
    void loaded([chosen]).then(() => warmBody(chosen, pictures).catch(() => undefined))
      .then(() => new Promise<void>(done => { uploads.push(...pictures); uploadsDone = done; if (!uploads.length) upload(); }))
      .then(() => { if (challenger === chosen) challengerReady = true; })
      .catch(error => { console.warn('Impact live: the next fighter did not load', chosen, error); if (challenger === chosen) challenger = null; });
  }
  /** The pair after a decided set: the winner stays in their seat (the visitor's fighter, if they play, stays in
   *  theirs), and the challenger takes the other. */
  /** (round 9) The pair after the decided set, chosen once for it (nextPair): pairAfter takes the challenger, so asked a
   *  second time it found none and gave the runback. Since the bodies made ahead (27e9222) asked it twice, once to make
   *  the bodies and once to begin the set, every set after the first was its runback, the same two for good. Let go when
   *  a set begins. */
  let after: [FighterId, FighterId] | null = null;
  const nextPair = (r: RingSet) => (after ??= pairAfter(r));
  function pairAfter(r: RingSet): [FighterId, FighterId] {
    const keepSeat = me ?? r.set.view.winner ?? SEATS[0], seat = Math.max(0, SEATS.indexOf(keepSeat as typeof SEATS[number]));
    const stays = r.snapshot?.players.find(p => p.id === keepSeat)?.fighter ?? r.pair[seat];
    const steps = challenger && challengerReady && challenger !== stays ? challenger : r.pair[1 - seat];
    if (steps === challenger) challenger = null;
    return seat === 1 ? [steps, stays] : [stays, steps];
  }

  /** A set begins on `next`: the drawn frame starts again with it. */
  function begin(next: RingSet) {
    const old = ring;
    ring = next;
    old?.dispose();
    epoch++;
    acc = 0; localClock = next.snapshot?.serverTime ?? 0; lastEvent = 0; duelRoundKey = ''; introFor = null; victoryFor = null; decidedAt = 0; finaleLine = undefined; preparing = ''; after = null;
    // (round 9) The same two again (the visitor's own set at the join, RingSet.open of the ring's pair): their bodies stay,
    // as they do from one round to the next (bodiesFor keeps a seat's body while its fighter is the same). Made new, the
    // visitor's seat's body was worn at once and its own meshes never drawn, so its materials held no program, and three
    // released the old body's programs with it two frames on: the leave's first watched frame built them all again
    // (Impact's draw 212 ms there, the journey of 21 Nov). Another pair (the bots' next set): every body goes, as before.
    const same = !!old && old.pair[0] === next.pair[0] && old.pair[1] === next.pair[1];
    timeline.reset(); clearFlights(); if (!same) clearFighters(); cutInSeen.clear(); hud.resetEvents();
    targeting.reset(); autoLock.reset(); targetId = null;
    if (me) next.seat(me, true);
    if (next.snapshot) { timeline.push(next.snapshot, performance.now()); bodiesFor(next.snapshot); }
    // (the challenger's warmed body, once its own body stands in the ring and holds the same programs)
    if (keptWarm && next.pair.includes(keptWarm.id)) { letGo(keptWarm.body, keptWarm.id); keptWarm = null; }
    // only the two in the ring (and the one coming) are kept
    const keep = new Set<FighterId>([...next.pair, ...(challenger ? [challenger] : [])]);
    library.evict(keep, keep.size);
    audio.retain(keep);
  }

  // ---- the input
  input.onMenu = source => { if (source === 'controller' && host.playing) host.exit(); };
  input.onTarget = () => {
    const s = ring?.snapshot, p = s?.players.find(q => q.id === me);
    if (!s || !p) return;
    targetId = targeting.cycle(s.players, p, input.yaw);
    if (!targeting.locked) autoLock.decline(s, epoch);
    hud.notify(targeting.locked ? 'LOCKED ON' : 'LOCK RELEASED', 0.7);
  };
  input.onModeChange = mode => hud.setInput(mode === 'controller' ? 'controller' : mode === 'touch' ? 'touch' : 'keyboard', input.family);
  // (dude.work round 8, G2) the game's own touch controls on a touch-first device (input/touch.ts: the stick where the
  // left thumb lands, the fan of buttons with their moves' art and cooldowns, LOCK, a drag of the right thumb to look),
  // shown only while the visitor plays and asking for landscape as the game does; the world's Leave pill is the way out
  // (the controls' pause button is left out, and the live duel has no emote wheel)
  // (its code comes only to a touch-first device: a chunk of its own)
  const touch: TouchControls | null = host.touch ? new (await import('../input/touch')).TouchControls(input, root) : null;
  if (touch) { rt.addCss(TOUCH_CSS); if (input.mode === 'touch') input.onModeChange('touch'); }
  input.onView = () => false;
  input.onInteract = () => false;

  /** What the visitor's keys say this tick (main.ts sendCommand). */
  function command(): PlayerInput | undefined {
    if (!me || !input.enabled) return undefined;
    const moving = movementMask(input.keys);
    const c = input.command(targetId, viewKeys.movementBasis(followCam.movementBasis(moving), moving));
    c.yaw = followCam.aimYaw;
    c.lock = targeting.locked;
    return c;
  }

  // ---- what a snapshot and its events do (main.ts onSnapshot, applyCombatFrame, cinematics)
  const involved = (event: CombatEvent) => !!me && (event.actorId === me || event.targetId === me);
  const nearby = (event: CombatEvent) => { const at = event.endpoint ?? event.origin; if (!at || !shownSelf) return Infinity; return Math.hypot(at.x - shownSelf.x, at.z - shownSelf.z); };
  const witness = (event: CombatEvent) => involved(event) ? 1 : Math.max(0, 1 - nearby(event) / 16) * .45;
  const eventStyle = (event: CombatEvent) => event.fighter && event.slot ? (event.slot === 'light' && (event.chain ?? 0) > 0 ? rushMove(event.fighter, event.chain!, false) : MOVES[event.fighter][event.slot]).style : undefined;
  const impactDetail = (event: CombatEvent) => {
    const awakened = !borrowedEvent(event) && !!ring?.snapshot?.players.find(p => p.id === event.actorId)?.awakened, big = bigBlowOf(event, awakened) || cinematicBlowOf(event, awakened);
    return { chain: event.chain, fromBehind: event.fromBehind, reaction: event.reaction, ...(big ? { big, tint: elementFor(event.fighter, event.slot, awakened, event.chain ?? 0, event.branch).spike } : {}), ...(event.downed ? { downed: true } : {}), ...(event.lift ? { lift: event.lift } : {}) };
  };
  const bigBlowSound = (event: CombatEvent) => {
    if (event.kind !== 'hit') return;
    const awakened = !borrowedEvent(event) && !!ring?.snapshot?.players.find(p => p.id === event.actorId)?.awakened;
    if (!bigBlowOf(event, awakened)) return;
    audio.bigBlow(event.endpoint ?? event.origin ?? { x: 0, y: 0, z: 0 }, event.actorId, .8 + Math.min(.35, (event.damage ?? 60) / 300));
  };
  const blowHeading = (event: CombatEvent) => event.origin && event.endpoint ? new THREE.Vector3(event.endpoint.x - event.origin.x, 0, event.endpoint.z - event.origin.z) : undefined;
  const notify = (id: string | undefined, text: string, duration: number) => { if (id && id === me) hud.notify(text, duration); };

  /** A snapshot as it arrives (main.ts onSnapshot, the duel's part). */
  function arrived(snapshot: GameSnapshot) {
    const duelKey = snapshot.duel ? `${snapshot.duel.set}:${snapshot.duel.round}` : '';
    if (snapshot.duel?.phase === 'playing' && snapshot.status === 'active' && duelKey !== duelRoundKey) {
      // (dude.work round 9, as main.ts since the game's own 19 Nov: a Duel's next round keeps its two bodies - the room puts
      // both back on their marks, alive, and a body takes a respawn's jump as one, its ragdoll handed back; built again for
      // every round, the two were a 70 to 120 ms frame three seconds after every knockout. A new set builds afresh.)
      if (duelRoundKey && duelRoundKey.split(':')[0] !== duelKey.split(':')[0]) clearFighters();
      duelRoundKey = duelKey;
      timeline.reset(); followCam.reset(); introFor = null; victoryFor = null;
      localClock = snapshot.serverTime;
      if (me) {
        input.yaw = snapshot.players.find(p => p.id === me)?.yaw ?? Math.PI;
        followCam.lookAlong(input.yaw);
        void vsSplash.fight();
      }
    }
    timeline.push(snapshot, performance.now());
  }

  function applyCombatFrame(snapshot: GameSnapshot) {
    bodiesFor(snapshot);
    const self = me ? snapshot.players.find(p => p.id === me) : undefined;
    if (self) {
      targetId = targeting.update(snapshot.players, self, snapshot.events, snapshot.serverTime, input.yaw);
      const rival = autoLock.want(snapshot, self.id, epoch, targeting.locked);
      if (rival) { targeting.lockOn(rival); targetId = rival; }
    }
    audio.handle(snapshot.events, me ?? '', presentPlayers(snapshot.players));
    if (me) { manga.handle(snapshot.events, me, snapshot.players); hud.events(snapshot); }
    for (const event of snapshot.events) {
      if (event.id <= lastEvent) continue;
      lastEvent = event.id;
      moment(event);
      if (me) { const pulse = pulseFor(event, me, () => false); if (pulse) input.feel(pulse); }
      if (event.actorId === me && event.kind === 'cast' && event.move && event.slot !== 'ultimate') notify(event.actorId, displayMove(event.fighter, event.move).toUpperCase(), 1.1);
      if (event.kind === 'awaken' && event.move && event.actorId === me) followCam.impact(.4);
      if ((event.kind === 'hit' || event.kind === 'blocked') && event.endpoint && (event.damage || event.downed)) {
        const heading = event.origin ? new THREE.Vector3(event.endpoint.x - event.origin.x, event.endpoint.y - event.origin.y, event.endpoint.z - event.origin.z) : undefined;
        const landed = event.kind === 'hit';
        const struck = snapshot.players.find(player => player.id === event.targetId);
        const height = struck ? event.endpoint.y - struck.y : undefined;
        const detail = impactDetail(event);
        bigBlowSound(event);
        fighters.get(event.targetId ?? '')?.impact(true, event.slot, eventStyle(event), event.contactIndex, heading, landed ? event.damage ?? 0 : (event.damage ?? 0) * 2.2, height, detail);
        if (landed && (event.slot === 'light' || event.slot === 'heavy')) fighters.get(event.actorId)?.impact(false, event.slot, undefined, undefined, heading, event.damage, undefined, detail);
        if (!landed) fighters.get(event.actorId)?.impact(false, event.slot, undefined, undefined, heading, event.damage, undefined, detail);
        if (me && landed && !!event.damage && (involved(event) || nearby(event) < 14)) {
          const target = event.targetId;
          damageNumbers.show(event.damage, new THREE.Vector3(event.endpoint.x, event.endpoint.y, event.endpoint.z), event.slot === 'special' || event.slot === 'ultimate' || event.slot === 'area',
            target ? () => { const body = fighters.get(target); return body ? bodyCentre(body, numberAnchor) : undefined; } : undefined, target, !!event.bullseye, false);
        }
      }
      if (me && event.kind === 'hit') {
        const weight = witness(event);
        if (weight > .01) {
          followCam.impact(Math.min(1, (.2 + screenWorth(event) / 460) * weight), blowHeading(event), involved(event) ? hitTier(event.slot, event.chain) : 0);
          if (involved(event)) { followCam.holdFor(Math.min(1, (event.damage ?? 0) / 240)); markerHoldUntil = performance.now() / 1000 + .5; }
        }
      }
      if (event.kind === 'rejected' && event.reason) notify(event.actorId, REJECTIONS[event.reason] ?? event.reason.toUpperCase(), .7);
      if (event.kind === 'counter') { if (event.actorId === me) hud.notify('COUNTER!', .9); else if (event.targetId === me) hud.notify('COUNTERED', .8); }
      if (me && event.kind === 'just-guard') { notify(event.targetId, 'PARRY', .8); followCam.impact(.5 * witness(event), blowHeading(event), involved(event) ? 1 : 0); }
      if (me && event.kind === 'guard-break') { followCam.impact(.6 * witness(event), blowHeading(event), involved(event) ? 2 : 0); if (event.targetId === me) hud.notify('GUARD BROKEN', .9); else notify(event.actorId, 'GUARD BREAK', .9); }
      if (me && event.kind === 'wall-splat') followCam.impact(.46 * witness(event));
      if (me && event.kind === 'ground-bounce') followCam.impact(.36 * witness(event));
      if (me && event.kind === 'land' && (event.drop ?? 0) >= 1) followCam.impact(Math.min(.6, .12 + ((event.drop ?? 0) - 1) * .07) * witness(event));
      if (me && event.kind === 'projectile-clash') followCam.impact(.42 * witness(event));
      if (me && event.kind === 'break') { followCam.impact(.4 * witness(event), blowHeading(event)); if (event.actorId === me) hud.notify('BREAK', .8); else notify(event.targetId, 'BROKEN', .8); }
      if ((event.kind === 'hit' || event.kind === 'blocked' || event.kind === 'chase') && involved(event)) lockExchangeAt = performance.now();
      if (me && event.kind === 'hit' && event.actorId === me && (event.branch || event.slot === 'light' && (event.chain ?? 0) >= 3)) followCam.comboPunch();
      if (me && event.kind === 'hit' && event.counter) { if (event.actorId === me) hud.notify('COUNTER', .6); else notify(event.targetId, 'COUNTERED', .6); }
    }
  }

  function cinematics(snapshot: GameSnapshot) {
    if (me) followCam.director.handle(snapshot.events, me, id => fighters.get(id));
    const startsAt = snapshot.lobby?.startsAt ?? null;
    if (snapshot.status === 'waiting' && startsAt !== null && introFor !== startsAt) { introFor = startsAt; if (me) followCam.intro(Math.max(0, startsAt - snapshot.serverTime)); }
    if (snapshot.status === 'waiting' && startsAt === null && introFor !== null) { introFor = null; if (me) followCam.intro(0); }
    const winnerId = snapshot.status === 'finished' ? snapshot.duel?.winner ?? snapshot.winnerId : null;
    if (winnerId && victoryFor !== winnerId) {
      const winner = fighters.get(winnerId);
      if (winner) {
        victoryFor = winnerId;
        const mine = winnerId === me;
        if (me) audio.ui(UI_SFX.victory, .45, .3);
        const line = HOME_VOICES[winner.state.fighter], own = audio.winLine(winner.state.fighter, mine ? 1.9 : .8);
        if (own === undefined && line) audio.quote(line, .85, mine ? 1.9 : .8);
        // (round 9: what the finale is timed on, as main.ts lineSeconds: the line said, else the home line's length)
        finaleLine = own ?? (line ? audio.sampleSeconds(line) : undefined) ?? HOME_VOICE_SECONDS[winner.state.fighter];
        if (me && !mine) audio.lossLine(.8 + (own ?? 0) + .4);
        if (me) followCam.victory(winner, 6);
        const self = snapshot.players.find(p => p.id === me);
        if (mine && self && snapshot.duel?.phase === 'complete') {
          if (duelCalls(snapshot)) duelCaller.say(self.damageTaken ? 'victory' : 'flawless', { delay: .55, queue: true });
          else if (announcerOn()) audio.announce(self.damageTaken ? VICTORY_LINE : FLAWLESS_LINE, .95, .55);
        }
      }
    }
    if (snapshot.status !== 'finished') victoryFor = null;
  }

  // ---- (dude.work round 8, G4) the world hears the duel (LiveHost.emit): its moments told once each, as they happen,
  // whether or not the visitor plays - a set's first bell, an ultimate cast, an awakening, a parry, a broken guard, a
  // counter, a long string, a knockout, a round and a set decided. `side` is the seat it was for (status().sides' order).
  const emitter = (host as LiveHost & { emit?: (e: LiveEvent) => void }).emit;
  const sideOf = (id: string | undefined): 0 | 1 | undefined => { const k = SEATS.indexOf(id as typeof SEATS[number]); return k === 0 ? 0 : k === 1 ? 1 : undefined; };
  const tell = (kind: LiveEvent['kind'], id: string | undefined, weight: number, label: string, at?: { x: number; y: number; z: number }) => {
    if (!emitter) return;
    try { emitter.call(host, { kind, side: sideOf(id), weight, label, you: !!me && id === me, ...(at ? { at: { x: at.x, y: at.y, z: at.z } } : {}) }); }
    catch (error) { console.warn('Impact live: emit', error); }
  };
  const bodyAt = (id: string | undefined) => { const p = id ? ring?.snapshot?.players.find(q => q.id === id) : undefined; return p ? { x: p.x, y: p.y + 1, z: p.z } : undefined; };
  /** One combat event as the world hears it (applyCombatFrame, each event once). */
  let castsByMe = 0;
  function moment(event: CombatEvent) {
    if (me && event.kind === 'cast' && event.actorId === me) castsByMe++;
    if (!emitter) return;
    const at = event.endpoint ?? bodyAt(event.actorId);
    if (event.kind === 'cast' && event.slot === 'ultimate') tell('big', event.actorId, .8, 'ultimate', bodyAt(event.actorId));
    else if (event.kind === 'awaken' && event.move) tell('big', event.actorId, .7, 'awakening', bodyAt(event.actorId));
    else if (event.kind === 'just-guard') tell('big', event.targetId, .5, 'parry', at);
    else if (event.kind === 'guard-break') tell('big', event.actorId, .55, 'guard break', at);
    else if (event.kind === 'counter') tell('big', event.actorId, .5, 'counter', at);
    else if (event.kind === 'hit' && (event.combo === 5 || event.combo === 8 || event.combo === 12)) tell('big', event.actorId, event.combo === 5 ? .45 : event.combo === 8 ? .65 : .85, `${event.combo}-hit combo`, at);
    else if (event.kind === 'eliminated') tell('knockout', event.actorId, 1, 'K.O.', bodyAt(event.targetId));
  }
  /** A round's and a set's beginning and end, from the duel's own view of itself (each once). */
  let toldRound = '', toldStart = '';
  /** (round 9) The winner's line as the finale says it (cinematics: its length, s, when known) */
  let finaleLine: number | undefined;
  /** (round 9) THE END OF THE SET, told once as it is decided: the side that won and, while the visitor plays, whether it
   *  was theirs (`you`) and their result moment's length (`hold`: the game's own finale); a bots' set leaves both out. */
  function ended(winner: string | undefined) {
    if (!emitter) return;
    const side = sideOf(winner);
    const hold = Math.min(FINALE.most, Math.max(FINALE.least, FINALE.lineAt + (finaleLine ?? FINALE.line) + FINALE.after));
    try { emitter.call(host, { kind: 'end', weight: 1, label: 'set won', ...(side !== undefined ? { side } : {}), ...(me ? { hold, ...(winner ? { you: winner === me } : {}) } : {}) }); }
    catch (error) { console.warn('Impact live: emit', error); }
  }
  function rounds(snapshot: GameSnapshot) {
    const duel = snapshot.duel;
    if (!emitter || !duel) return;
    const set = `${epoch}:${duel.set}`, key = `${set}:${duel.round}:${duel.phase}`;
    if (snapshot.status === 'active' && duel.phase === 'playing' && duel.round === 1 && toldStart !== set) { toldStart = set; tell('start', undefined, .4, 'first bell'); }
    if ((duel.phase === 'interval' || duel.phase === 'complete') && toldRound !== key) {
      toldRound = key;
      const won = duel.roundWinner ?? undefined;
      tell('round', won, duel.phase === 'complete' ? .9 : .6, `round ${duel.phase === 'complete' ? duel.round : duel.round - 1}`);
      if (duel.phase === 'complete') ended(duel.winner ?? undefined);
    }
  }

  // ---- (dude.work round 8, G7) the visitor coming (LiveGame.notice): the fighter nearest him looks over at him and nods,
  // whenever its own fight lets it look anywhere (Impact's own gaze, Fighter.aimHead, which turns a head only between
  // blows: idle, walking, running, dashing or guarding), and goes back to its opponent. The fight never waits for it.
  const GLANCE = 2.2, NOD_AT = .55, NOD_FOR = .5, NOD = .2;
  const AIMS = ['idle', 'run', 'dash', 'guard', 'walk'];
  let glance: { id: string; at: THREE.Vector3; t: number } | null = null;
  const glanceAt = new THREE.Vector3(), nodAxis = new THREE.Vector3(), nodLook = new THREE.Vector3(), nodQ = new THREE.Quaternion(), nodP = new THREE.Quaternion(), nodPi = new THREE.Quaternion();
  function noticed(at: THREE.Vector3 | null) {
    if (!at) { nearBy = false; return; }
    const s = ring?.snapshot;
    if (!s || me) return;
    // (round 9) his own set's two bodies, made ahead for his join (kept made while he is near: update)
    nearBy = true;
    let best: PlayerState | undefined, bd = Infinity;
    for (const p of s.players) { if (!p.alive || p.enemy) continue; const d = Math.hypot(p.x - at.x, p.z - at.z); if (d < bd) { bd = d; best = p; } }
    if (best) glance = { id: best.id, at: new THREE.Vector3(at.x, at.y + 1.6, at.z), t: 0 };
  }
  /** The glance's head turn, before the fighter's update (its gaze eases toward the point at its own pace). */
  function glancePoint(id: string, state: PlayerState): THREE.Vector3 | undefined {
    if (!glance || glance.id !== id || me || glance.t > GLANCE || !AIMS.includes(state.action)) return undefined;
    return glanceAt.copy(glance.at);
  }
  /** The nod, after the fighter's update: the head dips toward the visitor and comes up again. */
  function nod(f: Fighter, dt: number) {
    if (!glance) return;
    glance.t += dt;
    if (glance.t > GLANCE + 1) { glance = null; return; }
    const u = (glance.t - NOD_AT) / NOD_FOR;
    if (u <= 0 || u >= 1 || !AIMS.includes(f.state.action)) return;
    const head = f.drawnJoint('Head');
    if (!head?.parent) return;
    nodLook.copy(glance.at).sub(f.group.position).setY(0);
    if (nodLook.lengthSq() < 1e-6) return;
    nodAxis.crossVectors(THREE.Object3D.DEFAULT_UP, nodLook.normalize()).normalize();
    nodQ.setFromAxisAngle(nodAxis, NOD * Math.sin(Math.PI * u));
    head.parent.getWorldQuaternion(nodP);
    head.quaternion.premultiply(nodQ.premultiply(nodPi.copy(nodP).invert()).multiply(nodP));
    head.updateMatrixWorld(true);
  }

  /** The ultimate's and the awakening's cut-ins (main.ts cutIns), for the visitor. */
  const boxPoint = new THREE.Vector3(), boxRight = new THREE.Vector3();
  function screenBox(f: Fighter) {
    const cam = camera, p = f.group.position, size = Math.max(f.state.size ?? 1, bodyBulk(f.state)), w = innerWidth, h = innerHeight;
    boxRight.setFromMatrixColumn(cam.matrixWorld, 0).setY(0).normalize();
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const up of [0, 1.05, 2.05]) for (const across of [-.5, .5]) {
      boxPoint.set(p.x + boxRight.x * across * size, p.y + up * size, p.z + boxRight.z * across * size).project(cam);
      if (!(boxPoint.z < 1)) continue;
      const x = (boxPoint.x * .5 + .5) * w, y = (.5 - boxPoint.y * .5) * h;
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    return left <= right ? { left, top, right, bottom } : undefined;
  }
  function cutIns(snapshot: GameSnapshot) {
    if (!me) return;
    for (const p of snapshot.players) {
      const key = cutInKey(p);
      if (cutInSeen.get(p.id) === key) continue;
      const awakening = awakeningCutIn(p, me), side = awakening ? 'mine' : cutInSide(p, me);
      if (!side) continue;
      cutInSeen.set(p.id, key);
      const avoid = [];
      for (const id of new Set([p.id, p.target, me])) { const body = id ? fighters.get(id) : undefined, box = body ? screenBox(body) : undefined; if (box) avoid.push(box); }
      // (dude.work round 8, G6) the visitor's own card is his: his name, his face (his portrait, the world's) in the card's
      // inked panel, his colour (the red of his jacket's emblem) on the stroke's edge; the move is the kit's he plays
      const own = p.id === me && visitor ? { name: visitor.name, face: visitor.pictures?.portrait, color: visitor.outfit?.jacket?.emblem } : undefined;
      cutIn.show(p.fighter, displayMove(p.fighter, awakening ? AWAKENINGS[p.fighter].name : slotNames(p, 'ultimate')?.name ?? moveFor(p.fighter, 'ultimate', !!p.awakened).name), side, avoid, own);
    }
  }

  /** The visitor's camera (main.ts's frame, the duel's path: the focus picker, the turn keys, FollowCamera). */
  function aim(snapshot: GameSnapshot, self: PlayerState, own: Fighter, rawDt: number) {
    if (input.enabled && viewKeys.lockHold(rawDt, input.keys) && targeting.locked) { targeting.release(); autoLock.decline(snapshot, epoch); hud.notify('LOCK RELEASED', .7); }
    const picked = followCam.picker.update(rawDt, snapshot.players, self, followCam.movementYaw, snapshot.events, targeting.locked ? targetId : null, targetId);
    if (!targeting.locked) targetId = picked;
    followCam.focusHint.pending = followCam.picker.pending ?? '';
    followCam.focusHint.share = followCam.picker.pendingShare;
    followCam.stageBounds = STAGES[RING];
    if (input.enabled) viewKeys.steer(rawDt, input, self, targetId ? fighters.get(targetId)?.group.position : undefined, followCam.movementYaw, movementMask(input.keys), followCam.blocked);
    let rivals = 0, rival = '';
    for (const p of snapshot.players) if (p.id !== self.id && p.alive) { rivals++; rival = p.id; }
    followCam.sole = rivals === 1;
    const held = targetId || (followCam.sole && (settings.cameraMode === 'arena' || settings.cameraMode === 'smart') ? rival : '');
    followCam.comboShot = settings.cameraStyle === 'chase' && followCam.sole && performance.now() - lockExchangeAt < LOCK_EXCHANGE_MS;
    followCam.mode = settings.cameraMode;
    followCam.style = settings.cameraStyle;
    followCam.cinematics = settings.cinematics;
    followCam.finisherCuts = roanEnabled();
    followCam.cuts.arena = true;
    followCam.battlefield = false;
    followCam.wide = 0;
    followCam.movementBasis(movementMask(input.keys, !input.arrowsLook));
    followCam.update(rawDt, own, input.yaw, input.pitch, [], settings.shake, held ? fighters.get(held) : undefined, targeting.locked);
    input.yaw = followCam.inputYaw;
    input.pitch = followCam.inputPitch;
  }

  // ---- the first set: its two fighters, and nothing else, before the duel can be drawn
  progress(0.15);
  const first: [FighterId, FighterId] = [ROSTER[rotation % ROSTER.length], ROSTER[(rotation + 1 + Math.floor(Math.random() * (ROSTER.length - 1))) % ROSTER.length]];
  rotation = Math.max(ROSTER.indexOf(first[0]), ROSTER.indexOf(first[1]));
  // (the sound bank opens on the world's AudioContext now - it may stay suspended until the visitor's first click or
  // key, and nothing waits on it - so the fighters' sounds are asked for with their bodies)
  void audio.unlock().catch(() => undefined);
  audio.preload([FIGHT_LINE, VICTORY_LINE, FLAWLESS_LINE]);
  await loaded(first, false);
  progress(0.8);
  // (dude.work round 8, roadmap S2) with the world's frame budget: each fighter's clips worked out a step a slot
  // (FighterLibrary.prebake), then each of the first set's bodies made in a slot of its own and its rush plan in the next,
  // begin() taking them as they are (the two bodies took 260 ms of one frame)
  const opening = RingSet.open(first);
  if (slot) {
    for (const id of new Set(first)) await inSteps(library.prebake(id));
    for (const p of opening.snapshot?.players ?? []) {
      if (p.enemy || !library.has(p.fighter)) continue;
      made.set(p.id, await inSteps(library.createSteps(p)));
    }
    await slot();
  }
  begin(opening);
  // warm: one body of each fighter, its effects' shared meshes, compiled before the first frame shows them
  if (slot) await slot();
  rt.within(() => { awakeningEffects.warmup(); clashEffects.warmup(); });
  lens.position.set(0, 6, 16); lens.lookAt(0, 1, 0); lens.updateMatrixWorld();
  if (slot) await slot();
  await compile();
  // (dude.work round 9) and drawn once, off stage, with the effects still shown for their warm-up: the first set's bodies'
  // awakened forms and the effects' pictures and buffers put on the GPU now, not at a first awakening in the ring
  await drawOnce([...fighters.values()], true);
  awakeningEffects.hideWarmup(); clashEffects.hideWarmup();
  // (dude.work round 8) and the first set's fighters' occlusion-fade twins, which a warmed challenger's hidden proxies cover
  // for the fighters after them; their first use paid a while later, behind the duel
  const twins = twinProxies(fighters.values());
  if (slot) await slot();
  await compile(twins);
  // (and the first use of every program the duel's scene holds, its hidden effects' too: the ones only the visitor's play
  // draws, his aim, his telegraphs, were compiled here and first used in his join's frame)
  setTimeout(() => { void firstUse(twins).then(() => { twins.clear(); return firstUse(scene); }); }, 3000);
  progress(0.95);
  // the visitor's model: after the first set's own files (the duel never waits for it)
  loadLikeness();

  // ---- dev and tests: what the duel is doing (window.__impact, taken away with the game)
  rt.global('__impact', {
    state: () => {
      const s = ring?.snapshot;
      return s && { serverTime: +s.serverTime.toFixed(2), status: s.status, duel: s.duel, me, drawn: fighters.size,
        players: s.players.map(p => ({ id: p.id, fighter: p.fighter, bot: p.isBot, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), yaw: +p.yaw.toFixed(2), hp: Math.round(p.hp), action: p.action })) };
    },
    camera: () => ({ position: camera.position.toArray().map(v => +v.toFixed(2)), fov: camera.fov }),
    drawn: () => ({ ...drawn }),
    /** Tests: the visitor's model loaded, and worn by their fighter. */
    likeness: () => ({ loaded: !!likeness, worn: !!worn, fighter: worn?.fighter.state.fighter ?? null }),
    shadow: (opacity?: number) => {
      const m = catcher.material as THREE.ShadowMaterial;
      if (opacity !== undefined) m.opacity = opacity;
      return { map: !!sun.shadow.map, mapSize: sun.shadow.mapSize.x, cast: sun.castShadow, catcher: catcher.visible, opacity: m.opacity, sun: sun.position.toArray().map(v => +v.toFixed(2)),
        casters: (() => { let n = 0; scene.traverse(o => { if ((o as THREE.Mesh).isMesh && o.castShadow && o.visible) n++; }); return n; })() };
    },
    /** Tests (dude.work round 5): whether the ring is heard now (its sound decoded), by the world's lens. */
    heard: () => heard,
    /** Tests (dude.work round 8): the visitor's ultimate meter full (the cut-in), and the fighter glancing at him now. */
    charge: () => { const a = me ? ring?.sim.actors.get(me) : undefined; if (a) a.state.ultimate = 100; return !!a; },
    glance: () => glance && { id: glance.id, t: +glance.t.toFixed(2) },
    /** Tests (dude.work round 8, S14): bodies built only to be compiled, let go, and whose dispose() threw. */
    warms: () => ({ ...warms, onceDrawn, sparesDrawn }),
    /** Tests (dude.work round 8, G2): the visitor's casts since the page began (a touch button's attack is one). */
    casts: () => castsByMe,
    /** Tests: the set decided now (the first seat wins), so the next one comes round. */
    decide: () => { const r = ring; if (r && !r.decided) r.set.forfeit(r.sim, r.set.startedAt === null ? null : SEATS[0]); },
  });

  // ---- (dude.work round 5) the scene's instanced pools, looked for again every POOL_LOOK draws (effects come and go with
  // the sets); emptyPools() hides those drawn with nothing in them for the draw that follows (draw puts them back)
  const pools: THREE.InstancedMesh[] = [], idleNow: THREE.InstancedMesh[] = [];
  let poolDraws = 0;
  const emptyPools = (): THREE.InstancedMesh[] => {
    if (poolDraws++ % POOL_LOOK === 0) { pools.length = 0; scene.traverse(o => { if ((o as THREE.InstancedMesh).isInstancedMesh) pools.push(o as THREE.InstancedMesh); }); }
    idleNow.length = 0;
    for (const m of pools) if (m.visible && m.count === 0) { m.visible = false; idleNow.push(m); }
    return idleNow;
  };

  // ---- (dude.work round 5) can the ring be heard? The world's rule of round 2, judged from its lens, told every frame in
  // view or not (host.lens): within EAR_IN m of the ring the sound is decoded, beyond EAR_OUT let go (CombatAudio.setHeard:
  // some 50 MB of a pair's decoded voices, cues and lines, held for the page's life before wherever the visitor was), each
  // once the visitor has stayed near EAR_NEAR_MS or far EAR_FAR_MS (a flight over the ring decodes nothing for a moment);
  // playing, always heard. A world without the lens, or one whose frames have stopped (a hidden tab): as it was.
  // (by the nearer of the lens and the visitor: behind the title the lens flies round the island while the visitor waits at
  // the Overlook's rail, 80 m from the ring, where they arrive: the sound is decoded behind the title, as it always was,
  // not under the fly-in and the first look)
  let heard = true, wantHeard = true, wantAt = 0;
  const judgeEar = (now: number) => {
    const l = (host as unknown as { lens?: { distance: number; time: number; visitorDistance?: number } }).lens;
    if (!l || now - l.time > 2000) return;
    const d = Math.min(l.distance, l.visitorDistance ?? Infinity);
    const on = host.playing || d < EAR_IN ? true : d > EAR_OUT ? false : wantHeard;
    if (on !== wantHeard) { wantHeard = on; wantAt = now; }
    if (heard !== wantHeard && (host.playing || now - wantAt >= (wantHeard ? EAR_NEAR_MS : EAR_FAR_MS))) { heard = wantHeard; audio.setHeard(heard); }
  };
  const earTimer = setInterval(() => judgeEar(performance.now()), 1000);

  // ---- the frame
  return {
    court: {
      get matrix() { return courtMatrix; },
      bounds: RING_BOUNDS,
    },
    get camera() { return camera; },
    // (round 9) the film look's grade, as its site prints it (FILM_GRADE); the modern ART STYLE's is not declared
    grade: filmOn() ? FILM_GRADE : undefined,

    update(dt: number, now: number) {
      judgeEar(performance.now());
      if (uploads.length || uploadsDone) upload();
      // (round 9) the effects' hidden spares drawn once off stage as they come
      sweepSpares(performance.now());
      if (leaving.length) bury();
      Fighter.beginFrame(now);
      const rawDt = Math.max(0, dt), worldDt = Math.min(.05, rawDt);
      const r = ring;
      if (!r) return;
      // the visitor's controls
      input.enabled = !!me && host.playing;
      input.update(worldDt);
      // the sim: whole ticks of the world's time
      acc = Math.min(acc + rawDt, STEP * MOST_STEPS);
      while (acc >= STEP) {
        acc -= STEP;
        r.step(me, command());
        if (r.snapshot) arrived(r.snapshot);
      }
      // (round 9, tools only) probe('finish'): the visitor's rival down as each round of their set comes on
      if (finishing === epoch && me && r.sim.status === 'active' && r.set.view.phase === 'playing') {
        for (const p of r.snapshot?.players ?? []) if (p.id !== me && p.alive && !p.enemy) r.sim.damage(p.id, 1e6, me, 'probe');
      }
      // a decided set: its winner's moment, then the next set (the winner stays, the challenger steps in)
      if (r.decided) {
        // (round 9: the next set's two bodies made while this one's winner has his moment; the visitor's set's, once the world
        // has taken him out: leave)
        if (!decidedAt && !me) prepareBodies(nextPair(r));
        decidedAt ||= now;
        // (round 9: the visitor's own set plays its result moment out; the world takes them out, then the bots' next begins,
        // its bodies made ahead first: a couple of seconds more at most)
        const wait = (me ? BETWEEN + END_WAIT : BETWEEN) * 1000, next = now - decidedAt > wait ? nextPair(r) : null;
        if (next && (bodiesReady(next) || now - decidedAt > wait + 2500)) { begin(RingSet.open(next)); return; }
      } else if (r.set.startedAt !== null) {
        prepareChallenger();
        // (round 9) the visitor near: his set's bodies kept made ahead (a round's start takes them too, and they are made again)
        if (nearBy && !me && !bodiesReady(r.pair)) prepareBodies(r.pair);
        // the death ragdolls' physics (Rapier's wasm, render/Ragdoll.ts), off the first load: once the first bell has rung
        if (!ragdolls) { ragdolls = true; void import('../render/Ragdoll').then(m => m.prepareRagdolls()).catch(error => console.warn('Impact live: ragdolls unavailable', error)); }
      }
      // (dude.work round 8, S14) a duel too small to see (under TINY_PX pixels a metre in every picture since the last
      // frame) is drawn as it stands TINY_HZ times a second: its bodies' poses and effects step then, with the time gathered
      // since; its sim, its rounds and its sets run every frame as ever, and its events wait in the timeline for the next
      // step (none is lost). Played, seen any bigger, or run out of view near the visitor (who may turn round, and hears
      // it), it steps every frame.
      const small = TINY_ON && !me && performance.now() - seenAt < 500 && seenPx < TINY_PX;
      seenPx = 0;
      stepAcc += rawDt;
      if (small && stepAcc < 1 / TINY_HZ) return;
      const stepDt = Math.min(.1, stepAcc);
      stepAcc = 0; stepped = true;
      const pdt = small ? stepDt : worldDt, prd = small ? stepDt : rawDt;
      // the frame drawn: one tick behind the newest (main.ts's local clock)
      const newest = timeline.newest ?? 0;
      localClock = Math.min(newest, Math.max(newest - 3 / 60, localClock + prd));
      const presented = timeline.at(localClock - LOCAL_DELAY / 1000);
      const snapshot = presentSnapshot(presented?.snapshot);
      if (!snapshot) return;
      const serverTime = presented!.time;
      applyCombatFrame(snapshot);
      if (me) duelCommentary(snapshot);
      cinematics(snapshot);
      rounds(snapshot);
      cutIns(snapshot);
      const view = lensOf();
      viewProjection.multiplyMatrices(view.projectionMatrix, view.matrixWorldInverse);
      frustum.setFromProjectionMatrix(viewProjection);
      let self: PlayerState | undefined;
      for (const p of snapshot.players) {
        const fighter = fighters.get(p.id);
        if (p.enemy || !fighter) continue;
        const opponent = snapshot.players.find(o => o.id === (p.id === me ? targetId : p.target)) ?? snapshot.players.find(o => o.id !== p.id);
        fighter.targetDistance = opponent ? Math.hypot(opponent.x - p.x, opponent.z - p.z) : Infinity;
        fighter.targetPoint = opponent ? (fighter.targetPoint ?? new THREE.Vector3()).set(opponent.x, opponent.y + 1.45, opponent.z) : undefined;
        const looksAt = glancePoint(p.id, p);
        if (looksAt) fighter.targetPoint = (fighter.targetPoint ?? new THREE.Vector3()).copy(looksAt);
        fighter.cameraPoint = view.position;
        fighter.unseen = p.id !== me && p.id !== targetId && !fighter.inView(frustum, view.position);
        fighter.update(pdt, p, true, prd);
        if (glance?.id === p.id) nod(fighter, pdt);
        if (p.id === me) self = p;
      }
      shownSelf = self;
      // the visitor's body takes the pose of the fighter they play (after every layer of its own)
      worn?.pose(pdt);
      for (const [id, body] of fighters) {
        if (!body.steps.length) continue;
        const mine = id === me;
        for (const step of body.steps) { audio.step(step, step.speed, mine); effects.footstep(step, serverTime); }
        body.steps.length = 0;
      }
      effects.localId = me ?? '';
      SIGNATURE.localId = me ?? '';
      const shown = presentFighters(fighters);
      const fx = areaFx.handle(snapshot.events, me ?? '', snapshot.players, event => effects.handleAuthoredAreas([event], shown));
      effects.handle(fx, shown);
      castFx?.handle(fx, shown);
      awakeningEffects.handle(fx, fighters);
      clashEffects.handle(fx);
      // the visitor's camera, aim and HUD
      if (me && self) {
        const own = fighters.get(self.id);
        if (own) {
          aim(snapshot, self, own, rawDt);
          const move = areaMoveOf(self), lock = targetId ? snapshot.players.find(p => p.id === targetId && p.alive) : undefined;
          input.aim.follow(self, input.yaw, lock, move.range, move.radius, areaReady(self, snapshot.serverTime));
          const target = snapshot.players.find(p => p.id === targetId);
          if (now - lastHud > 70) { hud.update(snapshot, self, target); lastHud = now; }
          touch?.meters(self, snapshot.serverTime, undefined, snapshot.players);
          if (target) {
            const drawn = fighters.get(target.id);
            if (drawn) drawn.visualCenter(marker); else marker.set(target.x, target.y + 1.1, target.z);
            marker.y += .65 * (target.size ?? 1);
            marker.project(camera);
            const locked = targeting.locked;
            hud.targetMarker(0, 0, locked || Math.hypot(target.x - self.x, target.z - self.z) > 3.3, locked, { id: target.id, name: target.name, bot: target.isBot, fighter: target.fighter, hp: target.hp / target.maxHp, distance: Math.hypot(target.x - self.x, target.y - self.y, target.z - self.z), body: drawn, threatBody: drawn as never, camera } as never, performance.now() / 1000 < markerHoldUntil ? .35 : 1);
          } else hud.targetMarker(0, 0, false);
        }
      } else input.aim.cancel();
      areaFx.update(serverTime, me ? input.aim.view : undefined, self, () => 0);
      const steady = steadyBodies(shown);
      effects.update(serverTime, pdt, steady);
      awakeningEffects.update(serverTime, pdt, fighters, settings.effects, view);
      castFx?.update(serverTime, pdt, steady, settings.effects, view);
      strikeTrails.update(pdt, steady, view);
      clashEffects.update(serverTime, view, settings.effects);
      if (me) { hud.tick(); damageNumbers.update(camera); manga.update(camera); }
      touch?.update(input.enabled, true);
      letterbox.set(me ? followCam.cuts.bars : 0);
      // the drawn bodies' bones once a draw (skeletonOnce's rule, on these bodies alone)
    },

    draw(view: LiveView) {
      // the world's lens, for the next frame's effects and bodies (sprites face it; unseen bodies rest)
      lens.position.copy(view.camera.position); lens.quaternion.copy(view.camera.quaternion);
      lens.projectionMatrix.copy(view.camera.projectionMatrix); lens.projectionMatrixInverse.copy(view.camera.projectionMatrixInverse);
      lens.fov = view.camera.fov; lens.aspect = view.camera.aspect; lens.near = view.camera.near; lens.far = view.camera.far;
      lens.updateMatrixWorld();
      // the world's light: the fighters lit as the ring round them is (never darker than a floodlit night bout)
      const day = view.daylight, k = .45 + .55 * day;
      sun.intensity = look.key.intensity * (.4 + .6 * day);
      hemi.intensity = look.hemi.intensity * k;
      fill.intensity = look.fill.intensity * (1 + (1 - day) * 1.5);
      const dir = view.sunDir.lengthSq() > .01 ? view.sunDir : keyDir;
      sun.position.copy(dir).normalize().multiplyScalar(40);
      sun.target.position.set(0, 0, 0);
      const fog = scene.fog, shadow = gl.shadowMap.enabled, info = gl.info.render, calls = info.calls, tris = info.triangles;
      // (S14) how big the duel is in this picture (a world older than the hint: big); while it is tiny its shadow map is
      // drawn again only once its bodies have stepped (a map the world already holds still stays still)
      const px = view.pxPerMetre ?? Infinity;
      seenPx = Math.max(seenPx, px); seenAt = performance.now();
      const auto = gl.shadowMap.autoUpdate, needs = gl.shadowMap.needsUpdate;
      if (TINY_ON && !me && px < TINY_PX && auto) { gl.shadowMap.autoUpdate = false; gl.shadowMap.needsUpdate = stepped; }
      stepped = false;
      scene.fog = view.fog;
      gl.shadowMap.enabled = shadow && shadows;
      // (dude.work round 8) the visitor's programs for this kind of picture, built from here, as it will draw him
      if (likenessWarm && !me) {
        const kind = view.fog ? 'fog' : 'plain', warm = likenessWarm;
        if (!warm.built.has(kind)) { warm.built.add(kind); void Promise.resolve(gl.compileAsync(warm.only, view.camera, scene)).then(() => firstUse(warm.only)).catch(() => undefined); }
      }
      // (dude.work round 5) the effects' pools with nothing in them left out of the draw: an InstancedMesh at count 0 (the
      // debris, steam, flames, auras, sparks and cores at rest, some twenty) draws nothing, but three still binds its program
      // and uniforms and issues a draw of no instances for each, every frame the ring is in view, the Overlook's and the
      // title's included; each one's own visibility is put back after the draw, so nothing else sees the change
      const idle = emptyPools();
      try { gl.render(scene, view.camera); }
      finally {
        for (const m of idle) m.visible = true;
        scene.fog = fog; gl.shadowMap.enabled = shadow; gl.shadowMap.autoUpdate = auto; gl.shadowMap.needsUpdate = needs;
        // (what this draw cost, for the tests: three counts on unless the page resets it per render)
        drawn.calls = gl.info.autoReset ? info.calls : info.calls - calls; drawn.tris = gl.info.autoReset ? info.triangles : info.triangles - tris;
      }
    },

    join(at: THREE.Vector3, _yaw: number) {
      const r = ring;
      if (!r || !r.snapshot || !fighters.size) return false;
      // (dude.work round 9) a set of their own: the two fighters in the ring, both whole, the rounds at nought, from the
      // set's own start (its round intro, then the first bell and FIGHT!); the bots' set in progress is let go. They take
      // the seat whose mark is nearest where they stepped on (the new set stands both fighters on their marks).
      const fresh = RingSet.open(r.pair), s = fresh.snapshot;
      let best: PlayerState | undefined, bd = Infinity;
      for (const p of s?.players ?? []) { const d = Math.hypot(p.x - at.x, p.z - at.z); if (d < bd) { bd = d; best = p; } }
      if (!s || !best) { fresh.dispose(); return false; }
      me = best.id;
      nearBy = false;
      begin(fresh);
      input.clear();
      input.enabled = true;
      // (dude.work round 8, G8) the mouse looks once the pointer is locked: asked for now while the visitor's key still
      // counts as his say-so (he walked in; Chrome gives it then), else at his first click on the picture, which asks for
      // it and does nothing else (Input's own rule); until then O and [ turn the view and the duel's lock holds his rival
      input.lockRefused = false;
      const activation = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation;
      if (!host.touch && activation?.isActive && document.pointerLockElement !== host.canvas && typeof host.canvas.requestPointerLock === 'function') {
        try { void Promise.resolve(host.canvas.requestPointerLock()).catch(() => undefined); } catch { /* a click will ask */ }
      }
      targeting.reset(); autoLock.reset(); targetId = null;
      input.yaw = best.yaw; input.pitch = .02;
      followCam.reset();
      followCam.lookAlong(best.yaw);
      followCam.camera.aspect = innerWidth / innerHeight; followCam.camera.updateProjectionMatrix();
      // the camera behind them now, so the world's glide into it starts from where it will be
      const own = fighters.get(best.id);
      if (own) aim(s, best, own, 1 / 60);
      hud.enter(best.fighter);
      // the fighter becomes the visitor, under the world's burst: their body (once their model is in) and their plate
      hud.likeness = visitor ? { name: visitor.name, portrait: visitor.pictures.portrait } : null;
      wearMine();
      void audio.unlock().catch(() => undefined);
      return true;
    },

    leave() {
      const r = ring, s = r?.snapshot, p = me ? s?.players.find(q => q.id === me) : undefined;
      const out = { at: new THREE.Vector3(p?.x ?? 0, 0, p?.z ?? 0), yaw: p?.yaw ?? 0 };
      if (me) r?.seat(me, false);
      me = null;
      // (round 9) his set decided: the bots' next set's bodies made now, while he glides out (update waits for them)
      if (r?.decided) prepareBodies(nextPair(r));
      // the bot plays its own fighter again: its own body, its own plate
      unwear();
      hud.likeness = null;
      input.enabled = false; input.clear(); input.aim.cancel();
      // (the touch controls put away at once: a touch on the world is the world's again)
      touch?.update(false, true);
      targeting.reset(); targetId = null;
      cutIn.hide(); vsSplash.skip(); letterbox.set(0); hud.leave(); manga.reset();
      effects.localId = ''; SIGNATURE.localId = '';
      return out;
    },

    you() {
      const p = me ? ring?.snapshot?.players.find(q => q.id === me) : undefined;
      return p ? new THREE.Vector3(p.x, p.y, p.z) : null;
    },

    notice(at: THREE.Vector3 | null) { noticed(at); },

    probe(what: string) {
      if (what === 'finish') { if (!me) return null; finishing = epoch; return 'finishing'; }
      if (what === 'state') { const d = ring?.snapshot?.duel; return { me, epoch, status: ring?.sim.status, phase: d?.phase ?? null, round: d?.round ?? null, scores: d?.scores ?? null, decided: !!ring?.decided, finaleLine: finaleLine ?? null }; }
      return null;
    },

    resize(w: number, h: number) {
      camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
      setToonResolution(h * Math.min(2, devicePixelRatio || 1));
    },

    status() {
      const s = ring?.snapshot, duel = s?.duel;
      if (!s) return null;
      const side = (id: string) => {
        const p = s.players.find(q => q.id === id), f = p ? FIGHTERS[p.fighter] : undefined;
        return { name: id === me && visitor ? visitor.name : f?.name ?? '', score: duel?.scores[id] ?? 0, color: f?.color ?? '#ffffff' };
      };
      const line = !duel ? 'DUEL' : duel.phase === 'complete' ? 'FINAL' : duel.phase === 'interval' ? `ROUND ${duel.round} · GET READY` : `ROUND ${duel.round} · FIRST TO TWO`;
      return { sides: [side(SEATS[0]), side(SEATS[1])], line };
    },

    dispose() {
      gone = true;
      cutoutsWaitFor(null);
      clearInterval(earTimer);
      ring?.dispose(); ring = null;
      clearFighters(); bury(true);
      // (round 9: bodies made ahead and not taken)
      preparing = '';
      for (const body of made.values()) letGo(body, body.bodyFighter as FighterId);
      made.clear();
      worn?.remove(); worn = null; likeness = null;
      likenessWarm?.copy.free(); likenessWarm = null;
      if (keptWarm) { letGo(keptWarm.body, keptWarm.id); keptWarm = null; }
      for (const each of [effects, castFx, awakeningEffects, clashEffects, areaFx]) { try { each?.dispose(); } catch (error) { console.warn('Impact live: dispose', error); } }
      try { audio.dispose(); } catch { /* gone */ }
      cutIn.hide(); hud.dispose(); manga.dispose?.();
      catcher.geometry.dispose(); (catcher.material as THREE.Material).dispose();
      sun.shadow.map?.dispose();
      scene.clear();
    },
  };
}
