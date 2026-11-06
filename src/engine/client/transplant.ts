import type { AttackSlot, CombatEvent, FighterId, GameSnapshot, PlayerState } from '../../game/types';
import type { Fighter } from '../../render/Fighter';
import { MOVES } from '../../game/moves';
import { FIGHTERS } from '../../config';
import { ATTACK_SLOTS } from '../sim/spec';
import { areaAnimOf, areaCardOf } from '../sim/areaMoves';
import { areaCastAnim } from '../../originals/areaCasts';
import { forgedMoveFor } from '../sim/forgedKits';
import { moveSource, onKitChange, presentationKit, registerTransplant } from './forgeLive';
import { fitAhead, installTakes, knownTakes, onTakeWanted, setTakes } from './transplantTakes';
import { loadTakePack } from './takePacks';

/** A borrowed move being thrown: the slot it sits in, and whose move it is, from which of their slots. */
export interface Borrowed { readonly slot: AttackSlot; readonly fighter: FighterId; readonly fromSlot: AttackSlot }

const SLOTS: ReadonlySet<string> = new Set(ATTACK_SLOTS);

/** Whether a player brings a kit at all (cheap: no kit, nothing here does anything). */
export const forged = (state: { fighter: FighterId; forge?: string; enemy?: string }) => !state.enemy && !!presentationKit(state);

/** The borrowed move a player's action throws now, if it is one: a slot whose move is another fighter's, or another of
 *  the body's own slots - the light only as the string's first blow, and never a combo ender (both stay the body's own,
 *  the simulation's rule: forgedKits.ts forgedMoveFor). */
export function borrowedAction(state: PlayerState): Borrowed | undefined {
  const slot = state.action;
  if (state.enemy || !SLOTS.has(slot)) return undefined;
  if (slot === 'light' ? (state.chain ?? 0) > 0 : !!state.branch && (slot === 'heavy' || slot === 'special')) return undefined;
  const source = moveSource(state, slot as AttackSlot);
  return source ? { slot: slot as AttackSlot, fighter: source.fighter, fromSlot: source.slot } : undefined;
}
export function areaAnimBorrowed(state: PlayerState): Borrowed | undefined {
  if (state.enemy || state.action !== 'area' || moveSource(state, 'area')) return undefined;
  if (areaCastAnim(state)) return undefined;
  const anim = areaAnimOf(state.fighter, forgedMoveFor(state) ?? MOVES[state.fighter]?.area);
  return anim.fighter !== state.fighter ? { slot: 'area', fighter: anim.fighter, fromSlot: anim.slot } : undefined;
}
/** Every fighter whose take a player's own area move borrows for its cast (`area.anim.from`). */
const areaAnimDonor = (p: PlayerState): FighterId | undefined => {
  if (p.enemy || moveSource(p, 'area')) return undefined;
  if (areaCastAnim({ ...p, action: 'area' })) return undefined;
  const from = areaAnimOf(p.fighter, forgedMoveFor(p) ?? MOVES[p.fighter]?.area).fighter;
  return from !== p.fighter ? from : undefined;
};
/** Whether an event is a borrowed move's (it names a body other than the move's fighter). */
export const borrowedEvent = (event: CombatEvent) => !!event.body && event.body !== event.fighter;

/* ------------------------------------------------------------------------------------------------ events */

/** The events whose `fighter` and `slot` are the thrower's move (simulation.ts emit): the cast and everything its move
 *  does, an area move's strikes (`impact`) included. Not `vanish`, `break` or `status` (they name the other body's
 *  fighter), and `land` only for a thrower landing from their own move (it carries `drop`; a launched body's landing
 *  names its attacker's slot). */
const MOVE_EVENTS: ReadonlySet<CombatEvent['kind']> = new Set(['cast', 'release', 'hit', 'blocked', 'guard-break', 'just-guard', 'confirm', 'whiff', 'projectile-clash', 'land', 'impact'] as CombatEvent['kind'][]);
const presented = new WeakMap<CombatEvent, CombatEvent>();

