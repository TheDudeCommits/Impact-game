import type * as THREE from 'three';
import { FIGHTERS } from '../../config';
import { AWAKENINGS, moveFor } from '../../game/awakening';
import { MOVES, type MoveDefinition } from '../../game/moves';
import type { AttackSlot, CoreSlot, FighterId, PlayerState } from '../../game/types';
import { Fighter, OWN_BODY_ULTIMATE, clipMotionTable } from '../../render/Fighter';
import { isCharacterMotion } from '../../render/characterMotion';
import { findClipIn } from '../../render/clipMatch';
import { TAISEI_MELEE_CONTACTS, TAISEI_TRANSMISSION } from '../../render/taiseiMeleeContact';
import { GRAND_TIDE_TAKE } from '../../render/gummy/grand-tide';
import { forgedMoveFor } from '../sim/forgedKits';
import { CORE_SLOTS } from '../sim/spec';
import { retarget, rigOf, type Fitted, type Rig } from './retarget';
import { areaAnimBorrowed, borrowedAction, forged, type Borrowed } from './transplant';
import { areaAnimOf } from '../sim/areaMoves';

/** What Fighter.update reads of a borrowed move it is throwing (Fighter.transplant). */
export interface Transplanted {
  /** The fitted take for this moment of the move. */
  readonly clip: THREE.AnimationClip;
  /** The take carries its own legs off the floor, so the air string's tuck (Fighter.airTuck) leaves them be: the ball
   *  modes' sports takes (render/ball/ballMoves.ts). Unset for a borrowed move. */
  readonly legs?: boolean;
  /** Changes as the take does (an ultimate's confirm, a form's turn), so the body starts the new one. */
  readonly phase: string;
  /** The move the action is timed by (the simulation's: the forged one). */
  readonly move: MoveDefinition;
  readonly slot: AttackSlot;
  /** The last state `paced` gave: moveFor answers it with `move`. */
  readonly pacedState?: PlayerState;
  /** The state the take is paced with: the move's fighter, in the move's slot - its tables, this body's clock. A take
   *  authored on the move's own clock is paced straight through (as an action that is no slot, which contactCurve
   *  leaves to the linear clock). */
  paced(state: PlayerState): PlayerState;
}

/** One take of a fighter's, and the rig it is drawn on. */
interface Take { readonly clip: THREE.AnimationClip; readonly rig: Rig; readonly linear: boolean }
/** A fighter's takes for one slot: as thrown, after an ultimate's confirm, and its form's. */
interface SlotTakes { readonly open: Take; readonly cine?: Take; readonly form?: Take }
/** A fighter's takes: its four core slots' (an area move is drawn with one of them: takeSlotOf). */
type Takes = Record<CoreSlot, SlotTakes>;

/** Whose take, and which of its slots, draws `from`'s `fromSlot` move: the slot itself, or for its area move the one
 *  its `area.anim` names - one of `from`'s own slots (the special's by default) or another fighter's it borrows
 *  (areaAnimOf). A clip named by `area.anim.clip` is drawn by the body itself (Fighter.clipFor), not transplanted. */
export function takeOf(from: FighterId, fromSlot: AttackSlot): { fighter: FighterId; slot: CoreSlot } {
  if (fromSlot !== 'area') return { fighter: from, slot: fromSlot };
  const anim = areaAnimOf(from, MOVES[from]?.area);
  return { fighter: anim.fighter, slot: anim.slot };
}
/** The slot of the take that draws `from`'s `fromSlot` move (takeOf). */
export const takeSlotOf = (from: FighterId, fromSlot: AttackSlot): CoreSlot => takeOf(from, fromSlot).slot;

/** A body's reference for fitting: its idle as it stands in the game. */
const REFERENCE = ['_Idle', 'Idle', 'taisei-ready', '02-STANCE', 'stance', 'idle'];
const referenceOf = (clips: readonly THREE.AnimationClip[]) => findClipIn(clips, REFERENCE);
/** A body's rig for fitting, from what it draws with (cached by scene and reference in retarget.ts). */
const rigFor = (scene: THREE.Object3D, clips: readonly THREE.AnimationClip[]) => rigOf(scene, referenceOf(clips));

/** A plain state of a fighter, standing, for reading its takes. */
const standing = (fighter: FighterId): PlayerState => ({ id: `transplant-${fighter}`, name: 'Transplant', fighter, x: 0, y: -1000, z: 0, yaw: 0, hp: 1, maxHp: 1,
  stamina: 100, ultimate: 0, action: 'idle', actionStarted: 0, actionDuration: 1, actionTime: 0, target: null, alive: true, isBot: true, grounded: true,
  guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } });

/** Whether a fighter's form throws its ultimate when it is not awakened (Fighter.update's `show`): its form's take is
 *  the ultimate's, from the swap. */
