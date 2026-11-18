import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { framesHtml } from '../src/ui/hud/TrainingHud';
import type { CombatEvent, PlayerInput } from '../src/game/types';

/** Training's frame readout (TrainingHud FRAMES) - what a blow leaves its thrower ahead or
 *  behind by, in sixtieths, on the hit or the blocked event (simulation.ts frameAdvantage). Checked against the bodies
 *  themselves: the ticks from the blow until each can act again. */
type Actor = { cast: unknown; hitstopUntil: number; stunUntil: number; blockedUntil: number; reaction: string | null };
function exchange(guard: boolean, slot: 'light' | 'heavy') {
  const sim = new ArenaSimulation({ trainingBot: false, seed: 2 });
  sim.addPlayer('a', 'kenzo', 'A', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('b', 'taisei', 'B', false, { x: 0, y: 0, z: 1.6 });
  let seq = 0;
  const input = (id: string, more: Partial<PlayerInput> = {}) => sim.submitInput(id, { seq: seq++, moveX: 0, moveZ: 0, yaw: id === 'a' ? 0 : Math.PI, ...more });
  const actors = (sim as unknown as { actors: Map<string, Actor> }).actors, a = actors.get('a')!, b = actors.get('b')!;
  for (let i = 0; i < 20; i++) { input('a'); input('b', { guard }); sim.step(); }
  input('a', { attack: slot, targetId: 'b' }); input('b', { guard, targetId: 'a' });
  let event: CombatEvent | undefined, tick = 0;
  for (; tick < 120 && !event; tick++) { input('b', { guard }); sim.step(); event = sim.snapshot(true).events.find(e => (e.kind === 'hit' || e.kind === 'blocked') && e.actorId === 'a'); }
  // Then each body's first tick free: the thrower out of its cast and its freeze, the other out of its stagger or guard hold.
  let aFree: number | undefined, bFree: number | undefined;
  for (let t = 0; t < 240 && (aFree === undefined || bFree === undefined); t++) {
    const now = sim.serverTime;
    if (aFree === undefined && !a.cast && now >= a.hitstopUntil && now >= a.stunUntil) aFree = t;
    if (bFree === undefined && now >= b.hitstopUntil && now >= b.stunUntil && now >= b.blockedUntil && !b.reaction) bFree = t;
    input('a'); input('b', { guard: false }); sim.step();
  }
  sim.dispose();
  return { event: event!, measured: (bFree ?? NaN) - (aFree ?? NaN) };
}

describe('the frame readout', () => {
  it('says what a blocked blow and a landed one leave the thrower ahead by, within a tick of the bodies themselves', () => {
    for (const [guard, slot] of [[true, 'light'], [true, 'heavy'], [false, 'light']] as const) {
      const { event, measured } = exchange(guard, slot);
      expect(event.kind, `${slot}${guard ? ' guarded' : ''}`).toBe(guard ? 'blocked' : 'hit');
      expect(event.advantage, `${slot}${guard ? ' guarded' : ''}: the event carries it`).toBeTypeOf('number');
      expect(Math.abs(event.advantage! - measured), `${slot}${guard ? ' guarded' : ''}: said ${event.advantage}, counted ${measured}`).toBeLessThanOrEqual(1);
    }
  });
  it('reads as a sign and a number, and on what', () => {
    expect(framesHtml(3, true)).toBe('<strong>+3</strong> <i>ON HIT</i>');
    expect(framesHtml(-5, false)).toBe('<strong>−5</strong> <i>ON BLOCK</i>');
    expect(framesHtml(0, false)).toContain('±0');
  });
});
