import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Fighter} from '../Fighter';
import {findClipIn} from '../clipMatch';
import {retarget, rigOf, type Rig} from '../../engine/client/retarget';
import type {Transplanted} from '../../engine/client/transplantTakes';
import type {MoveDefinition} from '../../game/moves';
import type {AttackSlot, FighterId, PlayerState} from '../../game/types';
import type {BodyType} from '../../engine/sim/archetypes';
import type {Canonical} from '../skeleton';
import {styleOf} from '../../game/techniques';
import {FIGHTERS} from '../../config';
import {BALL_SPORT, GOAL_RULES, SPIKE_RULES, ballRadius, otherTeam, type BallView} from '../../game/ball/model';
import {goalZ} from '../../game/ball/physics';
import {chooseBallMove, type BallMoveAsk, type BallMoveKey} from './ballMoveChoice';
import {ownStrike} from './ownShot';

/** Ball modes, sports moves (a first version of dedicated sports animations). A swing in a ball match is drawn with a
 *  sports take - a pass, a header, a dig, a spike - instead of the fighter's own attack, where the take reads better
 *  than the blow.
 *
 *  - **One shared file**, public/assets/fighters/ball-moves.glb (hand-posed takes, and cuts of two of techniques.glb's
 *    kicks, each with its contact and its provenance in its extras), on a stub skeleton, fetched the first
 *    time a ball match is loaded (every ball match, for SHOOT's quick strike below; 274 KB, about 120 KB gzipped) -
 *    never by any other page - and fitted to each body that throws a take by the game's own retarget
 *    (engine/client/retarget.ts), once per rig and take. No fighter's file changes.
 *  - **In place**: the game moves the body; a take's own travel along the floor is held to a step.
 *  - **On the simulation's contact**: each fitted take is retimed so the frame where it meets the ball lands on the move's
 *    contact (the move this body throws: Fighter.movePlayed), and is then played straight through on the move's clock.
 *  - **Through the transplant's hook** (Fighter.transplant): a body's swing is handed the take as a borrowed move is, the
 *    hook installed before it asked first. Nothing else in the renderer changes.
 *  - **Off unless asked for**: only with `?ballmoves` in the address (`ballMovesWanted`), on any host, so the game as
 *    played is untouched.
 *  - **But SHOOT's quick strike, always** (model.ts SHOOT, PlayerState.strike 'tap'): the one blow every fighter shares
 *    has no clip of anyone's, so it is drawn with a take on every page - a kick on the floor, a volley or a spike in the
 *    air - its contact on the quick strike's own (the take's fastest frame is within 40 ms of the simulation's
 *    contact). Where no take serves (the file still coming, a rig the fit refused, a ball too high to kick in Sky Spike)
 *    the fighter's own heavy is drawn instead, time-fitted so its blow lands there too (`ownQuick`). A key held on turns
 *    the swing into the fighter's own move (PlayerState.strike 'charge'), which is their own clip again.
 *
 *  Which take a swing is drawn with is ballMoveChoice.ts's to say. A take that looks worse than the fighter's own attack
 *  is switched off in BALL_MOVES (`on: false`). */
export const BALL_MOVES_FILE = '/assets/fighters/ball-moves.glb';

/** Each take's switch, and how it is fitted: `back` how much of the take's bend and turn of the back the body takes on
 *  its own stance (retarget.ts ownBack), `travel` how far it may carry the body along the floor (hip heights), and
 *  `armed` how much of the take's arm swing a body holding a blade or a polearm keeps (a kick's or a header's arms are
 *  balance, and swung by a fighter carrying a cleaver they flail it through a slash: gaunt, filmed). Judged from the
 *  gameplay camera against the fighters' own attacks. */