const formThrowsUltimate = (id: FighterId) => !!FIGHTERS[id].formModel && id !== 'konta' && !OWN_BODY_ULTIMATE.has(id) && AWAKENINGS[id].formTint === undefined;
/** A take drawn on the move's own clock: played straight through, as its own body plays it. */
const linearTake = (id: FighterId, slot: AttackSlot, clip: THREE.AnimationClip) => isCharacterMotion(clip)
  || (id === 'konta' && /^(Konta|Kurobi)\s*(light|heavy|special|ultimate)$/i.test(clip.name))
  || (id === 'taisei' && slot === 'heavy' && clip.name === TAISEI_MELEE_CONTACTS[TAISEI_TRANSMISSION].clip);

/** Each fighter's takes: from its take pack (takePacks.ts), or read once off a body of its own. */
const takes = new Map<FighterId, Takes>();
/** Reads a fighter's takes off `body` (a body of that fighter's, standing), its form's included, once per fighter. */
export function readTakes(body: Fighter, id: FighterId): Takes {
  const known = takes.get(id);
  if (known) return known;
  const out = takesOff(body, id);
  takes.set(id, out);
  return out;
}
/** A fighter's takes as they come from its take pack. */
export const setTakes = (id: FighterId, from: Takes) => { if (!takes.has(id)) takes.set(id, from); };
/** A body's own takes, read off itself: another of its own moves in a slot plays its own take, unfitted. */
const ownTakes = new WeakMap<Fighter, Takes>();
function takesOff(body: Fighter, id: FighterId): Takes {
  const state = standing(id), out = {} as Takes;
  const take = (on: Fighter, slot: AttackSlot, patch: Partial<PlayerState> = {}): Take => {
    const read = on.take({ ...state, action: slot, ...patch });
    return { clip: read.clip!, rig: rigFor(read.scene, read.clips), linear: linearTake(id, slot, read.clip!) };
  };
  for (const slot of CORE_SLOTS) {
    const open = take(body, slot);
    if (slot !== 'ultimate') { out[slot] = { open }; continue; }
    const cine = take(body, slot, { confirmedAt: 0 }), form = formThrowsUltimate(id) ? body.take(state).form : undefined;
    out[slot] = { open, ...(cine.clip !== open.clip ? { cine } : {}), ...(form ? { form: take(form, slot, { confirmedAt: 0 }) } : {}) };
  }
  return out;
}
export const knownTakes = (id: FighterId) => takes.get(id);

/** Fitted takes, per source clip and per rig they were fitted to. */
const fitted = new WeakMap<THREE.AnimationClip, WeakMap<Rig, Fitted>>();
const said = new Set<string>();
/** Every fit made on this page, by what it was ("kagari's special on bellows"): for the capture tools and the inspector. */
const report = new Map<string, { ok: boolean; reason?: string; pinned?: number }>();
export const fitReport = () => Object.fromEntries(report);
/** A take fitted to a rig, once. */
export function fit(take: Take, rig: Rig, label: string): Fitted {
  let byRig = fitted.get(take.clip);
  if (!byRig) fitted.set(take.clip, byRig = new WeakMap());
  let result = byRig.get(rig);
  if (!result) {
    result = take.rig === rig ? { clip: take.clip, stray: 0, pinned: 0 } : retarget(take.rig, take.clip, rig);
    if (result.clip) clipMotionTable(result.clip);
    else if (!said.has(label)) { said.add(label); console.info(`Transplant: ${label} keeps the body's own take: ${result.reason}.`); }
    report.set(label, result.clip ? { ok: true, pinned: +result.pinned.toFixed(3) } : { ok: false, reason: result.reason });
    byRig.set(rig, result);
  }
  return result;
}

/** The take of a slot for this moment of the move: the opener, the cinematic after a confirm, the form's from its swap. */
function takeNow(slot: SlotTakes, from: FighterId, fromSlot: AttackSlot, state: PlayerState, move: MoveDefinition): { take: Take; phase: string } {
  if (fromSlot !== 'ultimate') return { take: slot.open, phase: '' };
  const confirmed = state.confirmedAt !== undefined, elapsed = state.actionTime * state.actionDuration;
  if (slot.form && (move.confirm ? confirmed : elapsed >= (from === 'gummy' ? GRAND_TIDE_TAKE.swap : .48))) return { take: slot.form, phase: '-form' };
  if (confirmed && slot.cine) return { take: slot.cine, phase: '-cine' };
  return { take: slot.open, phase: '' };
}

