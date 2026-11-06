import { describe, expect, it } from 'vitest';
import { comboMove } from '../src/game/combos';
import { ArenaSimulation } from '../src/game/simulation';
import { Prediction } from '../src/game/prediction';
import { InputQueue } from '../src/server/InputQueue';
import { createRapierCollision } from '../src/game/rapierCollision';
import { HARD_GAP, JUST_GUARD_WINDOW, LAUNCH_KNOCKBACK, MOVES, PUSH_RADIUS, meleeReach } from '../src/game/moves';
import { UME_TREES, ENVIRONMENT_COLLIDERS } from '../src/game/environmentLayout';
import type { CollisionWorld, CombatEvent, FighterId, GameSnapshot, PlayerInput, Vec3 } from '../src/game/types';

/** Round 3: Taisei's heavy is Cloudstep (MoveDefinition.teleport).
 *  Two fingers to the forehead, gone at `vanish`, back at `appear` behind the
 *  body it went for, and a kick in the back at the contact that launches. */
const HEAVY = MOVES.taisei.heavy, T = HEAVY.teleport!;
const flat = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);
const ticks = (seconds: number) => Math.round(seconds * 60);

function bout(options: ConstructorParameters<typeof ArenaSimulation>[0] = {}, at: { a?: Vec3; b?: Vec3 } = {}, foe: FighterId = 'konta') {
  const sim = new ArenaSimulation({ trainingBot: false, seed: 11, ...options });
  sim.addPlayer('a', 'taisei', 'Taisei', false, at.a ?? { x: 0, y: 0, z: 0 });
  sim.addPlayer('b', foe, 'Foe', false, at.b ?? { x: 0, y: 0, z: 6 });
  let seq = 0;
  const input = (id: string, more: Partial<PlayerInput> = {}) =>
    sim.submitInput(id, { seq: seq++, moveX: 0, moveZ: 0, yaw: id === 'a' ? 0 : Math.PI, targetId: id === 'a' ? 'b' : 'a', ...more });
  const events: CombatEvent[] = [];
  const step = (seconds: number, each?: (frame: number) => void) => {
    for (let i = 0; i < ticks(seconds); i++) { each?.(i); sim.step(); events.push(...sim.snapshot(true).events); }
  };
  input('a'); input('b');
  /** Press heavy and step to `seconds` into the cast. */
  const cast = (seconds: number, each?: (frame: number) => void) => { input('a', { attack: 'heavy' }); step(seconds, each); };
  return { sim, input, step, cast, events, mine: (kind: CombatEvent['kind']) => events.filter(e => e.kind === kind && e.actorId === 'a') };
}

