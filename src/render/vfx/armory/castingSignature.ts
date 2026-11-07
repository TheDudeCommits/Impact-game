import * as THREE from 'three';
import type { AttackSlot, CombatEvent, FighterId } from '../../../game/types';
import { MOVES, type MoveDefinition } from '../../../game/moves';
import { FIGHTERS } from '../../../config';
import type { FighterCasting, SlotCasting } from '../../../engine/vfx/casting';
import { ARMORY_CASTINGS, type RuntimeCasting } from './vendor/castings';
import type { ForgeFx } from '../../../engine/sim/forge';
import { splitSettings, type Macros } from './macros';
import { auraFx } from './fxLookup';
import type { Fighter } from '../../Fighter';
import type { Flight } from '../../CombatEffects';
import type { VfxKit } from '../VfxKit';
import { bodyCentre } from '../VfxKit';
import { EffectRegistry, type CueContext, type EffectAnchor, type EffectFrame, type EffectInstance, type EffectType, type Tier } from '../engine/Effect';
import { CueDirector, type Cue, type CueAnchorSpec, type CueTrack } from '../engine/cues';
import { registerIce, definePreset, presetFromPalette, ICE, type CrystalFieldParams, type FreezeOnHitParams, type GlacierJavelinParams, type FloorFreezeParams, type IcePheasantParams } from '../engine/ice';
import { involvesLocal } from '../../signature/context';
import { FITS } from './fits';
import { armoryRollout, CAST } from './rollout';
import { clearArmoryDrawn, markArmoryDrawn, markArmoryHit, markArmoryOnly } from './drawn';
import type { ArmoryParams } from './effect';

/**
 * A fighter drawn from its VFX casting (src/engine/vfx/casting.json; docs/engine/armory/README.md): the Jump Engine's
 * signature for every fighter in the rollout (src/engine/vfx/rollout.json): the live list in every build, the preview
 * rollout besides in a build made with it.
 *
 *  - **The moves.** Each move slot's pick becomes cues (VOL.2's CueDirector): an Armory id as `armory/<id>` (effect.ts),
 *    a pick with a `/` as the engine's own type (`ice/crystal-field`, registered with `registerIce`). The pick is
 *    tried first, then the casting's alternates: the first the game can run is drawn, so a pick the adapter cannot host
 *    (an Effekseer effect) falls back to the casting's own next choice, and none leaves the slot to the game.
 *    The casting's `on`, `anchor` and `scale` and the move itself (its contacts, range, speed, radius) say when, where
 *    and how big: a `release` starts on the move's clock at its first contact, a `hit` on the last blow of a move with
 *    several, a `confirm` when an ultimate's opener lands.
 *  - **The body.** The body slot's aura is state-driven: worn while awakened, or always, as `when` says, following the
 *    body (`AuraDriver`).
 *  - **Everything else** is the fighter's existing signature module's, handed every event and flight as before. The
 *    plain moves the casting draws are marked (drawn.ts); the module leaves their flights, finishers and hit impacts to
 *    the casting, and keeps their wind-ups (a burning fist, a glowing blade), the combo enders and the impact frames.
 *    A fighter with no module of its own (Kagari, an original) gets this one, so CombatEffects stops drawing his generic
 *    projectiles and GummyEffects, which draws his fire, leaves the cast moves to it (drawn.ts) too.
 *  - **Colours.** The casting's palette: an Armory effect's colour keys per cast (fits.ts), the ICE kit's look built
 *    from it (`presetFromPalette`, unless the fighter has a tuned one).
 *  - **Sound.** An Armory effect's own sound, through the game's audio (sound.ts): by default only its bed (its loop and
 *    its tail, which the game's move sounds don't cover), the whole profile with the slot's `sound: true`, none with
 *    `false`. A fan of casts sounds once.
 */

export type MoveSlot = Exclude<AttackSlot, 'body'>;
/** The engine's own effect types a casting may pick (casting.ts `NATIVE_EFFECTS`: the ICE kit's), and the test for one.
 *  The game reads the castings from vendor/castings.ts (palettes and slots, generated), never casting.json itself. */
