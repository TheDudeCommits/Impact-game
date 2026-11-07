import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CombatEvent } from '../src/game/types';
import { CombatEffects } from '../src/render/CombatEffects';
import { SwordSpiritEffects } from '../src/render/SwordSpiritEffects';

const event = (patch: Partial<CombatEvent>): CombatEvent => ({ id: 1, kind: 'cast', serverTime: 10, actorId: 'swordsman', fighter: 'strix', slot: 'special', origin: { x: 0, y: 1.05, z: 0 }, endpoint: { x: 0, y: 1.05, z: 32 }, ...patch });
describe('Strix authoritative flying cut', () => {
  it('does not throw a phantom wave during a cancelled wind-up or substitute a generic orb', () => {
    const scene = new THREE.Scene(), effects = new CombatEffects(scene), swords = new SwordSpiritEffects(scene);
    try {
      effects.handle([event({})]); swords.handle([event({})]);
      swords.update(11.5, 1 / 60, new Map());
      expect(scene.getObjectByName('cast-1')).toBeUndefined();
      expect(scene.getObjectByName('strix-bearpaw-cut-wave')).toBeUndefined();
    } finally { swords.dispose(); effects.dispose(); }
  });
  it('follows the actual release aim and freezes at a confirmed collision, then returns its pooled planes', () => {
    const scene = new THREE.Scene(), swords = new SwordSpiritEffects(scene);
    try {
      swords.handle([event({ kind: 'release', id: 2, serverTime: 11.4, origin: { x: 2, y: 1.05, z: 3 }, endpoint: { x: 34, y: 1.05, z: 3 } })]);
      swords.update(11.5, 1 / 60, new Map());
      const wave = scene.getObjectByName('strix-bearpaw-cut-wave')!;
      expect(wave.position.x).toBeCloseTo(5); expect(wave.position.z).toBeCloseTo(3);
      expect(wave.position.y - wave.scale.y * .45).toBeGreaterThan(-.02);
      swords.handle([event({ kind: 'blocked', id: 3, serverTime: 11.51, endpoint: { x: 5.3, y: 1.05, z: 3 } })]);
      swords.update(11.7, 1 / 60, new Map());
      expect(wave.position.x).toBeCloseTo(5.3);
      swords.update(13, 1 / 60, new Map());
      expect(scene.getObjectByName('strix-bearpaw-cut-wave')).toBeUndefined();
      for (let i = 0; i < 100; i++) swords.handle([event({ kind: 'release', id: 10 + i })]);
      expect(scene.children.filter(child => child.name === 'strix-bearpaw-cut-wave').length).toBeLessThanOrEqual(20);
      swords.reset();
      expect(scene.getObjectByName('strix-bearpaw-cut-wave')).toBeUndefined();
    } finally { swords.dispose(); }
  });
});
