import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { moveFor } from '../src/game/awakening';
import { MAX_HP, damageScale } from '../src/game/moves';

/**
 * Time stops, and then Iron Spirit beats them.
 *
 * HUSH used to stop time and land a single blow two and three quarter
 * seconds later, so the freeze was a pause with one hit on the end of it. The
 * barrage existed, but only on the awakened version - which meant the move
 * everyone sees most of the time was the one that did nothing while time was
 * stopped.
 */
function world(awakened: boolean) {
  const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 5 });
  sim.addPlayer('a', 'koko', 'A', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('b', 'kenzo', 'B', false, { x: 0, y: 0, z: 2.2 });
  sim.addPlayer('far', 'ouga', 'Far', false, { x: 0, y: 0, z: 26 });
  sim.startMatch();
  sim.actors.get('a')!.state.ultimate = 100;
  if (awakened) { sim.actors.get('a')!.state.awakened = true; sim.actors.get('a')!.state.awakenedUntil = 1e9; }
  sim.submitInput('a', { seq: 1, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack: 'ultimate' });
  const during: number[] = [];
  let hits = 0, hitsWhileFrozen = 0;
  for (let i = 0; i < 60 * 14; i++) {
    sim.step();
    const landed = sim.snapshot(true).events.filter(e => e.kind === 'hit' && e.targetId === 'b').length;
    hits += landed;
    if (sim.getPlayer('b')!.timeStopped) { hitsWhileFrozen += landed; during.push(sim.getPlayer('b')!.hp); }
  }
  const out = { hits, hitsWhileFrozen, hp: sim.getPlayer('b')!.hp, far: sim.getPlayer('far')!.hp };
  sim.dispose();
  return out;
}

describe('Iron Lullaby: Hush', () => {
  it('throws the barrage while time is stopped, not after it', () => {
    const base = world(false);
    const plain = moveFor('koko', 'ultimate', false), blows = plain.contacts.length - 1;
    // Most of the beating happens inside the freeze; the finisher is the blow
    // time resumes on, which is the whole shape of the move. Alone in the
    // stop, one opponent takes every GAN of the tour and the finisher.
    expect(base.hits, 'every GAN and the finisher').toBe(blows);
    expect(base.hitsWhileFrozen, `only ${base.hitsWhileFrozen} of ${base.hits} landed in stopped time`)
      .toBeGreaterThanOrEqual(blows - 2);
    // Every contact scaled by its place in the string, the finisher included:
    // read from the table rather than restated as a number.
    let taken = 0;
    for (let i = 1; i <= blows; i++) taken += Math.round((i === blows ? plain.finisherDamage! : plain.damage) * damageScale(i));
    expect(base.hp).toBe(MAX_HP - taken);
    expect(base.far, 'somebody outside the radius is untouched').toBe(1000);
  });

  it('still makes the awakened one the longer beating', () => {
    const plain = moveFor('koko', 'ultimate', false), awakened = moveFor('koko', 'ultimate', true);
    expect(awakened.contacts.length).toBeGreaterThan(plain.contacts.length);
    expect(awakened.timeStop!.duration).toBeGreaterThan(plain.timeStop!.duration);
    expect(world(true).hp, 'and worth more than the base one').toBeLessThan(world(false).hp);
  });

  it('pays nothing before time stops', () => {
    const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 5 });
    sim.addPlayer('a', 'koko', 'A', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('b', 'kenzo', 'B', false, { x: 0, y: 0, z: 2.2 });
    sim.startMatch();
    sim.actors.get('a')!.state.ultimate = 100;
    sim.submitInput('a', { seq: 1, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack: 'ultimate' });
    for (let i = 0; i < 60; i++) sim.step();
    expect(sim.getPlayer('b')!.timeStopped, 'time has stopped').toBe(true);
    expect(sim.getPlayer('b')!.hp, 'and nothing has been paid for it yet').toBe(1000);
    sim.dispose();
  });
});