const NATIVE = new Set<string>(Object.values(ICE));
const isNative = (id: string) => id.includes('/');
type Casting = Pick<FighterCasting, 'palette'> & { readonly slots?: Partial<FighterCasting['slots']> };
const MOVE_SLOTS: readonly MoveSlot[] = ['light', 'heavy', 'special', 'ultimate'] as MoveSlot[];
/** The casting's scale as a size against the Armory's 1.8 m caster (before the fighter's height). */
export const SCALE = Object.freeze({ small: .62, medium: .82, large: 1, huge: 1.25 });
/** A body aura is the wearer's size whatever the casting's scale, which only makes it a little bigger or smaller. */
export const AURA_SCALE = Object.freeze({ small: .95, medium: 1.05, large: 1.15, huge: 1.3 });

export interface BodyAura { readonly effect: string; readonly when: 'awakened' | 'always'; readonly params: ArmoryParams }
export interface CastingTrack {
  readonly cues: CueTrack;
  /** What each move slot draws: an Armory id, a native type, or null (the game's own effect). */
  readonly slots: Readonly<Partial<Record<MoveSlot | 'body', string | null>>>;
  readonly body?: BodyAura;
  /** The Armory effects and native types it uses. */
  readonly armory: readonly string[];
  readonly native: readonly string[];
}

/** A slot's effect as the game will draw it: its pick, else its first alternate the game can run, else none. */
export function resolvePick(slot: SlotCasting | undefined, available: (id: string) => boolean): string | null {
  for (const id of slot?.pick ? [slot.pick, ...(slot.alt ?? [])] : []) {
    if (isNative(id)) { if (NATIVE.has(id)) return id; continue; }
    if (available(id)) return id;
  }
  return null;
}

const heightOf = (fighter: FighterId) => (FIGHTERS as Record<string, { height?: number }>)[fighter]?.height ?? 1.7;

/** When a slot's cue starts on its move's clock, from the casting's `on`, and the cue fields that say so. */
function timing(cast: Pick<SlotCasting, 'on'>, slot: MoveSlot, move: Pick<MoveDefinition, 'contacts' | 'duration'>) {
  const on = cast.on ?? (slot === 'light' ? 'hit' : 'release');
  const contacts = move.contacts.length ? move.contacts : [0];
  const first = contacts[0], last = contacts[contacts.length - 1];
  switch (on) {
    case 'cast': return { start: 0, finisher: last, release: false, cue: { on: 'cast' as const } };
    case 'release': return { start: first, finisher: last, release: true, cue: { on: 'cast' as const, at: first } };
    case 'hit': return { start: last, finisher: last, release: true, cue: { on: 'hit' as const, ...(contacts.length > 1 ? { contact: contacts.length - 1 } : {}) } };
    case 'confirm': return { start: first, finisher: last, release: false, cue: { on: 'confirm' as const, life: 'move' as const } };
    case 'land': return { start: last, finisher: last, release: true, cue: { on: 'land' as const } };
  }
}

/** Where a slot's effect is laid out and what it is anchored to, from the casting's `anchor` and the move's style. */
function placement(cast: Pick<SlotCasting, 'anchor'>, move: Pick<MoveDefinition, 'style'>, on: string): { lay: ArmoryParams['lay']; anchor: CueAnchorSpec } {
  const melee = move.style === 'melee';
  switch (cast.anchor) {
    case 'target': return { lay: on === 'hit' || on === 'confirm' ? 'target' : 'line', anchor: on === 'hit' || on === 'confirm' ? { of: 'target', socket: 'centre', follow: false } : { socket: 'hand', follow: false } };
    case 'ground': return { lay: 'zone', anchor: on === 'hit' || on === 'confirm' ? { of: 'target', socket: 'floor', follow: false } : { socket: 'endpoint', follow: false } };
    case 'weapon': return { lay: 'line', anchor: { socket: 'strike', follow: false } };
    case 'feet': return { lay: 'line', anchor: { socket: 'floor', follow: false } };
    case 'body': return { lay: 'body', anchor: { socket: 'centre', follow: true } };
    case 'hand': return { lay: 'line', anchor: { socket: 'hand', follow: false } };
    default: return { lay: 'line', anchor: { socket: melee ? 'strike' : 'hand', follow: false } };
  }
}

/** A Forge kit's touches on a slot's effect: its size against the casting's, its colours turned (no palette), the
 *  Essentials dials, and its sound. */
export interface FxLook { scale?: number; hue?: number; macros?: Macros; sound?: ArmoryParams['sound'] }

