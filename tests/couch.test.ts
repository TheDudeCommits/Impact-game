import { describe, expect, it } from 'vitest';
import { CouchRig, DOLLY_FAR, DOLLY_NEAR } from '../src/couch/CouchCamera';
import { LEFT_KEYS, RIGHT_KEYS, Seat, screenMove, suggestSeats } from '../src/couch/seats';
import { ArenaSimulation } from '../src/game/simulation';
import { COMBO_HP, COMBO_STAMINA } from '../src/game/moves';
import { SECOND } from '../src/game/couchSeat';
import type { PadState } from '../src/input/gamepad';

const body = (x: number, z: number, y = 0) => ({ x, y, z, height: 1.8 });
const run = (rig: CouchRig, a: ReturnType<typeof body>, b: ReturnType<typeof body>, seconds: number) => {
  let shot = rig.update(1 / 60, [a, b]);
  for (let t = 0; t < seconds; t += 1 / 60) shot = rig.update(1 / 60, [a, b]);
  return shot;
};
/** Where a body lands across the frame: -1 the left edge, +1 the right (horizontal field of view only). */
const across = (shot: ReturnType<CouchRig['update']>, p: { x: number; z: number }) => {
  const fx = shot.lookX - shot.eyeX, fz = shot.lookZ - shot.eyeZ, f = Math.hypot(fx, fz), rx = -fz / f, rz = fx / f;
  const side = (p.x - shot.eyeX) * rx + (p.z - shot.eyeZ) * rz, depth = (p.x - shot.eyeX) * fx / f + (p.z - shot.eyeZ) * fz / f;
  return side / depth / Math.tan(Math.atan(Math.tan(25 * Math.PI / 180) * 16 / 9));
};

describe('the couch camera', () => {
  it('films a pair from the side, one on each half of the picture, both inside it', () => {
    const rig = new CouchRig(), a = body(-2, 0), b = body(2, 0);
    const shot = run(rig, a, b, 1);
    // Square to the line between them (the line runs along x, so the lens looks along z).
    expect(Math.abs(Math.sin(shot.yaw))).toBeLessThan(.05);
    const left = across(shot, a), right = across(shot, b);
    expect(Math.sign(left)).not.toBe(Math.sign(right));
    // Player 1 (the first body) starts on the left, whichever way round the pair stands.
    expect(left).toBeLessThan(0);
    const along = new CouchRig(), first = run(along, body(0, -9), body(0, 9), .5);
    expect(across(first, { x: 0, z: -9 })).toBeLessThan(0);
    for (const v of [left, right]) expect(Math.abs(v)).toBeLessThan(.95);
  });
  it('pulls back to keep a far-apart pair in frame, and never past its limits', () => {
    const rig = new CouchRig();
    const near = run(rig, body(-.6, 0), body(.6, 0), 2);
    expect(rig.distance).toBeGreaterThanOrEqual(DOLLY_NEAR - 1e-6);
    const far = run(rig, body(-9, 0), body(9, 0), 3);
    expect(rig.distance).toBeGreaterThan(DOLLY_NEAR + 3);
    expect(rig.distance).toBeLessThanOrEqual(DOLLY_FAR + 1e-6);
    expect(Math.abs(across(far, { x: 9, z: 0 }))).toBeLessThan(1);
    expect(near.fov).toBe(far.fov);
  });
  it('holds still while the pair circles a little, and turns slowly when the line swings far', () => {
    const rig = new CouchRig();
    run(rig, body(-2, 0), body(2, 0), 1);
    const rest = rig.yaw;
    // 15 degrees of circling: inside the window, so the lens rests.
    const r = 2, small = 15 * Math.PI / 180;
    run(rig, body(-r * Math.cos(small), -r * Math.sin(small)), body(r * Math.cos(small), r * Math.sin(small)), 1);
    expect(Math.abs(Math.atan2(Math.sin(rig.yaw - rest), Math.cos(rig.yaw - rest)))).toBeLessThan(1e-3);
    // 70 degrees: it follows, but never faster than its turn speed.
    const big = 70 * Math.PI / 180;
    let last = rig.yaw, fastest = 0;
    for (let i = 0; i < 180; i++) {
      rig.update(1 / 60, [body(-r * Math.cos(big), -r * Math.sin(big)), body(r * Math.cos(big), r * Math.sin(big))]);
      fastest = Math.max(fastest, Math.abs(Math.atan2(Math.sin(rig.yaw - last), Math.cos(rig.yaw - last))) * 60); last = rig.yaw;
    }
    expect(Math.abs(Math.atan2(Math.sin(rig.yaw - rest), Math.cos(rig.yaw - rest)))).toBeGreaterThan(.2);
    expect(fastest).toBeLessThanOrEqual(.9 + 1e-6);
  });
  it('lets a pair that crosses over swap sides of the picture rather than swinging round', () => {
    const rig = new CouchRig();
    run(rig, body(-2, 0), body(2, 0), 1);
    const before = rig.yaw;
    run(rig, body(2, 0), body(-2, 0), 1);
    expect(Math.abs(Math.atan2(Math.sin(rig.yaw - before), Math.cos(rig.yaw - before)))).toBeLessThan(1e-3);
  });
  it('looks down on the field in co-op, from further back', () => {
    const versus = new CouchRig(), coop = new CouchRig(); coop.coop = true;
    const v = run(versus, body(-1, 0), body(1, 0), 1), c = run(coop, body(-1, 0), body(1, 0), 1);
    expect(c.eyeY - c.lookY).toBeGreaterThan(v.eyeY - v.lookY);
    expect(coop.distance).toBeGreaterThan(versus.distance);
  });
});

