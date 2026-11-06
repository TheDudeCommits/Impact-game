import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FIGHTERS } from '../src/config';
import { Fighter } from '../src/render/Fighter';
import { RELEASED_FIGHTERS } from '../src/game/rosterAvailability';
import type { FighterId, PlayerState } from '../src/game/types';
import { installStyleMoves, resetStyleMoves } from '../src/engine/client/styleMoves';
import { rigOf } from '../src/engine/client/retarget';
import { plainFloor } from '../src/render/StageEnvironment';
import { loadRig } from './rigHarness';
import { hasAsset } from './assets';

/** Some fighters' clips are held back from the public repository (README.md): a body with no clip of its own for an action
 *  plays a shared take fitted to it (Fighter.fallbackTake), and is never left without a clip to draw. */
const fromDisk = async () => {
  const file = await loadRig('/assets/fighters/techniques.glb');
  const idle = file.animations.find(c => c.name === 'Idle');
  return { rig: rigOf(file.scene, idle), clips: new Map(file.animations.map(c => [c.name, c])) };
};
beforeAll(async () => { await installStyleMoves(fromDisk); });
afterAll(() => resetStyleMoves());

const base = (fighter: FighterId): PlayerState => ({ id: 'p', name: 'P', fighter, x: 0, y: 0, z: 0, yaw: 0,
  hp: 900, maxHp: 1000, stamina: 100, ultimate: 50, action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0,
  target: null, alive: true, isBot: false, grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } });

const bodies = RELEASED_FIGHTERS.filter(id => hasAsset(FIGHTERS[id].model));

describe('a body with clips held back', () => {
  it.each(bodies)('%s builds, and plays every action without throwing, never on an empty clip', async id => {
    const rig = await loadRig(FIGHTERS[id].model);
    const fighter = new Fighter(base(id), rig);
    try {
      for (const [action, duration] of [['idle', 0], ['light', .6], ['heavy', 1], ['special', 1], ['ultimate', 1.5], ['guard', 0], ['hurt', .4], ['run', 0]] as const) {
        for (let i = 0; i < 6; i++) fighter.update(1 / 60, { ...base(id), action, actionDuration: duration, actionStarted: 3, actionTime: duration ? i / 60 / duration : 0 }, true);
      }
      fighter.group.updateMatrixWorld(true);
      let finite = true;
      fighter.group.traverse(o => { if ((o as THREE.Bone).isBone && !Number.isFinite(o.getWorldPosition(new THREE.Vector3()).y)) finite = false; });
      expect(finite).toBe(true);
    } finally { fighter.dispose?.(); }
  }, 30_000);
});

describe('a stage with no model', () => {
  it('stands on a plain floor of its size', () => {
    const floor = plainFloor(38, 30);
    const box = new THREE.Box3().setFromObject(floor);
    expect(box.max.x - box.min.x).toBeGreaterThanOrEqual(76);
    expect(Math.abs(box.max.y)).toBeLessThan(.1);
  });
});
