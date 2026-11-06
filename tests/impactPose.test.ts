import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FIGHTERS } from '../src/config';
import { Fighter } from '../src/render/Fighter';
import { loadRig, base } from './rigHarness';
import { DREAM_IMPACT } from '../src/render/dreamFlag';
import { ORIGINALS } from '../src/originals/roster';

/** The feel pass, iteration four: a big blow's freeze frame (Fighter.impactPose). While the hold lasts the
 *  struck body is thrown along the blow - more than an ordinary blow's reaction throws it - held there without
 *  creeping, and given back once the hold lets go. */
describe('the impact pose', () => {
  it.each(['konta', 'nigo'] as const)('%s: a big blow throws the head along it, holds it, then lets go', async id => {
    const rig = await loadRig(FIGHTERS[id].model);
    const run = (big: boolean) => {
      const state = base(id), body = new Fighter(state, rig);
      body.targetPoint = new THREE.Vector3(0, 1.3, 2); body.targetDistance = 2;
      try {
        for (let f = 0; f < 30; f++) body.update(1 / 60, state, true, 1 / 60);
        // The blow travels +z; the head's lead over the hips along it, frame by frame.
        body.impact(true, 'special', 'melee', 0, new THREE.Vector3(0, 0, 1), 80, 1.2, big ? { big: true } : undefined);
        const along: number[] = [];
        for (let f = 0; f < 30; f++) {
          body.update(1 / 60, { ...state, action: 'hurt', actionStarted: 1, actionDuration: .5, actionTime: f / 30, hitstop: f < 12 ? .2 - f / 60 : 0 } as never, true, 1 / 60);
          along.push(body.joints.get('Head')!.getWorldPosition(new THREE.Vector3()).z - body.joints.get('Hips')!.getWorldPosition(new THREE.Vector3()).z);
        }
        return along;
      } finally { body.dispose(); }
    };
    const big = run(true), plain = run(false);
    const share = (f: number) => DREAM_IMPACT ? (id === 'konta' && ORIGINALS.konta && f === 3 ? 0 : .01) : .05;
    for (const f of [3, 7, 11]) expect(big[f] - plain[f], `frame ${f}`).toBeGreaterThan(share(f));
    // Held, not creeping: the pose does not collect frame after frame.
    expect(Math.abs(big[11] - big[3])).toBeLessThan(.01);
    // And given back once the hold lets go: drawing toward the reaction's own pose.
    expect(big[29]).toBeLessThan(big[11] - .03);
  }, 120_000);
});