/** An event as it is drawn and heard: a borrowed move's names the move's fighter and slot, and the body in `body`. */
export function presentEvent(event: CombatEvent, players: readonly PlayerState[]): CombatEvent {
  if (!event.slot || event.body || event.enemy || !MOVE_EVENTS.has(event.kind)) return event;
  const known = presented.get(event);
  if (known) return known;
  if (event.branch || (event.slot === 'light' && (event.chain ?? 0) > 0) || (event.kind === 'land' && event.drop === undefined)) return event;
  const actor = players.find(p => p.id === event.actorId);
  if (!actor || actor.enemy || (event.fighter !== undefined && event.fighter !== actor.fighter)) return event;
  const source = moveSource(actor, event.slot);
  if (!source) return event;
  const shown: CombatEvent = { ...event, fighter: source.fighter, slot: source.slot, body: actor.fighter };
  if (source.slot === 'light') shown.chain = 0; else delete shown.chain;
  presented.set(event, shown);
  return shown;
}
/** A list of events as drawn and heard; the very same list when none is a borrowed move's. */
export function presentEvents<T extends CombatEvent>(events: readonly T[], players: readonly PlayerState[]): T[] {
  let out: T[] | undefined;
  if (players.some(forged)) for (let i = 0; i < events.length; i++) {
    const shown = presentEvent(events[i], players) as T;
    if (shown !== events[i]) (out ??= events.slice())[i] = shown;
  }
  return out ?? events as T[];
}
const snapshots = new WeakMap<GameSnapshot, GameSnapshot>();
/** A snapshot as drawn and heard: the same snapshot with its borrowed moves' events presented (presentEvent), or the
 *  very same object where it has none. One copy per snapshot, so a snapshot drawn over several frames stays one. */
export function presentSnapshot<T extends GameSnapshot | undefined>(snapshot: T): T {
  if (!snapshot) return snapshot;
  let shown = snapshots.get(snapshot);
  if (!shown) {
    const events = presentEvents(snapshot.events, snapshot.players);
    shown = events === snapshot.events ? snapshot : { ...snapshot, events };
    snapshots.set(snapshot, shown);
  }
  return shown as T;
}

/* ------------------------------------------------------------------------------------------------ players */

const players = new WeakMap<PlayerState, PlayerState>();
/** Players as the combat audio reads them: one throwing a borrowed move from another slot is in that slot, so a cast's
 *  sounds are matched to the action that throws them (CombatAudio's cast tracking). Fighter, place and clock unchanged. */
export function presentPlayers(list: PlayerState[]): PlayerState[] {
  let out: PlayerState[] | undefined;
  for (let i = 0; i < list.length; i++) {
    const p = list[i], move = p.enemy ? undefined : borrowedAction(p);
    if (!move || move.fromSlot === move.slot) continue;
    let shown = players.get(p);
    if (!shown || shown.action !== move.fromSlot) {
      shown = { ...p, action: move.fromSlot, chain: move.fromSlot === 'light' ? 0 : undefined, branch: undefined };
      players.set(p, shown);
    }
    (out ??= list.slice())[i] = shown;
  }
  return out ?? list;
}

/* ------------------------------------------------------------------------------------------------ bodies */

interface View {
  readonly proxy: Fighter;
  /** The state it was shown with this frame, and the frame. */
  shown?: PlayerState;
  frame: number;
  /** Bound methods, so a method reached through the view runs on the Fighter itself (with its own state). */
  readonly bound: Map<PropertyKey, { raw: unknown; fn: unknown }>;
  /** Whether the body was showing a borrowed move last frame. */
  borrowing: boolean;
}
const views = new WeakMap<Fighter, View>();
let frame = 0;
const shownFighters = new Map<string, Fighter>();

/** What an effect module reads of a body throwing a borrowed move: the move's fighter, in the move's slot, unawakened
 *  (the move's own look; the body's aura is AwakeningEffects', which reads the bodies themselves). */
