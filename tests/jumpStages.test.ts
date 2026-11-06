import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { createRapierCollision, initRapier } from '../src/game/rapierCollision';
import { STAGES, type StageId } from '../src/game/stages';
import { PLAYER_HEIGHT, PLAYER_RADIUS, jumpArc } from '../src/game/moves';
import ceilings from '../src/game/data/stageCeilings.json';
import type { FighterId, PlayerInput } from '../src/game/types';

/**
 * Round 4b (JUMP): what a jump of 4-5.6 m (2.5-3.5x the old 1.61) runs into on the stages.
 *
 * The Proving Hall's balconies hang over the edge of its floor at 3.5 m, the Mirror Mere's inner roof is 2.3 m
 * over the floor behind its shrine, and the stadium's stands overhang their corners at 4.7-8 m: a head went through
 * all of them. scripts/probe_jump_clearance.mts measures the roofs off the stage GLBs
 * and emits them (src/game/data/stageCeilings.json); rapierCollision makes them slabs, and the simulation ends a
 * climb that meets one. The play bound still holds a leap of 12-18 m.
 */
type Roof = { x: number; z: number; halfX: number; halfZ: number; y: number };
const ROOFS = ceilings as Partial<Record<StageId, Roof[]>>;
const HIGHEST: FighterId = 'setsu';

async function arena(stage: StageId, fighter: FighterId, at: { x: number; z: number }) {
  const sim = new ArenaSimulation({ stage, collision: await createRapierCollision(stage), trainingBot: false, seed: 3 });
  sim.addPlayer('a', fighter, 'A', false, { x: at.x, y: 0, z: at.z });
  let seq = 0;
  const go = (input: Partial<PlayerInput> = {}) => { sim.submitInput('a', { seq: ++seq, moveX: 0, moveZ: 0, yaw: 0, ...input }); sim.step(); };
  return { sim, go, a: sim.actors.get('a')! };
}

describe('the round 4b jump on the stages', () => {
  it('carries a roof for every stage the probe found one on, and the Proving Hall\'s balconies among them', async () => {
    await initRapier();
    expect(ROOFS['proving-hall']?.length, 'the training hall').toBeGreaterThan(0);
    for (const [stage, roofs] of Object.entries(ROOFS) as [StageId, Roof[]][]) {
      const world = await createRapierCollision(stage);
      expect(world.ceilings, stage).toBe(roofs.length);
      // Only roofs a head can reach: the highest jump's apex and a body, and a margin (the probe's --head=8).
      for (const r of roofs) expect(r.y, stage).toBeLessThanOrEqual(Math.max(8, jumpArc(HIGHEST).apex + PLAYER_HEIGHT + .5));
      world.dispose?.();
    }
  });

  // (Its own limit: it sweeps every stage's roofs, Thornwood Ward's among them, and under a loaded machine ran past the default five seconds.)
  it('stops the head at every roof a jump reaches, and brings the body back down', async () => {
    await initRapier();
    for (const [stage, roofs] of Object.entries(ROOFS) as [StageId, Roof[]][]) {
      const { halfX, halfZ } = STAGES[stage];
      for (const roof of roofs) {
        const at = { x: Math.max(-halfX + PLAYER_RADIUS, Math.min(halfX - PLAYER_RADIUS, roof.x)), z: Math.max(-halfZ + PLAYER_RADIUS, Math.min(halfZ - PLAYER_RADIUS, roof.z)) };
        const { sim, go, a } = await arena(stage, HIGHEST, at);
        for (let i = 0; i < 10; i++) go();
        if (!a.state.grounded || a.state.y > .2) { sim.dispose(); continue; }
        const floor = a.state.y;
        go({ jump: true, jumpHeld: true });
        let top = 0, ticks = 0;
        for (; ticks < 150 && !(a.state.grounded && ticks > 3); ticks++) { top = Math.max(top, a.state.y); go({ jumpHeld: true }); }
        // Over the roof's footprint the head stops at it (a capsule under its edge as well); landed again.
        if (Math.abs(a.state.x - roof.x) < roof.halfX && Math.abs(a.state.z - roof.z) < roof.halfZ)
          expect(top + PLAYER_HEIGHT, `${stage}: roof at ${roof.y} m over (${roof.x}, ${roof.z})`).toBeLessThan(roof.y + .05);
        expect(a.state.grounded, `${stage} (${roof.x}, ${roof.z}): back on the floor`).toBe(true);
        expect(a.state.y, stage).toBeLessThan(floor + .5);
        sim.dispose();
      }
    }
  }, 30000);

  it('lets a leap that comes down over a roof pass it: no standing on a balcony\'s edge', async () => {
    // A roof is one way: it stops a head rising into it, and a body coming down from over it falls past. A leap at
    // the Proving Hall's side wall used to come down on the slab under the balcony and stand there, 3.8 m up.
    await initRapier();
    for (const dx of [1, -1]) {
      const { sim, go, a } = await arena('proving-hall', 'taisei', { x: 0, z: 0 });
      for (let i = 0; i < 30; i++) go({ moveX: dx });
      go({ moveX: dx, jump: true, jumpHeld: true });
      for (let i = 0; i < 120; i++) go({ moveX: dx, jumpHeld: true });
      expect(Math.abs(a.state.x), 'at the wall').toBeGreaterThan(5.9);
      expect(a.state.grounded).toBe(true);
      expect(a.state.y, 'on the floor').toBeLessThan(.2);
      sim.dispose();
    }
  });

  // (Its own limit: it sweeps every stage's edges, and under a loaded machine ran past the default five seconds.)
  it('keeps a running leap at every edge of every stage on the stage', async () => {
    await initRapier();
    const stages = (Object.keys(STAGES) as StageId[]).filter(id => id !== 'harbor');
    for (const stage of stages) {
      const { halfX, halfZ } = STAGES[stage];
      for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5, Math.PI / 4, Math.PI * 1.25]) {
        const dx = Math.sin(angle), dz = Math.cos(angle);
        const { sim, go, a } = await arena(stage, HIGHEST, { x: 0, z: 0 });
        for (let i = 0; i < 30; i++) go({ moveX: dx, moveZ: dz });
        go({ moveX: dx, moveZ: dz, jump: true, jumpHeld: true });
        let low = 0;
        for (let i = 0; i < 240; i++) { go({ moveX: dx, moveZ: dz, jumpHeld: true, jump: i % 70 === 69 }); low = Math.min(low, a.state.y); }
        expect(Math.abs(a.state.x), `${stage} at ${angle.toFixed(2)}`).toBeLessThanOrEqual(halfX);
        expect(Math.abs(a.state.z), `${stage} at ${angle.toFixed(2)}`).toBeLessThanOrEqual(halfZ);
        expect(low, `${stage}: never through the floor`).toBeGreaterThan(-.5);
        expect(a.state.alive, stage).toBe(true);
        sim.dispose();
      }
    }
  }, 30000);

});
