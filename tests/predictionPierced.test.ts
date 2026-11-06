import { describe, expect, it } from 'vitest';
import { pack, unpack } from 'msgpackr';
import { ArenaSimulation } from '../src/game/simulation';
import type { PlayerInput } from '../src/game/types';

/** A shot that tore through the horde (simulation.ts `pierced`, the bodies it went through) in the checkpoint a page's
 *  prediction copy is put back to: the message on the wire carries a Set as an array (msgpackr), and the restored shot
 *  called `pierced.has` on it - "n.pierced?.has is not a function", live from the lock combat clients (GET /errors). */
describe('a shot restored from a prediction checkpoint', () => {
  it('keeps the bodies it pierced as a set, after the wire turned them into an array', () => {
    const make = () => {
      const sim = new ArenaSimulation({ trainingBot: false, seed: 5 });
      sim.addPlayer('a', 'tsubute', 'A', false, { x: 0, y: 0, z: 0 });
      sim.addPlayer('b', 'konta', 'B', false, { x: 0, y: 0, z: 30 });
      return sim;
    };
    const sim = make();
    let seq = 0;
    const send = (more: Partial<PlayerInput> = {}) => sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', ...more });
    send({ attack: 'special' });
    let checkpoint;
    for (let i = 0; i < 90 && !checkpoint; i++) { sim.step(); send(); const c = sim.predictionCheckpoint('a'); if (c?.shots.length) checkpoint = c; }
    expect(checkpoint, 'a shot in flight').toBeDefined();
    (checkpoint!.shots[0] as { pierced?: Set<string> }).pierced = new Set(['grunt-1', 'grunt-2']);
    const wire = unpack(pack(checkpoint));
    expect(Array.isArray(wire.shots[0].pierced)).toBe(true);
    const copy = make();
    copy.restorePrediction('a', wire);
    const shot = (copy as unknown as { projectiles: { pierced?: Set<string> }[] }).projectiles[0];
    expect(shot.pierced).toBeInstanceOf(Set);
    expect(shot.pierced!.has('grunt-2')).toBe(true);
    expect(() => { for (let i = 0; i < 30; i++) copy.step(); }).not.toThrow();
  });
});