export interface BallMoveRow {on: boolean; take: string; back: number; travel: number; armed?: number}
export const BALL_MOVES: Readonly<Record<BallMoveKey, BallMoveRow>> = {
  'GR.pass': {on: true, take: 'GR.pass', back: .8, travel: .12, armed: .3},
  'GR.power': {on: true, take: 'GR.power', back: .85, travel: .2, armed: .4},
  'GR.volley': {on: true, take: 'GR.volley', back: .85, travel: .15, armed: .4},
  'GR.head': {on: true, take: 'GR.head', back: 1, travel: .1, armed: .3},
  'GR.headAir': {on: true, take: 'GR.headAir', back: 1, travel: .1, armed: .3},
  'GR.keeper': {on: true, take: 'GR.keeper', back: .9, travel: .1},
  'SS.dig': {on: true, take: 'SS.dig', back: .9, travel: .1},
  'SS.set': {on: true, take: 'SS.set', back: .9, travel: .1},
  'SS.setAir': {on: true, take: 'SS.setAir', back: .9, travel: .1},
  'SS.spike': {on: true, take: 'SS.spike', back: 1, travel: .1},
  'SS.wall': {on: true, take: 'SS.wall', back: .9, travel: .05},
};

/** `?ballmoves` in the address, on any host: the only way the path is switched on (main.ts). */
export function ballMovesWanted(location?: {hostname: string; search: string}): boolean {
  if (!location) return false;
  return new URLSearchParams(location.search).has('ballmoves');
}

/** What the hook reads of the match on the page: the room's ball view and where the ball is drawn now. */
export interface BallMoveContext {view: BallView; ball?: THREE.Vector3 | null}

interface Take {clip: THREE.AnimationClip; contact: number; level: boolean; held: boolean}
interface Pack {rig: Rig; takes: Map<string, Take>}
let load: () => Promise<Pack> = async () => readPack(await new GLTFLoader().loadAsync(BALL_MOVES_FILE));
/** The file read: its rig (against `Stance`) and its takes, each with what its extras say. */
export function readPack(file: {scene: THREE.Object3D; animations: THREE.AnimationClip[]}): Pack {
  const stance = file.animations.find(c => c.name === 'Stance');
  const takes = new Map<string, Take>();
  for (const clip of file.animations) {
    const extras = clip.userData as {contact?: number; level?: boolean; held?: boolean};
    takes.set(clip.name, {clip, contact: THREE.MathUtils.clamp(extras.contact ?? .5, .05, .95), level: !!extras.level, held: !!extras.held});
  }
  return {rig: rigOf(file.scene, stance), takes};
}
let pack: Pack | null | undefined;
let fetching: Promise<Pack | undefined> | undefined;
function fetchPack() {
  fetching ??= load().then(found => { pack = found; return found; }, error => {
    console.info(`Ball moves: the takes are unavailable (${(error as Error).message}); every swing keeps its own clip.`);
    pack = null; return undefined;
  });
  return fetching;
}
/** Resolves once the takes are in (or known to be missing): main.ts waits on it beside a ball room's other files.
 *  (Without `?ballmoves` the takes are only SHOOT's quick strike's, which draws the fighter's own heavy
 *  until they come - ownQuick - so a slow file holds a ball room's loading for READY_WAIT at the most, never for good.) */
export function ballMovesReady(): Promise<unknown> {
  if (!installed) return Promise.resolve();
  const ready = fetchPack().catch(() => undefined);
  return everything ? ready : Promise.race([ready, new Promise(done => setTimeout(done, READY_WAIT))]);
}
/** How long a ball room's loading waits on the takes for SHOOT's quick strike alone, ms. */
export const READY_WAIT = 4000;

