import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Fighter } from '../src/render/Fighter';
import { IDLE_PROFILES } from '../src/render/idle/profile';
import { assembleFighter, popBase } from './popHarness';
import type { FighterId } from '../src/game/types';

/** Round 3c (ANIM), the second blind critic on the idles:
 *   - "Setsu 1.2 cm, hand 1.1 cm, statue-like between fidgets; Ouga 0.5 cm
 *     vertical; Shiden 0.4 cm" - the head's range over five seconds of
 *     standing at the lock-on distance.
 *  A profile may name a fight-ready stance (`ready`, the fighter's own battle
 *  idle) that it stands in with an opponent close and for a while after; and
 *  the life layer breathes a fighter squared up to someone keyed up, with the
 *  breath settling into the knees (`dip`). */
const dt = 1 / 60;
async function standing(id: FighterId) {
  const { source, rush } = await assembleFighter(id);
  const body = new Fighter(popBase(id, 'a'), source, false, rush);
  body.prepareRush();
  const joints = [...body.joints].filter(([n]) => !/finger|thumb|index|middle|ring|pinky|toe|eye|jaw/i.test(n));
  const previous = joints.map(([, j]) => j.quaternion.clone());
  /** Stand `seconds` with the opponent `distance` away; the clip drawn last,
   *  the worst joint step a frame, and the head's range per axis (cm). */
  const stand = (distance: number, seconds: number) => {
    body.targetPoint = new THREE.Vector3(0, 1.45, distance); body.targetDistance = distance;
    let worst = 0;
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], clips = new Set<string>();
    const head = body.joints.get('Head')!;
    for (let f = 0; f < seconds / dt; f++) {
      body.update(dt, popBase(id, 'a'), true, dt);
      joints.forEach(([, j], i) => { worst = Math.max(worst, THREE.MathUtils.radToDeg(previous[i].angleTo(j.quaternion))); previous[i].copy(j.quaternion); });
      clips.add(String(body.motionEvidence().clip));
      const p = body.group.worldToLocal(head.getWorldPosition(new THREE.Vector3())).toArray();
      for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
    }
    return { clip: String(body.motionEvidence().clip), clips, worst, head: hi.map((h, k) => (h - lo[k]) * 100) };
  };
  return { body, stand };
}

describe('a relaxed idle is not how a fighter faces an opponent', () => {
  // Taisei (8 October 2026): his relaxed idle, open hands and feet together, gives way to his fighting stance (taisei-ready).
  it.each([['taisei', 'Taisei idle']] as const)('%s stands in his battle idle when it is a fight', async (id, relaxed) => {
    expect(IDLE_PROFILES[id]?.clip).toBe(relaxed);
    const { body, stand } = await standing(id);
    try {
      stand(12, 1);
      expect(stand(12, 3).clip, 'nobody about: the relaxed idle').toBe(relaxed);
      const squared = stand(1.9, 2);
      expect(squared.clip, 'an opponent at lock-on range: the battle idle').toBe(IDLE_PROFILES[id]!.ready);
      // Into it as a weight shift, not a snap: the idle's own blend took the
      // feet between two stances a quarter of a metre apart at 3 m/s.
      expect(squared.worst, 'the worst joint step a frame going into it').toBeLessThan(12);
      expect(stand(12, 3).clip, 'kept a while after the opponent backs off').toBe(IDLE_PROFILES[id]!.ready);
      const relaxing = stand(12, 3);
      expect(relaxing.clip, 'and let go of once nobody has been near for a while').toBe(relaxed);
      expect(relaxing.worst).toBeLessThan(12);
    } finally { body.dispose(); }
  }, 120_000);

  it('keeps the hands in the pockets the design asked to keep', () => {
    for (const id of ['kuon', 'setsu', 'kosho', 'koko'] as FighterId[]) expect(IDLE_PROFILES[id]?.ready, id).toBeUndefined();
  });
});

describe('a fighter squared up to an opponent is not a statue', () => {
  // The critic's head ranges, before: Setsu 1.2 cm at most on any axis,
  // Ouga 0.5 cm and Shiden 0.4 cm up and down.
  it.each(['setsu', 'ouga', 'shiden'] as FighterId[])('%s breathes where the critic saw a statue', async id => {
    const { body, stand } = await standing(id);
    try {
      stand(1.9, 6);
      const { head, clips } = stand(1.9, 5);
      expect(Math.max(...head), `${id}: the head's largest range, cm (${head.map(v => v.toFixed(1)).join('/')}, ${[...clips].join(', ')})`).toBeGreaterThan(1.5);
      expect(head[1], `${id}: up and down, cm`).toBeGreaterThan(1.2);
    } finally { body.dispose(); }
  }, 120_000);
});
