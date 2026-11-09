import { describe, expect, it } from 'vitest';
import { BallMatch } from './BallMatch';

/** The ball modes' timing skills online (the room's own clock against what each page drew). */
const until = (m: BallMatch, done: () => boolean, seconds = 20) => { for (let i = 0; i < seconds * 60 && !done(); i++) m.step(1 / 60); return done(); };
const ack = (m: BallMatch, id: string) => m.sim.playerStates().find(p => p.id === id)?.ackSeq;

describe('online ball rooms: commands held back are still heard', () => {
  it('acknowledges every command through the countdown, a kickoff and a replay, playing none of them', () => {
    // (A page online stops sending at forty unacknowledged commands: main.ts MAX_IN_FLIGHT. The countdown's three seconds
    // are 180 of them.)
    const m = new BallMatch('goal-rush', { seed: 3, access: 'host', fillBots: false });
    m.add('red-1', 'gorai', 'Red', false, 'red');
    m.add('blue-1', 'konta', 'Blue', false, 'blue');
    expect(m.start()).toBe(true);
    expect(m.view.phase).toBe('countdown');
    const at = m.sim.actors.get('red-1')!.state, from = {x: at.x, z: at.z};
    let seq = 0;
    for (let i = 0; i < 90; i++) { expect(m.submit('red-1', { seq: ++seq, moveX: 1, moveZ: 1, yaw: 0, dash: true })).toBe(false); m.step(1 / 60); }
    expect(ack(m, 'red-1')).toBe(seq);
    // (Not played: the body held its mark.)
    const held = m.sim.actors.get('red-1')!.state;
    expect(Math.hypot(held.x - from.x, held.z - from.z)).toBeLessThan(.01);
    expect(until(m, () => m.view.phase === 'kickoff')).toBe(true);
    expect(m.submit('red-1', { seq: ++seq, moveX: 1, moveZ: 0, yaw: 0 })).toBe(false);
    expect(ack(m, 'red-1')).toBe(seq);
    expect(until(m, () => m.view.phase === 'live')).toBe(true);
    expect(m.submit('red-1', { seq: ++seq, moveX: 1, moveZ: 0, yaw: 0 })).toBe(true);
    expect(ack(m, 'red-1')).toBe(seq);
    // An old command is still refused, and acknowledges nothing it should not.
    expect(m.submit('red-1', { seq: seq - 5, moveX: 1, moveZ: 0, yaw: 0 })).toBe(false);
    expect(ack(m, 'red-1')).toBe(seq);
  });
});
