import { beforeAll, describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { MOVES, PLAYER_RADIUS } from '../src/game/moves';
import { prepare, trial, type Behaviour, type Hands, type Room } from '../scripts/gummy/ult_hitrate.mts';
import type { CombatEvent, PlayerInput } from '../src/game/types';

const TRIALS = 6;
const move = MOVES.ward.ultimate, swap = move.teleport!;
beforeAll(async () => { await prepare(); });
const rate = (spec: { distance: number; behaviour: Behaviour; awakened?: boolean; room?: Room; hands?: Hands }) => {
  let landed = 0;
  for (let variant = 0; variant < TRIALS; variant++) if (trial({ fighter: 'ward', ...spec, variant }).landed) landed++;
  return landed / TRIALS;
};

describe('Flatline: Crossmatch lands whenever it fairly should', () => {
  it('reaches as far as his ROOM: the swap and the palm on the opener\'s one tick, on the near side of them', () => {
    expect(swap.reach + PLAYER_RADIUS, '11 m centre to centre, as Gummy\'s grab').toBeGreaterThanOrEqual(10.9);
    expect(swap.appear, 'the palm lands where he arrives').toBe(move.contacts[0]);
    expect(swap.vanish, 'a swap, not a flight').toBe(swap.appear);
    expect(swap.near, 'in front of them, down the line he threw it along').toBe(true);
    expect(swap.miss, 'nobody in it: he stays where he is').toBe(0);
    expect(move.close, 'no drive across the floor').toBeUndefined();
  });

  it('keeps everything after the opener: the guard break, the whiff\'s recovery, 40 + 288, the cooldown', () => {
    expect(move).toMatchObject({ damage: 40, finisherDamage: 288, guardBreak: true, cooldown: 20, contacts: [.45, 1.52, 1.74], schedule: [40, 92, 202] });
    expect(move.confirm?.recovery).toBeGreaterThan(0);
  });

  it.each(['standing', 'jogging', 'strafing', 'guarding'] as Behaviour[])('a partner %s 3, 6 and 9 m off is caught, the stick let go', behaviour => {
    for (const distance of [3, 6, 9]) expect(rate({ distance, behaviour }), `${behaviour} at ${distance} m`).toBeGreaterThanOrEqual(.9);
  });

  it('awakened, and on a royale\'s places, as well', () => {
    for (const behaviour of ['jogging', 'strafing'] as Behaviour[]) for (const distance of [6, 9]) {
      expect(rate({ distance, behaviour, awakened: true }), `awakened, ${behaviour} at ${distance} m`).toBeGreaterThanOrEqual(.9);
      expect(rate({ distance, behaviour, room: 'royale' }), `royale, ${behaviour} at ${distance} m`).toBeGreaterThanOrEqual(.9);
    }
  });

  it('running them down - the stick held at them, which owns travel - it lands from 3 to 12 m', () => {
    for (const behaviour of ['standing', 'jogging', 'strafing'] as Behaviour[]) for (const distance of [3, 6, 9, 12])
      expect(rate({ distance, behaviour, hands: 'stick' }), `${behaviour} at ${distance} m`).toBeGreaterThanOrEqual(.9);
  });

  it('a body standing outside his ROOM is not caught', () => {
    expect(rate({ distance: 12, behaviour: 'standing' })).toBe(0);
  });

  it('lands as hard as it did: 290 off a standing partner, the finisher every time it confirms', () => {
    for (const distance of [3, 9]) {
      const r = trial({ fighter: 'ward', distance, behaviour: 'standing' });
      expect(r.finisher, `${distance} m`).toBe(true);
      expect(r.damage, `${distance} m`).toBe(290);
    }
  });
});

describe('the swap, and what still beats it', () => {
  /** Ward at the origin facing +z with a full bar, Taisei `gap` metres in front, in a training room. */
  function duel(gap: number) {
    const sim = new ArenaSimulation({ trainingBot: false, seed: 3 });
    sim.addPlayer('a', 'ward', 'A', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('b', 'taisei', 'B', false, { x: 0, y: 0, z: gap });
    sim.actors.get('a')!.state.ultimate = 100;
    const seq: Record<string, number> = { a: 1, b: 1 }, events: CombatEvent[] = [];
    const tick = (b: Partial<PlayerInput> = {}, a: Partial<PlayerInput> = {}) => {
      sim.submitInput('a', { seq: seq.a++, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', lock: true, ...a });
      sim.submitInput('b', { seq: seq.b++, moveX: 0, moveZ: 0, yaw: Math.PI, ...b });
      sim.step(1 / 60); events.push(...sim.drainEvents());
    };
    const mine = (kind: CombatEvent['kind']) => events.filter(e => e.kind === kind && e.actorId === 'a');
    return { sim, tick, events, mine, ward: sim.actors.get('a')!.state, taisei: sim.actors.get('b')!.state };
  }

  it('comes back on the near side of them, facing them, a pushbox off - on the opener\'s tick - and the cinematic holds him there', () => {
    const { sim, tick, mine, ward, taisei, events } = duel(8);
    tick({}, { attack: 'ultimate' });
    let swapped = -1;
    for (let i = 1; i < 60 && swapped < 0; i++) { tick(); if (ward.z > 1) swapped = i; }
    expect(swapped, 'he went').toBeGreaterThan(0);
    expect(Math.hypot(ward.x - taisei.x, ward.z - taisei.z), 'touching them').toBeCloseTo(swap.behind, 1);
    expect(ward.z, 'between them and where he left').toBeLessThan(taisei.z);
    expect(Math.abs(ward.x), 'on the line he threw it along').toBeLessThan(.05);
    expect(mine('release').length, 'the palm on the same tick').toBe(1);
    expect(events.some(e => e.kind === 'hit' && e.actorId === 'a' && e.targetId === 'b'), 'and on them').toBe(true);
    // The verdict once the blow's impact freeze is over.
    for (let i = 0; i < 10; i++) tick();
    expect(mine('confirm')).toHaveLength(1);
    expect(Math.cos(ward.yaw), 'facing them').toBeGreaterThan(.99);
    const at = { x: ward.x, z: ward.z };
    for (let i = 0; i < 60; i++) tick();
    expect(Math.hypot(ward.x - at.x, ward.z - at.z), 'held where he arrived').toBeLessThan(.01);
    sim.dispose();
  });

  it('nobody in his ROOM: he stays where he is, and the shock goes off in his hand', () => {
    const { sim, tick, mine, ward } = duel(13);
    tick({}, { attack: 'ultimate' });
    for (let i = 1; i < 90; i++) tick();
    expect(mine('whiff')).toHaveLength(1);
    expect(mine('confirm')).toHaveLength(0);
    expect(Math.hypot(ward.x, ward.z), 'not a step').toBeLessThan(.05);
    sim.dispose();
  });

  it('a partner who turns and runs on the press is caught while still inside it, and gets away once out of it', () => {
    for (const [gap, caught] of [[6, true], [10, false]] as const) {
      const { sim, tick, mine } = duel(gap);
      tick({}, { attack: 'ultimate' });
      for (let i = 1; i < 90; i++) tick({ moveZ: 1, yaw: 0 });
      expect(mine('confirm').length, `from ${gap} m`).toBe(caught ? 1 : 0);
      expect(mine('whiff').length, `from ${gap} m`).toBe(caught ? 0 : 1);
      sim.dispose();
    }
  });

  it('the stick held at them through the wind-up changes nothing: it lands', () => {
    const { sim, tick, mine } = duel(9);
    tick({}, { attack: 'ultimate', moveZ: 1 });
    for (let i = 1; i < 90; i++) tick({}, { moveZ: 1 });
    expect(mine('confirm')).toHaveLength(1);
    sim.dispose();
  });

  it('a dash timed onto the swap slips it', () => {
    const { sim, tick, mine, events } = duel(8);
    tick({}, { attack: 'ultimate' });
    // A forward dash's evade (0.13 s) - pressed just before the swap, so it covers the palm's tick.
    const dashAt = Math.round((move.contacts[0] - .06) * 60);
    for (let i = 1; i < 90; i++) tick(i === dashAt ? { dash: true, moveX: 0, moveZ: -1 } : {});
    expect(events.some(e => e.kind === 'dodge' && e.actorId === 'a'), 'it went through the dash').toBe(true);
    expect(mine('whiff')).toHaveLength(1);
    expect(mine('confirm')).toHaveLength(0);
    sim.dispose();
  });

  it('a guard is broken, as every ultimate\'s is', () => {
    const { sim, tick, mine } = duel(8);
    for (let i = 0; i < 20; i++) tick({ guard: true });
    tick({ guard: true }, { attack: 'ultimate' });
    for (let i = 0; i < 70; i++) tick({ guard: true });
    expect(mine('guard-break')).toHaveLength(1);
    expect(mine('confirm')).toHaveLength(1);
    sim.dispose();
  });
});
