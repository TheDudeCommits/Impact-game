import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { SECOND } from '../src/game/couchSeat';
import type { StageId } from '../src/game/types';

const seats = (sim: ArenaSimulation) => sim.snapshot().players.map(p => `${p.x.toFixed(2)},${p.z.toFixed(2)}`).sort();
const facing = (sim: ArenaSimulation, id: string, other: string) => {
  const p = sim.actors.get(id)!.state, q = sim.actors.get(other)!.state, want = Math.atan2(q.x - p.x, q.z - p.z);
  return Math.abs(Math.atan2(Math.sin(p.yaw - want), Math.cos(p.yaw - want)));
};
function pair(stage: StageId) {
  const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, stage });
  sim.addPlayer('you', 'taisei', 'P1'); sim.addPlayer(SECOND, 'konta', 'Player 2');
  expect(sim.seatPair('you', SECOND)).toBe(true);
  return sim;
}

describe('couch Training: the pair face to face', () => {
  it('stands where a Duel on the same place seats its two, each facing the other, Player 1 on the +z end', () => {
    for (const stage of ['sunfall-arena', 'starfall-crater'] as StageId[]) {
      const sim = pair(stage), duel = new ArenaSimulation({ roomMode: 'match', stage });
      duel.addPlayer('a', 'taisei', 'A'); duel.addPlayer('b', 'konta', 'B'); expect(duel.startMatch()).toBe(true);
      expect(seats(sim)).toEqual(seats(duel));
      expect(sim.actors.get('you')!.state.z).toBeGreaterThan(sim.actors.get(SECOND)!.state.z);
      expect(facing(sim, 'you', SECOND)).toBeLessThan(1e-6); expect(facing(sim, SECOND, 'you')).toBeLessThan(1e-6);
      expect(sim.snapshot().trainingPair).toEqual(['you', SECOND]);
      sim.dispose(); duel.dispose();
    }
  });
  it('brings a KO back to its seat, turned to the other, and RESET both', () => {
    const sim = pair('sunfall-arena'), seat = sim.actors.get(SECOND)!.state.z;
    const two = sim.actors.get(SECOND)!;
    Object.assign(two.state, { x: 3, z: 2, yaw: 1 });
    (sim as unknown as { eliminate(a: unknown, by: string): void }).eliminate(two, 'you');
    expect(two.state.alive).toBe(false);
    for (let i = 0; i < 60 * 4 && !two.state.alive; i++) sim.step(1 / 60);
    expect(two.state.alive).toBe(true);
    expect(two.state.x).toBeCloseTo(0, 3); expect(two.state.z).toBeCloseTo(seat, 3);
    expect(facing(sim, SECOND, 'you')).toBeLessThan(1e-6);
    // RESET: both back, bars full, no spawn protection, face to face.
    Object.assign(sim.actors.get('you')!.state, { x: -2, z: -1, yaw: 2, hp: 10 });
    expect(sim.trainingCommand('you', 'reset')).toBe(true);
    expect(seats(sim)).toEqual(seats(pair('sunfall-arena')));
    expect(sim.actors.get('you')!.state.hp).toBe(sim.actors.get('you')!.state.maxHp);
    expect(sim.actors.get('you')!.evadeUntil).toBe(0);
    expect(facing(sim, 'you', SECOND)).toBeLessThan(1e-6); expect(facing(sim, SECOND, 'you')).toBeLessThan(1e-6);
    sim.dispose();
  });
  it('is couch Training\'s alone: a Training with its dummy, or a match, has no pair', () => {
    const solo = new ArenaSimulation({ roomMode: 'training', stage: 'sunfall-arena' });
    solo.addPlayer('you', 'taisei', 'P1');
    expect(solo.snapshot().trainingPair).toBeUndefined();
    const match = new ArenaSimulation({ roomMode: 'match', stage: 'sunfall-arena' });
    match.addPlayer('a', 'taisei', 'A'); match.addPlayer('b', 'konta', 'B');
    expect(match.seatPair('a', 'b')).toBe(false);
    solo.dispose(); match.dispose();
  });
});
