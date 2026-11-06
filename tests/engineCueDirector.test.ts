import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import type { Fighter } from '../src/render/Fighter';
import type { Flight } from '../src/render/CombatEffects';
import { TOKAN_MOVES } from '../src/game/fighters/tokan';
import { EffectPool, EffectRegistry, PooledEffect, type CancelReason, type CueContext, type EffectFrame, type EffectType } from '../src/render/vfx/engine/Effect';
import { CueDirector, type CueTrack } from '../src/render/vfx/engine/cues';

/** A pooled effect that records its cue and its life. */
class Probe extends PooledEffect<{ tag?: string }> {
  log: { kind: string; age?: number; reason?: CancelReason }[] = [];
  seed = 0; flight?: string; follow = false; point = new THREE.Vector3(); tier = ''; density = 0; spike = 0; heading = new THREE.Vector3(); local = false;
  tag?: string; ended = false; private stopping = false;
  constructor(readonly type: string) { super(); }
  start(params: { tag?: string }, cue: CueContext) {
    this.log.push({ kind: 'start' }); this.tag = params.tag; this.seed = cue.seed; this.flight = cue.anchor.flight; this.follow = cue.anchor.follow;
    this.point.copy(cue.anchor.point); this.tier = cue.tier; this.density = cue.density; this.spike = cue.palette.spike; this.heading.copy(cue.heading); this.local = cue.local;
  }
  update(age: number, _dt: number, _frame: EffectFrame) { this.log.push({ kind: 'update', age }); if (this.stopping) return false; return !this.ended; }
  cancel(reason: CancelReason) { this.log.push({ kind: 'cancel', reason }); this.stopping = true; }
  protected reset() { this.stopping = false; this.ended = false; }
  get ages() { return this.log.filter(l => l.kind === 'update').map(l => l.age!); }
  get reasons() { return this.log.filter(l => l.kind === 'cancel').map(l => l.reason); }
}
class ProbeType implements EffectType<{ tag?: string }> {
  readonly cost = { draws: 0, gpuMs: 0 };
  pool?: EffectPool<Probe>;
  constructor(readonly id: string, readonly capacity = 4) {}
  prewarm() { if (!this.pool) this.pool = new EffectPool(this.capacity, () => new Probe(this.id)); }
  acquire() { return this.pool!.acquire(); }
  /** Every instance that has been started, in the order made. */
  get used() { return this.pool!.all.filter(p => p.log.length > 0); }
}

const BEAK = TOKAN_MOVES.special, AGE = TOKAN_MOVES.ultimate;
const TRACK: CueTrack = [
  { on: 'cast', slot: 'special', type: 'test/flight', preset: 'ice/tokan', anchor: { socket: 'flight', follow: true }, params: { tag: 'beak' } },
  { on: 'hit', slot: 'special', type: 'test/impact', preset: 'ice/tokan', anchor: { of: 'target', socket: 'floor', follow: false } },
  { on: 'cast', slot: 'ultimate', type: 'test/flight', preset: 'ice/tokan', anchor: { socket: 'hand', follow: true }, life: 'move', params: { tag: 'opener' } },
  { on: 'confirm', slot: 'ultimate', at: 2.3, type: 'test/impact', preset: 'ice/tokan', anchor: { socket: 'floor', follow: false }, params: { tag: 'floor' } },
  { on: 'hit', slot: 'ultimate', contact: 2, type: 'test/finisher', preset: 'ice/tokan', anchor: { of: 'target', joint: 'Hips', follow: true } },
];

function fighter(id: string, fighterId: FighterId, x: number, state: Partial<PlayerState> = {}): Fighter {
  const group = new THREE.Group(); group.position.set(x, 0, 0);
  const hips = new THREE.Bone(); hips.position.set(x, 1, 0); hips.updateMatrixWorld(true);
  return { group, joints: new Map([['Hips', hips]]), handR: new THREE.Vector3(x + .3, 1.4, .2), handL: new THREE.Vector3(x - .3, 1.4, .2), strikePoint: (out: THREE.Vector3) => out.set(x + .5, 1.2, 0),
    state: { id, fighter: fighterId, alive: true, grounded: true, action: 'idle', actionSeq: 1, actionTime: 0, actionDuration: 1, actionStarted: 0, yaw: 0, ...state } as PlayerState } as unknown as Fighter;
}