/** A body's reference for fitting: its idle as it stands in the game (as styleMoves.ts reads one). */
const REFERENCE = ['_Idle', 'Idle', 'taisei-ready', '02-STANCE', 'stance', 'idle'];
/** Each rig's fitted takes, by take (null: refused), and each fitted take retimed to a contact (by hundredths). */
let fits = new WeakMap<THREE.Object3D, Map<string, THREE.AnimationClip | null>>();
let timed = new WeakMap<THREE.AnimationClip, Map<string, THREE.AnimationClip>>();
const report = new Map<string, {ok: boolean; reason?: string; stray?: number; ms: number}>();
/** The last swings' choices (page time, body, action, take or null), for the probes (window.ballMoveLog). */
export const chosen: {at: number; id: string; fighter: string; action: string; grounded: boolean; key: BallMoveKey | null; ask?: BallMoveAsk}[] = [];
let lastAsk: BallMoveAsk | undefined;
/** What fitting has cost this page, for the probes (window.ballMoveFits). */
export const ballFitCost = {ms: 0, fits: 0, refused: 0, hookMs: 0, hookCalls: 0};
export const ballMoveReport = () => Object.fromEntries(report);

/** `key`'s take fitted to the rig of `scene` (cached): undefined while the file is coming, null where it was refused. */
export function fitBallMove(scene: THREE.Object3D, clips: readonly THREE.AnimationClip[], key: BallMoveKey, fighter?: FighterId): {clip: THREE.AnimationClip; take: Take} | null | undefined {
  const label = fighter ?? '';
  if (pack === undefined) { void fetchPack(); return undefined; }
  if (pack === null) return null;
  const row = BALL_MOVES[key], take = pack.takes.get(row.take);
  if (!take) return null;
  let byTake = fits.get(scene);
  if (!byTake) fits.set(scene, byTake = new Map());
  const armed = fighter && ARMED.has(styleOf(fighter)) ? row.armed ?? 1 : 1;
  const as = `${row.take}|${row.back}|${row.travel}|${armed}`;
  let fitted = byTake.get(as);
  if (fitted === undefined) {
    const t0 = performance.now();
    const body = rigOf(scene, findClipIn(clips, REFERENCE));
    const result = retarget(pack.rig, take.clip, body, 60, {ownBack: row.back, ownHands: true, facing: {source: 0, target: 0}, level: take.level, travel: row.travel});
    const ms = performance.now() - t0;
    ballFitCost.ms += ms; ballFitCost.fits++;
    if (result.clip) { result.clip.name = `ball ${key}`; if (armed < 1) holdArms(result.clip, body, armed); }
    else { ballFitCost.refused++; console.info(`Ball moves: ${label} ${key} refused: ${result.reason}.`); }
    report.set(`${label} ${key}`, result.clip ? {ok: true, stray: +result.stray.toFixed(1), ms: +ms.toFixed(1)} : {ok: false, reason: result.reason, ms: +ms.toFixed(1)});
    fitted = result.clip ?? null;
    byTake.set(as, fitted);
  }
  return fitted ? {clip: fitted, take} : null;
}

/** Bodies that carry a blade or a polearm in their hands (techniques.ts styles). */
const ARMED: ReadonlySet<BodyType> = new Set<BodyType>(['blade', 'polearm']);
const ARMS: readonly Canonical[] = ['LeftShoulder', 'LeftArm', 'LeftForeArm', 'RightShoulder', 'RightArm', 'RightForeArm'];
/** The arms of a fitted take kept `keep` of the way to the take's swing from the body's own stance (its reference), each
 *  joint's turn on its parent: they ride the chest as it bends and turns, the weapon held as the stance holds it. */
function holdArms(clip: THREE.AnimationClip, body: Rig, keep: number) {
  const q = new THREE.Quaternion(), ref = new THREE.Quaternion();
  for (const joint of ARMS) {
    const index = body.joints.get(joint);
    if (index === undefined) continue;
    const track = clip.tracks.find(t => t.name === `${body.nodes[index].name}.quaternion`);
    if (!track) continue;
    ref.copy(body.refQ[index]);
    for (let i = 0; i < track.values.length; i += 4) {
      q.fromArray(track.values, i);
      if (q.dot(ref) < 0) ref.set(-ref.x, -ref.y, -ref.z, -ref.w);
      ref.clone().slerp(q, keep).toArray(track.values, i);
    }
  }
}