function stateOf(fighter: Fighter, view: View): PlayerState {
  if (view.frame !== frame) {
    view.frame = frame;
    const real = fighter.state, move = borrowedAction(real);
    view.shown = move ? { ...real, fighter: move.fighter, action: move.fromSlot, chain: move.fromSlot === 'light' ? 0 : undefined, branch: undefined, awakened: false } : undefined;
    // A move's effect may hide the body (an Cloudstep, a blink); its own frame puts it back, but the move can
    // end on a hidden frame, and after it the body is no longer that fighter's for the module to show again.
    if (view.borrowing && !move) restoreVisibility(fighter);
    view.borrowing = !!move;
  }
  return view.shown ?? fighter.state;
}
/** The base body shown again after a borrowed move, unless its own form is the body drawn (Fighter.update keeps that). */
function restoreVisibility(fighter: Fighter) {
  if (fighter.model.visible) return;
  const form = fighter.group.children.some(child => child !== fighter.model && child.visible && child.name.startsWith('fighter-'));
  if (!form) fighter.model.visible = true;
}
function viewOf(fighter: Fighter): Fighter {
  let view = views.get(fighter);
  if (!view) {
    const made: View = { frame: -1, bound: new Map(), borrowing: false } as unknown as View;
    (made as { proxy: Fighter }).proxy = new Proxy(fighter, {
      get(target, key) {
        if (key === 'state') return stateOf(target, made);
        const value = Reflect.get(target, key, target);
        if (typeof value !== 'function') return value;
        let bound = made.bound.get(key);
        if (!bound || bound.raw !== value) { bound = { raw: value, fn: (value as (...args: unknown[]) => unknown).bind(target) }; made.bound.set(key, bound); }
        return bound.fn;
      },
      set(target, key, value) { return Reflect.set(target, key, value, target); },
    });
    views.set(fighter, view = made);
  }
  return view.proxy;
}
/** The fighter each body was last shown to the effect modules as, and the bodies whose fighter changed this frame. */
const shownAs = new Map<string, FighterId>();
const turned = new Set<string>();
const steadyFighters = new Map<string, Fighter>();
/** The bodies as the effect modules read them, once a frame: a forged player's body is a view whose state reads as the
 *  borrowed move it throws (stateOf); everyone else's is itself. The very same map when nobody is forged. */
export function presentFighters(fighters: Map<string, Fighter>): Map<string, Fighter> {
  frame++;
  turned.clear();
  let any = false;
  for (const fighter of fighters.values()) if (forged(fighter.state)) { any = true; break; }
  if (any) {
    shownFighters.clear();
    for (const [id, fighter] of fighters) shownFighters.set(id, forged(fighter.state) ? viewOf(fighter) : fighter);
  }
  const shown = any ? shownFighters : fighters;
  for (const [id, fighter] of shown) {
    const as = fighter.state.fighter, was = shownAs.get(id);
    if (was !== undefined && was !== as) turned.add(id);
    shownAs.set(id, as);
  }
  if (shownAs.size > shown.size) for (const id of shownAs.keys()) if (!shown.has(id)) shownAs.delete(id);
  return shown;
}
/** The bodies for the effect modules' per-frame updates: as presentFighters gives them, less any body whose fighter
 *  changed this frame - a borrowed move begun or ended. The modules keep a body's own lasting visuals by its fighter (a
 *  spirit out, a Guardian, a decoy, a trail) and let them go when the body leaves; so for that one frame it has left, and
 *  the last fighter's visuals go with it rather than staying on the body for good. Its events are still handled. */
export function steadyBodies(shown: Map<string, Fighter>): Map<string, Fighter> {
  if (!turned.size) return shown;
  steadyFighters.clear();
  for (const [id, fighter] of shown) if (!turned.has(id)) steadyFighters.set(id, fighter);
  return steadyFighters;
}

/* ------------------------------------------------------------------------------------------------ names */

const INDEX: Readonly<Record<AttackSlot, number>> = { light: 0, heavy: 1, special: 2, ultimate: 3, area: -1 };
/** The HUD's names for a player's slot: the card's short and full names of the move the slot carries (the move's own
 *  fighter's card), or undefined for the body's own move. */
export function slotNames(state: { fighter: FighterId; forge?: string }, slot: AttackSlot): { short: string; name: string; from: FighterId; fromSlot: AttackSlot } | undefined {
  const source = moveSource(state, slot);
  if (!source) return undefined;
  const card = FIGHTERS[source.fighter], i = INDEX[source.slot];
  const move = i < 0 ? MOVES[source.fighter]?.[source.slot] : undefined;
  const name = (move ? move.name : card.moves[i]) ?? source.slot;
  return { short: move ? areaCardOf(move).toUpperCase() : card.shortMoves?.[i] ?? name.toUpperCase(), name, from: source.fighter, fromSlot: source.slot };
}

/* ------------------------------------------------------------------------------------------------ assets */

/** The fighters whose moves the players' kits borrow, besides `have` (the room's own): their effects are loaded for their
 *  looks (their takes come in their take packs; their models are not needed). */
