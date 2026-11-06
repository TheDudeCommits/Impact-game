import { describe, expect, it } from 'vitest';
import { ArenaSimulation, LAG_COMPENSATION, RISE_REACH, validateInput } from '../src/game/simulation';
import { MOVES, meleeReach } from '../src/game/moves';
import type { CombatEvent, FighterId, PlayerInput } from '../src/game/types';
import { kiteRun } from '../scripts/combat/kite_hitrate.mts';


const DT = 1 / 60;
function duel(attacker: FighterId = 'kenzo') {
  const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 7 });
  sim.addPlayer('a', attacker, 'A', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('b', 'taisei', 'B', false, { x: 0, y: 0, z: 2 });
  sim.place('a', { x: 0, y: 0, z: 0 }, 0); sim.place('b', { x: 0, y: 0, z: 2 }, Math.PI);
  for (let i = 0; i < 20; i++) sim.step(DT);
  sim.drainEvents();
  return sim;
}
const hits = (events: CombatEvent[]) => events.filter(e => e.kind === 'hit' && e.actorId === 'a' && e.targetId === 'b').length;

describe('lag compensation', () => {
  it('resolves a swing against where the attacker saw a fighter who has since moved on', () => {
    // B stands 1.6 m in front of A, then, as A swings, is carried off straight away from it at 14 m/s - out of the
    // swing's reach by its blow. A's page draws B 0.2 s behind, so to A, B was still standing there when it landed.
    const run = (rewind: number, behind: number) => {
      const sim = duel();
      sim.rewind = rewind;
      sim.place('b', { x: 0, y: 0, z: 1.6 }, Math.PI);
      let sa = 0, landed = 0, z = 1.6;
      for (let i = 0; i < 40; i++) {
        if (i > 10) { z += 14 / 60; sim.place('b', { x: 0, y: 0, z }, Math.PI); }
        // No target given: nothing steers or steps in after B; the swing goes where A faces.
        sim.submitInput('a', { seq: ++sa, moveX: 0, moveZ: 0, yaw: 0, view: sim.serverTime - behind,
          ...(i === 10 ? { attack: 'light' as const } : {}) } as PlayerInput);
        sim.step(DT);
        landed += hits(sim.drainEvents());
      }
      return landed;
    };
    expect(run(LAG_COMPENSATION, .2)).toBeGreaterThan(0);
    // Without it (the page's own copy, an old room) the same swing was the near miss.
    expect(run(0, .2)).toBe(0);
    // A page that draws B as it is now is resolved against now.
    expect(run(LAG_COMPENSATION, 0)).toBe(0);
  });

  it('keeps the view an input reports, and refuses one that is not a time', () => {
    expect(validateInput({ seq: 1, moveX: 0, moveZ: 0, yaw: 0, view: 12.5 })?.view).toBe(12.5);
    expect(validateInput({ seq: 1, moveX: 0, moveZ: 0, yaw: 0 })?.view).toBeUndefined();
    expect(validateInput({ seq: 1, moveX: 0, moveZ: 0, yaw: 0, view: 'soon' })).toBeNull();
    expect(validateInput({ seq: 1, moveX: 0, moveZ: 0, yaw: 0, view: -1 })).toBeNull();
  });
});

describe('the rising strike', () => {
  // Nigo: a plain melee heavy (Kenzo's is Mirage Draw, a dash-through cut that homes on its own).
  const overhead = (z: number, swing: 'light' | 'heavy') => {
    const sim = duel('nigo');
    sim.place('b', { x: 0, y: 0, z }, Math.PI);
    let sa = 0, sb = 0, landed = 0, top = 0;
    // B jumps on the spot; A swings as B leaves the floor.
    sim.submitInput('b', { seq: ++sb, moveX: 0, moveZ: 0, yaw: Math.PI, jump: true, jumpHeld: true });
    for (let i = 0; i < 70; i++) {
      if (i > 0) sim.submitInput('b', { seq: ++sb, moveX: 0, moveZ: 0, yaw: Math.PI, jumpHeld: true });
      sim.submitInput('a', { seq: ++sa, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', lock: true, ...(i === 6 ? { attack: swing } : {}) });
      sim.step(DT);
      landed += hits(sim.drainEvents());
      top = Math.max(top, sim.getPlayer('a')!.y);
    }
    return { landed, top, b: sim.getPlayer('b')! };
  };

  it('meets a fighter who jumps over a swing thrown from the floor, on the blow, and comes back down', () => {
    const light = overhead(1.8, 'light');
    expect(light.landed).toBeGreaterThan(0);
    expect(light.top).toBeGreaterThan(1);
    expect(light.top).toBeLessThanOrEqual(RISE_REACH + .5);
    const heavy = overhead(2, 'heavy');
    expect(heavy.landed).toBeGreaterThan(0);
  });

  it('reaches no further across the floor than the move does', () => {
    const reach = meleeReach('nigo', 'light', MOVES.nigo.light);
    expect(overhead(reach + 6, 'light').landed).toBe(0);
    expect(overhead(reach + 6, 'light').top).toBeLessThan(.5);
  });
});

describe('chasing', () => {
  it('a swing thrown with the stick held at a fighter running away still steps in and lands', () => {
    const sim = duel();
    sim.place('b', { x: 0, y: 0, z: 2.6 }, 0);
    let sa = 0, sb = 0, landed = 0;
    for (let i = 0; i < 50; i++) {
      sim.submitInput('b', { seq: ++sb, moveX: 0, moveZ: 1, yaw: 0 });
      sim.submitInput('a', { seq: ++sa, moveX: 0, moveZ: 1, yaw: 0, targetId: 'b', lock: true, ...(i === 4 ? { attack: 'light' as const } : {}) });
      sim.step(DT);
      landed += hits(sim.drainEvents());
    }
    expect(landed).toBeGreaterThan(0);
  });
});

describe('against somebody who will not stand and fight', () => {
  // The harness's kiting fighter: running off, weaving, a full jump every 1.1 s. Measured on the roster before this
  // change: 30% of lights thrown in the open landed offline, 5% at 200 ms behind; after it, 86% and 81%.
  it('lands most lights, offline and 200 ms behind', () => {
    for (const lag of [0, .2]) {
      let casts = 0, landed = 0;
      for (const fighter of ['taisei', 'kenzo', 'gummy', 'konta'] as const) {
        const t = kiteRun(fighter, 'light', 'kite', 41, 16, lag);
        casts += t.casts; landed += t.landed;
      }
      expect(casts).toBeGreaterThan(20);
      expect(landed / casts).toBeGreaterThan(.6);
    }
  });
});