/** `clip` with its keys moved so the share `from` of it falls at the share `to`, the stretch either side even: a take
 *  whose foot meets the ball 38% of the way through, played straight across a light whose blow lands 36% of the way. */
export function retimed(clip: THREE.AnimationClip, from: number, to: number): THREE.AnimationClip {
  const at = Math.round(THREE.MathUtils.clamp(to, .04, .96) * 100), key = `${at}|${Math.round(from * 1000)}`;
  let byAt = timed.get(clip);
  if (!byAt) timed.set(clip, byAt = new Map());
  let out = byAt.get(key);
  if (!out) {
    const D = clip.duration, c = from * D, n = at / 100 * D;
    const map = (t: number) => t <= c ? t * n / Math.max(1e-6, c) : n + (t - c) * (D - n) / Math.max(1e-6, D - c);
    out = clip.clone();
    for (const track of out.tracks) track.times = Float32Array.from(track.times, map);
    out.name = clip.name;
    byAt.set(key, out);
  }
  return out;
}

/** What Fighter.update reads of a sports take it is drawing (Fighter.transplant's swap): the take, retimed onto the
 *  move's contact and played on the move's own clock (`paced` hands the body a state no pacing curve takes up). */
class BallSwap implements Transplanted {
  clip!: THREE.AnimationClip;
  /** Every sports take throws with its own legs (a volley's kick, a header's spring): never the air string's tuck. */
  readonly legs = true;
  phase = '';
  move!: MoveDefinition;
  slot!: AttackSlot;
  pacedState?: PlayerState;
  paced(state: PlayerState) { return this.pacedState = {...state, action: 'idle', chain: undefined, branch: undefined}; }
}
/** The take each body's swing was given, decided as the swing starts and kept to its end; for SHOOT's quick strike, the
 *  move it is timed by (the simulation's, which no fighter's table holds). */
interface Latch {swing: string; key: BallMoveKey | null; swap?: BallSwap; quick?: MoveDefinition}
const latches = new WeakMap<Fighter, Latch>();

let context: (() => BallMoveContext | undefined) | undefined;
let installed = false;
/** Every take (`?ballmoves`), or SHOOT's quick strike alone. */
let everything = false;
/** For the sheet and the checks: every swing drawn with this take, whatever the chooser says (null: the chooser's). */
let forced: BallMoveKey | null = null;
export function forceBallMove(key: BallMoveKey | null) { forced = key; }

