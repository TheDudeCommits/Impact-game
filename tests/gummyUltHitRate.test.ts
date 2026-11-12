import { beforeAll, describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { meleeReach, MOVES } from '../src/game/moves';
import { prepare, trial, type Behaviour, type Hands, type Room } from '../scripts/gummy/ult_hitrate.mts';
import type { CombatEvent, PlayerInput } from '../src/game/types';

const TRIALS = 6;
beforeAll(async () => { await prepare(); });
const rate = (spec: { distance: number; behaviour: Behaviour; awakened?: boolean; room?: Room; hands?: Hands }) => {
  let landed = 0;
  for (let variant = 0; variant < TRIALS; variant++) if (trial({ fighter: 'gummy', ...spec, variant }).landed) landed++;
  return landed / TRIALS;
};

describe('Spring Tide: the grab lands whenever it fairly should', () => {
  it('reaches 11 m with his stretched arm, not the crouch\'s 2.9', () => {
    expect(meleeReach('gummy', 'ultimate', MOVES.gummy.ultimate)).toBeGreaterThanOrEqual(10.9);
    expect(MOVES.gummy.ultimate.close, 'no slide across the floor to reach them').toBe(0);
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

  it('running them down - the stick held at them, so nothing steers it - it still lands from 6 to 12 m', () => {
    for (const behaviour of ['standing', 'jogging'] as Behaviour[]) for (const distance of [6, 9, 12])
      expect(rate({ distance, behaviour, hands: 'stick' }), `${behaviour} at ${distance} m`).toBeGreaterThanOrEqual(.9);
  });

  it('a body standing past its reach is not caught', () => {
    expect(rate({ distance: 12, behaviour: 'standing' })).toBe(0);
  });
});

describe('what still beats it', () => {
  /** Gummy at the origin facing +z with a full bar, Taisei `gap` metres in front, in a training room. */
  function duel(gap: number) {
    const sim = new ArenaSimulation({ trainingBot: false, seed: 3 });
    sim.addPlayer('a', 'gummy', 'A', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('b', 'taisei', 'B', false, { x: 0, y: 0, z: gap });
    sim.actors.get('a')!.state.ultimate = 100;
    const seq: Record<string, number> = { a: 1, b: 1 }, events: CombatEvent[] = [];
    const tick = (b: Partial<PlayerInput> = {}, a: Partial<PlayerInput> = {}) => {
      sim.submitInput('a', { seq: seq.a++, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', lock: true, ...a });
      sim.submitInput('b', { seq: seq.b++, moveX: 0, moveZ: 0, yaw: Math.PI, ...b });
      sim.step(1 / 60); events.push(...sim.drainEvents());
    };
    return { sim, tick, events };
  }

  it('a dash timed onto the grab slips it', () => {
    const { sim, tick, events } = duel(8);
    tick({}, { attack: 'ultimate' });
    // A forward dash's evade (0.13 s) - pressed just before the grab arrives, so it covers the contact.
    const dashAt = Math.round((MOVES.gummy.ultimate.contacts[0] - .06) * 60);
    for (let i = 1; i < 90; i++) tick(i === dashAt ? { dash: true, moveX: 0, moveZ: -1 } : {});
    expect(events.some(e => e.kind === 'dodge' && e.actorId === 'a'), 'it went through the dash').toBe(true);
    expect(events.filter(e => e.kind === 'whiff' && e.actorId === 'a')).toHaveLength(1);
    expect(events.some(e => e.kind === 'confirm')).toBe(false);
    sim.dispose();
  });

  it('a guard is broken, as every ultimate\'s is (none of them is parried: Round 5)', () => {
    const { sim, tick, events } = duel(8);
    for (let i = 0; i < 20; i++) tick({ guard: true });
    tick({ guard: true }, { attack: 'ultimate' });
    for (let i = 0; i < 70; i++) tick({ guard: true });
    expect(events.filter(e => e.kind === 'guard-break' && e.actorId === 'a')).toHaveLength(1);
    expect(events.filter(e => e.kind === 'confirm' && e.actorId === 'a')).toHaveLength(1);
    sim.dispose();
  });
});
