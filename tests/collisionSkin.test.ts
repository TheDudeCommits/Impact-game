import { describe, expect, it, vi } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { createRapierCollision } from '../src/game/rapierCollision';
import type { EnvironmentCollider } from '../src/game/environmentLayout';
import type { StageId } from '../src/game/stages';

/**
 * Round 3f (RULES): a move never starts inside the character controller's
 * skin (rapierCollision.ts, unsink).
 *
 * Rapier's controller keeps a capsule 1 cm off what it touches and does not
 * see the floor from inside that skin. A capsule a few millimetres off the
 * floor was carried down by each tick's fall into it, and once inside,
 * snap-to-ground fired and dropped it up to 0.18 m in one tick; a capsule
 * sunk into the floor was also let through what it was pinned against. The
 * integrator's report: with the survival branch's Black Fortress, a run at
 * the corner of one of its square towers along the diagonal ended 0.12 m
 * inside it ("run at (26, 26) from 45 deg"). The same tower is rebuilt here
 * on the Proving arena's floor (the mock below), and our own stages' corners
 * and open floor are held to the same rule.
 */
const TOWER: EnvironmentCollider = { x: 26, y: 9, z: 26, halfX: 3.5, halfY: 9, halfZ: 3.5 } as EnvironmentCollider;
vi.mock('../src/game/environmentLayout', async original => {
  const layout = await original<typeof import('../src/game/environmentLayout')>();
  return { ...layout, stageColliders: (stage: StageId) => {
    const colliders = layout.stageColliders(stage);
    return stage === 'ash-colosseum' && process.env.RULES_TOWER === '1' ? { ...colliders, landmarks: [...colliders.landmarks, TOWER] } : colliders;
  } };
});

interface Run { lowest: number; drop: number; deepest: number; end: { x: number; z: number }; away: number }

/** A fighter running from (x, z) at `deg` for `ticks`: the lowest its feet
 *  went, the largest drop in one tick, the deepest it was inside anything
 *  (the floor included), where it ended, and how far it then walks back the
 *  way it came in a second. */
async function run(stage: StageId, x: number, z: number, deg: number, ticks: number, y = 0): Promise<Run> {
  const collision = await createRapierCollision(stage);
  const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, stage, collision });
  try {
    sim.addPlayer('me', 'taisei', 'Me', false, { x, y, z });
    const p = sim.actors.get('me')!.state, a = deg * Math.PI / 180;
    let lowest = Infinity, drop = 0, deepest = 0, prev = p.y, seq = 0;
    for (let t = 0; t < ticks; t++) {
      sim.submitInput('me', { seq: ++seq, moveX: Math.sin(a), moveZ: Math.cos(a), yaw: a });
      sim.step(1 / 60);
      if (t > 1) { lowest = Math.min(lowest, p.y); drop = Math.max(drop, prev - p.y); }
      prev = p.y;
      deepest = Math.max(deepest, collision.penetration(p));
    }
    const end = { x: p.x, z: p.z };
    for (let t = 0; t < 60; t++) {
      sim.submitInput('me', { seq: ++seq, moveX: -Math.sin(a), moveZ: -Math.cos(a), yaw: a + Math.PI });
      sim.step(1 / 60);
    }
    return { lowest, drop, deepest, end, away: Math.hypot(p.x - end.x, p.z - end.z) };
  } finally { sim.dispose(); }
}

describe('a fighter is never carried into the floor, or through a corner', () => {
  it('the Black Fortress\'s tower, run at along its diagonal: never inside it (the integrator\'s case)', async () => {
    process.env.RULES_TOWER = '1';
    try {
      // The survival probe's drive: from 2.5 m out past the tower's support
      // along the diagonal, a centimetre off the floor, 90 ticks at a run.
      const support = 3.5 * Math.SQRT1_2 * 2 + .45, back = (support + 2.5) * Math.SQRT1_2;
      const r = await run('ash-colosseum', 26 - back, 26 - back, 45, 90, .01);
      expect(r.deepest, 'inside the tower or the floor, metres').toBeLessThan(.005);
      expect(r.lowest, 'the feet never below the floor').toBeGreaterThanOrEqual(0);
      expect(Math.hypot(r.end.x - (26 - 3.5), r.end.z - (26 - 3.5)), 'stopped at its corner, a capsule off it').toBeGreaterThan(.45);
      expect(r.away, 'and walks away').toBeGreaterThan(1);
    } finally { delete process.env.RULES_TOWER; }
  });

  it.each([
    ['zenith-coliseum', 5, 5, 45],
    ['sunfall-arena', -8, 8, 315],
    ['ash-colosseum', 42, -42, 135],
  ] as [StageId, number, number, number][])('%s: pinned diagonally into the stage\'s corner for two seconds, the feet stay on the floor', async (stage, x, z, deg) => {
    const r = await run(stage, x, z, deg, 120);
    expect(r.lowest).toBeGreaterThanOrEqual(0);
    expect(r.deepest).toBeLessThan(.005);
    expect(r.away).toBeGreaterThan(1);
  });

  it('a diagonal run across the Proving arena\'s open floor never drops into it', async () => {
    // Round 3's controller dipped this run 9 cm into the floor on one tick
    // (16-18 cm with a stage's other landmarks about).
    const r = await run('ash-colosseum', 20, 20, 45, 30);
    expect(r.lowest).toBeGreaterThanOrEqual(0);
    expect(r.drop, 'no one-tick drop over a centimetre').toBeLessThan(.01);
  });

  it('keeps round 3e\'s open-floor fix: a step from inside the skin is not refused', async () => {
    // VARIETY's measured case (tests/botNav.test.ts has the exact floats): a
    // capsule standing a few millimetres off the floor, stepping along it
    // with the tick's fall, goes the whole step.
    const collision = await createRapierCollision('proving-hall');
    try {
      const moved = collision.move('probe', { x: 0, y: .004, z: 0 }, { x: .1, y: -.0064, z: .05 });
      expect(Math.hypot(moved.x, moved.z)).toBeGreaterThan(.1);
      expect(moved.grounded).toBe(true);
    } finally { collision.dispose?.(); }
  });
});
