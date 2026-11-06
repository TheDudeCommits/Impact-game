import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ClashEffects } from '../src/render/ClashEffects';
import type { CombatEvent } from '../src/game/types';

const event = (kind: CombatEvent['kind'], serverTime: number, id = 1): CombatEvent => ({
  id, kind, serverTime, actorId: 'a', fighter: 'kenzo',
  origin: { x: 0, y: 1, z: 0 }, endpoint: { x: 0, y: 1, z: 0 },
} as CombatEvent);

const drawn = (scene: THREE.Scene) => {
  const sparks = scene.getObjectByName('clash-sparks') as THREE.InstancedMesh;
  let rings = 0;
  scene.traverse(o => { if (o.name === 'clash-ring' && o.visible) rings++; });
  return { sparks: sparks.count, rings };
};

describe('two fighters meeting is actually drawn', () => {
  /** The clock these were stamped with used to be how long the page had been
   *  open, while the clock they are aged against is the match's. The two are
   *  tens of seconds apart, so every ring and spark was older than its own
   *  lifetime before it was ever drawn: no parry ring, no wall splat, no beam
   *  clash had ever been seen. */
  // Round 5 (GUARD): not the parry, which is the guard's orb's (tests/guardOrb.test.ts).
  for (const kind of ['projectile-clash', 'wall-splat', 'ground-bounce', 'break'] as const) {
    it(`${kind} survives the frame it was made on`, () => {
      const scene = new THREE.Scene(), effects = new ClashEffects(scene);
      try {
        // A match that has been running a while, and a page that has been open
        // longer still - which is the situation that hid this.
        const now = 42.5;
        effects.handle([event(kind, now)]);
        effects.update(now + 1 / 60, undefined, 1);
        const first = drawn(scene);
        expect(first.rings, 'wall contact uses sparks without an opaque ring').toBe(kind==='wall-splat'?0:1);
        expect(first.sparks, 'and sparks').toBeGreaterThan(0);
        // And it is gone by the time it should be, rather than never.
        effects.update(now + 1.2, undefined, 1);
        const later = drawn(scene);
        expect(later.rings).toBe(0);
        expect(later.sparks).toBe(0);
      } finally { effects.dispose(); }
    });
  }

  it('ignores an event it has already handled', () => {
    const scene = new THREE.Scene(), effects = new ClashEffects(scene);
    try {
      effects.handle([event('projectile-clash', 10, 7)]);
      effects.handle([event('projectile-clash', 10, 7)]);
      effects.update(10.01, undefined, 1);
      expect(drawn(scene).rings).toBe(1);
    } finally { effects.dispose(); }
  });
});