export function transplantDonors(list: readonly PlayerState[], have: readonly FighterId[] = []): FighterId[] {
  const out = new Set<FighterId>();
  for (const p of list) {
    const animated = areaAnimDonor(p);
    if (animated && !have.includes(animated)) out.add(animated);
    if (!forged(p)) continue;
    for (const slot of ATTACK_SLOTS) { const source = moveSource(p, slot); if (source && !have.includes(source.fighter)) out.add(source.fighter); }
  }
  return [...out];
}
/** A room's donors as a key, so a new kit (a pick in the Forge, a kit arriving for a room) loads what it needs. */
export const transplantKey = (list: readonly PlayerState[]) => { const donors = transplantDonors(list); return donors.length ? `+${donors.sort().join(',')}` : ''; };
/** The fighters whose moves were made ready last, most recent last: their effects stay loaded with the room's, so trying
 *  one move after another does not retire and rebuild the last one's effects (RosterSignatureSet keeps only what it is
 *  asked for). */
const recent: FighterId[] = [];
const RECENT = 6;
const remember = (from: FighterId) => { const at = recent.indexOf(from); if (at >= 0) recent.splice(at, 1); recent.push(from); if (recent.length > RECENT) recent.shift(); };
/** The fighters whose effects a room loads besides its own: its kits' donors and the moves made ready last. */
export function effectDonors(list: readonly PlayerState[], have: readonly FighterId[] = []): FighterId[] {
  return [...new Set([...transplantDonors(list, have), ...recent.filter(id => !have.includes(id))])];
}

/** What the page lends the transplant (main.ts): the bodies' library, and how the room's effects are loaded with donors. */
export interface TransplantHost {
  /** Loads fighters' models and clips (FighterLibrary.ensure): the body's, and a donor's only when it has no take pack. */
  ensure(ids: readonly FighterId[]): Promise<void>;
  /** A body of a loaded fighter's, built from the library, to read its takes or its rig off (let go after); undefined
   *  while its files are not loaded. */
  donor(state: PlayerState): Fighter | undefined;
  /** The bodies drawn now (a forged player's included), so a move is fitted to the very rigs that will throw it. */
  bodies(): Iterable<Fighter>;
  /** Loads the effects of the room's fighters and of `donors` with them (the room's effect sets retire what is absent:
   *  `effectDonors` says which to keep). */
  effects(donors: readonly FighterId[]): Promise<void>;
  /** Links the programs of whatever was just loaded, so the first throw does not compile. */
  compile(): Promise<void>;
}
let host: TransplantHost | undefined;
/** Where moves are being made ready (one promise per fighter and slot). */
const preparing = new Map<string, Promise<void>>();
/** A plain standing state of a fighter's, for a body built to be read. */
const standing = (fighter: FighterId): PlayerState => ({ id: `transplant-${fighter}`, name: 'Transplant', fighter, x: 0, y: -1000, z: 0, yaw: 0, hp: 1, maxHp: 1,
  stamina: 100, ultimate: 0, action: 'idle', actionStarted: 0, actionDuration: 1, actionTime: 0, target: null, alive: true, isBot: true, grounded: true,
  guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } });
/** Fits `from`'s `fromSlot` takes onto the bodies of `body`'s drawn now (or one built to be read), ahead of a throw. */
function fitFor(body: FighterId, from: FighterId, fromSlot: AttackSlot, steps?: Record<string, number>) {
  if (!host) return;
  let at = performance.now();
  const lap = (name: string) => { if (steps) { const now = performance.now(); steps[name] = (steps[name] ?? 0) + Math.round(now - at); at = now; } };
  const live = [...host.bodies()].filter(each => each.state.fighter === body), made = live.length ? undefined : host.donor(standing(body));
  lap('body');
  try { fitAhead(from, fromSlot, made ? [made] : live, id => { const donor = host?.donor(standing(id)); lap('donor'); return donor; }); } finally { made?.dispose(); }
  lap('fit');
}

/** What each step of the last few prepares took (ms): read by the capture tools (scripts/engine/forge_first_try.mjs). */
const timings: { move: string; steps: Record<string, number>; total: number }[] = [];
const recorded = (move: string, started: number, steps: Record<string, number>) => {
  timings.push({ move, steps, total: Math.round(performance.now() - started) });
  if (timings.length > 32) timings.shift();
};
export const prepareTimings = () => timings;
if (typeof navigator === 'object' && navigator.webdriver && typeof window === 'object') (window as unknown as { __transplantTimings?: typeof timings }).__transplantTimings = timings;

/** How long a move made ready waits, once its take is fitted, for its effects to be loaded and linked: an effect still
 *  loading after that (a spirit's model) comes in during the throw, rather than holding the throw. */
