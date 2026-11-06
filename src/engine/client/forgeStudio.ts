import type { AttackSlot, FighterId } from '../../game/types';
import { canonicalJson } from '../sim/hash';
import { ATTACK_SLOTS } from '../sim/spec';
import { FORGE_VERSION, kitPick, ownKit, type ForgeFx, type ForgeKit, type SlotPick } from '../sim/forge';

/** What the studio edits: one of the five slots (J, K, Q, R and the area slot G), or the body's aura. */
export type StudioTarget = AttackSlot | 'aura';
export const STUDIO_TARGETS: readonly StudioTarget[] = [...ATTACK_SLOTS, 'aura'];
/** Something to try: any fighter's move from any of its five slots (its area move from `area`), or an Armory effect. */
export type StudioItem = { kind: 'move'; from: FighterId; fromSlot: AttackSlot } | { kind: 'fx'; effect: string };
/** A slot's two halves: the move it throws (with its tunes and status) and the look it wears. */
export type StudioPart = 'move' | 'look';

export interface StudioTrial {
  readonly target: StudioTarget;
  readonly item: StudioItem;
  /** The kit in play while it is tried: what is assigned, with the item in its target (and any edits made to it). */
  readonly kit: ForgeKit;
}
export interface StudioState {
  readonly body: FighterId;
  /** What is kept for the body. */
  readonly assigned: ForgeKit;
  readonly trial?: StudioTrial;
  /** The kits assigned before, oldest first: what undo goes back to. */
  readonly history: readonly ForgeKit[];
  /** The last edit's key, when it may be merged with the next one (a slider dragged through its values). */
  readonly merging?: string;
}

/** How many assignments undo remembers. */
export const STUDIO_HISTORY = 100;
/** The name a body's kit is given until the player names it. */
export const defaultKitName = (cardName: string) => `${cardName} Forged`.slice(0, 24).trim();

const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);

/** The studio for a body: its kept draft when there is one (and it is this body's), else the body's own kit. */
export function startStudio(body: FighterId, name: string, draft?: ForgeKit): StudioState {
  return { body, assigned: draft && draft.body === body ? draft : ownKit(body, name), history: [] };
}

/** The kit in play: the trial's while something is tried, else what is assigned. */
export const inPlay = (state: StudioState): ForgeKit => state.trial?.kit ?? state.assigned;

/** Whether the library lists an item while `target` is selected: an effect fits every target; an area move only the
 *  area slot, and the area slot only area moves (the aura takes a move to the slot it comes from, never an area move). */
export const fits = (target: StudioTarget, item: StudioItem): boolean => item.kind === 'fx' || (target === 'area') === (item.fromSlot === 'area');
/** Where an item goes when `target` is selected: a move never goes on the aura, so it takes the slot it comes from; an
 *  area move only ever goes in the area slot, and a move that is not one never does (it takes its own slot). */
export function targetFor(target: StudioTarget, item: StudioItem): StudioTarget {
  if (item.kind !== 'move') return target;
  if (item.fromSlot === 'area') return 'area';
  return target === 'aura' || target === 'area' ? item.fromSlot : target;
}

/** A kit with `item` in `target`. A new move brings its own tunes (none) and no status, and keeps the slot's look; an
 *  effect replaces the target's look, with its own settings. */
export function withItem(kit: ForgeKit, target: StudioTarget, item: StudioItem): ForgeKit {
  const at = targetFor(target, item);
  if (at === 'aura') return item.kind === 'fx' ? { ...kit, aura: { effect: item.effect } } : kit;
  const pick = kitPick(kit, at);
  const next: SlotPick = item.kind === 'move'
    ? { from: item.from, ...(item.fromSlot !== at ? { fromSlot: item.fromSlot } : {}), ...(pick.fx ? { fx: pick.fx } : {}) }
    : { ...pick, fx: { effect: item.effect } };
  return { ...kit, slots: { ...kit.slots, [at]: next } };
}

/** A kit with a slot's move (and its tunes and status), or a target's look, back to the body's own. */
export function withOriginal(kit: ForgeKit, target: StudioTarget, part: StudioPart): ForgeKit {
  if (target === 'aura') { if (part !== 'look' || !kit.aura) return kit; const { aura: _aura, ...rest } = kit; return rest; }
  const pick = kitPick(kit, target);
  // Already the body's own (a kit from before the area slot names none there): nothing to put back.
  if (part === 'move' && !changed(kit, target).move) return kit;
  if (part === 'move') return { ...kit, slots: { ...kit.slots, [target]: { from: kit.body, ...(pick.fx ? { fx: pick.fx } : {}) } } };
  if (!pick.fx) return kit;
  const { fx: _fx, ...rest } = pick;
  return { ...kit, slots: { ...kit.slots, [target]: rest } };
}

/** The look a target wears in a kit, if any. */
export const lookOf = (kit: ForgeKit, target: StudioTarget): ForgeFx | undefined => target === 'aura' ? kit.aura : kitPick(kit, target).fx;
/** Whether a target's move or look differs from the body's own. */
export function changed(kit: ForgeKit, target: StudioTarget): { move: boolean; look: boolean } {
  if (target === 'aura') return { move: false, look: !!kit.aura };
  const pick = kitPick(kit, target);
  return { move: pick.from !== kit.body || (pick.fromSlot !== undefined && pick.fromSlot !== target) || !!pick.tune || !!pick.status, look: !!pick.fx };
}
/** Whether a kit is the body's own in every slot and wears nothing (whatever it is called). */
export const isOwnKit = (kit: ForgeKit) => STUDIO_TARGETS.every(target => { const each = changed(kit, target); return !each.move && !each.look; });