function setup(capacity = 4) {
  const registry = new EffectRegistry(), flightType = new ProbeType('test/flight', capacity), impact = new ProbeType('test/impact', capacity), finisher = new ProbeType('test/finisher', capacity);
  registry.register(flightType).register(impact).register(finisher); registry.prewarm(new THREE.Scene());
  const director = new CueDirector({ registry, tracks: f => f === 'tokan' ? TRACK : undefined, tier: () => 'medium', density: () => .8 });
  const tokan = fighter('a', 'tokan', 0), gummy = fighter('l', 'gummy', 3);
  const fighters = new Map<string, Fighter>([['a', tokan], ['l', gummy]]), flights = new Map<string, Flight>();
  const cast = (id: number, slot: 'special' | 'ultimate', t: number, extra: Partial<CombatEvent> = {}): CombatEvent =>
    ({ id, kind: 'cast', fighter: 'tokan', actorId: 'a', targetId: 'l', slot, actionSeq: 1, serverTime: t, seed: 4242, origin: { x: 0, y: 1.4, z: 0 }, endpoint: { x: 3, y: 1.4, z: 0 }, ...extra });
  /** Tokan in `slot` since `start`, `age` seconds into it on its own clock. */
  const pose = (slot: 'special' | 'ultimate', start: number, age: number) => Object.assign(tokan.state, { action: slot, actionStarted: start, actionDuration: (slot === 'special' ? BEAK : AGE).duration, actionTime: age / (slot === 'special' ? BEAK : AGE).duration });
  return { registry, director, flightType, impact, finisher, tokan, gummy, fighters, flights, cast, pose };
}

