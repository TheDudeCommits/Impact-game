import type * as THREE from 'three';
import type { CombatEvent, FighterId } from '../../../../game/types';
import { TOKAN_MOVES } from '../../../../game/fighters/tokan';
import type { Fighter } from '../../../Fighter';
import type { Flight } from '../../../CombatEffects';
import type { VfxKit } from '../../VfxKit';
import { TokanIce } from '../../../signature/TokanIce';
import { EffectRegistry, type Tier } from '../Effect';
import { CueDirector, type Cue, type CueAnchorSpec, type CueTrack } from '../cues';
import { registerIce, ICE, type CrystalFieldParams, type FloorFreezeParams, type GlacierJavelinParams, type IcePheasantParams, type FreezeOnHitParams } from '../ice';
import { fxLook, type FxLook } from '../flag';


const P = 'ice/tokan';
const FLIGHT: CueAnchorSpec = { socket: 'flight', follow: true };
const VICTIM_FLOOR: CueAnchorSpec = { of: 'target', socket: 'floor', follow: false };
const THROWER_FLOOR: CueAnchorSpec = { socket: 'floor', follow: false };
const VICTIM: CueAnchorSpec = { of: 'target', joint: 'Hips', follow: true };

/** Typed cue builders: each type's params checked where the track is written. */
type CueOf<T> = Omit<Cue, 'type' | 'preset' | 'params'> & { params: T };
const field = (cue: CueOf<CrystalFieldParams>): Cue => ({ ...cue, type: ICE.field, preset: P });
const floor = (cue: CueOf<FloorFreezeParams>): Cue => ({ ...cue, type: ICE.floor, preset: P });
const lance = (cue: CueOf<GlacierJavelinParams>): Cue => ({ ...cue, type: ICE.lance, preset: P });
const pheasant = (cue: CueOf<IcePheasantParams>): Cue => ({ ...cue, type: ICE.pheasant, preset: P });
const freeze = (cue: CueOf<FreezeOnHitParams>): Cue => ({ ...cue, type: ICE.freeze, preset: P });

const BEAK = TOKAN_MOVES.special, AGE = TOKAN_MOVES.ultimate;
/** The special's charge (its release) and its flight speed, from the move itself. */
const CHARGE = BEAK.contacts[0], SPEED = BEAK.speed ?? 27, RANGE = BEAK.range;
/** Winter Sleep's finisher, and where its last beat (the palm down) begins on the move's clock. */
const FINISHER = AGE.contacts.length - 1, WIND = 2.3;

/** Frostplume Flight's hit: a ring of crystals snapping up round the body it struck. */
const beakImpact = (scale: number) => field({ on: 'hit', slot: 'special', anchor: VICTIM_FLOOR, params: {
  layout: 'ring', reach: 1.1 * scale, clear: .6, count: { low: 6, medium: 9, high: 12 }, height: [1.5 * scale, .8 * scale], radius: .24, rubble: .2,
  spread: 0, rise: .1, hold: .35, sink: .3, lean: .5, end: 'shatter', chips: { low: 1, medium: 1, high: 2 } } });
/** Winter Sleep's opener has landed: frost crystals sprouting round the held body's feet as the palm comes down. */
const ageWarning = field({ on: 'confirm', slot: 'ultimate', at: WIND + .05, anchor: VICTIM_FLOOR, life: 'move', params: {
  layout: 'ring', reach: .9, clear: .5, count: { low: 5, medium: 7, high: 9 }, height: [.55, .35], radius: .14, spread: 0, rise: .3, hold: .4, sink: .15, lean: .35,
  chips: { low: 0, medium: 0, high: 0 } } });

