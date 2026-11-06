import type * as THREE from 'three';
import type { Element } from '../palette';
import type { Fighter } from '../../Fighter';
import type { Flight } from '../../CombatEffects';
import type { Canonical } from '../../skeleton';


/** The quality presets (Settings.quality), lowest first. */
export type Tier = 'low' | 'medium' | 'high';
export const TIERS: readonly Tier[] = ['low', 'medium', 'high'];
/** One value per tier: a count, a size. */
export type PerTier<T = number> = Readonly<Record<Tier, T>>;
/** `count` for `tier`, scaled by settings.effects (`density`, 0.3..1), never below `floor`. */
export function tierCount(count: PerTier, tier: Tier, density = 1, floor = 0) {
  return Math.max(floor, Math.round(count[tier] * Math.max(.3, Math.min(1, density))));
}

/** Why an effect is being stopped before its own end:
 *  - `whiff`: a hit-confirm ultimate's opener found nobody (its field, grade and light go at once);
 *  - `interrupt`: the move was cut short (a hit, a KO, the server rejecting it);
 *  - `clash`: its projectile met another and both are gone;
 *  - `despawn`: its fighter left or respawned, or the room reset. Gone this frame, no exit. */
export type CancelReason = 'whiff' | 'interrupt' | 'clash' | 'despawn';

/** A standard joint: the canonical names every rig resolves to (render/skeleton.ts). */
export type StandardJoint = Canonical;
/** Named points on a body and on a cast, besides its joints:
 *  - `centre` its drawn centre (VfxKit.bodyCentre), `floor` the floor under it, `strike` the limb or blade landing the
 *    blow (Fighter.strikePoint), `hand` its right hand;
 *  - `flight` the cast's projectile in flight (CombatEffects FLIGHTS), `origin` / `endpoint` the event's own points. */
export type Socket = 'centre' | 'floor' | 'strike' | 'hand' | 'flight' | 'origin' | 'endpoint';

/** Where an effect is, as the director resolved it when the effect started. */
export interface EffectAnchor {
  /** World-space point at the start: always set. */
  readonly point: THREE.Vector3;
  /** The body it is on (a fighter id), if any. */
  readonly fighter?: string;
  /** The joint on that body (a standard joint)... */
  readonly joint?: StandardJoint;
  /** ...or a named point. */
  readonly socket?: Socket;
  /** The projectile it rides (a CombatEffects FLIGHTS key), when `socket` is `flight`. */
  readonly flight?: string;
  /** Ride the anchor every frame (`EffectFrame.locate`), or stay at `point`. */
  readonly follow: boolean;
  /** The floor's height under the move (metres): the thrower's footing at the start. */
  readonly floor: number;
}

/** What an effect knows about the cue that started it. Lent by the director for the instance's whole life: valid
 *  from `start` until `release`. */
export interface CueContext {
  /** The server's seed for the cast (CombatEvent.seed, else its id): the same cast lays out the same on every screen. */
  readonly seed: number;
  /** The element the move is drawn in (vfx/palette.ts). */
  readonly palette: Element;
  /** The look the cue asked for, e.g. `ice/tokan`; the type resolves it in its own preset table. */
  readonly preset: string;
  readonly anchor: EffectAnchor;
  /** The quality preset when it started, and settings.effects (0.3..1). */
  readonly tier: Tier;
  readonly density: number;
  /** Whether the local player threw it or is its target: only then may an effect touch the whole frame (an impact
   *  frame, a grade). signature/context.ts `involvesLocal`. */
  readonly local: boolean;
  /** Who threw it, and at whom. */
  readonly actorId: string;
  readonly targetId?: string;
  /** The way the attack goes along the floor, unit (y = 0). */
  readonly heading: THREE.Vector3;
}

/** One frame, as every live effect sees it. */
export interface EffectFrame {
  /** The presentation clock (seconds, server time as drawn). */
  readonly time: number;
  readonly fighters: ReadonlyMap<string, Fighter>;
  readonly flights: ReadonlyMap<string, Flight>;
  /** Where `anchor` is now: re-resolved when it follows, else its start point. False (and the last point it was
   *  known at in `out`) when the body or the projectile it follows is gone. */
  locate(anchor: EffectAnchor, out: THREE.Vector3): boolean;
  /** Ask for light this frame from the game's fixed light pool (VfxKit's LightPool: its lights are all made before the
   *  load-time compile, so asking never changes a program). Absent where there is no pool. */
  light?(x: number, y: number, z: number, hex: number, intensity: number, distance: number): void;
}

/** One running effect. */
export interface EffectInstance<P> {
  /** Begin, from a cue. `params` and `cue` are the director's; copy what you keep, or hold `cue` until `release`. */
  start(params: P, cue: CueContext): void;
  /** Step to `age` seconds on the move's clock since it started (`dt` the frame's own step). False once it is over;
   *  the director then calls `release`. */
  update(age: number, dt: number, frame: EffectFrame): boolean;
  /** Stop early. Anything but `despawn` may take a short exit (at most ~0.15 s) before `update` returns false. */
  cancel(reason: CancelReason): void;
  /** Back to the pool, reset. Safe to call twice. */
  release(): void;
}