class Swap implements Transplanted {
  clip!: THREE.AnimationClip;
  phase = '';
  move!: MoveDefinition;
  slot!: AttackSlot;
  from!: FighterId;
  fromSlot!: AttackSlot;
  linear = false;
  pacedState?: PlayerState;
  paced(state: PlayerState) {
    return this.pacedState = { ...state, fighter: this.from, action: this.linear ? 'idle' : this.fromSlot, chain: this.fromSlot === 'light' ? 0 : undefined, branch: undefined };
  }
}
const swaps = new WeakMap<Fighter, Swap>();
/** Each body's rig for fitting (its scene and idle never change). */
const bodyRigs = new WeakMap<Fighter, Rig>();
/** Asks for a move's files and fit, when a body throws it before it was made ready. */
let request: ((body: FighterId, from: FighterId, fromSlot: AttackSlot) => void) | undefined;
export const onTakeWanted = (wanted: typeof request) => { request = wanted; };

/** The borrowed move `body` throws now, fitted to it, or nothing (its own take): Fighter.transplant. */
export function transplantFor(body: Fighter, state: PlayerState): Transplanted | undefined {
  const borrowed = forged(state) ? borrowedAction(state) : areaAnimBorrowed(state);
  if (!borrowed || (!state.grounded && (borrowed.slot === 'light' || borrowed.slot === 'heavy'))) return undefined;
  let own: SlotTakes | undefined;
  const source = takeOf(borrowed.fighter, borrowed.fromSlot), slot = source.slot;
  if (source.fighter === state.fighter) {
    let mine = ownTakes.get(body);
    if (!mine) ownTakes.set(body, mine = takesOff(body, state.fighter));
    own = mine[slot];
  } else own = takes.get(source.fighter)?.[slot];
  if (!own) { request?.(state.fighter, source.fighter, slot); return undefined; }
  // An area cast plays its take's opener alone, whichever slot it is (never an ultimate's cinematic or its form's).
  const move = movePlayed(state, borrowed), now = takeNow(own, source.fighter, state.action === 'area' ? 'area' : borrowed.fromSlot, state, move);
  let rig = bodyRigs.get(body);
  if (!rig) { const read = body.take({ ...state, action: 'idle' }); bodyRigs.set(body, rig = rigFor(read.scene, read.clips)); }
  const result = fit(now.take, rig, `${borrowed.fighter}'s ${slot}${now.phase} on ${state.fighter}`);
  if (!result.clip) return undefined;
  let swap = swaps.get(body);
  if (!swap) swaps.set(body, swap = new Swap());
  swap.clip = result.clip; swap.phase = now.phase; swap.move = move; swap.slot = borrowed.slot; swap.from = borrowed.fighter; swap.fromSlot = borrowed.fromSlot;
  swap.linear = now.take.linear;
  return swap;
}
/** The move the simulation plays for the slot: online the forged kit's by hash, offline the body's (the Forge put the
 *  kit into MOVES), awakened as the simulation awakens it. */
function movePlayed(state: PlayerState, borrowed: Borrowed): MoveDefinition {
  return forgedMoveFor(state) ?? moveFor(state.fighter, borrowed.slot, !!state.awakened);
}

/** Fits `from`'s `fromSlot` takes onto the rigs of `bodies` (a body of `body`'s, and any live ones), ahead of the
 *  first throw: for an area move, the opener of the take it is drawn with (takeSlotOf). `donor` builds a body of a
 *  fighter's from the library (undefined until its files are loaded). */
export function fitAhead(from: FighterId, fromSlot: AttackSlot, bodies: readonly Fighter[], donor: (id: FighterId) => Fighter | undefined): boolean {
  // An area move drawn with another fighter's take (its `area.anim` borrows one): that fighter's take is fitted.
  const source = takeOf(from, fromSlot);
  if (source.fighter !== from) return fitAhead(source.fighter, source.slot, bodies, donor);
  let own = takes.get(from);
  if (!own) {
    const made = donor(from);
    if (!made) return false;
    try { own = readTakes(made, from); } finally { made.dispose(); }
  }
  const at = source.slot, slot = own[at];
  if (!slot) return false;
  // An area cast plays its take's opener alone (takeNow: never an ultimate's cinematic or its form's).
  const phases = fromSlot === 'area' ? [slot.open] : [slot.open, slot.cine, slot.form];
  for (const body of bodies) {
    const read = body.take({ ...standing(body.state.fighter), action: 'idle' }), rig = rigFor(read.scene, read.clips);
    bodyRigs.set(body, rig);
    for (const take of phases) if (take) fit(take, rig, `${from}'s ${at} on ${body.state.fighter}`);
    // The body's own form (an awakened body throws with it).
    const form = read.form;
    if (form) { const formRead = form.take({ ...standing(body.state.fighter), action: 'idle' }), formRig = rigFor(formRead.scene, formRead.clips); for (const take of phases) if (take) fit(take, formRig, `${from}'s ${at} on ${body.state.fighter}'s form`); }
  }
  return true;
}

/** Installs the animation half (Fighter's hook). */
export function installTakes() { Fighter.transplant = transplantFor; }
/** For tests. */
export function resetTakes() { takes.clear(); said.clear(); }