/** The cues an Armory pick plays for one move slot. */
function armoryCues(fighter: FighterId, slot: MoveSlot, cast: Omit<SlotCasting, 'why'>, pick: string, move: MoveDefinition, palette: FighterCasting['palette'] | undefined, own: boolean, look?: FxLook): Cue[] {
  const when = timing(cast, slot, move), place = placement(cast, move, when.cue.on), fit = FITS[pick] ?? {};
  const height = heightOf(fighter), size = SCALE[cast.scale ?? 'medium'] * height / 1.8 * (look?.scale ?? 1);
  const reach = Math.max(1.5, move.range + .5);
  const projectile = move.style === 'projectile' || move.style === 'beam' || move.style === 'bomb';
  const after = Math.max(.2, move.duration - when.start);
  const zone = fit.radius, wanted = move.radius ? move.radius * (cast.scale === 'huge' ? 1.5 : 1.2) : undefined;
  const params: ArmoryParams = {
    lay: place.lay, reach, size, height, ...(palette ? { palette: { core: palette.core, main: palette.main, rim: palette.rim } } : {}),
    ...(look?.hue ? { hue: look.hue } : {}), ...(look?.macros ? { macros: look.macros } : {}),
    release: when.release, past: projectile ? 1.6 : 1.1,
    // A thrown move's front flies with its projectile; a blow's is there as it lands.
    speed: projectile ? move.speed ?? 30 : Math.max(40, reach / .05),
    sustain: Math.min(1.6, Math.max(.25, after - .2)),
    hold: after + .8,
    radius: wanted === undefined ? zone?.[0] : zone ? Math.min(zone[1], Math.max(zone[0], wanted)) : Math.max(1.5, wanted),
    ...(fit.pace && fit.peak ? { pace: fit.peak / Math.max(.35, when.finisher - when.start) } : {}),
    set: cast.settings,
    light: .35,
    // A fighter with no module of its own has nobody else to give its ultimate its impact frame.
    impactFrame: slot === 'ultimate' && !own ? .42 : 0,
  };
  // An ultimate's blast runs well past its victim: a melee ultimate's reach is arm's length, its fire is not.
  if (slot === 'ultimate' && place.lay === 'line') { params.reach = Math.max(reach, 7); params.past = 4; }
  // A fan is one cast: its sound is its middle thread's.
  const fan = Math.max(1, Math.min(7, Math.round(cast.fan ?? 1))), spread = (cast.spread ?? 26) * Math.PI / 180, sound = look ? look.sound : soundOf(cast);
  return Array.from({ length: fan }, (_, i): Cue => ({ ...when.cue, slot, type: `armory/${pick}`, preset: `armory/${fighter}`, anchor: place.anchor,
    params: { ...params, ...(fan > 1 ? { yaw: (i / (fan - 1) - .5) * spread } : {}), ...(sound && i === fan >> 1 ? { sound } : {}) } }));
}

/** A slot's sound (sound.ts): the bed unless its casting asks for the whole profile (`sound: true`) or none (`false`). */
export const soundOf = (cast: Pick<SlotCasting, 'sound'>): ArmoryParams['sound'] => cast.sound === false ? undefined : cast.sound ? 'full' : 'bed';

/** A Forge kit's effect on a slot (kit v2 `fx`, src/engine/client/forgeLive.ts), as cues: `body`'s size and the move
 *  the slot throws (`moveFighter`'s: a borrowed move's own timing), placed as a casting of the same pick would be, in
 *  the effect's own colours turned by `hue`, its own settings and Essentials dials over the fit's, and its sound's bed. */
export function fxCues(body: FighterId, moveFighter: FighterId, slot: MoveSlot, fx: ForgeFx): Cue[] {
  // The move as thrown (a borrowed move is its own fighter's), the effect sized by the body.
  const move = MOVES[moveFighter]?.[slot] ?? MOVES[body]?.[slot];
  if (!move) return [];
  const { macros, own } = splitSettings(fx.settings);
  const cast = { pick: fx.effect, settings: Object.keys(own).length ? own : undefined };
  if (isNative(fx.effect)) return NATIVE.has(fx.effect) ? nativeCues(body, slot, cast, fx.effect, move) : [];
  // Its own module is left out for the move, so an ultimate's impact frame comes with it.
  return armoryCues(body, slot, cast, fx.effect, move, undefined, false, { scale: fx.scale, hue: fx.hue, macros, sound: 'bed' });
}

