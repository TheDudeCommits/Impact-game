import { describe, expect, it } from 'vitest';
import { BallMatch } from './BallMatch';
import { FUN4 } from './sportBrain';
import type { PlayerInput } from '../types';

/** Football: the person kept in the play - a person out of it FUN4.idle s is given the
 *  ball by their side, met by the other side's carrier, and left the tackle and the loose ball. */
let seq = 0;
type Keys = Partial<PlayerInput>;
const send = (m: BallMatch, id: string, input: Keys) => m.submit(id, { seq: ++seq, moveX: 0, moveZ: 0, yaw: 0, ...input });

/** A lazy person: passes it on at once, goes to a loose ball within 4 m, else drifts to `spot` in or by its own half.
 *  Each stretch of live play with the ball over FUN4.near m from them (s). */
function lazy(seed: number, spot: readonly [number, number], seconds = 150) {
  const m = new BallMatch('goal-rush', { seed, access: 'bots', football: true, difficulty: 'normal' });
  m.add('p', 'konta', 'P', false, 'red');
  expect(m.start()).toBe(true);
  let out = 0;
  const spells: number[] = [];
  for (let i = 0; i < 60 * seconds && m.view.phase !== 'over'; i++) {
    const a = m.sim.actors.get('p')!.state, b = m.view.ball;
    const near = !b.carry && Math.hypot(b.x - a.x, b.z - a.z) < 4, gx = near ? b.x - a.x : spot[0] - a.x, gz = near ? b.z - a.z : spot[1] - a.z, g = Math.hypot(gx, gz);
    if (b.carry === 'p') send(m, 'p', { moveZ: 1, attack: i % 20 === 0 ? 'light' : undefined });
    else send(m, 'p', { moveX: g > .5 ? gx / g : 0, moveZ: g > .5 ? gz / g : 0, yaw: Math.atan2(gx, gz) });
    m.step(1 / 60);
    if (m.view.phase !== 'live') { if (out) spells.push(out); out = 0; continue; }
    if (Math.hypot(a.x - b.x, a.z - b.z) > FUN4.near && b.carry !== 'p') out += 1 / 60; else { if (out) spells.push(out); out = 0; }
  }
  if (out) spells.push(out);
  return spells;
}

describe('Goal Rush football: the person in the play', () => {
  it('a person who stands off by their own half is brought into the play: no long spells out of it', () => {
    // (Bots that left a person out, on these seeds and spots: 25 spells over 10 s, the longest a minute.)
    const spells: number[] = [];
    for (const seed of [1, 5]) for (const spot of [[4, -6], [-6, 2], [0, -12]] as const) spells.push(...lazy(seed, spot));
    expect(spells.filter(s => s > 10).length).toBeLessThanOrEqual(6);
    expect(Math.max(...spells)).toBeLessThan(24);
  }, 120000);
});
