import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FIGHTERS } from '../src/config';
import { Fighter } from '../src/render/Fighter';
import { isDynamicBoneName } from '../src/render/SecondaryMotion';
import { loadRig, base } from './rigHarness';
import { ORIGINALS } from '../src/originals/roster';
const LEG = /^(Left|Right)(UpLeg|Leg|Foot|ToeBase)$/;

describe.skipIf(!!ORIGINALS.tobari)('Tobari’s cloak hangs off the pelvis', () => {
  it('hangs the hem on chains of its own, and no cloth vertex is pulled by both a chain and a leg', async () => {
    const rig = await loadRig(FIGHTERS.tobari.model);
    const roots: THREE.Bone[] = [];
    rig.scene.traverse(o => { if ((o as THREE.Bone).isBone && /^Detail_CLOTH_tobari_hem_\d+_0$/.test(o.name)) roots.push(o as THREE.Bone); });
    expect(roots.length).toBe(8);
    for (const bone of roots) expect(bone.parent?.name).toBe('Hips');
    let hem = 0;
    rig.scene.traverse(o => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isSkinnedMesh) return;
      const bones = mesh.skeleton.bones, index = mesh.geometry.getAttribute('skinIndex'), weight = mesh.geometry.getAttribute('skinWeight');
      for (let v = 0; v < index.count; v++) {
        let chain = 0, leg = 0;
        for (let k = 0; k < 4; k++) {
          const w = weight.getComponent(v, k), name = bones[index.getComponent(v, k)]?.name ?? '';
          if (w <= 0) continue;
          if (isDynamicBoneName(name)) chain += w;
          else if (LEG.test(name)) leg += w;
        }
        if (chain > 0) { hem++; expect(leg, `${mesh.name} vertex ${v}`).toBe(0); }
      }
    });
    expect(hem).toBeGreaterThan(400);
  }, 120_000);

  it('keeps the hem below the belt, outside the legs and finite through a run, a dash and a stop', async () => {
    const rig = await loadRig(FIGHTERS.tobari.model);
    const state = base('tobari');
    const fighter = new Fighter({ ...state }, rig);
    try {
      expect(fighter.motionEvidence().springBones).toBe(16);
      const hips = fighter.model.getObjectByName('Hips')!, hip = new THREE.Vector3(), tail = new THREE.Vector3();
      const ends: THREE.Bone[] = [];
      fighter.model.traverse(o => { if ((o as THREE.Bone).isBone && /^HemEnd_tobari_\d+$/.test(o.name)) ends.push(o as THREE.Bone); });
      expect(ends.length).toBe(8);
      let x = 0, lowest = Infinity;
      const steps: [PlayerStateAction, number, number][] = [['idle', 40, 0], ['run', 60, 7.5], ['dash', 20, 15], ['idle', 40, 0]];
      for (const [action, frames, speed] of steps) for (let i = 0; i < frames; i++) {
        x += speed / 60;
        fighter.update(1 / 60, { ...state, action, x, actionTime: i / 60 }, true, 1 / 60);
        fighter.group.updateMatrixWorld(true);
        hips.getWorldPosition(hip);
        for (const end of ends) {
          end.getWorldPosition(tail);
          expect(Number.isFinite(tail.x + tail.y + tail.z)).toBe(true);
          // The hem never flies up over the belt as a board (a knee lifted to the hips in the run may push the front
          // up to about its height), and never leaves the body.
          expect(tail.y, `${action} ${end.name}`).toBeLessThan(hip.y + .2);
          expect(tail.distanceTo(hip)).toBeLessThan(1.1);
          lowest = Math.min(lowest, tail.y);
        }
      }
      expect(lowest).toBeGreaterThan(-.05);
    } finally { fighter.dispose(); }
  }, 120_000);
});

type PlayerStateAction = 'idle' | 'run' | 'dash';
