import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { PlayerState } from '../src/game/types';
import { FighterLibrary, type Fighter } from '../src/render/Fighter';
import { rakuchoContactPoint } from '../src/render/signature/RakuchoTendrils';
import { RAKUCHO, RakuchoRibbons, rakuchoTip, ribbonPlan, sampleTrack } from '../src/originals/rakuchoRibbons';
import { RIBBON_PLAN } from '../src/originals/rakuchoRibbonPlan';
import { base, loadRig } from './rigHarness';

describe('Rakucho\'s ribbon plans (remake-rakucho)', () => {
  it('plays Rakucho in the slot', () => expect(RAKUCHO).toBe(true));
  for (const [clip, plan] of Object.entries(RIBBON_PLAN)) {
    it(`${clip}: four ribbons, keys in order inside the clip, hits on the contact`, () => {
      expect(plan.ribs.length).toBe(4);
      for (const keys of plan.ribs) {
        if (!keys) continue;
        for (let i = 0; i < keys.length; i++) {
          const [t, , , , reveal, aim = 0] = keys[i];
          expect(t).toBeGreaterThanOrEqual(0); expect(t).toBeLessThanOrEqual(plan.end + 1e-6);
          if (i) expect(t, `${clip} key ${i}`).toBeGreaterThan(keys[i - 1][0]);
          expect(reveal).toBeGreaterThanOrEqual(0); expect(reveal).toBeLessThanOrEqual(1);
          expect(aim).toBeGreaterThanOrEqual(0); expect(aim).toBeLessThanOrEqual(1);
        }
        // A ribbon that strikes (a key aimed fully at the victim) is fully out within 30 ms of the plan's contact.
        const hits = keys.filter(k => (k[5] ?? 0) >= 1);
        if (plan.contact !== undefined && hits.length) {
          const tip = new THREE.Vector3();
          expect(sampleTrack(keys, plan.contact, tip).reveal, `${clip} at its contact`).toBeGreaterThan(.95);
          expect(Math.min(...hits.map(k => Math.abs(k[0] - plan.contact!))), `${clip}: a hit key near ${plan.contact}`).toBeLessThan(.035);
        }
      }
    });
  }
  it('reads the area cast\'s own plan before the clip\'s', () => {
    expect(ribbonPlan('Ribbon Lash', 'heavy')).toBe(RIBBON_PLAN['Ribbon Lash']);
    expect(ribbonPlan(undefined, 'heavy')).toBeUndefined();
  });
});

const load = GLTFLoader.prototype.loadAsync;
beforeAll(() => { GLTFLoader.prototype.loadAsync = function (url: string) { return loadRig(url); }; });
afterAll(() => { GLTFLoader.prototype.loadAsync = load; });

