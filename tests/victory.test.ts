import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { FIGHTERS } from '../src/config';
import type { FighterId } from '../src/game/types';

const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const VICTORY = ['victory_lp', 'victory', 'Konta pose', '_Idle', 'Idle', 'taisei-ready', 'stance'];
function clips(id: FighterId): string[] {
  const file = fs.readFileSync(`public${FIGHTERS[id].model}`);
  const json = JSON.parse(file.subarray(20, 20 + file.readUInt32LE(12)).toString());
  return (json.animations ?? []).map((a: { name: string }) => a.name);
}
const resolve = (names: string[]) => {
  for (const want of VICTORY) {
    const exact = names.find(n => clean(n) === clean(want));
    if (exact) return exact;
    const near = names.find(n => clean(n).includes(clean(want)));
    if (near) return near;
  }
  return undefined;
};

describe('winning the match', () => {
  it('leaves the winner celebrating rather than standing still', () => {
    const sim = new ArenaSimulation({ roomMode: 'match', trainingBot: false, seed: 4 });
    sim.addPlayer('a', 'kenzo', 'A', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('b', 'konta', 'B', false, { x: 0, y: 0, z: 1.6 });
    sim.startMatch();
    // The last opponent goes down. How he goes down is the elimination
    // path's business and is tested where that lives; what is being asked
    // here is what the fighter left standing does next.
    sim.actors.get('b')!.state.alive = false;
    sim.actors.get('b')!.state.hp = 0;
    sim.step();
    expect(sim.getPlayer('b')!.alive, 'the match was actually won').toBe(false);
    expect(sim.snapshot().status).toBe('finished');
    expect(sim.winnerId).toBe('a');
    // And he stays in it: the step loop used to hand him back to the
    // locomotion state machine, which put him in idle on the very next frame.
    expect(sim.getPlayer('a')!.action).toBe('victory');
    for (let i = 0; i < 300; i++) sim.step();
    expect(sim.getPlayer('a')!.action, 'he went back to standing about').toBe('victory');
    sim.dispose();
  });

  // Four of the ten ship a real one; the rest fall back to their idle, which
  // is no worse than what all ten did before. What must not happen is a
  // fighter resolving to nothing and being drawn on clip zero.
  it.each(Object.keys(FIGHTERS) as FighterId[])('%s has something to celebrate with', id => {
    expect(resolve(clips(id)), `${id} resolves no victory clip at all`).toBeDefined();
  });

  it('gives at least the fighters who shipped one a real celebration', () => {
    const real = (Object.keys(FIGHTERS) as FighterId[])
      .filter(id => /victory|pose/i.test(resolve(clips(id)) ?? ''));
    expect(real.length, `only ${real.length} fighters celebrate: ${real}`).toBeGreaterThanOrEqual(4);
  });
});