const VICTIM_FLOOR: CueAnchorSpec = { of: 'target', socket: 'floor', follow: false };
const FLIGHT: CueAnchorSpec = { socket: 'flight', follow: true };

/** The cues a native pick (the ICE kit) plays for one move slot: the shapes VOL.2's tuned ice-a uses, sized by the
 *  casting's scale and the move. */
function nativeCues(fighter: FighterId, slot: MoveSlot, cast: Omit<SlotCasting, 'why'>, pick: string, move: MoveDefinition): Cue[] {
  const preset = `ice/${fighter}`, when = timing(cast, slot, move), s = SCALE[cast.scale ?? 'medium'] / .82;
  const contacts = move.contacts.length ? move.contacts : [0], last = contacts.length - 1;
  const projectile = move.style === 'projectile' || move.style === 'beam';
  const cue = <T extends object>(type: string, base: Omit<Cue, 'type' | 'preset' | 'params'>, params: T): Cue => ({ ...base, type, preset, params, slot });
  switch (pick) {
    case ICE.field: {
      if (projectile && cast.anchor === 'line') return [cue<CrystalFieldParams>(ICE.field, { on: 'cast', anchor: FLIGHT }, {
        layout: 'line', reach: move.range, width: [.35 * s, 1.1 * s], count: { low: 22, medium: 38, high: 56 }, height: [1.1 * s, 2.1 * s], radius: .24 * s,
        rubble: .35, lean: .32, rise: .12, hold: .8, sink: .5, end: 'shatter', chips: { low: 0, medium: 1, high: 1 }, bias: 1.35 })];
      if (slot === 'ultimate' || cast.scale === 'huge') return [cue<CrystalFieldParams>(ICE.field, { on: 'hit', contact: contacts.length > 1 ? last : undefined, anchor: VICTIM_FLOOR }, {
        layout: 'disc', reach: 4.6 * s, clear: .9, count: { low: 28, medium: 48, high: 72 }, height: [2.3 * s, .45 * s], radius: .34 * s, rubble: .3,
        spread: 13, spokes: 8, rise: .14, hold: .85, sink: .55, lean: .55, end: 'shatter', chips: { low: 0, medium: 1, high: 2 }, impactFrame: .42 })];
      return [cue<CrystalFieldParams>(ICE.field, { on: 'hit', contact: contacts.length > 1 ? last : undefined, anchor: VICTIM_FLOOR }, {
        layout: 'ring', reach: 1.1 * s, clear: .6, count: { low: 6, medium: 9, high: 12 }, height: [1.4 * s, .75 * s], radius: .22 * s, rubble: .2,
        spread: 0, rise: .1, hold: .35, sink: .3, lean: .5, end: 'shatter', chips: { low: 1, medium: 1, high: 2 } })];
    }
    case ICE.freeze: return [cue<FreezeOnHitParams>(ICE.freeze, { on: 'hit', contact: contacts.length > 1 ? last : undefined, anchor: { of: 'target', joint: 'Hips', follow: true } },
      slot === 'light' || cast.scale === 'small'
        ? { grow: .05, hold: .18, shatter: .2, bulk: 1.18, spikes: { low: 0, medium: 0, high: 1 } }
        : { grow: .09, hold: .7, shatter: .42, bulk: 1.55, spikes: { low: 0, medium: 1, high: 2 } })];
    case ICE.lance: return [cue<GlacierJavelinParams>(ICE.lance, { on: 'cast', anchor: FLIGHT }, { length: 3.1 * s, girdle: .42 * s, charge: contacts[0], speed: move.speed ?? 27, wake: { low: 6, medium: 12, high: 18 } })];
    case ICE.floor: return [cue<FloorFreezeParams>(ICE.floor, projectile ? { on: 'cast', anchor: FLIGHT } : { ...when.cue, anchor: { socket: 'floor', follow: false } },
      projectile ? { shape: 'strip', reach: move.range, width: 1.05 * s, hold: 1.1, thaw: .5 } : { shape: 'disc', reach: 4 * s, grow: .62, hold: 1.25, thaw: .6 })];
    case ICE.pheasant: return [cue<IcePheasantParams>(ICE.pheasant, { on: 'cast', anchor: FLIGHT }, { span: 4.6 * s, charge: contacts[0], speed: move.speed ?? 27, wake: { low: 6, medium: 12, high: 20 } })];
  }
  return [];
}