export const TOKAN_TRACKS: Readonly<Record<FxLook, CueTrack>> = Object.freeze({
  'ice-a': [
    lance({ on: 'cast', slot: 'special', anchor: FLIGHT, params: { length: 3.1, girdle: .42, charge: CHARGE, speed: SPEED, wake: { low: 6, medium: 12, high: 18 } } }),
    field({ on: 'cast', slot: 'special', anchor: FLIGHT, params: { layout: 'line', reach: RANGE, width: [.3, .9], count: { low: 20, medium: 34, high: 50 }, height: [.85, 1.5], radius: .21,
      rubble: .35, lean: .45, rise: .12, hold: .5, sink: .45, end: 'shatter', chips: { low: 0, medium: 0, high: 1 }, bias: 1.35 } }),
    beakImpact(1),
    ageWarning,
    field({ on: 'hit', slot: 'ultimate', contact: FINISHER, anchor: VICTIM_FLOOR, params: { layout: 'disc', reach: 5.5, clear: .9, count: { low: 28, medium: 48, high: 72 },
      height: [2.3, .45], radius: .34, rubble: .3, spread: 13, spokes: 8, rise: .14, hold: .85, sink: .55, lean: .55, end: 'shatter', chips: { low: 0, medium: 1, high: 2 }, impactFrame: .42 } }),
  ],
  'ice-b': [
    pheasant({ on: 'cast', slot: 'special', anchor: FLIGHT, params: { span: 4.6, charge: CHARGE, speed: SPEED, wake: { low: 6, medium: 12, high: 20 } } }),
    // The floor freezes in a narrow lane under the bird as it passes, and thaws.
    floor({ on: 'cast', slot: 'special', anchor: FLIGHT, params: { shape: 'strip', reach: RANGE, width: 1.05, hold: 1.1, thaw: .5 } }),
    beakImpact(.9),
    floor({ on: 'confirm', slot: 'ultimate', at: WIND, anchor: THROWER_FLOOR, params: { shape: 'disc', reach: 6.5, grow: .62, hold: 1.25, thaw: .6 } }),
    // Low and leaning out, so the frozen body stands clear of them.
    field({ on: 'hit', slot: 'ultimate', contact: FINISHER, anchor: VICTIM_FLOOR, params: { layout: 'ring', reach: 1.9, clear: 1, count: { low: 8, medium: 12, high: 16 },
      height: [1.1, .6], radius: .28, spread: 0, rise: .08, hold: .5, sink: .35, lean: .8, end: 'shatter', chips: { low: 1, medium: 2, high: 3 }, impactFrame: .42 } }),
    freeze({ on: 'hit', slot: 'ultimate', contact: FINISHER, anchor: VICTIM, params: { grow: .09, hold: .7, shatter: .42, bulk: 1.55, spikes: { low: 0, medium: 1, high: 2 } } }),
  ],
  'ice-c': [
    lance({ on: 'cast', slot: 'special', anchor: FLIGHT, params: { length: 3.4, girdle: .46, charge: CHARGE, speed: SPEED, wake: { low: 6, medium: 14, high: 22 } } }),
    pheasant({ on: 'cast', slot: 'special', anchor: FLIGHT, params: { span: 5.2, charge: CHARGE, speed: SPEED, wake: { low: 6, medium: 12, high: 20 } } }),
    floor({ on: 'cast', slot: 'special', anchor: FLIGHT, params: { shape: 'strip', reach: RANGE, width: 1.5, hold: 2, thaw: .6, mist: { low: 0, medium: 2, high: 5 } } }),
    field({ on: 'cast', slot: 'special', anchor: FLIGHT, params: { layout: 'line', reach: RANGE, width: [.35, 1.1], count: { low: 22, medium: 38, high: 56 }, height: [1, 1.9], radius: .24,
      rubble: .35, lean: .5, rise: .12, hold: .7, sink: .5, end: 'shatter', chips: { low: 0, medium: 1, high: 1 }, bias: 1.35 } }),
    beakImpact(1.25),
    floor({ on: 'confirm', slot: 'ultimate', at: WIND, anchor: THROWER_FLOOR, params: { shape: 'disc', reach: 8.5, grow: .7, hold: 2, thaw: .7, mist: { low: 0, medium: 4, high: 8 } } }),
    ageWarning,
    field({ on: 'hit', slot: 'ultimate', contact: FINISHER, anchor: VICTIM_FLOOR, params: { layout: 'disc', reach: 7, clear: 1, count: { low: 40, medium: 64, high: 96 },
      height: [2.7, .55], radius: .4, rubble: .3, spread: 15, spokes: 9, rise: .15, hold: 1.1, sink: .6, lean: .6, end: 'shatter', chips: { low: 0, medium: 1, high: 2 }, impactFrame: .42 } }),
    freeze({ on: 'hit', slot: 'ultimate', contact: FINISHER, anchor: VICTIM, params: { grow: .09, hold: .7, shatter: .45, bulk: 1.55, spikes: { low: 0, medium: 1, high: 2 } } }),
  ],
});

/** The events and flights the tracks draw instead of TokanIce: the plain special's and ultimate's. */
const tracked = (e: CombatEvent) => e.fighter === 'tokan' && !e.branch && (e.slot === 'special' || e.slot === 'ultimate') && (e.kind === 'hit' || e.kind === 'confirm');
const trackedFlight = (f: Flight) => f.fighter === 'tokan' && f.slot === 'special' && !f.branch;

type Kit = Pick<VfxKit, 'budget'> & Partial<Pick<VfxKit, 'quality' | 'density' | 'lights'>>;

/** TokanIce plus the engine's cue director: what RosterSignatureSet runs for Tokan in a build with a look. */
export class TokanEnginePilot {
  readonly base: TokanIce;
  readonly director: CueDirector;
  private readonly registry = new EffectRegistry();
  private readonly others = new Map<string, Flight>();
  constructor(scene: THREE.Scene, kit: Kit, readonly look: FxLook) {
    this.base = new TokanIce(scene, kit);
    registerIce(this.registry, scene);
    this.director = new CueDirector({
      registry: this.registry,
      tracks: (fighter: FighterId) => fighter === 'tokan' ? TOKAN_TRACKS[look] : undefined,
      tier: () => (kit.quality ?? 'high') as Tier,
      density: () => kit.density ?? 1,
      // The ice lights the fight from the game's own fixed pool, as every technique's light does.
      light: kit.lights ? (x, y, z, hex, intensity, distance) => kit.lights!.request(x, y, z, hex, intensity, distance, 1.5) : undefined,
    });
  }
  load(ids: readonly string[]) { return this.base.load(ids); }
  handle(e: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    // (What the shared stage lays round the ice is TokanIce's `frost`: it is handed the tracked events too.)
    if (!tracked(e)) this.base.handle(e, fighters); else this.base.frost.handle(e, fighters);
    this.director.handle(e, fighters);
  }
  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) {
    this.others.clear();
    for (const [key, flight] of flights) if (!trackedFlight(flight)) this.others.set(key, flight);
    this.base.update(time, fighters, this.others, flights);
    this.director.update(time, fighters, flights);
  }
  reset() { this.base.reset(); this.director.reset(); }
  dispose() { this.base.dispose(); this.director.dispose(); }
}

/** RosterSignatureSet's factory for Tokan: today's TokanIce, or the pilot in a build made with a look. */
export function tokanSignature(scene: THREE.Scene, kit: Kit, look: FxLook | null | undefined = fxLook()) {
  return look ? new TokanEnginePilot(scene, kit, look) : new TokanIce(scene, kit);
}
