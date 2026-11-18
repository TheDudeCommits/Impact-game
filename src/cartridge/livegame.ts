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
import type { LiveCourt, LiveHost, LiveStatus, LiveView } from './live-contract';
import { rt } from './runtime';
import { RING, RING_BOUNDS, RingCollision, registerRing } from './liveRing';
import { LiveHud } from './liveHud';
import { FIGHTERS, loadSettings, type Settings } from '../config';
import { ArenaSimulation } from '../game/simulation';
import { DuelSet } from '../game/duel/DuelSet';
import { COMBO_HP, COMBO_STAMINA, MOVES, SIMULATION_HZ, BIG_HITSTOP } from '../game/moves';
import { STAGES } from '../game/stages';
import type { CombatEvent, FighterId, GameSnapshot, PlayerInput, PlayerState } from '../game/types';
import { keptSkill } from '../boot/skill';
import { Targeting } from '../game/Targeting';
import { AutoLock } from '../game/autoLock';
import { rushMove, moveFor, AWAKENINGS } from '../game/awakening';
import { FighterLibrary, Fighter } from '../render/Fighter';
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
import { lookFor } from '../render/look/stageLooks';
import { skinnedBoundsOn } from '../render/skinnedBounds';
import { ViewKeys, movementMask } from '../render/viewKeys';
import { borrowedEvent, effectDonors, installTransplant, presentEvents, presentFighters, presentPlayers, presentSnapshot, slotNames, steadyBodies } from '../engine/client/transplant';
import { installBorrowedHurts } from '../engine/client/borrowedHurts';
import { installStyleMoves, stylesReady } from '../engine/client/styleMoves';
import { CombatAudio } from '../audio/CombatAudio';
import { HOME_VOICES } from '../audio/HomeVoice';
import { UI_SFX } from '../originals/sfx';
import { displayMove } from '../originals/apply';
import { Input } from '../input';
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
/** Seconds from a set's first frame to its first bell (LocalDuel waits 3; there is no VS screen to cover here). */
const INTRO = 2;
/** Seconds a decided set holds its winner's pose before the next one starts. */
const BETWEEN = 5;
/** Most sim ticks one frame may run (a hitch is caught up over the next frames, not in one burst). */
const MOST_STEPS = 6;
const FIGHT_LINE = '/assets/audio/survival/announcer-fight.m4a';
const VICTORY_LINE = '/assets/audio/survival/announcer-victory.m4a', FLAWLESS_LINE = '/assets/audio/survival/announcer-flawless.m4a';
/** main.ts: how long after an exchange of blows the chase camera's combo shot holds. */
const LOCK_EXCHANGE_MS = 1100;
const REJECTIONS: Record<string, string> = { cooldown: 'NOT READY', stamina: 'NO STAMINA', 'ultimate-meter': 'ULTIMATE NOT CHARGED' };

export interface Running {
  readonly court: LiveCourt;
  readonly camera: THREE.PerspectiveCamera;
  update(dt: number, now: number): void;
  draw(view: LiveView): void;
  join(at: THREE.Vector3, yaw: number): boolean;
  leave(): { at: THREE.Vector3; yaw: number };
  you(): THREE.Vector3 | null;
  resize(w: number, h: number): void;
  status(): LiveStatus | null;
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
  get decided() { return this.set.view.phase === 'complete'; }
  dispose() { this.sim.dispose(); }
}

/** The renderer stays the world's: the effects' calls on the game's own frame (impact frames, speed lines, the
 *  technique grade) belong to its post stack, which the world's film pipeline stands in for here. */
const NO_SCREEN = undefined;