describe('cue director: combat events to effect instances', () => {
  it('starts a cast cue once, seeded from the cast, on its projectile, at the tier and density', () => {
    const h = setup(), e = h.cast(10, 'special', 5);
    h.pose('special', 5, 0);
    h.director.handle(e); h.director.handle(e);
    h.director.update(5, h.fighters, h.flights);
    expect(h.flightType.used).toHaveLength(1);
    const probe = h.flightType.used[0];
    expect(probe.tag).toBe('beak');
    expect(probe.seed).toBe(4242);
    expect(probe.flight).toBe('10:0');
    expect(probe.follow).toBe(true);
    expect(probe.tier).toBe('medium'); expect(probe.density).toBe(.8);
    expect(probe.spike).toBe(0xe9faff);
    expect(probe.heading.toArray()).toEqual([1, 0, 0]);
    // The projectile's own position, once it is published.
    h.flights.set('10:0', { fighter: 'tokan', slot: 'special', position: new THREE.Vector3(2, 1.4, 0), heading: new THREE.Vector3(1, 0, 0), released: true, since: 5.7 });
    const out = new THREE.Vector3();
    h.director.update(5.1, h.fighters, h.flights);
    expect(h.director.locate({ point: new THREE.Vector3(), flight: '10:0', socket: 'flight', follow: true, floor: 0 }, out)).toBe(true);
    expect(out.x).toBe(2);
  });

  it('reads only its own move: no combo ender, no other fighter, no other contact', () => {
    const h = setup();
    h.director.handle(h.cast(1, 'special', 5, { branch: 'llls' }));
    h.director.handle({ ...h.cast(2, 'special', 5), fighter: 'taisei' });
    h.director.handle({ id: 3, kind: 'hit', fighter: 'tokan', actorId: 'a', targetId: 'l', slot: 'ultimate', contactIndex: 0, actionSeq: 1, serverTime: 5.46 });
    h.director.update(6, h.fighters, h.flights);
    expect(h.flightType.used).toHaveLength(0);
    expect(h.finisher.used).toHaveLength(0);
    h.director.handle({ id: 4, kind: 'hit', fighter: 'tokan', actorId: 'a', targetId: 'l', slot: 'ultimate', contactIndex: 2, actionSeq: 1, serverTime: 6 });
    h.director.update(6, h.fighters, h.flights);
    expect(h.finisher.used).toHaveLength(1);
    // On the target's hips.
    expect(h.finisher.used[0].point.toArray()).toEqual([3, 1, 0]);
  });

  it('holds a scheduled cue for its moment on the move clock, with the hit-stop taken out', () => {
    const h = setup();
    h.pose('ultimate', 10, 0);
    h.director.handle(h.cast(20, 'ultimate', 10));
    h.director.handle({ id: 21, kind: 'confirm', fighter: 'tokan', actorId: 'a', targetId: 'l', slot: 'ultimate', actionSeq: 1, serverTime: 10.5, castAge: .5 });
    h.pose('ultimate', 10, 1.5); h.director.update(11.5, h.fighters, h.flights);
    expect(h.impact.used.filter(p => p.tag === 'floor')).toHaveLength(0);
    h.pose('ultimate', 10, 2.31); h.director.update(12.31, h.fighters, h.flights);
    const floor = h.impact.used.find(p => p.tag === 'floor')!;
    expect(floor).toBeDefined();
    expect(floor.ages[0]).toBeCloseTo(.01, 2);
    // A 0.2 s impact freeze: the move's clock stands still, and so does the effect.
    h.director.update(12.41, h.fighters, h.flights); h.director.update(12.51, h.fighters, h.flights);
    expect(floor.ages.at(-1)).toBeCloseTo(.01, 2);
    h.pose('ultimate', 10, 2.41); h.director.update(12.61, h.fighters, h.flights);
    expect(floor.ages.at(-1)).toBeCloseTo(.11, 2);
  });

  it('waits for an event that is still ahead of the drawn clock', () => {
    const h = setup();
    h.director.handle({ id: 5, kind: 'hit', fighter: 'tokan', actorId: 'a', targetId: 'l', slot: 'special', actionSeq: 1, serverTime: 8 });
    h.director.update(7.9, h.fighters, h.flights);
    expect(h.impact.used).toHaveLength(0);
    h.director.update(8, h.fighters, h.flights);
    expect(h.impact.used).toHaveLength(1);
    // Where the target stood, on the floor.
    expect(h.impact.used[0].point.toArray()).toEqual([3, 0, 0]);
  });

  it('cancels what the opener raised on a whiff, and drops what was scheduled', () => {
    const h = setup();
    h.pose('ultimate', 10, .3);
    h.director.handle(h.cast(30, 'ultimate', 10));
    h.director.handle({ id: 31, kind: 'confirm', fighter: 'tokan', actorId: 'a', targetId: 'l', slot: 'ultimate', actionSeq: 1, serverTime: 10.5, castAge: .5 });
    h.director.update(10.3, h.fighters, h.flights);
    expect(h.director.armed).toBe(1);
    h.director.handle({ id: 32, kind: 'whiff', fighter: 'tokan', actorId: 'a', slot: 'ultimate', actionSeq: 1, serverTime: 10.6 });
    expect(h.director.armed).toBe(0);
    h.director.update(10.65, h.fighters, h.flights);
    expect(h.flightType.used[0].reasons).toEqual(['whiff']);
    expect(h.director.live).toBe(0);
    expect(h.flightType.pool!.live).toBe(0);
  });

  it('cancels a projectile that clashed, for either thrower', () => {
    const h = setup();
    h.pose('special', 5, .8);
    h.director.handle(h.cast(40, 'special', 5)); h.director.update(5.8, h.fighters, h.flights);
    h.director.handle({ id: 41, kind: 'projectile-clash', fighter: 'taisei', actorId: 'g', targetId: 'a', serverTime: 5.9 });
    h.director.update(5.9, h.fighters, h.flights);
    expect(h.flightType.used[0].reasons).toEqual(['clash']);
  });

  it('a KO of the thrower cuts the charge; a KO of the target keeps the blow that did it', () => {
    const h = setup();
    h.pose('special', 5, .3);
    h.director.handle(h.cast(50, 'special', 5)); h.director.update(5.3, h.fighters, h.flights);
    h.director.handle({ id: 51, kind: 'eliminated', actorId: 'a', serverTime: 5.35 });
    h.director.update(5.36, h.fighters, h.flights);
    expect(h.flightType.used[0].reasons).toEqual(['interrupt']);
    const k = setup();
    k.director.handle({ id: 60, kind: 'hit', fighter: 'tokan', actorId: 'a', targetId: 'l', slot: 'ultimate', contactIndex: 2, actionSeq: 1, serverTime: 13 });
    k.director.handle({ id: 61, kind: 'eliminated', actorId: 'l', serverTime: 13 });
    k.director.update(13, k.fighters, k.flights); k.director.update(13.2, k.fighters, k.flights);
    expect(k.finisher.used).toHaveLength(1);
    expect(k.finisher.used[0].reasons).toEqual([]);
  });

  it('a move cut short cancels what is bound to its charge, and not what it already let go', () => {
    const h = setup();
    h.pose('special', 5, .3);
    h.director.handle(h.cast(70, 'special', 5)); h.director.update(5.3, h.fighters, h.flights);
    Object.assign(h.tokan.state, { action: 'hurt', actionStarted: 5.32 });
    h.director.update(5.4, h.fighters, h.flights);
    expect(h.flightType.used[0].reasons).toEqual(['interrupt']);
    const k = setup();
    k.pose('special', 5, .8);
    k.director.handle(k.cast(71, 'special', 5)); k.director.update(5.8, k.fighters, k.flights);
    Object.assign(k.tokan.state, { action: 'hurt', actionStarted: 5.82, actionSeq: 2 });
    k.director.update(5.9, k.fighters, k.flights);
    expect(k.flightType.used[0].reasons).toEqual([]);
  });

  it('a respawn or a reset removes everything at once', () => {
    const h = setup();
    h.pose('special', 5, .8);
    h.director.handle(h.cast(80, 'special', 5)); h.director.update(5.8, h.fighters, h.flights);
    h.director.handle({ id: 81, kind: 'respawn', actorId: 'a', serverTime: 6 });
    expect(h.flightType.used[0].reasons).toEqual(['despawn']);
    expect(h.director.live).toBe(0); expect(h.flightType.pool!.live).toBe(0);
    h.director.handle(h.cast(82, 'special', 7)); h.director.update(7, h.fighters, h.flights);
    expect(h.director.live).toBe(1);
    h.director.reset();
    expect(h.director.live).toBe(0); expect(h.flightType.pool!.live).toBe(0);
  });

  it('a full pool drops the cue and counts it; a finished effect goes back to its pool', () => {
    const h = setup(1);
    h.pose('special', 5, 0);
    h.director.handle(h.cast(90, 'special', 5)); h.director.handle(h.cast(91, 'special', 5.01));
    h.director.update(5.02, h.fighters, h.flights);
    expect(h.director.dropped).toBe(1);
    expect(h.flightType.pool!.live).toBe(1);
    h.flightType.pool!.all[0].ended = true;
    h.director.update(5.03, h.fighters, h.flights);
    expect(h.flightType.pool!.live).toBe(0);
    expect(h.director.live).toBe(0);
  });

  it('an unknown effect type is reported once and skipped', () => {
    const registry = new EffectRegistry();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const director = new CueDirector({ registry, tracks: () => [{ on: 'cast', type: 'nope/missing', preset: 'x', anchor: { follow: false } }], tier: () => 'high' });
    director.handle({ id: 1, kind: 'cast', fighter: 'tokan', actorId: 'a', slot: 'special', serverTime: 1 });
    director.handle({ id: 2, kind: 'cast', fighter: 'tokan', actorId: 'a', slot: 'special', serverTime: 2 });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(director.armed).toBe(0);
    warn.mockRestore();
  });
});