describe('couch seats', () => {
  it('keeps the two keyboard halves apart: no key is both players\'', () => {
    const left = new Set(Object.values(LEFT_KEYS).flat());
    for (const code of Object.values(RIGHT_KEYS).flat()) expect(left.has(code), code).toBe(false);
  });
  it('reads each half against the screen: right is the screen\'s right for both', () => {
    const p1 = new Seat('you', { kind: 'keys', layout: 'left' }), p2 = new Seat(SECOND, { kind: 'keys', layout: 'right' });
    const yaw = 0; // the lens looks along +z: the screen's right is -x
    const right = screenMove(0, 1, yaw);
    const a = p1.command(new Set(['KeyD']), yaw, 0, null), b = p2.command(new Set(['ArrowRight']), yaw, 0, null);
    expect(a.moveX).toBeCloseTo(right.moveX); expect(b.moveX).toBeCloseTo(right.moveX);
    expect(a.moveX).toBeLessThan(0);
    // A key of the other half moves nobody.
    expect(p1.command(new Set(['ArrowRight']), yaw, 0, null).moveX).toBe(0);
  });
  it('hands each press to its own seat once', () => {
    const p1 = new Seat('you', { kind: 'keys', layout: 'left' }), p2 = new Seat(SECOND, { kind: 'keys', layout: 'right' });
    expect(p1.press('KeyC')).toBe(true); expect(p2.press('KeyC')).toBe(false);
    expect(p2.press('KeyK')).toBe(true);
    expect(p1.command(new Set(), 0, 0, null).attack).toBe('light');
    expect(p1.command(new Set(), 0, 0, null).attack).toBeUndefined();
    expect(p2.command(new Set(), 0, 0, 'you').attack).toBe('light');
  });
  it('seats two pads first, then the keyboard, and the keyboard split in two with none', () => {
    const pad = (index: number) => ({ index, id: 'Xbox', mapping: 'standard', connected: true, axes: [], buttons: [] }) as PadState;
    expect(suggestSeats([], false)).toEqual([{ kind: 'keys', layout: 'left' }, { kind: 'keys', layout: 'right' }]);
    expect(suggestSeats([pad(0)], false)).toEqual([{ kind: 'keys', layout: 'full' }, { kind: 'pad', index: 0 }]);
    expect(suggestSeats([pad(0)], true)).toEqual([{ kind: 'pad', index: 0 }, { kind: 'keys', layout: 'full' }]);
    expect(suggestSeats([pad(0), null, pad(2)], false)).toEqual([{ kind: 'pad', index: 0 }, { kind: 'pad', index: 2 }]);
  });
});

describe('couch versus in the simulation', () => {
  it('two people in one Duel each move and land blows from their own commands', async () => {
    const { createRapierCollision } = await import('../src/game/rapierCollision');
    const sim = new ArenaSimulation({ roomMode: 'match', stage: 'sunfall-arena', collision: await createRapierCollision('sunfall-arena'), maxStamina: COMBO_STAMINA, maxHp: COMBO_HP, lockCombat: true });
    sim.addPlayer('you', 'taisei', 'Player 1'); sim.addPlayer(SECOND, 'konta', 'Player 2');
    expect(sim.startMatch()).toBe(true);
    const hits: Record<string, number> = { you: 0, [SECOND]: 0 };
    for (let tick = 0; tick < 60 * 8; tick++) {
      const s = sim.snapshot(false), a = s.players.find(p => p.id === 'you')!, b = s.players.find(p => p.id === SECOND)!;
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 1, close = d < 2.2;
      // Player 1 walks in and presses light; Player 2 does the same from the other side, on a different beat.
      sim.submitInput('you', { seq: tick + 1, moveX: close ? 0 : dx / d, moveZ: close ? 0 : dz / d, yaw: Math.atan2(dx, dz), targetId: SECOND, lock: true, ...(close && tick % 11 === 0 ? { attack: 'light' as const } : {}) });
      sim.submitInput(SECOND, { seq: tick + 1, moveX: close ? 0 : -dx / d, moveZ: close ? 0 : -dz / d, yaw: Math.atan2(-dx, -dz), targetId: 'you', lock: true, ...(close && tick % 17 === 5 ? { attack: 'light' as const } : {}) });
      sim.step(1 / 60);
      for (const e of sim.drainEvents()) if (e.kind === 'hit' && e.actorId in hits) hits[e.actorId]++;
    }
    sim.dispose?.();
    expect(hits.you).toBeGreaterThan(0);
    expect(hits[SECOND]).toBeGreaterThan(0);
  });
});

describe('couch co-op leash', () => {
  it('stops a hero walking further than the leash from the other, and only that step', async () => {
    const { Couch, LEASH } = await import('../src/couch/couch');
    const couch = new Couch();
    couch.begin('coop', [{ kind: 'keys', layout: 'left' }, { kind: 'keys', layout: 'right' }], { yaw: 0 });
    couch.live = true;
    const player = (id: string, x: number) => ({ id, x, y: 0, z: 0, yaw: 0, alive: true, fighter: 'taisei', name: id, hp: 1, maxHp: 1 }) as never;
    couch.aimAt([player('you', -(LEASH / 2 + 1)), player(SECOND, LEASH / 2 + 1)]);
    // The lens looks along +z (yaw 0): the screen's left is +x. P1 at -x holding A walks... toward +x (back toward P2): allowed.
    couch.seats.held.add('KeyA');
    expect(couch.command('you')!.moveX).toBeGreaterThan(.9);
    couch.seats.held.delete('KeyA'); couch.seats.held.add('KeyD');
    // D: away from P2 (toward -x), past the leash: taken out.
    expect(Math.abs(couch.command('you')!.moveX)).toBeLessThan(1e-9);
    couch.end();
  });
});