describe('Rakucho\'s ribbons on his body (remake-rakucho)', () => {
  it('binds them to his forearms and the front of his waist, and rides the striking tip', async () => {
    const library = new FighterLibrary();
    await library.ensure(['rakucho']);
    const body = library.create(base('rakucho')) as unknown as Fighter;
    const scene = new THREE.Scene(), ribbons = new RakuchoRibbons(scene), fighters = new Map<string, Fighter>([[body.state.id, body]]);
    try {
      let time = 1;
      const pose = (state: PlayerState, frames = 4) => { for (let i = 0; i < frames; i++) { body.update(1 / 60, state, true); time += 1 / 60; ribbons.update(time, fighters); } };
      // At rest: four torn ends hang from the bindings, none out, the socket on his hand as before.
      pose(base('rakucho'), 30);
      const meshes = scene.children.filter(o => o.name.startsWith('rakucho-ribbon-'));
      expect(meshes.length).toBe(4);
      const out = new THREE.Vector3();
      expect(rakuchoTip(body, 'Tendrils1_8', out)).toBe(false);
      // Every drawn ribbon starts at its binding: on the forearm, or in front of the hips.
      const shown = body.shownBody, at = (n: string) => (shown.joints.get(n) ?? shown.bones.get(n))!.getWorldPosition(new THREE.Vector3());
      const check = () => {
        let laid = 0;
        for (const mesh of meshes) {
          const i = Number(mesh.name.split('-').pop()), pos = (mesh as THREE.Mesh).geometry.attributes.position;
          const root = new THREE.Vector3().fromBufferAttribute(pos, 0).add(new THREE.Vector3().fromBufferAttribute(pos, 1)).multiplyScalar(.5);
          if (pos.getX(0) === 0 && pos.getY(0) === 0) continue; // never laid out
          laid++;
          if (i < 2) {
            const side = i === 0 ? 'Right' : 'Left', a = at(`${side}ForeArm`), b = at(`${side}Hand`), ab = b.clone().sub(a);
            const u = THREE.MathUtils.clamp(root.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1);
            expect(root.distanceTo(a.clone().addScaledVector(ab, u)), `ribbon ${i} bound on the forearm`).toBeLessThan(.12);
          } else {
            const hips = at('Hips'), up = at('Spine1').sub(hips).normalize(), right = at('RightUpLeg').sub(at('LeftUpLeg'));
            right.addScaledVector(up, -right.dot(up)).normalize();
            const fwd = up.clone().cross(right);
            expect(root.clone().sub(hips).dot(fwd), `ribbon ${i} bound in front of the waist`).toBeGreaterThan(.04);
          }
        }
        expect(laid, 'every ribbon laid out for the camera').toBe(4);
      };
      // The strips are laid for a camera; lay them for one in front of him and check where they start.
      const camera = new THREE.PerspectiveCamera(); camera.position.set(4, 1.4, 2); camera.updateMatrixWorld();
      const lay = () => { for (const mesh of meshes) (mesh as THREE.Mesh).onBeforeRender(undefined as never, scene, camera, undefined as never, undefined as never, undefined as never); };
      lay(); check();
      // Silverfish Cross, the launcher (J J K, Silverfish Cross) at its blow: ribbon 1 is out, its tip ahead of him, and
      // the strike socket (Tendrils2_8 in main) rides it.
      const launch = { ...base('rakucho'), action: 'heavy', branch: 'llh', actionStarted: 1, actionDuration: .735, actionSeq: 4 } as PlayerState;
      for (let k = 0; k <= 60 && !(shown.displayedClipName === 'Silverfish Cross' && shown.displayedClipTime >= .4735); k++) pose({ ...launch, actionTime: Math.min(1, k / 60 / .735) }, 1);
      lay(); check();
      expect(shown.displayedClipName).toBe('Silverfish Cross');
      expect(rakuchoTip(body, 'Tendrils2_8', out)).toBe(true);
      const socket = new THREE.Vector3();
      expect(rakuchoContactPoint(body, 'heavy', 'Silverfish Cross', 0, socket)).toBe(true);
      expect(socket.distanceTo(out)).toBeLessThan(1e-6);
      expect(body.group.worldToLocal(out.clone()).z, 'the X lands ahead of him').toBeGreaterThan(.8);
      // Ribbon Lash at its blow (heavy .59 of 1.01 s): ribbon 0 is out with the red orb's socket on its tip, ahead of him.
      const heavy = { ...base('rakucho'), action: 'heavy', actionStarted: 3, actionDuration: 1.01, actionSeq: 5 } as PlayerState;
      pose(base('rakucho'), 20);
      for (let k = 0; k <= 70 && !(shown.displayedClipName === 'Ribbon Lash' && shown.displayedClipTime >= .5918); k++) pose({ ...heavy, actionTime: Math.min(1, k / 60 / 1.01) }, 1);
      lay(); check();
      expect(shown.displayedClipName).toBe('Ribbon Lash');
      expect(rakuchoTip(body, 'Tendrils1_8', out)).toBe(true);
      expect(rakuchoContactPoint(body, 'heavy', 'Ribbon Lash', 0, socket)).toBe(true);
      expect(socket.distanceTo(out)).toBeLessThan(1e-6);
      expect(body.group.worldToLocal(out.clone()).z, 'the reap lands ahead of him').toBeGreaterThan(.8);
    } finally { ribbons.dispose(); body.dispose(); }
    expect(rakuchoTip(body, 'Tendrils1_8', new THREE.Vector3())).toBe(false);
  }, 120_000);
});