/** A fighter's whole casting as the engine plays it. Pure: tests and tools build it without a scene. `available` says
 *  which Armory ids this build carries (vendor/manifest.ts); `own` that the fighter has a signature module of its own. */
export function trackFor(fighter: FighterId, casting: Casting, available: (id: string) => boolean, own = true): CastingTrack {
  const cues: Cue[] = [], slots: Partial<Record<MoveSlot | 'body', string | null>> = {}, armory = new Set<string>(), native = new Set<string>();
  for (const slot of MOVE_SLOTS) {
    const cast = casting.slots?.[slot], move = MOVES[fighter]?.[slot];
    const pick = move ? resolvePick(cast, available) : null;
    slots[slot] = pick;
    if (!pick || !cast || !move) continue;
    if (isNative(pick)) { cues.push(...nativeCues(fighter, slot, cast, pick, move)); native.add(pick); }
    else { cues.push(...armoryCues(fighter, slot, cast, pick, move, casting.palette, own)); armory.add(pick); }
  }
  let body: BodyAura | undefined;
  const aura = casting.slots?.body, pick = aura && aura.when !== 'never' ? resolvePick(aura, available) : null;
  slots.body = pick && !isNative(pick) ? pick : null;
  if (pick && !isNative(pick) && aura) {
    const height = heightOf(fighter);
    body = { effect: pick, when: aura.when === 'always' ? 'always' : 'awakened', params: {
      lay: 'body', size: AURA_SCALE[aura.scale ?? 'small'] * height / 1.8, height, palette: { core: casting.palette.core, main: casting.palette.main, rim: casting.palette.rim },
      set: aura.settings, light: .25, ...(soundOf(aura) ? { sound: soundOf(aura) } : {}) } };
    armory.add(pick);
  }
  return { cues: Object.freeze(cues), slots, body, armory: [...armory], native: [...native] };
}

/** How many casts of one Armory effect may run at once in a scene: its cues across the whole rollout (each may still be
 *  burning when its fighter casts again), at least two. Order-independent, so it does not matter who loads first. */
export function capacityOf(id: string, castings: Partial<Record<FighterId, Casting>> = ARMORY_CASTINGS, fighters: readonly FighterId[] = CAST, available: (id: string) => boolean = () => true) {
  let uses = 0;
  for (const fighter of fighters) {
    const casting = castings[fighter];
    if (!casting) continue;
    const track = trackFor(fighter, casting, available);
    uses += track.cues.filter(c => c.type === `armory/${id}`).length + (track.body?.effect === id ? 1 : 0);
  }
  return Math.min(8, Math.max(2, uses * 2));
}

interface Signature {
  load(ids: readonly FighterId[]): Promise<unknown>;
  handle(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>): void;
  prepareContact?(event: CombatEvent, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>): void;
  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>): void;
  reset(): void;
  dispose(): void;
}
type Kit = Pick<VfxKit, 'budget' | 'quality' | 'density' | 'lights'>;

const _p = new THREE.Vector3();
const STILL_ELEMENT = Object.freeze({ spike: 0xffffff, rim: 0xffffff, light: 0xffffff, ink: 0 });

/** The body slot's aura: worn while its condition holds (awakened, or always), by every body of the fighter in the
 *  room, following it; wound down when the condition ends or the body falls. */