/** The sports take `body` draws `state` with now, or nothing (its own clip). */
export function ballSwapFor(body: Fighter, state: PlayerState): Transplanted | undefined {
  const sport = state.action === 'light' || state.action === 'heavy' || state.action === 'special' || state.action === 'guard';
  const ctx = context?.();
  // (SHOOT's quick strike is drawn with a take on every page; anything else only with `?ballmoves`.)
  // (The page's own swing is the tap or the charge its prediction says - ownShot.ts. The
  // drawn body's other fields are the room's, a round trip and the display delay old online: the quick strike was drawn
  // as the fighter's own heavy until the room's 'tap' came, after its blow.)
  const strike = ownStrike(state.id, state.actionSeq) ?? state.strike;
  const tap = state.action === 'heavy' && strike === 'tap';
  if (!sport || (!ctx && !forced) || !(everything || tap || forced)) { latches.delete(body); return undefined; }
  const swing = `${state.action}|${state.actionSeq ?? state.actionStarted.toFixed(2)}|${state.chain ?? 0}|${state.branch ?? ''}|${strike ?? ''}`;
  let latch = latches.get(body);
  if (!latch || latch.swing !== swing) {
    lastAsk = undefined;
    const strike = tap && ctx ? BALL_SPORT[ctx.view.mode].strike : undefined, quick = strike ? (state.grounded ? strike.move : strike.air ?? strike.move) : undefined;
    latch = {swing, key: forced ?? (ctx ? choose(body, state, ctx, quick) : null), quick};
    latches.set(body, latch);
    chosen.push({at: performance.now(), id: state.id, fighter: state.fighter, action: state.action, grounded: state.grounded, key: latch.key, ask: lastAsk});
    if (chosen.length > 400) chosen.splice(0, chosen.length - 400);
  }
  const fit = latch.key && BALL_MOVES[latch.key].on ? fitTo(body, state, latch.key) : undefined;
  if (!fit) return latch.quick ? ownQuick(body, state, latch, latch.quick) : undefined;
  const swap = latch.swap ??= new BallSwap();
  const held = state.action === 'guard';
  const move = held ? undefined : latch.quick ?? body.movePlayed(state);
  const at = move && state.actionDuration > 0 ? latch.quick ? drawnShare(body, state, move.contacts[0]) : move.contacts[0] / state.actionDuration : fit.take.contact;
  swap.clip = held ? fit.clip : retimed(fit.clip, fit.take.contact, at);
  swap.phase = `-ball-${latch.key}`;
  swap.move = move ?? ({name: 'guard', duration: 0, contacts: [0]} as unknown as MoveDefinition);
  swap.slot = state.action as AttackSlot;
  return swap;
}
function fitTo(body: Fighter, state: PlayerState, key: BallMoveKey) {
  const read = body.take({...state, action: 'idle'});
  return fitBallMove(read.scene, read.clips, key, state.fighter);
}
/** SHOOT's quick strike with no take to draw it (none chosen, the file still coming, a rig the fit refused): the
 *  fighter's own heavy - their air strike off the floor - played across the quick strike's clock with its blow moved
 *  onto the quick strike's contact. The blow's place in the clip is read off the move the clip was made for (its
 *  contact over its length), as Fighter's pacing reads a clip with nothing measured. */
function ownQuick(body: Fighter, state: PlayerState, latch: Latch, quick: MoveDefinition): Transplanted | undefined {
  const own: PlayerState = {...state, strike: undefined, charge: undefined};
  const clip = body.take(own).clip, made = body.movePlayed(own);
  if (!clip || !made.contacts.length || !(made.duration > 0) || !(state.actionDuration > 0)) return undefined;
  const swap = latch.swap ??= new BallSwap();
  swap.clip = retimed(clip, THREE.MathUtils.clamp(made.contacts[0] / made.duration, .05, .95), drawnShare(body, state, quick.contacts[0]));
  swap.phase = '-ball-own'; swap.move = quick; swap.slot = 'heavy';
  return swap;
}

/** Where the body's drawn clock stands (a share of the swing) as the swing's own reaches `t`
 *  seconds. The renderer's feel pass (Fighter.animStyle 'snap', the default: animeWarp) draws a melee swing on a
 *  snap-and-hold timing laid on the move it reads for the body - for SHOOT's quick strike the body's own heavy or air
 *  strike, whose blow is not the quick strike's - and where that blow falls inside the quick strike's 0.4 s it holds the
 *  clock back before it: the take's blow was drawn 36-44 ms after the ball left in the air on all six fighters filmed
 *  (kenzo, kosho, taisei, ouga, gummy, setsu), the spike's hand still cocked behind the head (the floor's kick, under
 *  heavies whose blow falls past the swing, was not held). The quick strike's take is laid on that clock instead.
 *  (Before its own blow the warp holds nothing, so the hold handed to it - Fighter.ts ANIME_HOLD's - does not matter here.) */
function drawnShare(body: Fighter, state: PlayerState, t: number) {
  const D = state.actionDuration, own = body.movePlayed(state);
  const drawn = Fighter.animStyle !== 'classic' && own?.style === 'melee' && own.contacts.length ? Fighter.animeWarp(t, own.contacts, D, .05) : t;
  return drawn / D;
}