export const EFFECTS_GRACE = 100;
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
/** Where each fighter's takes are being got: its take pack, or (without one) its files and a body of its own. */
const getting = new Map<FighterId, Promise<void>>();
function takesFor(from: FighterId, steps?: Record<string, number>) {
  let pending = getting.get(from);
  if (!pending) {
    pending = (async () => {
      if (knownTakes(from)) return;
      const started = performance.now(), packed = await loadTakePack(from);
      // The four core slots' takes: an area move is drawn with one of them (transplantTakes.ts takeSlotOf).
      if (packed?.light && packed.heavy && packed.special && packed.ultimate) { setTakes(from, packed as Required<typeof packed>); if (steps) steps.pack = Math.round(performance.now() - started); return; }
      await host?.ensure([from]);
      if (steps) steps.files = Math.round(performance.now() - started);
    })();
    getting.set(from, pending);
    pending.catch(() => getting.delete(from));
  }
  return pending;
}
/** Effects being loaded and linked for a fighter's moves, once per fighter. */
const linking = new Map<FighterId, Promise<void>>();
function effectsFor(from: FighterId) {
  let pending = linking.get(from);
  if (!pending) {
    pending = (async () => { if (!host) return; await host.effects([from]); await host.compile(); })();
    linking.set(from, pending);
    pending.catch(() => linking.delete(from));
  }
  return pending;
}

/** Makes `from`'s `fromSlot` move ready in `body`'s, and resolves when the next throw will show it: its take fitted to
 *  the body (from `from`'s take pack, one small file; its files and a body of its own when it has none; an area move's
 *  take is the core take its `area.anim` names), its effects loaded and linked alongside - waited for EFFECTS_GRACE at
 *  most past the take. Another of the body's own moves needs nothing: its own take plays. Safe to call again: it is
 *  done once per move. */
export function prepare(body: FighterId, from: FighterId, fromSlot: AttackSlot): Promise<void> {
  const key = `${body}:${from}:${fromSlot}`;
  let ready = preparing.get(key);
  if (!ready) {
    const work = async () => {
      if (!host || body === from) return;
      remember(from);
      const started = performance.now(), steps: Record<string, number> = {};
      const effects = effectsFor(from).then(() => { steps.effects = Math.round(performance.now() - started); });
      effects.catch(error => console.warn(`Transplant: ${from}'s effects could not be loaded`, error));
      await Promise.all([takesFor(from, steps), host.ensure([body])]);
      let at = performance.now();
      fitFor(body, from, fromSlot, steps);
      steps.take = Math.round((at = performance.now()) - started);
      await Promise.race([effects, wait(EFFECTS_GRACE)]).catch(() => {});
      recorded(key, started, steps);
    };
    ready = work().catch(error => { preparing.delete(key); console.warn(`Transplant: ${from}'s ${fromSlot} could not be readied for ${body}`, error); });
    preparing.set(key, ready);
  }
  return ready;
}
/** Starts getting a fighter's takes (its take pack: its four core takes, which draw its area move too), without
 *  fitting anything: the Forge's warm-up for a fighter the player is likely to try. */
export function prefetch(from: FighterId) {
  if (!host) return;
  void takesFor(from).catch(() => {});
}
/** Every borrowed move of a kit made ready (a kit put in play offline, on every pick in the Forge). */
function prepareKit(body: FighterId) {
  const state = { fighter: body };
  for (const slot of ATTACK_SLOTS) { const source = moveSource(state, slot); if (source) void prepare(body, source.fighter, source.slot); }
}

/** Connects the transplant to the page (main.ts, once): registers it with the Forge (forgeLive.ts) and readies every
 *  kit put in play. */
export function installTransplant(page: TransplantHost) {
  host = page;
  installTakes();
  registerTransplant({ prepare, prefetch });
  onKitChange((body, kit) => { if (kit) prepareKit(body); });
  // A move thrown before it was made ready (a kit arriving with a room): made ready for its next throw, and fitted to
  // the bodies drawn now as soon as its takes are known.
  onTakeWanted((body, from, fromSlot) => { if (knownTakes(from)) fitFor(body, from, fromSlot); else void prepare(body, from, fromSlot); });
}

/** For tests: the transplant as it was before install. */
export function resetTransplant() { host = undefined; preparing.clear(); getting.clear(); linking.clear(); recent.length = 0; }