class AuraDriver {
  private readonly worn = new Map<string, { instance: EffectInstance<ArmoryParams>; ctx: CueContext & { anchor: EffectAnchor }; born: number; off: boolean }>();
  private readonly frame: EffectFrame & { time: number; fighters: ReadonlyMap<string, Fighter>; flights: ReadonlyMap<string, Flight> };
  private last?: number;
  constructor(private readonly fighter: FighterId, private readonly type: EffectType<ArmoryParams>, private readonly aura: BodyAura, private readonly kit: Kit) {
    const light = kit.lights ? (x: number, y: number, z: number, hex: number, intensity: number, distance: number) => kit.lights!.request(x, y, z, hex, intensity, distance, 1.2) : undefined;
    this.frame = { time: 0, fighters: new Map(), flights: new Map(), locate: (anchor, out) => { const f = anchor.fighter ? this.frame.fighters.get(anchor.fighter) : undefined; if (!f) { out.copy(anchor.point); return false; } bodyCentre(f, out); return true; }, light };
  }
  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) {
    const dt = this.last === undefined ? 0 : Math.max(0, Math.min(.1, time - this.last));
    this.last = time;
    this.frame.time = time; this.frame.fighters = fighters; this.frame.flights = flights;
    for (const [id, f] of fighters) {
      if (f.state?.fighter !== this.fighter) continue;
      // A Forge kit's aura (forgeFx.ts) is worn instead of the casting's. (While a borrowed move is thrown the body reads
      // as the move's fighter, so this skips it then and the aura stays as it was.)
      const wanted = f.state.alive !== false && (this.aura.when === 'always' || !!f.state.awakened) && !auraFx(f);
      const worn = this.worn.get(id);
      if (wanted && !worn) {
        const instance = this.type.acquire();
        if (!instance) continue;
        const ctx = this.context(id, f);
        instance.start(this.aura.params, ctx);
        this.worn.set(id, { instance, ctx, born: time, off: false });
      } else if (!wanted && worn && !worn.off) { worn.off = true; worn.instance.cancel(f.state.alive === false ? 'despawn' : 'interrupt'); }
    }
    for (const [id, worn] of this.worn) {
      let alive = fighters.has(id);
      if (alive) { try { alive = worn.instance.update(time - worn.born, dt, this.frame); } catch (error) { console.warn('armory aura failed', error); alive = false; } }
      if (!alive) { worn.instance.release(); this.worn.delete(id); }
    }
  }
  private context(id: string, f: Fighter): CueContext & { anchor: EffectAnchor } {
    bodyCentre(f, _p);
    const yaw = f.state?.yaw ?? 0;
    return {
      seed: [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7), palette: STILL_ELEMENT, preset: `armory/${this.fighter}`,
      anchor: { point: _p.clone(), fighter: id, socket: 'centre', follow: true, floor: f.group.position.y },
      tier: (this.kit.quality ?? 'high') as Tier, density: this.kit.density ?? 1, local: involvesLocal(id), actorId: id,
      heading: new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)),
    };
  }
  reset() { for (const worn of this.worn.values()) { worn.instance.cancel('despawn'); worn.instance.release(); } this.worn.clear(); this.last = undefined; }
}

/** A rollout fighter: its casting drawn by the engine, everything else by its own module (`base`, if it has one). */
export class CastingSignature implements Signature {
  private director?: CueDirector;
  private aura?: AuraDriver;
  private track?: CastingTrack;
  private loading?: Promise<void>;
  private disposed = false;
  private pump?: () => void;
  /** The room's bodies as the last event saw them: whether a cast's thrower is awakened picks his form's cues. */
  private room?: ReadonlyMap<string, Fighter>;
  constructor(readonly fighter: FighterId, private readonly scene: THREE.Scene, private readonly kit: Kit, readonly base?: Signature) {}

  load(ids: readonly FighterId[]) {
    // A casting that cannot load (its lazy chunk failed to arrive) leaves every slot to the game, as before the Armory;
    // it never holds the room up (a live fighter is drawn this way in release builds).
    this.loading ??= this.prepare().catch(error => { console.warn(`armory casting for ${this.fighter} not loaded`, error); });
    return Promise.all([this.base?.load(ids), this.loading]);
  }