describe('Cloudstep', () => {
  it('is a single-contact melee heavy on the roster\'s heavy envelope, with the teleport inside its wind-up', () => {
    expect(HEAVY.name).toBe('Cloudstep Strike');
    expect(HEAVY.style).toBe('melee');
    expect(HEAVY.contacts).toHaveLength(1);
    // Round 3d (PACE): the roster's heavies weigh 51-63 (0.6 of what they were).
    expect(HEAVY.damage).toBeGreaterThanOrEqual(51); expect(HEAVY.damage).toBeLessThanOrEqual(63);
    // Round 3d (PACE): the roster's heavies cool in 1.0-1.3 s (from 1.3-1.8).
    expect(HEAVY.cooldown).toBeGreaterThanOrEqual(1); expect(HEAVY.cooldown).toBeLessThanOrEqual(1.3);
    expect(HEAVY.stamina).toBeGreaterThanOrEqual(22); expect(HEAVY.stamina).toBeLessThanOrEqual(24);
    expect(T.vanish).toBeGreaterThan(0);
    expect(T.appear).toBeGreaterThan(T.vanish);
    expect(HEAVY.contacts[0]).toBeGreaterThan(T.appear);
    expect(HEAVY.knockback, 'the kick launches').toBeGreaterThanOrEqual(LAUNCH_KNOCKBACK);
    expect(T.behind, 'it comes back a body clear of them').toBeGreaterThanOrEqual(PUSH_RADIUS * 2);
    expect(T.behind, 'and inside the kick').toBeLessThan(meleeReach('taisei', 'heavy', HEAVY));
  });

  it('stands still for the two fingers, is gone and untouchable at the vanish, and comes back behind the lock facing their back', () => {
    const fight = bout();
    const b0 = fight.sim.getPlayer('b')!;
    fight.cast(T.vanish - .03);
    expect(flat(fight.sim.getPlayer('a')!, { x: 0, y: 0, z: 0 }), 'no step before the blink').toBeLessThan(.01);
    fight.step(.05);
    const gone = fight.sim.actors.get('a')!;
    expect(gone.evadeUntil, 'evading while gone').toBeGreaterThan(fight.sim.serverTime);
    expect(gone.goneUntil, 'and public about it').toBeGreaterThan(fight.sim.serverTime);
    fight.step(T.appear - T.vanish);
    const a = fight.sim.getPlayer('a')!, b = fight.sim.getPlayer('b')!;
    // Behind their back: they face Taisei's old spot (-z), so behind is +z.
    expect(a.z, 'past them').toBeGreaterThan(b.z);
    expect(flat(a, b)).toBeGreaterThanOrEqual(PUSH_RADIUS * 2 - .05);
    expect(flat(a, b)).toBeLessThan(T.behind + .3);
    const bearing = Math.atan2(b.x - a.x, b.z - a.z);
    expect(Math.abs(Math.atan2(Math.sin(bearing - a.yaw), Math.cos(bearing - a.yaw))), 'facing their back').toBeLessThan(.2);
    expect(flat(b, b0), 'the target was not moved').toBeLessThan(.05);
  });

  it('goes across a body that has its back turned, and half way round one that is side on', () => {
    // Facing away from Taisei: their back is toward him, so "behind" would be a
    // blink a stride short of where he stood. It goes across them instead.
    const away = bout();
    away.sim.actors.get('b')!.state.yaw = 0;
    away.cast(T.appear + .02);
    let a = away.sim.getPlayer('a')!, b = away.sim.getPlayer('b')!;
    expect(a.z, 'across them').toBeGreaterThan(b.z + PUSH_RADIUS * 2 - .05);
    // Side on (facing +x): between their back (-x) and across them (+z).
    const side = bout();
    side.sim.actors.get('b')!.state.yaw = Math.PI / 2;
    side.cast(T.appear + .02);
    a = side.sim.getPlayer('a')!; b = side.sim.getPlayer('b')!;
    expect(a.z, 'across them').toBeGreaterThan(b.z + .3);
    expect(a.x, 'and round toward their back').toBeLessThan(b.x - .3);
    side.step(HEAVY.contacts[0] - T.appear + .1);
    expect(side.mine('hit')[0]?.fromBehind, 'which is their back').toBe(true);
  });

  it('kicks them in the back at the contact, for the full heavy, and launches them', () => {
    const fight = bout();
    fight.cast(HEAVY.contacts[0] + .15);
    const [hit] = fight.mine('hit');
    expect(hit, 'the kick lands').toBeDefined();
    expect(hit.move).toBe(HEAVY.name);
    expect(hit.fromBehind, 'from behind').toBe(true);
    expect(hit.damage).toBe(HEAVY.damage);
    expect(hit.reaction).toBe('launched');
    expect(hit.serverTime - fight.mine('cast')[0].serverTime).toBeCloseTo(HEAVY.contacts[0], 1);
    expect(fight.sim.getPlayer('b')!.grounded).toBe(false);
  });

  it('whiffs with a short blink ahead when nobody is in reach, and does not lunge on after it', () => {
    const fight = bout({}, { b: { x: 0, y: 0, z: T.reach + 3 } });
    fight.cast(T.appear + .02);
    const a = fight.sim.getPlayer('a')!;
    expect(a.z, 'a blink straight ahead').toBeCloseTo(T.miss, 1);
    expect(Math.abs(a.x)).toBeLessThan(.01);
    fight.step(HEAVY.duration);
    expect(fight.mine('hit'), 'at nobody').toHaveLength(0);
    expect(fight.sim.getPlayer('b')!.hp).toBe(1000);
    expect(fight.sim.getPlayer('a')!.z, 'no slide after the blink').toBeCloseTo(a.z, 2);
  });

  it('goes for the nearest body in front of the aim when nothing is locked', () => {
    const sim = new ArenaSimulation({ trainingBot: false, seed: 3 });
    sim.addPlayer('a', 'taisei', 'Taisei', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('behind', 'kenzo', 'Behind', false, { x: 0, y: 0, z: -3 });
    sim.addPlayer('ahead', 'gummy', 'Ahead', false, { x: 1, y: 0, z: 7 });
    sim.submitInput('a', { seq: 0, moveX: 0, moveZ: 0, yaw: 0, attack: 'heavy' });
    for (let i = 0; i < ticks(T.appear + .02); i++) sim.step();
    const a = sim.getPlayer('a')!, ahead = sim.getPlayer('ahead')!;
    expect(flat(a, ahead), 'beside the body it was looking at').toBeLessThan(T.behind + .3);
  });

  it('keeps a hard gap to the body it kicks, and to everybody, from the vanish to the end', () => {
    const fight = bout({}, { b: { x: 0, y: 0, z: 3 } });
    let closest = Infinity;
    fight.cast(HEAVY.duration + .2, () => {
      const a = fight.sim.getPlayer('a')!, b = fight.sim.getPlayer('b')!;
      if (Math.abs(a.y - b.y) < .9) closest = Math.min(closest, flat(a, b));
    });
    expect(fight.mine('hit')).toHaveLength(1);
    expect(closest).toBeGreaterThanOrEqual(HARD_GAP - 1e-6);
  });

  it('never comes back inside the stage edge, a wall or another body', () => {
    // The stage edge right behind them: behind is off the stage, so it goes
    // to the far side from where it left, or to a side.
    const probe = new ArenaSimulation({ stage: 'sunfall-arena' });
    const { halfZ, halfX } = probe.bounds; probe.dispose();
    const edge = bout({ stage: 'sunfall-arena' }, { a: { x: 0, y: 0, z: halfZ - 6 }, b: { x: 0, y: 0, z: halfZ - .7 } });
    // b faces +z, the edge: its back is toward Taisei, so "behind" is between.
    edge.input('b', { yaw: 0 });
    edge.cast(T.appear + .02);
    let a = edge.sim.getPlayer('a')!, b = edge.sim.getPlayer('b')!;
    expect(Math.abs(a.z)).toBeLessThanOrEqual(halfZ); expect(Math.abs(a.x)).toBeLessThanOrEqual(halfX);
    expect(flat(a, b)).toBeGreaterThanOrEqual(PUSH_RADIUS * 2 - .05);

    // A wall across the arena just behind them, at z = 6.6.
    const wall = 6.6;
    const collision: CollisionWorld = {
      move: (_id, p, d) => ({ x: d.x, y: Math.max(-p.y, d.y), z: p.z + d.z > wall - .45 ? Math.min(d.z, wall - .45 - p.z) : d.z }),
      raycast: (from, to) => (from.z - wall) * (to.z - wall) < 0
        ? { x: from.x + (to.x - from.x) * (wall - from.z) / (to.z - from.z), y: from.y, z: wall } : to,
    };
    const walled = bout({ collision });
    walled.cast(T.appear + .02);
    a = walled.sim.getPlayer('a')!; b = walled.sim.getPlayer('b')!;
    expect(a.z, 'on this side of the wall').toBeLessThan(wall);
    expect(flat(a, b)).toBeGreaterThanOrEqual(PUSH_RADIUS * 2 - .05);
    walled.step(HEAVY.contacts[0] - T.appear + .1);
    expect(walled.mine('hit'), 'and the kick still lands').toHaveLength(1);

    // Somebody standing right behind them: not inside that body either.
    const crowded = bout();
    crowded.sim.addPlayer('c', 'kenzo', 'Bystander', false, { x: 0, y: 0, z: 7.1 });
    crowded.cast(T.appear + .02);
    a = crowded.sim.getPlayer('a')!;
    const c = crowded.sim.getPlayer('c')!;
    expect(flat(a, c)).toBeGreaterThanOrEqual(PUSH_RADIUS * 2 - .05);
    expect(flat(a, crowded.sim.getPlayer('b')!)).toBeGreaterThanOrEqual(PUSH_RADIUS * 2 - .05);
  });

  it('goes round a real post to a target standing behind it, and clear of the post', async () => {
    const collision = await createRapierCollision();
    // The ume trunk at (-34, 36): a post 0.4 m wide (tests/meleeFollowThrough).
    const tree = UME_TREES.find(t => t.x === -34 && t.z === 36)!;
    const post = [...ENVIRONMENT_COLLIDERS].filter(c => c.halfX < .3)
      .sort((p, q) => Math.hypot(p.x - tree.x, p.z - tree.z) - Math.hypot(q.x - tree.x, q.z - tree.z))[0];
    const face = post.z - post.halfZ - .45;
    const fight = bout({ collision }, { a: { x: post.x, y: 0, z: face - .43 }, b: { x: post.x, y: 0, z: face - .43 + 2.1 } });
    try {
      fight.cast(T.appear + .02);
      const a = fight.sim.getPlayer('a')!;
      expect(collision.penetration(a), 'not inside the post').toBeLessThan(.02);
      fight.step(HEAVY.contacts[0] - T.appear + .1);
      expect(fight.mine('hit'), 'the teleport is not stopped by a post in the way').toHaveLength(1);
    } finally { fight.sim.dispose(); }
  });

  it('is dodged while gone: a blow at the spot it left finds nobody', () => {
    const fight = bout({}, { b: { x: 0, y: 0, z: 1.6 } });
    fight.input('a', { attack: 'heavy' });
    fight.step(T.vanish + .02);
    // The foe swings at where Taisei stood.
    fight.input('b', { attack: 'special' });
    fight.step(.02);
    const a = fight.sim.getPlayer('a')!;
    expect(fight.sim.actors.get('a')!.evadeUntil).toBeGreaterThan(fight.sim.serverTime);
    expect(a.hp).toBe(1000);
  });

  it('is blocked by a held guard, which turns to meet it, and a just guard parries it into a vanish', () => {
    const guarded = bout();
    guarded.cast(HEAVY.contacts[0] + .15, i => { if (i % 6 === 0) guarded.input('b', { guard: true, yaw: Math.PI }); });
    expect(guarded.events.some(e => e.kind === 'blocked' && e.actorId === 'a'), 'blocked from behind').toBe(true);
    expect(guarded.mine('hit')).toHaveLength(0);

    const parried = bout();
    const pressAt = ticks(HEAVY.contacts[0] - JUST_GUARD_WINDOW * .5);
    parried.cast(HEAVY.contacts[0] + .15, i => { if (i >= pressAt) parried.input('b', { guard: true, yaw: Math.PI }); });
    expect(parried.events.some(e => e.kind === 'just-guard'), 'parried on the beat').toBe(true);
    const vanish = parried.events.find(e => e.kind === 'vanish');
    expect(vanish?.actorId, 'into the usual vanish behind Taisei').toBe('b');
  });

  it('catches a body that turned and ran, and loses one that dashed out', () => {
    const run = bout({}, { b: { x: 0, y: 0, z: 3 } });
    run.cast(HEAVY.contacts[0] + .15, () => run.input('b', { moveX: 0, moveZ: 1, yaw: 0 }));
    expect(run.mine('hit'), 'a run is not an escape').toHaveLength(1);

    const dash = bout({}, { b: { x: 0, y: 0, z: 3 } });
    dash.cast(HEAVY.contacts[0] + .15, i => {
      if (i === ticks(T.appear + .02)) dash.input('b', { moveX: 1, moveZ: 0, yaw: 0, dash: true });
      else dash.input('b', { moveX: 1, moveZ: 0, yaw: 0 });
    });
    expect(dash.mine('hit'), 'a dash on the reappear is').toHaveLength(0);
  });

  it('comes back in the air beside a body in the air, and drives it into the floor', () => {
    const fight = bout({}, { b: { x: 0, y: 0, z: 4 } });
    const b = fight.sim.actors.get('b')!;
    // Launched: two metres up and still rising.
    Object.assign(b.state, { y: 2.2, grounded: false });
    Object.assign(b, { vy: 3, reaction: 'launched', stunUntil: fight.sim.serverTime + 1.5, launchSlot: 'light' });
    fight.cast(T.appear + .02);
    const a = fight.sim.getPlayer('a')!, q = fight.sim.getPlayer('b')!;
    expect(a.grounded, 'off the floor').toBe(false);
    expect(Math.abs(a.y - q.y), 'level with them').toBeLessThan(.3);
    fight.step(2.2);
    expect(fight.mine('hit'), 'the kick lands in the air').toHaveLength(1);
    expect(fight.events.some(e => e.kind === 'ground-bounce' && e.actorId === 'b'), 'and they bounce off the floor').toBe(true);
    expect(fight.sim.getPlayer('a')!.grounded, 'Taisei comes down too').toBe(true);
  });

  it('is thrown from the floor: from the air a heavy is Taisei\'s air strike (combos.ts, 5 October)', () => {
    const fight = bout();
    fight.input('a', { jump: true });
    fight.step(.2);
    expect(fight.sim.getPlayer('a')!.grounded).toBe(false);
    fight.cast(T.appear + .02);
    const cast = fight.mine('cast').find(e => e.slot === 'heavy');
    expect(cast?.branch).toBe('airHeavy');
    expect(cast?.move).toBe(comboMove('taisei', 'airHeavy')!.name);
    expect(fight.sim.actors.get('a')!.goneUntil ?? -Infinity, 'no vanish').toBeLessThan(fight.sim.serverTime);
  });

  it('lets bodies through it only while it is gone, on the server and in a client\'s copy of it', () => {
    // A foe walking through the spot Taisei left.
    const fight = bout({}, { b: { x: 0, y: 0, z: 1.3 } });
    fight.input('a', { attack: 'heavy', targetId: undefined });
    let through = false;
    fight.step(T.appear - .02, i => {
      fight.input('b', { moveX: 0, moveZ: -1, yaw: Math.PI });
      if (i > ticks(T.vanish) + 3) through ||= flat(fight.sim.getPlayer('b')!, { x: 0, y: 0, z: 0 }) < .5;
    });
    expect(through, 'walked straight through the empty spot').toBe(true);
  });
});

describe('Cloudstep under rollback', () => {
  it.each([['a stationary target', 5, 0], ['a target that walks away', 5, 1], ['nobody in reach', 14, 0]] as const)(
    'replays %s under WAN batching without a correction', (_label, gap, walk) => {
      const server = new ArenaSimulation({ trainingBot: false, seed: 4 });
      server.addPlayer('me', 'taisei', 'Me', false, { x: 0, y: 0, z: 0 });
      server.addPlayer('foe', 'konta', 'Foe', false, { x: 0, y: 0, z: gap });
      const prediction = new Prediction(), queue = new InputQueue();
      prediction.start('me', server.snapshot(true, true));
      const upload: { tick: number; input: PlayerInput }[] = [], download: { tick: number; s: GameSnapshot }[] = [];
      let maxCorrection = 0, hits = 0, blinked = 0;
      try {
        for (let tick = 0; tick < 150; tick++) {
          const input: PlayerInput = { seq: tick, moveX: 0, moveZ: 0, yaw: 0, targetId: 'foe', attack: tick === 10 ? 'heavy' : undefined };
          prediction.submit(input); upload.push({ tick: tick + 9, input });
          while (upload.length && upload[0].tick <= tick) queue.push(upload.shift()!.input);
          const next = queue.take(); if (next) server.submitInput('me', next);
          server.submitInput('foe', { seq: tick, moveX: 0, moveZ: walk, yaw: 0, targetId: 'me' });
          server.step(1 / 60, new Set(next ? [] : ['me']));
          if (tick % 2 === 0) {
            const snapshot = server.snapshot(true, true);
            hits += snapshot.events.filter(e => e.kind === 'hit' && e.actorId === 'me').length;
            download.push({ tick: tick + 9, s: snapshot });
          }
          blinked = Math.max(blinked, server.getPlayer('me')!.z);
          while (download.length && download[0].tick <= tick) {
            const before = prediction.diagnostics.position!; prediction.reconcile(download.shift()!.s); const after = prediction.diagnostics.position!;
            maxCorrection = Math.max(maxCorrection, Math.hypot(before.x - after.x, before.y - after.y, before.z - after.z));
          }
        }
        if (gap < T.reach) expect(hits, 'it landed').toBe(1);
        else { expect(hits).toBe(0); expect(blinked).toBeCloseTo(T.miss, 1); }
        // A walking target is copied into the client a snapshot late, so the
        // spot behind them is a round trip old there: a small correction, the
        // same one any approach at a moving body carries.
        expect(maxCorrection).toBeLessThan(walk ? .6 : .001);
      } finally { prediction.stop(); server.dispose(); }
    });

  it('restores a checkpoint taken while gone and comes back where the server does', () => {
    const source = new ArenaSimulation({ trainingBot: false, seed: 7 }), restored = new ArenaSimulation({ trainingBot: false, seed: 7 });
    try {
      for (const sim of [source, restored]) { sim.addPlayer('me', 'taisei', 'Me', false, { x: 0, y: 0, z: 0 }); sim.addPlayer('foe', 'konta', 'Foe', false, { x: 0, y: 0, z: 5 }); }
      let seq = 0;
      const drive = (sim: ArenaSimulation, frames: number, attack?: 'heavy') => {
        for (let i = 0; i < frames; i++) { sim.submitInput('me', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, targetId: 'foe', attack: i === 0 ? attack : undefined }); sim.step(); }
      };
      drive(source, ticks(T.vanish + .08), 'heavy');
      const checkpoint = source.predictionCheckpoint('me')!;
      expect(checkpoint.cast?.blink?.from, 'the checkpoint carries the blink').toBeDefined();
      expect(checkpoint.cast?.blink?.to).toBeUndefined();
      restored.serverTime = source.serverTime; restored.tick = source.tick;
      Object.assign(restored.actors.get('me')!.state, source.getPlayer('me')!);
      restored.restorePrediction('me', structuredClone(checkpoint));
      const at = seq;
      drive(source, ticks(.4)); seq = at; drive(restored, ticks(.4));
      expect(flat(restored.getPlayer('me')!, source.getPlayer('me')!)).toBeLessThan(1e-9);
      expect(restored.getPlayer('foe')!.hp).toBe(source.getPlayer('foe')!.hp);
    } finally { source.dispose(); restored.dispose(); }
  });
});