export async function boot(host: LiveHost, root: HTMLElement, progress: (f: number) => void): Promise<Running> {
  registerRing();
  const settings: Settings = loadSettings();
  // The world's quality is the machine's (render/qualityTier.ts reads the host's): effects and shadows follow it.
  settings.quality = host.quality === 'high' ? 'high' : host.quality === 'mid' ? 'medium' : 'low';
  setVfxLevel(settings.vfx);
  const gl = host.renderer;

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
    opacity: 0.32, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
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
  const effects = new CombatEffects(scene);
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
  const hud = new LiveHud(root, settings);
  const damageNumbers = new DamageNumbers(root), manga = new MangaImpact(root);
  const cutIn = new CutIn(hud.root);
  cutIn.onShow = () => audio.ui(UI_SFX.cutIn, 0.4);
  // the FIGHT card at each bell, and the finisher's cinema bars (the visitor's alone, as host.ui is)
  const vsSplash = new VsSplash(hud.root), letterbox = new Letterbox(root);
  vsSplash.onBeat = beat => {
    if (beat === 'fight') { audio.ui(UI_SFX.fight, .55, .05); audio.announce(FIGHT_LINE, .95, .08); audio.bell(); }
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

  function clearFighters() { for (const body of fighters.values()) body.dispose(); fighters.clear(); }
  function clearFlights() {
    audio.reset(); areaFx.reset(); effects.reset(); castFx?.reset(); awakeningEffects.reset(); clashEffects.reset(); manga.reset();
  }
  function bodiesFor(snapshot: GameSnapshot) {
    for (const p of snapshot.players) {
      if (p.enemy || !library.has(p.fighter)) continue;
      const have = fighters.get(p.id);
      if (have && have.bodyFighter !== p.fighter) { have.dispose(); fighters.delete(p.id); }
      if (!fighters.has(p.id)) {
        const fighter = library.create(p);
        skinnedBoundsOn(fighter.group);
        fighters.set(p.id, fighter);
        scene.add(fighter.group);
      }
    }
    for (const [id, fighter] of fighters) if (!snapshot.players.some(p => p.id === id && !p.enemy)) { fighter.dispose(); fighters.delete(id); }
  }

  /** The materials of what the scene holds, compiled for the world's picture (a colour target, no tone mapping, the
   *  world's kind of fog), off the frame (KHR_parallel_shader_compile) - so the first frame the visitor sees the duel
   *  has nothing left to build. */
  async function compile() {
    const rt0 = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true });
    const was = gl.getRenderTarget(), fog = scene.fog, shadow = gl.shadowMap.enabled;
    try {
      rt.within(() => {
        gl.setRenderTarget(rt0);
        scene.fog = new THREE.Fog(0xd6e9f8, 160, 1150);
        gl.shadowMap.enabled = shadow && shadows;
      });
      await rt.within(() => gl.compileAsync(scene, lens, scene)).catch(() => undefined);
    } finally {
      scene.fog = fog; gl.shadowMap.enabled = shadow; gl.setRenderTarget(was); rt0.dispose();
    }
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
    void loaded([chosen]).then(() => { if (challenger === chosen) challengerReady = true; })
      .catch(error => { console.warn('Impact live: the next fighter did not load', chosen, error); if (challenger === chosen) challenger = null; });
  }
  /** The pair after a decided set: the winner stays in their seat (the visitor's fighter, if they play, stays in
   *  theirs), and the challenger takes the other. */
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
    acc = 0; localClock = next.snapshot?.serverTime ?? 0; lastEvent = 0; duelRoundKey = ''; introFor = null; victoryFor = null; decidedAt = 0;
    timeline.reset(); clearFlights(); clearFighters(); cutInSeen.clear(); hud.resetEvents();
    targeting.reset(); autoLock.reset(); targetId = null;
    if (me) next.seat(me, true);
    if (next.snapshot) { timeline.push(next.snapshot, performance.now()); bodiesFor(next.snapshot); }
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
    void BIG_HITSTOP;
  };
  const blowHeading = (event: CombatEvent) => event.origin && event.endpoint ? new THREE.Vector3(event.endpoint.x - event.origin.x, 0, event.endpoint.z - event.origin.z) : undefined;
  const notify = (id: string | undefined, text: string, duration: number) => { if (id && id === me) hud.notify(text, duration); };

  /** A snapshot as it arrives (main.ts onSnapshot, the duel's part). */
  function arrived(snapshot: GameSnapshot) {
    const duelKey = snapshot.duel ? `${snapshot.duel.set}:${snapshot.duel.round}` : '';
    if (snapshot.duel?.phase === 'playing' && snapshot.status === 'active' && duelKey !== duelRoundKey) {
      if (duelRoundKey) clearFighters();
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
        if (me && !mine) audio.lossLine(.8 + (own ?? 0) + .4);
        if (me) followCam.victory(winner, 6);
        const self = snapshot.players.find(p => p.id === me);
        if (mine && self && snapshot.duel?.phase === 'complete') audio.announce(self.damageTaken ? VICTORY_LINE : FLAWLESS_LINE, .95, .55);
      }
    }
    if (snapshot.status !== 'finished') victoryFor = null;
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
      cutIn.show(p.fighter, displayMove(p.fighter, awakening ? AWAKENINGS[p.fighter].name : slotNames(p, 'ultimate')?.name ?? moveFor(p.fighter, 'ultimate', !!p.awakened).name), side, avoid);
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
  begin(RingSet.open(first));
  // warm: one body of each fighter, its effects' shared meshes, compiled before the first frame shows them
  rt.within(() => { awakeningEffects.warmup(); clashEffects.warmup(); });
  lens.position.set(0, 6, 16); lens.lookAt(0, 1, 0); lens.updateMatrixWorld();
  await compile();
  awakeningEffects.hideWarmup(); clashEffects.hideWarmup();
  progress(0.95);

  // ---- dev and tests: what the duel is doing (window.__impact, taken away with the game)
  rt.global('__impact', {
    state: () => {
      const s = ring?.snapshot;
      return s && { serverTime: +s.serverTime.toFixed(2), status: s.status, duel: s.duel, me, drawn: fighters.size,
        players: s.players.map(p => ({ id: p.id, fighter: p.fighter, bot: p.isBot, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), yaw: +p.yaw.toFixed(2), hp: Math.round(p.hp), action: p.action })) };
    },
    camera: () => ({ position: camera.position.toArray().map(v => +v.toFixed(2)), fov: camera.fov }),
    drawn: () => ({ ...drawn }),
    /** Tests: the set decided now (the first seat wins), so the next one comes round. */
    decide: () => { const r = ring; if (r && !r.decided) r.set.forfeit(r.sim, r.set.startedAt === null ? null : SEATS[0]); },
  });

  // ---- the frame
  const steadyCache = { shown: fighters };
  return {
    court: {
      get matrix() { return courtMatrix; },
      bounds: RING_BOUNDS,
    },
    get camera() { return camera; },

    update(dt: number, now: number) {
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
      // a decided set: its winner's moment, then the next set (the winner stays, the challenger steps in)
      if (r.decided) {
        decidedAt ||= now;
        if (now - decidedAt > BETWEEN * 1000) { begin(RingSet.open(pairAfter(r))); return; }
      } else if (r.set.startedAt !== null) {
        prepareChallenger();
        // the death ragdolls' physics (Rapier's wasm, render/Ragdoll.ts), off the first load: once the first bell has rung
        if (!ragdolls) { ragdolls = true; void import('../render/Ragdoll').then(m => m.prepareRagdolls()).catch(error => console.warn('Impact live: ragdolls unavailable', error)); }
      }
      // the frame drawn: one tick behind the newest (main.ts's local clock)
      const newest = timeline.newest ?? 0;
      localClock = Math.min(newest, Math.max(newest - 3 / 60, localClock + rawDt));
      const presented = timeline.at(localClock - LOCAL_DELAY / 1000);
      const snapshot = presentSnapshot(presented?.snapshot);
      if (!snapshot) return;
      const serverTime = presented!.time;
      applyCombatFrame(snapshot);
      cinematics(snapshot);
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
        fighter.cameraPoint = view.position;
        fighter.unseen = p.id !== me && p.id !== targetId && !fighter.inView(frustum, view.position);
        fighter.update(worldDt, p, true, rawDt);
        if (p.id === me) self = p;
      }
      shownSelf = self;
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
      void steadyCache;
      effects.update(serverTime, worldDt, steady);
      awakeningEffects.update(serverTime, worldDt, fighters, settings.effects, view);
      castFx?.update(serverTime, worldDt, steady, settings.effects, view);
      strikeTrails.update(worldDt, steady, view);
      clashEffects.update(serverTime, view, settings.effects);
      if (me) { hud.tick(); damageNumbers.update(camera); manga.update(camera); }
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
      scene.fog = view.fog;
      gl.shadowMap.enabled = shadow && shadows;
      try { gl.render(scene, view.camera); }
      finally {
        scene.fog = fog; gl.shadowMap.enabled = shadow;
        // (what this draw cost, for the tests: three counts on unless the page resets it per render)
        drawn.calls = gl.info.autoReset ? info.calls : info.calls - calls; drawn.tris = gl.info.autoReset ? info.triangles : info.triangles - tris;
      }
    },

    join(at: THREE.Vector3, _yaw: number) {
      const r = ring, s = r?.snapshot;
      if (!r || !s || !fighters.size) return false;
      let best: PlayerState | undefined, bd = Infinity;
      for (const p of s.players) { const d = Math.hypot(p.x - at.x, p.z - at.z); if (d < bd) { bd = d; best = p; } }
      if (!best) return false;
      me = best.id;
      r.seat(me, true);
      input.clear();
      input.enabled = true;
      targeting.reset(); autoLock.reset(); targetId = null;
      input.yaw = best.yaw; input.pitch = .02;
      followCam.reset();
      followCam.lookAlong(best.yaw);
      followCam.camera.aspect = innerWidth / innerHeight; followCam.camera.updateProjectionMatrix();
      // the camera behind them now, so the world's glide into it starts from where it will be
      const own = fighters.get(best.id);
      if (own) aim(s, best, own, 1 / 60);
      hud.enter(best.fighter);
      void audio.unlock().catch(() => undefined);
      return true;
    },

    leave() {
      const r = ring, s = r?.snapshot, p = me ? s?.players.find(q => q.id === me) : undefined;
      const out = { at: new THREE.Vector3(p?.x ?? 0, 0, p?.z ?? 0), yaw: p?.yaw ?? 0 };
      if (me) r?.seat(me, false);
      me = null;
      input.enabled = false; input.clear(); input.aim.cancel();
      targeting.reset(); targetId = null;
      cutIn.hide(); vsSplash.skip(); letterbox.set(0); hud.leave(); manga.reset();
      effects.localId = ''; SIGNATURE.localId = '';
      return out;
    },

    you() {
      const p = me ? ring?.snapshot?.players.find(q => q.id === me) : undefined;
      return p ? new THREE.Vector3(p.x, p.y, p.z) : null;
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
        return { name: f?.name ?? '', score: duel?.scores[id] ?? 0, color: f?.color ?? '#ffffff' };
      };
      const line = !duel ? 'DUEL' : duel.phase === 'complete' ? 'FINAL' : duel.phase === 'interval' ? `ROUND ${duel.round} · GET READY` : `ROUND ${duel.round} · FIRST TO TWO`;
      return { sides: [side(SEATS[0]), side(SEATS[1])], line };
    },

    dispose() {
      ring?.dispose(); ring = null;
      clearFighters();
      for (const each of [effects, castFx, awakeningEffects, clashEffects, areaFx]) { try { each?.dispose(); } catch (error) { console.warn('Impact live: dispose', error); } }
      try { audio.dispose(); } catch { /* gone */ }
      cutIn.hide(); hud.dispose(); manga.dispose?.();
      catcher.geometry.dispose(); (catcher.material as THREE.Material).dispose();
      sun.shadow.map?.dispose();
      scene.clear();
      void effectDonors;
    },
  };
}