/** The chooser's question for a swing starting now: the ball where the blow lands, in the body's own frame. */
function choose(body: Fighter, state: PlayerState, ctx: BallMoveContext, quick?: MoveDefinition): BallMoveKey | null {
  const view = ctx.view, seat = view.seats.find(s => s.id === state.id);
  if (!seat) return null;
  const move = state.action === 'guard' ? undefined : quick ?? body.movePlayed(state);
  const r = ballRadius(view.mode), b = view.ball, drawn = ctx.ball;
  const g = (view.mode === 'goal-rush' ? GOAL_RULES.gravity : SPIKE_RULES.gravity) * (b.grav || 1);
  // Where the ball will be when the blow lands: its flight run on from where it is drawn (drag and bounces left out).
  const lead = move ? Math.max(0, move.contacts[0] - state.actionTime * state.actionDuration) : 0;
  const x0 = drawn?.x ?? b.x, y0 = drawn?.y ?? b.y, z0 = drawn?.z ?? b.z, still = b.held;
  const bx = x0 + (still ? 0 : b.vx * lead), bz = z0 + (still ? 0 : b.vz * lead), by = Math.max(r, y0 + (still ? 0 : b.vy * lead - .5 * g * lead * lead));
  const dx = bx - state.x, dz = bz - state.z, s = Math.sin(state.yaw), c = Math.cos(state.yaw);
  const height = (FIGHTERS[state.fighter]?.height ?? 1.7) * (state.size ?? 1);
  const own = seat.team, used = view.touchTeam === own ? view.touches : 0;
  const goal = goalZ(own), fromGoal = Math.abs(state.z - goal), incoming = Math.sign(goal - b.z) === Math.sign(b.vz) && Math.hypot(b.vx, b.vz) > 4 && b.lastTeam === otherTeam(own);
  return chooseBallMove(lastAsk = {
    mode: view.mode, action: state.action, grounded: state.grounded, style: move?.style, blows: move?.contacts.length ?? 1, lock: seat.lock,
    ball: {ahead: dx * s + dz * c, left: dx * c - dz * s, up: by - state.y, radius: r * (b.size || 1)}, height,
    touch: used + 1, fromGoal, incoming, fromNet: Math.abs(state.z),
  });
}

/** Installs the hook (main.ts): Fighter.transplant asks for a sports take first, and hands on to the hook installed
 *  before it (the move transplant's). `read` says what the page's match is now. `all`: every take (`?ballmoves` in the
 *  address); without it only SHOOT's quick strike is drawn with one. */
export function installBallMoves(read: () => BallMoveContext | undefined, all = true) {
  if (installed) return;
  installed = true; context = read; everything = all;
  const before = Fighter.transplant;
  Fighter.transplant = (body, state) => {
    const t0 = performance.now(), swap = ballSwapFor(body, state);
    ballFitCost.hookMs += performance.now() - t0; ballFitCost.hookCalls++;
    return swap ?? before?.(body, state);
  };
  if (typeof window === 'object') (window as unknown as {ballMoveFits?: unknown; ballMoveReport?: unknown}).ballMoveFits = ballFitCost;
  if (typeof window === 'object') Object.assign(window, {ballMoveReport, ballMoveLog: chosen});
}
/** For tests and tools: the takes read another way (the tests read the file off the disk); resolves once they are in. */
export function loadBallMovesFrom(from: () => Promise<Pack>) { load = from; pack = undefined; fetching = undefined; return fetchPack(); }
/** For tests: forget the takes, every fit and the hook. */
export function resetBallMoves(transplant?: typeof Fighter.transplant) {
  pack = undefined; fetching = undefined; fits = new WeakMap(); timed = new WeakMap(); report.clear(); forced = null; chosen.length = 0;
  if (installed) Fighter.transplant = transplant; installed = false; context = undefined; everything = false;
  Object.assign(ballFitCost, {ms: 0, fits: 0, refused: 0, hookMs: 0, hookCalls: 0});
}