/** Keeps `kit` as the assigned one. An edit with the same `merge` key as the last one replaces it in the history
 *  instead of adding a step (one undo takes back a whole slider drag). Nothing changes for an assignment that changes
 *  nothing. */
function commit(state: StudioState, kit: ForgeKit, merge?: string): StudioState {
  if (same(kit, state.assigned)) return { ...state, merging: merge };
  const merged = merge !== undefined && merge === state.merging;
  const history = merged ? state.history : [...state.history, state.assigned].slice(-STUDIO_HISTORY);
  return { ...state, assigned: kit, history, merging: merge };
}

/** Tries `item` in `target`: whatever was being tried goes, and its target is what is assigned again. */
export function tryItem(state: StudioState, target: StudioTarget, item: StudioItem): StudioState {
  const at = targetFor(target, item);
  return { ...state, trial: { target: at, item, kit: withItem(state.assigned, at, item) }, merging: undefined };
}
/** Stops trying: everything is what is assigned. */
export const dropTrial = (state: StudioState): StudioState => state.trial ? { ...state, trial: undefined, merging: undefined } : state;
/** Keeps what is being tried. */
export function assignTrial(state: StudioState): StudioState {
  if (!state.trial) return state;
  return { ...commit(state, state.trial.kit), trial: undefined, merging: undefined };
}
/** Tries and keeps `item` in one step (Enter with nothing tried). */
export const assignItem = (state: StudioState, target: StudioTarget, item: StudioItem) => assignTrial(tryItem(state, target, item));
/** Puts a slot's move, or a target's look, back to the body's own: an assignment, so undo can take it back. A trial in
 *  that target goes too. */
export function original(state: StudioState, target: StudioTarget, part: StudioPart): StudioState {
  const base = state.trial?.target === target ? dropTrial(state) : state;
  const kept = commit(base, withOriginal(base.assigned, target, part));
  return { ...kept, trial: kept.trial && { ...kept.trial, kit: withOriginal(kept.trial.kit, target, part) }, merging: undefined };
}
/** Takes back the last assignment, and anything being tried. */
export function undo(state: StudioState): StudioState {
  if (!state.history.length) return dropTrial(state);
  return { ...state, assigned: state.history[state.history.length - 1], history: state.history.slice(0, -1), trial: undefined, merging: undefined };
}
/** A whole kit loaded (a code, a kept fighter, a share link): an assignment, so undo can take it back. */
export function loadKit(state: StudioState, kit: ForgeKit): StudioState {
  if (kit.forge !== FORGE_VERSION || kit.body !== state.body) return state;
  return { ...commit(dropTrial(state), kit), merging: undefined };
}

/** An edit to one target's settings (its tunes and status, or its look's settings, size and hue), or to the kit's name
 *  (`'name'`). While that target is being tried, the edit is the trial's and is kept with it when it is assigned;
 *  otherwise it is an assignment, merged with the last one when `merge` repeats (a slider dragged). An edit elsewhere
 *  is carried into the trial's kit too, so assigning the trial never undoes it. */
export function edit(state: StudioState, target: StudioTarget | 'name', change: (kit: ForgeKit) => ForgeKit, merge?: string): StudioState {
  if (state.trial && state.trial.target === target) return { ...state, trial: { ...state.trial, kit: change(state.trial.kit) }, merging: undefined };
  const kept = commit(state, change(state.assigned), merge);
  return state.trial ? { ...kept, trial: { ...state.trial, kit: change(state.trial.kit) } } : kept;
}

/* ---------------------------------------------------------------- the edits themselves, as kit changes */

/** A slot's tune set (1, or nothing: the move as it comes). */
export const withTune = (slot: AttackSlot, key: 'power' | 'reach' | 'speed', value: number) => (kit: ForgeKit): ForgeKit => {
  const pick = kitPick(kit, slot), tune = { ...pick.tune, [key]: value };
  if (Math.abs(value - 1) < 1e-9) delete tune[key];
  const { tune: _tune, ...rest } = pick;
  return { ...kit, slots: { ...kit.slots, [slot]: Object.keys(tune).length ? { ...rest, tune } : rest } };
};
/** A slot's status set, or cleared (`undefined`). */
export const withStatus = (slot: AttackSlot, status: SlotPick['status']) => (kit: ForgeKit): ForgeKit => {
  const { status: _status, ...rest } = kitPick(kit, slot);
  return { ...kit, slots: { ...kit.slots, [slot]: status ? { ...rest, status } : rest } };
};
/** A target's look changed (its settings, size or hue); nothing for a target that wears none. */
export const withLook = (target: StudioTarget, change: (fx: ForgeFx) => ForgeFx) => (kit: ForgeKit): ForgeKit => {
  const fx = lookOf(kit, target);
  if (!fx) return kit;
  return target === 'aura' ? { ...kit, aura: change(fx) } : { ...kit, slots: { ...kit.slots, [target]: { ...kitPick(kit, target), fx: change(fx) } } };
};
/** One of a look's settings, its size (`scale`, 1: as cast) or its hue turn (0: its own colours). */
export const lookSetting = (key: string, value: number | string | boolean) => (fx: ForgeFx): ForgeFx => ({ ...fx, settings: { ...fx.settings, [key]: value } });
export const lookScale = (scale: number) => (fx: ForgeFx): ForgeFx => { const { scale: _scale, ...rest } = fx; return Math.abs(scale - 1) < 1e-9 ? rest : { ...rest, scale }; };
export const lookHue = (hue: number) => (fx: ForgeFx): ForgeFx => { const { hue: _hue, ...rest } = fx; return hue === 0 ? rest : { ...rest, hue }; };
export const withName = (name: string) => (kit: ForgeKit): ForgeKit => ({ ...kit, name });