  /** The casting's effects, ready before the room's compile: the Armory's runtime loaded (a lazy chunk, fetched the
   *  first time a casting asks for it), its types made and prewarmed, the ICE kit's registered, the track built. */
  private async prepare() {
    const casting: RuntimeCasting | undefined = ARMORY_CASTINGS[this.fighter];
    if (!casting?.slots) return;
    const runtime = await import('./runtime');
    if (this.disposed) return;
    const track = trackFor(this.fighter, casting, runtime.vendored, !!this.base);
    const registry = new EffectRegistry();
    const { host, types } = await runtime.armoryTypes(this.scene, track.armory, id => capacityOf(id, ARMORY_CASTINGS, CAST, runtime.vendored));
    if (this.disposed) { host.dispose(); return; }
    registry.layer(host);
    for (const type of types) registry.register(type);
    if (track.native.length) {
      registerIce(registry, this.scene);
      if (track.native.some(id => id.startsWith('ice/'))) definePreset(presetFromPalette(`ice/${this.fighter}`, casting.palette));
    }
    registry.prewarm(this.scene);
    // And each slot cast with values of its own (casting.json `settings`: an element, a colour of the fighter's) cast whole in
    // hiding with them, so what only such a cast builds is built and compiled with the room (ArmoryEffectType.warmWith;
    // launch day 15). Each set once a type.
    const tier = (this.kit.quality ?? 'high') as Tier;
    for (const cue of track.cues) {
      const p = cue.params as ArmoryParams | undefined, type = types.find(t => t.id === cue.type);
      if (!type || (!p?.set && !p?.macros)) continue;
      try { type.warmWith((p.set ?? {}) as Record<string, number | string | boolean>, p.macros ?? {}, tier); } catch (error) { console.warn(`armory: ${cue.type} for ${this.fighter} was not warmed with its casting's values`, error); }
    }
    // Its sound's renders and samples, made now and loaded with the room (sound.ts).
    runtime.prepareSound(track);
    this.pump = runtime.pumpSound;
    this.track = track;
    // A slot cast for one form only (`form`) plays its cues for that form's move only.
    const formOf = (slot?: string) => (casting.slots as Partial<Record<string, { form?: 'base' | 'awakened' }>> | undefined)?.[slot ?? '']?.form;
    const base = track.cues.filter(c => formOf(c.slot) !== 'awakened'), awake = track.cues.filter(c => formOf(c.slot) !== 'base');
    this.director = new CueDirector({
      registry,
      tracks: (fighter: FighterId, event: CombatEvent) => fighter !== this.fighter ? undefined : this.room?.get(event.actorId)?.state?.awakened ? awake : base,
      tier: () => (this.kit.quality ?? 'high') as Tier,
      density: () => this.kit.density ?? 1,
      light: this.kit.lights ? (x, y, z, hex, intensity, distance) => this.kit.lights!.request(x, y, z, hex, intensity, distance, 1.5) : undefined,
    });
    if (track.body) {
      const aura = types.find(t => t.effectId === track.body!.effect);
      if (aura) this.aura = new AuraDriver(this.fighter, aura, track.body, this.kit);
    }
    const drawn = MOVE_SLOTS.filter(slot => track.slots[slot]);
    markArmoryDrawn(this.fighter, drawn);
    // A fighter with no module of his own whose casting starts at the hit keeps the game's wind-up and flight (drawn.ts).
    if (!this.base) markArmoryHit(this.fighter, drawn.filter(slot => timing(casting.slots?.[slot] ?? {}, slot, MOVES[this.fighter]?.[slot] ?? { contacts: [0], duration: 1 }).cue.on === 'hit'));
  }

  /** What each slot draws (tests, the capture tools). */
  get slots() { return this.track?.slots; }
  /** The Armory effects this casting draws as built: its slots' and its aura's, after any alternate was taken. */
  get armoryIds(): readonly string[] { return this.track?.armory ?? []; }
  get live() { return this.director?.liveEffects() ?? []; }

  handle(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    this.base?.handle(event, fighters);
    if (fighters) this.room = fighters;
    this.director?.handle(event, fighters);
  }
  prepareContact(event: CombatEvent, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) { this.base?.prepareContact?.(event, fighters, flights); }
  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) {
    this.base?.update(time, fighters, flights);
    this.director?.update(time, fighters, flights);
    this.aura?.update(time, fighters, flights);
    this.pump?.();
  }
  reset() { this.base?.reset(); this.director?.reset(); this.aura?.reset(); }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.base?.dispose();
    this.aura?.reset();
    this.director?.dispose();
    clearArmoryDrawn(this.fighter);
  }
}

type Factory = (scene: THREE.Scene, kit: VfxKit) => Signature;

/** RosterSignatureSet's hook: every fighter drawn from his casting in this page (armoryRollout: the live list, and the
 *  preview rollout in a rollout build) is drawn by a CastingSignature around his own module (if he has one). */
export function wireArmory(factories: Partial<Record<FighterId, Factory>>, rollout: ReadonlySet<FighterId> = armoryRollout()) {
  if (!rollout.size) return factories;
  for (const id of rollout) {
    if (!ARMORY_CASTINGS[id]?.slots) continue;
    const base = factories[id];
    if (!base) markArmoryOnly(id);
    factories[id] = (scene, kit) => new CastingSignature(id, scene, kit, base?.(scene, kit));
  }
  return factories;
}
