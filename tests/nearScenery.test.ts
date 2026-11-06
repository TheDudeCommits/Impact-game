import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ArenaSimulation } from '../src/game/simulation';
import { NavGrid } from '../src/game/botNav';
import { PLAYER_RADIUS } from '../src/game/moves';
import { STAGE_PROPS, propCollider } from '../src/game/stageProps';
import { STAGES, type StageId } from '../src/game/stages';
import { linePoint, nearShare, scatterWear, thin, WEAR } from '../src/render/stages/near';
import { TOURNAMENT_MASTS } from '../src/render/ground/places/sunfallArena';

/**
 * Near scenery round the built
 * places (src/render/stages/near.ts and each place's dressing). What is solid
 * is boxed in src/game/stageProps.ts - the server's world, the bots' grid and
 * the camera's occluders are built from those boxes - so these hold the new
 * boxes to the seats and the routes the places had: no seat moves, every
 * seat reaches the middle, and what hangs overhead stays over a jump.
 */
const PLACES: StageId[] = ['mirror-mere'];
/** Seats safeSpawn already slid off a landmark before stream E. */
const MOVED_BEFORE: Partial<Record<StageId, number>> = { 'mirror-mere': 1 };

/** The twelve seats round a stage's spawn ellipse, as simulation.ts spaces
 *  them (evenly along the perimeter, from +z). */
function idealSeats(stage: StageId) {
  const { halfX, halfZ, spawnRadius } = STAGES[stage];
  const rx = Math.min(spawnRadius, halfX - PLAYER_RADIUS * 2), rz = Math.min(spawnRadius * halfZ / halfX, halfZ - PLAYER_RADIUS * 2);
  const N = 96, arc = [0];
  for (let i = 1; i <= N; i++) { const a = (i - .5) / N * Math.PI * 2; arc.push(arc[i - 1] + Math.hypot(rx * Math.cos(a), rz * Math.sin(a)) * Math.PI * 2 / N); }
  return Array.from({ length: 12 }, (_, seat) => {
    let base = seat / 12 * Math.PI * 2;
    if (Math.abs(rx - rz) > 1e-6) {
      const want = seat / 12 * arc[N]; let i = 1; while (i < N && arc[i] < want) i++;
      base = (i - 1 + (want - arc[i - 1]) / Math.max(arc[i] - arc[i - 1], 1e-9)) / N * Math.PI * 2;
    }
    return { x: Math.sin(base) * rx, z: Math.cos(base) * rz };
  });
}

/** Where a twelve-fighter match seats its field on a stage. */
function seated(stage: StageId) {
  const sim = new ArenaSimulation({ roomMode: 'match', stage, seed: 7 });
  for (let i = 0; i < 12; i++) sim.addPlayer(`p${i}`, 'taisei', `P${i}`, i > 0);
  expect(sim.startMatch()).toBe(true);
  return sim.snapshot().players.map(p => ({ x: p.x, z: p.z }));
}

describe('stream E\'s near scenery keeps the places playable', () => {
  it.each(PLACES)('%s: every seat is where it was', stage => {
    const ideal = idealSeats(stage), seats = seated(stage);
    const moved = seats.filter(s => Math.min(...ideal.map(i => Math.hypot(i.x - s.x, i.z - s.z))) > .2);
    expect(moved.length, moved.map(s => `(${s.x.toFixed(1)}, ${s.z.toFixed(1)})`).join(' ')).toBeLessThanOrEqual(MOVED_BEFORE[stage] ?? 0);
  });

  it.each(PLACES)('%s: a bot finds its way from every seat to the middle and to the next seat', stage => {
    const grid = NavGrid.for(stage), seats = seated(stage);
    for (const [k, s] of seats.entries()) {
      expect(grid.path(s.x, s.z, 0, 0), `seat (${s.x.toFixed(1)}, ${s.z.toFixed(1)}) to the middle`).not.toBeNull();
      const next = seats[(k + 1) % seats.length];
      expect(grid.path(s.x, s.z, next.x, next.z), `seat (${s.x.toFixed(1)}, ${s.z.toFixed(1)}) to its neighbour`).not.toBeNull();
    }
  });

  it.each(PLACES)('%s: what the dressing draws in a box has its box', stage => {
    for (const p of (STAGE_PROPS[stage] ?? []).filter(p => p.draw)) {
      expect(p.piece, `${p.draw} at (${p.x}, ${p.z})`).toBe('none');
      expect(propCollider(p), `${p.draw} at (${p.x}, ${p.z}) is solid`).toBeDefined();
    }
  });

});

describe('the narrow places keep their whole floor', () => {
  it('the ring: the field\'s masts stand off it, and it has no boxes', () => {
    const { halfX, halfZ } = STAGES['sunfall-arena'];
    for (const [x, z] of TOURNAMENT_MASTS) expect(Math.hypot(Math.max(0, Math.abs(x) - halfX), Math.max(0, Math.abs(z) - halfZ)), `mast (${x}, ${z})`).toBeGreaterThan(4);
    expect(STAGE_PROPS['sunfall-arena']).toBeUndefined();
  });
});

describe('the near scenery thins with the quality setting', () => {
  it('draws all of it on high, about half on medium, a quarter on low', () => {
    expect(nearShare('high')).toBe(1);
    expect(nearShare('medium')).toBeLessThan(.6);
    expect(nearShare('low')).toBeLessThan(nearShare('medium'));
  });

  it('thins a list evenly, not from one end', () => {
    const list = Array.from({ length: 100 }, (_, i) => i);
    const half = thin(list, .5);
    expect(half).toHaveLength(50);
    expect(Math.min(...half)).toBeLessThan(5);
    expect(Math.max(...half)).toBeGreaterThan(95);
    expect(thin(list, 0)).toEqual([]);
  });

  it('scatters the wear by kind, scaled by the share, only where there is floor', () => {
    let s = 1;
    const rng = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const kinds = { crack: { count: 20, size: [2, 4] as [number, number] }, dust: { count: 10, size: [3, 6] as [number, number] } };
    const all = scatterWear(rng, { kinds, share: 1, spot: () => [(rng() - .5) * 80, (rng() - .5) * 80], floor: (x, z) => Math.abs(x) < 30 && Math.abs(z) < 30 ? 0 : undefined });
    expect(all).toHaveLength(30);
    for (const d of all) expect(Math.abs(d.x) < 30 && Math.abs(d.z) < 30).toBe(true);
    expect(all.filter(d => (WEAR.crack as readonly number[]).includes(d.cell))).toHaveLength(20);
    const low = scatterWear(rng, { kinds, share: .25, spot: () => [0, 0], floor: () => 0 });
    expect(low).toHaveLength(8);
  });
});