/** A kind of effect: one fixed pool of instances. */
export interface EffectType<P> {
  /** `element/name`, e.g. `ice/crystal-field`. */
  readonly id: string;
  /** How many may run at once. */
  readonly capacity: number;
  readonly cost: { readonly draws: number; readonly gpuMs: number };
  /** Build everything (meshes into `scene`, programs ready for the load-time compile, the whole pool). Idempotent. */
  prewarm(scene: THREE.Scene): void;
  /** A free instance, or null when the pool is full (the cue is dropped). */
  acquire(): EffectInstance<P> | null;
}

/** Several types drawing into the same batches: begun before any instance updates in a frame, ended after. `owner`
 *  is whoever is drawing (a registry): a layer shared by several must empty itself once a frame, on the first begin of
 *  the frame, which is the one from an owner that has already begun since it last emptied. */
export interface EffectLayer {
  begin(time: number, owner?: object): void;
  end(owner?: object): void;
  /** Empty every batch (a room reset). */
  reset(): void;
  dispose(): void;
}

/** The base every pooled instance extends: the pool bookkeeping, and a `reset` it must implement. */
export abstract class PooledEffect<P> implements EffectInstance<P> {
  private home?: EffectPool<PooledEffect<P>>;
  /** Set by the pool that made it. */
  adopt(pool: EffectPool<PooledEffect<P>>) { this.home = pool; }
  abstract start(params: P, cue: CueContext): void;
  abstract update(age: number, dt: number, frame: EffectFrame): boolean;
  abstract cancel(reason: CancelReason): void;
  /** Back to the state it was made in. */
  protected abstract reset(): void;
  release() { if (this.home?.owns(this)) { this.reset(); this.home.give(this); } }
}

/**
 * A fixed set of instances, made once.
 *
 * `acquire` hands out a free one or null, `give` takes one back (false for one that is not out: a second release, or
 * another pool's). Nothing is created after construction.
 */
export class EffectPool<I extends EffectInstance<unknown>> {
  readonly capacity: number;
  private readonly items: I[];
  private readonly out: Uint8Array;
  private used = 0;
  constructor(capacity: number, make: (index: number) => I) {
    this.capacity = Math.max(0, Math.floor(capacity));
    this.items = Array.from({ length: this.capacity }, (_, i) => make(i));
    this.out = new Uint8Array(this.capacity);
    for (const item of this.items) (item as unknown as { adopt?(pool: unknown): void }).adopt?.(this);
  }
  acquire(): I | null {
    if (this.used >= this.capacity) return null;
    for (let i = 0; i < this.capacity; i++) if (!this.out[i]) { this.out[i] = 1; this.used++; return this.items[i]; }
    return null;
  }
  /** Whether `item` is out of this pool right now. */
  owns(item: unknown) { const i = this.items.indexOf(item as I); return i >= 0 && this.out[i] === 1; }
  give(item: I) {
    const i = this.items.indexOf(item);
    if (i < 0 || !this.out[i]) return false;
    this.out[i] = 0; this.used--; return true;
  }
  /** How many are out. */
  get live() { return this.used; }
  /** Every instance, out or not (for disposal and tests). */
  get all(): readonly I[] { return this.items; }
}

/** Every type and layer a director can cue, by id. */
export class EffectRegistry {
  private readonly types = new Map<string, EffectType<unknown>>();
  private readonly layers: EffectLayer[] = [];
  register<P>(type: EffectType<P>) { this.types.set(type.id, type as EffectType<unknown>); return this; }
  layer(layer: EffectLayer) { if (!this.layers.includes(layer)) this.layers.push(layer); return this; }
  get(id: string) { return this.types.get(id); }
  /** A type let go (its pool disposed): no longer handed out. */
  unregister(id: string) { this.types.delete(id); return this; }
  get ids() { return [...this.types.keys()]; }
  prewarm(scene: THREE.Scene) { for (const type of this.types.values()) type.prewarm(scene); }
  begin(time: number) { for (const layer of this.layers) layer.begin(time, this); }
  end() { for (const layer of this.layers) layer.end(this); }
  reset() { for (const layer of this.layers) layer.reset(); }
  dispose() { for (const layer of this.layers) layer.dispose(); this.layers.length = 0; this.types.clear(); }
  /** Draw calls and estimated GPU ms if every type ran one instance (the budget report). */
  get cost() { let draws = 0, gpuMs = 0; for (const t of this.types.values()) { draws += t.cost.draws; gpuMs += t.cost.gpuMs; } return { draws, gpuMs }; }
}

/** A small seeded generator (mulberry32), reseeded in place: an instance keeps one and lays out from the cast's seed
 *  without allocating. */
export class Seeded {
  private s = 1;
  seed(value: number) { this.s = (Math.floor(Math.abs(value)) ^ 0x9e3779b9) >>> 0 || 1; return this; }
  /** 0..1 */
  next() {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** -1..1 */
  signed() { return this.next() * 2 - 1; }
}
