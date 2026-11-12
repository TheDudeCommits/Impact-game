import {TAKE, dropTake, releaseTake, retakeAt, startKick, startTake, takeOn} from './kickLayer';
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
import {BALL_SPORT, GOAL_RULES, GOAL_STANCE, SHOOT, SPIKE_RULES, ballRadius, otherTeam, type BallView, type VolleyView} from '../../game/ball/model';
import {goalZ} from '../../game/ball/physics';
import {SPIKE_QUICK, placement} from '../../game/ball/strike';
import {TRAP} from '../../game/ball/BallMatch';
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
 *  is switched off in BALL_MOVES (`on: false`).
 *
 *  **The sport kit**: beside the prototypes the file holds the kit - 30 takes made with Meshy's text to motion from
 *  plain descriptions of the motion, carried
 *  onto the same mannequin - and with the kit on (`?ballmoves`, or BALL_KIT_DEFAULT) every row draws its kit take
 *  (`kit`) and the chooser knows the whole kit. Swings are timed as the prototypes are; the rest are played as their
 *  extras say: once and held on the last frame (a guard's TRAP, dives and parry, a celebration on the victory pose, the
 *  diving dig's get-up on the idle after it), held in a loop (the block), or the carry's run cycle laid on the body's
 *  own run (so the run's cadence drives it). Without the kit nothing here changes what a page draws. */
export const BALL_MOVES_FILE = '/assets/fighters/ball-moves.glb';
/** The kit for everyone: true would draw every page's ball matches with the whole kit, as
 *  `?ballmoves` does. Off: the kit is asked for with `?ballmoves`. */
export const BALL_KIT_DEFAULT = false;

/** Each take's switch, and how it is fitted: `back` how much of the take's bend and turn of the back the body takes on
 *  its own stance (retarget.ts ownBack), `travel` how far it may carry the body along the floor (hip heights), and
 *  `armed` how much of the take's arm swing a body holding a blade or a polearm keeps (a kick's or a header's arms are
 *  balance, and swung by a fighter carrying a cleaver they flail it through a slash: gaunt, filmed). Judged from the
 *  gameplay camera against the fighters' own attacks. */
export interface BallMoveRow {
  on: boolean; take: string; back: number; travel: number; armed?: number;
  /** The sport kit: the take drawn with the kit on, in place of `take` (the prototype's, which SHOOT's
   *  quick strike ships with); `level` thrown as from the air whatever the take's extras say (one take serves a header
   *  on the floor and in the air); `pace` how much faster than made a take played through is played. */
  kit?: string; level?: boolean; pace?: number;
}
export const BALL_MOVES: Readonly<Record<BallMoveKey, BallMoveRow>> = {
  // (The sport kit: the kit's pass, dig and block replaced the hand-posed prototypes, which are gone from the
  // file - nothing without the kit drew them; the posed set stays, kit or not: its hands push up through the contact,
  // where the generated set holds them up from the start and its fastest frame was the swing's blend into it.)
  'GR.pass': {on: true, take: 'K.pass', back: .8, travel: .12, armed: .3},
  // (The quick strike's kick keeps its prototype, kit or not: SHOOT's tap is a short snap, and the kit's DRIVE is the
  // charge's wound-up shot.)
  'GR.power': {on: true, take: 'GR.power', back: .85, travel: .2, armed: .4},
  'GR.volley': {on: true, take: 'GR.volley', kit: 'K.volley', back: .85, travel: .15, armed: .4},
  'GR.head': {on: true, take: 'GR.head', kit: 'K.head', back: 1, travel: .1, armed: .3},
  'GR.headAir': {on: true, take: 'GR.headAir', kit: 'K.head', level: true, back: 1, travel: .1, armed: .3},
  'GR.keeper': {on: true, take: 'GR.keeper', back: .9, travel: .1},
  'SS.dig': {on: true, take: 'K.dig', back: .9, travel: .1},
  'SS.set': {on: true, take: 'SS.set', back: .9, travel: .1},
  'SS.setAir': {on: true, take: 'SS.setAir', back: .9, travel: .1},
  'SS.spike': {on: true, take: 'SS.spike', kit: 'K.spike', back: 1, travel: .1},
  'SS.wall': {on: true, take: 'K.wall', back: .9, travel: .05},
  // The kit's own (with the kit on only).
  'GR.drive': {on: true, take: 'K.drive', back: .85, travel: .2, armed: .4},
  'GR.bicycle': {on: true, take: 'K.bicycle', back: 1, travel: .15, armed: .4},
  'GR.trap': {on: true, take: 'K.trap', back: .85, travel: .1, armed: .3, pace: 1.2},
  'GR.carry': {on: true, take: 'K.carry', back: .9, travel: 0, armed: .5},
  'GR.shoulder': {on: true, take: 'K.shoulder', back: .9, travel: .25, armed: .4},
  'GR.slide': {on: true, take: 'K.slide', back: .9, travel: .3, armed: .4},
  'GR.diveL': {on: true, take: 'K.diveL', back: 1, travel: .4, pace: 1.5},
  'GR.diveR': {on: true, take: 'K.diveR', back: 1, travel: .4, pace: 1.5},
  'GR.parry': {on: true, take: 'K.parry', back: .9, travel: .1, pace: 1.3},
  'SS.pancake': {on: true, take: 'K.pancake', back: 1, travel: .3},
  'SS.pancakeUp': {on: true, take: 'K.pancakeUp', back: 1, travel: .1, pace: 2.4},
  'SS.backSet': {on: true, take: 'K.backSet', back: .9, travel: .1},
  'SS.spikeCut': {on: true, take: 'K.spikeCut', back: 1, travel: .1},
  'SS.spikeRoll': {on: true, take: 'K.spikeRoll', back: 1, travel: .1},
  'SS.tip': {on: true, take: 'K.tip', back: 1, travel: .1},
  'SS.float': {on: true, take: 'K.float', back: .9, travel: .15},
  'SS.jumpServe': {on: true, take: 'K.topServe', back: 1, travel: .1},
  'C.slide': {on: true, take: 'C.slide', back: 1, travel: .3, armed: .5},
  'C.pump': {on: true, take: 'C.pump', back: 1, travel: .1, armed: .5},
  'C.flex': {on: true, take: 'C.flex', back: 1, travel: .1, armed: .5},
  'C.point': {on: true, take: 'C.point', back: 1, travel: .1, armed: .5},
  'C.leap': {on: true, take: 'C.leap', back: 1, travel: .15, armed: .5},
  'C.bow': {on: true, take: 'C.bow', back: 1, travel: .1, armed: .5},
  // The football takes: Goal Rush's SPORT mode's, off until its rules ask
  // for them - a side-foot pass and a full instep shot inside a running stride (in place, the body's run carrying it;
  // ending on the running pose it starts on, its extras' `stride` the run it was cut to), the poke tackle, the keeper's
  // catch (played once from its contact, `at` in its extras, and held) and the slide's get-up (the slide's own clip,
  // from where K.slide ends).
  'GR.stridePass': {on: false, take: 'K.stridePass', back: .85, travel: 0, armed: .4},
  'GR.strideShot': {on: false, take: 'K.strideShot', back: .85, travel: 0, armed: .4},
  'GR.poke': {on: false, take: 'K.poke', back: .9, travel: .2, armed: .4},
  'GR.catch': {on: false, take: 'K.catch', back: .9, travel: .1},
  'GR.slideUp': {on: false, take: 'K.slideUp', back: 1, travel: .2, armed: .5},
};
/** The take a row draws: its kit take with the kit on. */
export const takeOf = (row: BallMoveRow, kit: boolean) => kit && row.kit ? row.kit : row.take;

/** `?ballmoves` in the address, on any host: the only way the path is switched on (main.ts). */
export function ballMovesWanted(location?: {hostname: string; search: string}): boolean {
  if (!location) return false;
  return new URLSearchParams(location.search).has('ballmoves');
}

/** What the hook reads of the match on the page: the room's ball view and where the ball is drawn now; and the
 *  drawn clock (server s: main.ts timeline.drawnAt), which volleyball's ready poses are timed on. */
export interface BallMoveContext {view: BallView; ball?: THREE.Vector3 | null; now?: number | null}

/** A take as the file has it: its contact, thrown in the air (`level`), held through a guard (`held`); the sport
 *  kit adds a take played through once and held on its last frame (`once`) and a run's cycle (`loop`). */
interface Take {clip: THREE.AnimationClip; contact: number; level: boolean; held: boolean; once: boolean; loop: boolean}
interface Pack {rig: Rig; takes: Map<string, Take>}
let load: () => Promise<Pack> = async () => readPack(await new GLTFLoader().loadAsync(BALL_MOVES_FILE));
/** The file read: its rig (against `Stance`) and its takes, each with what its extras say. */
export function readPack(file: {scene: THREE.Object3D; animations: THREE.AnimationClip[]}): Pack {
  const stance = file.animations.find(c => c.name === 'Stance');
  const takes = new Map<string, Take>();
  for (const clip of file.animations) {
    const extras = clip.userData as {contact?: number; level?: boolean; held?: boolean; once?: boolean; loop?: boolean};
    takes.set(clip.name, {clip, contact: THREE.MathUtils.clamp(extras.contact ?? .5, .05, .95), level: !!extras.level, held: !!extras.held, once: !!extras.once, loop: !!extras.loop});
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

/** `key`'s take fitted to the rig of `scene` (cached): undefined while the file is coming, null where it was refused.
 *  `kit`: the row's kit take (the kit is on when the hook was installed with every take). */
export function fitBallMove(scene: THREE.Object3D, clips: readonly THREE.AnimationClip[], key: BallMoveKey, fighter?: FighterId, kit = everything): {clip: THREE.AnimationClip; take: Take} | null | undefined {
  const label = fighter ?? '';
  if (pack === undefined) { void fetchPack(); return undefined; }
  if (pack === null) return null;
  const row = BALL_MOVES[key], name = takeOf(row, kit), take = pack.takes.get(name);
  if (!take) return null;
  let byTake = fits.get(scene);
  if (!byTake) fits.set(scene, byTake = new Map());
  const armed = fighter && ARMED.has(styleOf(fighter)) ? row.armed ?? 1 : 1, level = row.level ?? take.level;
  const as = `${name}|${row.back}|${row.travel}|${armed}|${level}`;
  let fitted = byTake.get(as);
  if (fitted === undefined) {
    const t0 = performance.now();
    const body = rigOf(scene, findClipIn(clips, REFERENCE));
    const result = retarget(pack.rig, take.clip, body, 60, {ownBack: row.back, ownHands: true, facing: {source: 0, target: 0}, level, travel: row.travel});
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

/** The sport kit: the stick the page's own body pressed with (main.ts notes each command it sends), for the
 *  choices read off it - the spike's arm by PLACEMENT, the BACK SET. Nobody else's stick is known on a page: their spikes
 *  are the straight arm, their sets as the floor's. */
const sticks = new Map<string, {x: number; z: number}>();
export function noteBallStick(id: string, x: number, z: number) {
  const s = sticks.get(id);
  if (s) { s.x = x; s.z = z; } else sticks.set(id, {x, z});
}
/** The kit's actions besides a swing and a guard: Sky Spike's DIVE, the carry's run, the victory pose, and
 *  the idle a diving dig gets up in. */
const KIT_ACTIONS: ReadonlySet<string> = new Set(['dash', 'run', 'victory', 'idle']);
/** Each body's last diving dig (page ms), and when the idle after it began: its get-up (SS.pancakeUp) is drawn there. */
const dove = new WeakMap<Fighter, {at: number; up?: number; swap?: BallSwap}>();
/** Sky Spike: a dash is drawn as the diving dig at a ball this near along the floor (metres) and this low. */
const DIVE_AT = {reach: 6, height: 2.6} as const;
/** How long after the dive the idle may begin and still get up from the floor, ms (the dash is 0.16-0.22 s). */
const GET_UP = 600;

/** The sports take `body` draws `state` with now, or nothing (its own clip). */
export function ballSwapFor(body: Fighter, state: PlayerState): Transplanted | undefined {
  // (Goal Rush's SPORT mode, `?football`: the kit always on, and the match's own touches drawn - sportKick.)
  const sporting = !!context?.()?.view.football;
  if (sporting) { const kick = sportKick(body, state); if (kick) return kick; }
  // (The volleyball rules: every touch drawn from its ready pose - volleyPose.)
  { const ctx = context?.(); if (ctx?.view.volley) volleyPose(body, state, ctx); }
  const kit = everything || sporting;
  const sport = state.action === 'light' || state.action === 'heavy' || state.action === 'special' || state.action === 'guard';
  // (The kit's other actions only with the kit on, and nothing read for them otherwise.)
  if (!sport && !((kit || forced) && KIT_ACTIONS.has(state.action))) { latches.delete(body); return undefined; }
  if (state.action === 'idle') { latches.delete(body); return getUp(body, state); }
  const ctx = context?.();
  // (SHOOT's quick strike is drawn with a take on every page; anything else only with `?ballmoves`.)
  // (The page's own swing is the tap or the charge its prediction says - ownShot.ts. The
  // drawn body's other fields are the room's, a round trip and the display delay old online: the quick strike was drawn
  // as the fighter's own heavy until the room's 'tap' came, after its blow.)
  const strike = ownStrike(state.id, state.actionSeq) ?? state.strike;
  const tap = state.action === 'heavy' && strike === 'tap';
  if ((!ctx && !forced) || !(kit || tap || forced)) { latches.delete(body); return undefined; }
  // (A run is chosen again whenever the body takes the ball on or loses it: the carry.)
  const carrying = state.action === 'run' && ctx?.view.ball.carry === state.id;
  const swing = `${state.action}|${state.actionSeq ?? state.actionStarted.toFixed(2)}|${state.chain ?? 0}|${state.branch ?? ''}|${strike ?? ''}${carrying ? '|carry' : ''}`;
  let latch = latches.get(body);
  if (!latch || latch.swing !== swing) {
    lastAsk = undefined;
    const strike = tap && ctx ? BALL_SPORT[ctx.view.mode].strike : undefined, quick = strike ? (state.grounded ? strike.move : strike.air ?? strike.move) : undefined;
    latch = {swing, key: forced ?? (ctx ? choose(body, state, ctx, quick) : null), quick};
    latches.set(body, latch);
    // (The probes' log: every swing and guard, and the kit's other actions only when a take is chosen - every body's
    // runs filled it.)
    if (sport || latch.key) chosen.push({at: performance.now(), id: state.id, fighter: state.fighter, action: state.action, grounded: state.grounded, key: latch.key, ask: lastAsk});
    if (chosen.length > 400) chosen.splice(0, chosen.length - 400);
  }
  const fit = latch.key && BALL_MOVES[latch.key].on ? fitTo(body, state, latch.key) : undefined;
  if (!fit) return latch.quick ? ownQuick(body, state, latch, latch.quick) : undefined;
  const swap = latch.swap ??= new BallSwap(), take = fit.take, row = BALL_MOVES[latch.key!];
  if (state.action === 'guard' || state.action === 'victory' || state.action === 'run' || take.held || take.once || take.loop) {
    // Played through on the body's own clock (Fighter loops a guard, a run and the victory pose): once and held on its
    // last frame, looped, or the run's cycle laid on the body's own run.
    swap.clip = take.loop ? cycled(fit.clip, ownRun(body, state, fit.clip)) : take.once ? heldOn(fit.clip, row.pace ?? 1) : paced(fit.clip, row.pace ?? 1);
    swap.move = {name: state.action, duration: 0, contacts: [0]} as unknown as MoveDefinition;
  } else if (state.action === 'dash') {
    // Sky Spike's DIVE: the diving dig laid across the dash, its get-up on the idle after it (getUp).
    swap.clip = fit.clip;
    swap.move = {name: 'dash', duration: state.actionDuration, contacts: [take.contact * state.actionDuration]} as unknown as MoveDefinition;
    if (latch.key === 'SS.pancake') dove.set(body, {at: performance.now()});
  } else {
    const move = latch.quick ?? body.movePlayed(state);
    const at = move && state.actionDuration > 0 ? latch.quick ? drawnShare(body, state, move.contacts[0]) : move.contacts[0] / state.actionDuration : take.contact;
    swap.clip = retimed(fit.clip, take.contact, at);
    swap.move = move;
  }
  swap.phase = `-ball-${latch.key}`;
  swap.slot = state.action as AttackSlot;
  return swap;
}
/** So a contact is shown by arms meeting the ball, not by rings and bubbles - the volleyball rules
 *  (game/ball/volley.ts): a touch's swing is SHOOT's quick strike, its contact 0.115 s after the press is answered, so
 *  the kit's take ran its whole lead-in in three frames and the body seemed to stand there as the ball left it. But the
 *  rules know the touch before it comes - whose ball it is and its best moment (`volley.owner`, `volley.at`) - so its
 *  body takes the touch's ready pose ahead of it: the take (kickLayer.ts startTake, full body, on the drawn clock) runs
 *  in from `lead` s before that moment (`air` for a hitter in the air, the serve's `serve` s from the ball held for it)
 *  up to where the swing starts and holds there - the forearms together for a receive, the hands up for a set, the arm
 *  drawn back for a spike or a serve - and the swing the rules start plays it on from that frame to its contact as the
 *  ball is struck (`releaseTake`), into its follow-through for `after` s, then back to the body's own. A swing with no
 *  ready pose before it (a bot's touch from further off) is drawn the same from its press. A ready pose whose ball goes
 *  elsewhere is let go (`dropTake`). Presentation only: the touch and its timing are the rules'. */
export const VPOSE = {lead: .42, air: .4, serve: .55, after: .38, still: 1.2, run: 3.5} as const;
const vposed = new WeakMap<Fighter, {key: string; take: BallMoveKey; released: boolean; swing: string}>();
/** For the checks (window.volleyPoses): ready poses taken, swings played on from one, swings drawn from their press
 *  (none before them), ready poses let go. */
export const volleyPoses = {ready: 0, released: 0, fresh: 0, dropped: 0};
function volleyPose(body: Fighter, state: PlayerState, ctx: BallMoveContext) {
  const view = ctx.view, vol = view.volley, now = ctx.now;
  strideOf(body, state);
  if (!vol || now === undefined || now === null || !Number.isFinite(now) || view.replay) return;
  const p = vposed.get(body);
  const strike = ownStrike(state.id, state.actionSeq) ?? state.strike;
  if (state.action === 'heavy' && strike === 'tap') {
    const swing = `${state.actionSeq ?? state.actionStarted.toFixed(3)}`;
    if (p?.swing === swing) return;
    const named = vol.takes[state.id], take = named && named in BALL_MOVES ? named as BallMoveKey : p?.take;
    if (!take) return;
    const at = state.actionStarted + SHOOT.contact;
    if (p && !p.released && p.take === take && takeOn(body) && releaseTake(body, at)) volleyPoses.released++;
    else if (volleyTake(body, state, take, at)) volleyPoses.fresh++;
    vposed.set(body, {key: p?.key ?? '', take, released: true, swing});
    return;
  }
  // (A DIVE is its own take, the dash's: the ready pose gives way to it.)
  const want = state.action === 'dash' ? null : readyFor(view, vol, state, now);
  if (want) {
    if (!p || p.key !== want.key) { if (volleyTake(body, state, want.take, want.at, true)) { volleyPoses.ready++; vposed.set(body, {key: want.key, take: want.take, released: false, swing: p?.swing ?? ''}); } }
    else if (!p.released && want.follow) retakeAt(body, want.at);
    return;
  }
  if (p && !p.released) { dropTake(body); volleyPoses.dropped++; vposed.set(body, {...p, released: true}); }
}
/** The ready pose this body should hold now, if any: its key (one a ball), the take and the moment its swing is aimed at
 *  (`follow`: the room's moment for it, which the forecast keeps refining). */
function readyFor(view: BallView, vol: VolleyView, state: PlayerState, now: number): {key: string; take: BallMoveKey; at: number; follow: boolean} | null {
  const b = view.ball;
  if (view.phase === 'kickoff') {
    if (view.serverId !== state.id || !b.held) return null;
    return {key: `serve|${view.startedAt}|${view.rally}|${state.grounded ? 'float' : 'jump'}`, take: state.grounded ? 'SS.float' : 'SS.jumpServe', at: now + VPOSE.serve, follow: false};
  }
  if (view.phase !== 'live' || b.held || vol.owner !== state.id || vol.touch < 1) return null;
  const left = vol.at - now, air = vol.touch === SPIKE_RULES.touches && !state.grounded;
  // (The spike's from the air only - its lead-in is the arm drawn back as the hitter rises; a third ball on the floor is
  // put OVER.)
  const take: BallMoveKey = vol.touch === 1 ? 'SS.dig' : vol.touch === 2 ? 'SS.set' : air ? 'SS.spike' : 'SS.float';
  if (vol.touch === SPIKE_RULES.touches && state.grounded && b.shot === 'set') return null;
  if (left > (air ? VPOSE.air : VPOSE.lead) || left < -.25) return null;
  return {key: `${vol.touch}|${view.touchTeam}|${view.touches}|${b.lastId}|${take}`, take, at: vol.at, follow: true};
}
/** A volleyball take on `body` (kickLayer startTake): fitted to its rig, its contact at `at` (server s), held short of
 *  its swing while `ready`. */
function volleyTake(body: Fighter, state: PlayerState, key: BallMoveKey, at: number, ready = false) {
  const row = BALL_MOVES[key];
  if (!row?.on) return 0;
  const fit = fitTo(body, state, key);
  if (!fit) return 0;
  const contact = fit.take.contact * fit.clip.duration, rate = row.pace ?? 1;
  return startTake(body, fit.clip, {at, contact, rate, end: Math.min(fit.clip.duration, contact + VPOSE.after * rate), ready: ready ? Math.max(0, contact - SHOOT.contact * rate) : undefined,
    legs: () => { const g = stride.get(body); return g ? 1 - THREE.MathUtils.smoothstep(g.speed, VPOSE.still, VPOSE.run) : 1; }});
}
/** Each body's pace along the floor (m/s, smoothed), for the ready pose's legs (volleyTake): under VPOSE.still the
 *  take's own, over VPOSE.run the body's stride. */
const stride = new WeakMap<Fighter, {x: number; z: number; t: number; speed: number}>();
function strideOf(body: Fighter, state: PlayerState) {
  const now = performance.now(), was = stride.get(body), dt = was ? (now - was.t) / 1000 : 0;
  const speed = was && dt > 1e-3 && dt < .25 ? Math.hypot(state.x - was.x, state.z - was.z) / dt : was?.speed ?? 0;
  stride.set(body, {x: state.x, z: state.z, t: now, speed: was ? was.speed + (speed - was.speed) * Math.min(1, dt * 12) : speed});
}

/** Goal Rush's SPORT mode (game/ball/football.ts): the match plays the ball itself, so no swing of the body's says a
 *  touch - its PASS and SHOOT events do (BallEvent 'pass', 'strike'). Each is drawn with the kit's take (the side-foot
 *  pass; SHOOT's snap on a tap, the DRIVE wound up; the header) played once from a beat before its contact - the ball
 *  has already left - and then the body's own action again, but only on a body standing or walking as it struck
 *  (under KICK.slow m/s): an in-place take on a running body slides its feet along the floor, so on the run the take is
 *  laid over the run cycle (or the carry's jog) as an additive layer on the striking leg, the hips and the spine
 *  (kickLayer.ts). */
const KICK = {slow: 3, lead: .05, most: .9} as const;
const kicked = new WeakMap<Fighter, {seen: number; id: number; at: number; key: BallMoveKey; swap: BallSwap}>();
const pace = new WeakMap<Fighter, {x: number; z: number; t: number; speed: number}>();
function sportKick(body: Fighter, state: PlayerState): Transplanted | undefined {
  const ctx = context?.(), now = performance.now();
  if (!ctx) return undefined;
  const was = pace.get(body), dt = was ? (now - was.t) / 1000 : 0;
  const speed = was && dt > 1e-3 && dt < .25 ? Math.hypot(state.x - was.x, state.z - was.z) / dt : was?.speed ?? 0;
  pace.set(body, {x: state.x, z: state.z, t: now, speed: was ? was.speed + (speed - was.speed) * Math.min(1, dt * 12) : speed});
  let k = kicked.get(body);
  const seen = k?.seen ?? 0;
  let newest = seen;
  for (const e of ctx.view.events) {
    if (e.id <= seen || e.actorId !== state.id || (e.kind !== 'pass' && e.kind !== 'strike' && e.kind !== 'steal' && e.kind !== 'save')) continue;
    newest = Math.max(newest, e.id);
    // (A keeper's save - FOOTBALL.fun2.keeper - is seen: a dive to the side the ball was met on, or the parry
    // with the ball at its body; a dive that caught it is not then also played as the standing catch.)
    if (e.kind === 'save') {
      if (!ctx.view.football || !ctx.view.seats.find(s => s.id === state.id)?.keeper) continue;
      const across = (e.x - state.x) * Math.cos(state.yaw) - (e.z - state.z) * Math.sin(state.yaw);
      const dive = Math.abs(across) >= DIVE_FROM;
      if (footTake(body, state, !dive ? 'GR.parry' : across > 0 ? 'GR.diveL' : 'GR.diveR', e.at) && dive) caught.add(body);
      continue;
    }
    if (e.kind === 'steal' && (e.text === 'BEATEN')) continue;
    // (The football takes - kickLayer.ts startTake, full body, entered at the contact: a POKE with the poke's lunge, won
    // or not; a SLIDE, won or missed, with the slide and its get-up straight after; on the run a PASS or a SHOOT with
    // the pass or the shot in stride, its cycle matched to the body's run; the TRICK the sole's drag through the layer.)
    const running = (pace.get(body)?.speed ?? 0) >= KICK.slow && state.grounded;
    if (e.kind === 'steal' && e.text === 'POKING') { footTake(body, state, 'GR.poke', e.at); continue; }
    if (e.kind === 'steal' && e.text === 'POKE') continue;
    if (e.kind === 'steal' && e.text === 'SLIDING') { footTake(body, state, 'GR.slide', e.at, {then: 'GR.slideUp', start: true}); continue; }
    if (e.kind === 'steal' && (e.text === 'SLIDE' || e.text === 'MISSED')) continue;
    if (running && (e.kind === 'pass' || e.kind === 'strike' && e.shot !== 'header')) { footTake(body, state, e.kind === 'pass' ? 'GR.stridePass' : 'GR.strideShot', e.at, {stride: true}); continue; }
    const key: BallMoveKey = e.kind === 'steal' ? 'GR.trap' : e.kind === 'pass' ? 'GR.pass' : e.shot === 'header' ? 'GR.head' : e.shot === 'power' ? 'GR.drive' : 'GR.power';
    if (!running && state.grounded) { k = {seen: e.id, id: e.id, at: now, key, swap: k?.swap ?? new BallSwap()}; kicked.set(body, k); }
    else if (state.grounded) { const row = BALL_MOVES[key], fit = row.on ? fitTo(body, state, key) : undefined; if (fit) startKick(body, fit.clip, fit.take.contact * fit.clip.duration, e.at, key === 'GR.pass'); }
  }
  // (A held SHOOT winding up at this body's feet: the shot in stride's lead-in, run by how far it is wound.)
  const b = ctx.view.ball;
  // (A tapped PASS or SHOOT's own short wind-up - FOOTBALL.fun2.kick - the pass's take for a pass, over a
  // shorter lead-in: the foot drawn back and brought through to the contact as the ball goes.)
  if (b.carry === state.id && (b.wind ?? 0) > 0 && !takeOn(body)?.wind && state.grounded) footTake(body, state, b.windTap === 'pass' ? 'GR.stridePass' : 'GR.strideShot', NaN, {lead: b.windTap ? TAP_LEAD : undefined, wind: () => { const v = context?.()?.view.ball; return v && v.carry === state.id && (v.wind ?? 0) > 0 ? v.wind : undefined; }});
  // (SPORT's keeper with the ball at its feet - a catch, a gather - the keeper's catch, held while it keeps it.)
  const keeper = ctx.view.seats.find(s => s.id === state.id)?.keeper;
  if (keeper) {
    const holding = b.carry === state.id;
    if (holding && !caught.has(body)) { caught.add(body); footTake(body, state, 'GR.catch', NaN, {hold: () => context?.()?.view.ball.carry === state.id}); }
    else if (!holding) caught.delete(body);
  }
  if (k && newest > k.seen) k.seen = newest; else if (!k && newest > 0) kicked.set(body, k = {seen: newest, id: 0, at: 0, key: 'GR.pass', swap: new BallSwap()});
  if (!k || !k.id) return undefined;
  const row = BALL_MOVES[k.key], fit = row.on ? fitTo(body, state, k.key) : undefined;
  if (!fit) return undefined;
  const clip = fromContact(fit.clip, fit.take.contact), long = Math.min(KICK.most, clip.duration / (row.pace ?? 1));
  if ((now - k.at) / 1000 > long) { k.id = 0; return undefined; }
  const swap = k.swap;
  swap.clip = heldOn(clip, row.pace ?? 1);
  swap.move = {name: state.action, duration: 0, contacts: [0]} as unknown as MoveDefinition;
  swap.phase = `-ball-kick-${k.id}`; swap.slot = state.action as AttackSlot;
  return swap;
}
/** A tap's wind-up (FOOTBALL.fun2.kick, BallState.windTap) plays this much of its take's lead-in (s); a held
 *  SHOOT's, TAKE.wind. */
const TAP_LEAD = .26;
/** A keeper's save met this far across its body (m) or more is a dive; nearer, the parry. */
const DIVE_FROM = 1.1;
/** The keepers whose catch is drawn now (one take a catch). */
const caught = new WeakSet<Fighter>();
/** The football takes' extras: `at` the contact in seconds; a stride take's run. */
type FootExtras = {at?: number; stride?: {cycle: number; speed: number}};
/** A football take on `body` (kickLayer startTake): fitted to its rig (the rows are off until SPORT asks: switched on
 *  here, under the flag), entered at its contact; a stride take at the rate that matches the body's own run (its run's
 *  hip heights a second against the take's, the body's size its hip height in metres, near enough) and blended back
 *  TAKE.after past the contact; `then` played straight after; `hold` and `wind` as startTake says. */
function footTake(body: Fighter, state: PlayerState, key: BallMoveKey, at: number, o: {stride?: boolean; then?: BallMoveKey; hold?: () => boolean; wind?: () => number | undefined; start?: boolean; lead?: number} = {}) {
  const fit = fitTo(body, state, key);
  if (!fit) return 0;
  // (`start`: a take pressed now and played from its first frame - a slide's run in to the ball.)
  const x = fit.take.clip.userData as FootExtras, contact = o.start ? 0 : x.at ?? fit.take.contact * fit.clip.duration;
  const speed = pace.get(body)?.speed ?? 0, hip = HIP * (state.size ?? 1);
  const rate = o.stride && x.stride ? THREE.MathUtils.clamp(speed / hip / x.stride.speed, .7, 1.8) : 1;
  const then = o.then ? fitTo(body, state, o.then)?.clip : undefined;
  return startTake(body, fit.clip, {at, contact, rate, end: o.stride ? contact + TAKE.after * rate : undefined, hold: o.hold, wind: o.wind, lead: o.lead, then});
}
/** A body's hip height at size 1 (m), for a stride take's rate. */
const HIP = 1;
/** `clip` from KICK.lead s before its contact (a share of it) on: the touch has already happened when it starts. */
function fromContact(clip: THREE.AnimationClip, contact: number): THREE.AnimationClip {
  return variant(clip, `from ${contact}`, () => {
    const start = Math.max(0, contact * clip.duration - KICK.lead), out = clip.clone();
    for (const track of out.tracks) track.times = Float32Array.from(track.times, t => t - start);
    out.duration = clip.duration - start; out.name = clip.name;
    return out;
  });
}
/** The sport kit: the diving dig's get-up, on the idle straight after the dive - played through once at its
 *  row's pace, then the body's own idle again (the swap let go: Fighter blends back). */
function getUp(body: Fighter, state: PlayerState): Transplanted | undefined {
  const d = dove.get(body);
  if (!d) return undefined;
  const now = performance.now(), row = BALL_MOVES['SS.pancakeUp'];
  if (d.up === undefined) {
    if (now - d.at > GET_UP || !state.grounded) { dove.delete(body); return undefined; }
    d.up = now;
  }
  const fit = row.on ? fitTo(body, state, 'SS.pancakeUp') : undefined;
  if (!fit || now - d.up > fit.clip.duration / (row.pace ?? 1) * 1000) { dove.delete(body); return undefined; }
  const swap = d.swap ??= new BallSwap();
  swap.clip = heldOn(fit.clip, row.pace ?? 1);
  swap.move = {name: 'idle', duration: 0, contacts: [0]} as unknown as MoveDefinition;
  swap.phase = '-ball-SS.pancakeUp'; swap.slot = state.action as AttackSlot;
  return swap;
}
/** How long the body's own run takes (its cycle, which Fighter's cadence runs the carry's on), seconds. */
function ownRun(body: Fighter, state: PlayerState, fallback: THREE.AnimationClip) {
  return body.take({...state, action: 'run'}).clip?.duration ?? fallback.duration;
}
/** How much longer than its last key a take played through once is held there, seconds (longer than any celebration). */
const HOLD = 30;
const played = new WeakMap<THREE.AnimationClip, Map<string, THREE.AnimationClip>>();
function variant(clip: THREE.AnimationClip, key: string, make: () => THREE.AnimationClip) {
  let by = played.get(clip);
  if (!by) played.set(clip, by = new Map());
  let out = by.get(key);
  if (!out) by.set(key, out = make());
  return out;
}
/** `clip` played `pace` times as fast (the take itself at 1). */
function paced(clip: THREE.AnimationClip, pace: number): THREE.AnimationClip {
  if (pace === 1) return clip;
  return variant(clip, `pace ${pace}`, () => {
    const out = clip.clone();
    for (const track of out.tracks) track.times = Float32Array.from(track.times, t => t / pace);
    out.duration = clip.duration / pace; out.name = clip.name;
    return out;
  });
}
/** `clip` played once at `pace` and held on its last frame for HOLD seconds: looped by Fighter as a guard or a victory
 *  pose is, it never comes round again. */
export function heldOn(clip: THREE.AnimationClip, pace = 1): THREE.AnimationClip {
  return variant(clip, `held ${pace}`, () => {
    const out = paced(clip, pace).clone();
    for (const track of out.tracks) {
      const n = track.times.length, size = track.getValueSize(), times = new Float32Array(n + 1), values = new Float32Array((n + 1) * size);
      times.set(track.times); times[n] = track.times[n - 1] + HOLD;
      values.set(track.values); values.set(track.values.subarray((n - 1) * size, n * size), n * size);
      track.times = times; track.values = values;
    }
    out.duration = clip.duration / pace + HOLD; out.name = clip.name;
    return out;
  });
}
/** A run's cycle laid across `length` seconds (the body's own run: Fighter's cadence then runs it as it runs that). */
function cycled(clip: THREE.AnimationClip, length: number): THREE.AnimationClip {
  return variant(clip, `cycle ${Math.round(length * 1000)}`, () => paced(clip, clip.duration / Math.max(.1, length)).clone());
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
  // (VOLLEYBALL: the rules say which touch this swing draws - game/ball/volley.ts - and it is the kit's.)
  const named = view.volley?.takes[state.id];
  if (named && named in BALL_MOVES) return named as BallMoveKey;
  const move = state.action === 'light' || state.action === 'heavy' || state.action === 'special' ? quick ?? body.movePlayed(state) : undefined;
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
  const ask: BallMoveAsk = {
    mode: view.mode, action: state.action, grounded: state.grounded, style: move?.style, blows: move?.contacts.length ?? 1, lock: seat.lock,
    ball: {ahead: dx * s + dz * c, left: dx * c - dz * s, up: by - state.y, radius: r * (b.size || 1)}, height,
    touch: used + 1, fromGoal, incoming, fromNet: Math.abs(state.z),
  };
  if (everything) kitAsk(ask, body, state, view, {x: bx, y: by, z: bz});
  return chooseBallMove(lastAsk = ask, everything);
}
/** The sport kit: what the kit's choices read besides the prototype's (ballMoveChoice.ts BallMoveAsk). */
function kitAsk(ask: BallMoveAsk, body: Fighter, state: PlayerState, view: BallView, at: {x: number; y: number; z: number}) {
  const b = view.ball, s = Math.sin(state.yaw), c = Math.cos(state.yaw), seat = view.seats.find(q => q.id === state.id)!, team = seat.team;
  ask.strike = ownStrike(state.id, state.actionSeq) ?? state.strike;
  ask.carrying = b.carry === state.id;
  if (view.mode === 'sky-spike') {
    ask.serve = view.serverId === state.id && b.held;
    // (A dive is at a ball the other side sent, near and low enough to reach off the floor.)
    ask.diving = !b.held && b.lastTeam !== null && b.lastTeam !== team && Math.hypot(at.x - state.x, at.z - state.z) < DIVE_AT.reach && at.y < DIVE_AT.height;
    // (strike.ts: a light from the air on the attacking touch with the ball over the net is a TIP.)
    ask.tip = !state.grounded && state.action === 'light' && (ask.touch ?? 1) >= SPIKE_RULES.touches && at.y > SPIKE_RULES.netHeight;
    const stick = sticks.get(state.id);
    if (stick) {
      // The stick as the striker read it (BallMatch: forward and across the aim), then as PLACEMENT and the sets read it.
      const forward = stick.x * s + stick.z * c, lateral = -stick.x * c + stick.z * s;
      ask.place = placement({forward, lateral, aimYaw: state.yaw} as Parameters<typeof placement>[0], team);
      const across = -lateral * Math.cos(state.yaw), wing = Math.sign(across || 1) * SPIKE_QUICK.wing;
      ask.backSet = Math.abs(lateral) > .55 && Math.abs(wing - at.x) >= SPIKE_QUICK.back;
    }
  } else {
    // The keeper: where the ball coming crosses the body's line, and when.
    const ahead = ask.ball!.ahead, va = b.vx * s + b.vz * c, vl = b.vx * c - b.vz * s;
    if (va < -1) { const t = Math.max(0, ahead / -va); ask.shot = {left: ask.ball!.left + vl * t, eta: t}; }
    // A TRAP's ball: near, free, and coming to the body.
    const dx = state.x - at.x, dz = state.z - at.z;
    ask.arriving = !b.held && b.carry === undefined && Math.hypot(dx, dz) < TRAP.reach + ballRadius(view.mode) && dx * b.vx + dz * b.vz > 0 && Math.hypot(b.vx, b.vz) > 2;
    // The TACKLE: the one locked on (the body's target, as main.ts sets it) on the ball - carrying it, or by it.
    if (seat.lock && body.targetPoint) {
      const p = body.targetPoint;
      ask.foe = {distance: body.targetDistance, onBall: b.carry === seat.lock || Math.hypot(p.x - at.x, p.z - at.z) <= GOAL_STANCE.tackle.near};
    }
  }
  if (state.action === 'victory') {
    ask.celebrate = view.phase === 'over' ? 'podium' : view.mode === 'goal-rush' ? 'goal' : 'point';
    let h = 0;
    for (let i = 0; i < state.id.length; i++) h = (h * 31 + state.id.charCodeAt(i)) | 0;
    ask.seed = Math.abs(h) + view.score.red + view.score.blue + view.round;
  }
}

/** Installs the hook (main.ts): Fighter.transplant asks for a sports take first, and hands on to the hook installed
 *  before it (the move transplant's). `read` says what the page's match is now. `all`: every take (`?ballmoves` in the
 *  address); without it only SHOOT's quick strike is drawn with one. */
export function installBallMoves(read: () => BallMoveContext | undefined, all = true) {
  if (installed) return;
  installed = true; context = read; everything = all || BALL_KIT_DEFAULT;
  const before = Fighter.transplant;
  Fighter.transplant = (body, state) => {
    const t0 = performance.now(), swap = ballSwapFor(body, state);
    ballFitCost.hookMs += performance.now() - t0; ballFitCost.hookCalls++;
    return swap ?? before?.(body, state);
  };
  if (typeof window === 'object') (window as unknown as {ballMoveFits?: unknown; ballMoveReport?: unknown}).ballMoveFits = ballFitCost;
  if (typeof window === 'object') Object.assign(window, {ballMoveReport, ballMoveLog: chosen, volleyPoses});
}
/** For tests and tools: the takes read another way (the tests read the file off the disk); resolves once they are in. */
export function loadBallMovesFrom(from: () => Promise<Pack>) { load = from; pack = undefined; fetching = undefined; return fetchPack(); }
/** For tests: forget the takes, every fit and the hook. */
export function resetBallMoves(transplant?: typeof Fighter.transplant) {
  pack = undefined; fetching = undefined; fits = new WeakMap(); timed = new WeakMap(); report.clear(); forced = null; chosen.length = 0; sticks.clear();
  if (installed) Fighter.transplant = transplant; installed = false; context = undefined; everything = false;
  Object.assign(ballFitCost, {ms: 0, fits: 0, refused: 0, hookMs: 0, hookCalls: 0});
}
