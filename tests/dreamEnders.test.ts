import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FIGHTERS } from '../src/config';
import { DREAM_IMPACT } from '../src/render/dreamFlag';
import { Fighter, bindClips } from '../src/render/Fighter';
import { comboClip } from '../src/render/comboClips';
import type { PlayerState } from '../src/game/types';
import { loadRigWithExtras } from './extraClips';
import { base, loadRig } from './rigHarness';

/** The dream loop, round 42 (scripts/fanim/dream_enders.py): Taisei's launcher as a rising kick - the
 *  right leg chambered out to his side and swung up past his head into their chin, carried on up and let down - where
 *  his take rose with both arms up from a crouch ("the same low crouch before and after contact ... no visible leg
 *  swing", the calibration critic). Posed over a copy of the take the ender plays, at its length, and struck where the
 *  ender's row reads it (comboClips.ts). */
const CORE = ['Hips', 'Spine', 'Spine1', 'Neck', 'Head', 'LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm', 'LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg'];

async function taisei() {
  const rig = await loadRigWithExtras('taisei'), url = FIGHTERS.taisei.rushModel!;
  return new Fighter(base('taisei'), rig, false, bindClips(rig.scene, (await loadRig(url)).animations, 'taisei'));
}
type Inner = { clipFor(s: PlayerState): THREE.AnimationClip | undefined; enderClips: Map<string, unknown> };

describe('Taisei\'s dream launcher', () => {
  it('carries the take at the length of the one it stands in for, every core joint keyed', async () => {
    const body = await taisei();
    try {
      const take = body.clips.find(c => c.name === 'DZ Rising Axe'), own = body.clips.find(c => c.name === 'Rising Axe');
      expect(take, 'DZ Rising Axe').toBeDefined();
      expect(Math.abs(take!.duration - own!.duration), 'its length').toBeLessThan(1 / 30);
      const keyed = new Set(take!.tracks.map(t => THREE.PropertyBinding.parseTrackName(t.name).nodeName));
      const loose = CORE.map(k => body.joints.get(k)?.name).filter((n): n is string => !!n && !keyed.has(n));
      expect(loose, 'core joints left unkeyed').toEqual([]);
    } finally { body.dispose(); }
  }, 60_000);

  it.runIf(DREAM_IMPACT)('throws it for the Light x2 + Heavy, on the take\'s row; the takes off, the take', async () => {
    const body = await taisei(), inner = body as unknown as Inner;
    try {
      const state: PlayerState = { ...base('taisei'), action: 'heavy', branch: 'llh', grounded: true };
      expect(inner.clipFor(state)?.name).toBe('DZ Rising Axe');
      Fighter.dreamTakes = false; inner.enderClips.clear();
      try { expect(inner.clipFor(state)?.name, 'the takes off').toBe('Rising Axe'); } finally { Fighter.dreamTakes = true; inner.enderClips.clear(); }
    } finally { body.dispose(); }
  }, 60_000);

  it('kicks on the contact: the right foot up past the head, out to the right of the body', async () => {
    const body = await taisei();
    try {
      const mixer = new THREE.AnimationMixer(body.model), row = comboClip('taisei', 'llh')!;
      const clip = body.clips.find(c => c.name === 'DZ Rising Axe')!;
      // The contact, in seconds of the take: the row plays from..to and lands at `contact` of that.
      const contact = row.from! + row.contact! * (row.to! - row.from!);
      mixer.clipAction(clip).play().time = contact; mixer.update(0); body.model.updateMatrixWorld(true);
      const p = (joint: string) => body.group.worldToLocal(body.joints.get(joint)!.getWorldPosition(new THREE.Vector3()));
      const hips = p('Hips'), head = p('Head'), foot = p('RightFoot'), height = head.y;
      expect(foot.y, 'the kicking foot over the head').toBeGreaterThan(head.y);
      // Out to the right, where the gameplay camera (behind him) sees it past his own body - swung up the middle, his
      // back hid it - and in front of the hips, into their chin.
      expect(Math.abs(foot.x - hips.x), 'the foot out to the side, heights').toBeGreaterThan(.12 * height);
      expect(foot.z - hips.z, 'the foot in front, heights').toBeGreaterThan(.05 * height);
      mixer.stopAllAction();
    } finally { body.dispose(); }
  }, 60_000);
});
