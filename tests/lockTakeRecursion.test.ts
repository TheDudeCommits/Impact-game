import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { FIGHTERS } from '../src/config';
import { Fighter, bindClips } from '../src/render/Fighter';
import type { FighterId, PlayerState } from '../src/game/types';
import { base, loadRig } from './rigHarness';

/** Lock combat's second round, drawn before the body's rush plan is (render/Fighter.ts lockTake → planRush): live on
 *  1 November 2026, 363 "Maximum call stack size exceeded" from build bdb56c071 (lockTake, clipFor, planRush,
 *  enderClip) - planRush asked the clip of the body's own state, still in its second round, which asked lockTake again,
 *  the plan not yet made. */
describe('a lock second round drawn before the rush plan', () => {
  for (const id of ['kenzo', 'gaku'] as FighterId[]) it(`plans the rush once and plays the round for ${id}`, async () => {
    const def = FIGHTERS[id];
    const source = await loadRig(def.model) as GLTF & { animations: THREE.AnimationClip[] };
    const rush = def.rushModel ? bindClips(source.scene, (await loadRig(def.rushModel)).animations, id) : undefined;
    const fighter = new Fighter(base(id), source, false, rush) as unknown as { state: PlayerState; rushPlan?: unknown; clipFor(state: PlayerState): THREE.AnimationClip | undefined; dispose?(): void };
    try {
      const second: PlayerState = { ...base(id), action: 'light', chain: 1, lockRound: 1, grounded: true, actionStarted: 1, actionDuration: .4, actionTime: .2 };
      fighter.state = second; fighter.rushPlan = undefined;
      expect(() => fighter.clipFor(second)).not.toThrow();
      expect(fighter.rushPlan).toBeDefined();
    } finally { fighter.dispose?.(); }
  }, 120000);
});
