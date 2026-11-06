import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { FighterId } from '../src/game/types';
import type { Canonical } from '../src/render/skeleton';
import { RELEASED_FIGHTERS } from '../src/game/rosterAvailability';
import { TECHNIQUE_KEYS, styleOf } from '../src/game/techniques';
import { STYLE_TAKES, installStyleMoves, resetStyleMoves, styleMove, styleReport, styleTake } from '../src/engine/client/styleMoves';
import { orderSpine, rigOf } from '../src/engine/client/retarget';
import { resolveSkeleton } from '../src/render/skeleton';
import { findClipIn } from '../src/render/clipMatch';
import { loadRig } from './rigHarness';
import { assembleFighter } from './popHarness';

/** Techniques (src/engine/client/styleMoves.ts): each style's takes, read off the disk as the page fetches them, fitted to
 *  every released fighter's body - all nine techniques each. */
const fromDisk = async () => {
  const file = await loadRig('/assets/fighters/techniques.glb');
  const idle = file.animations.find(c => c.name === 'Idle');
  return { rig: rigOf(file.scene, idle), clips: new Map(file.animations.map(c => [c.name, c])) };
};
beforeAll(async () => { await installStyleMoves(fromDisk); });
afterAll(() => resetStyleMoves());

describe('the style takes', () => {
  it('name a take in the file for every style and technique, with its blow inside it', async () => {
    const file = await loadRig('/assets/fighters/techniques.glb');
    const names = new Set(file.animations.map(c => c.name));
    expect(names.has('Idle')).toBe(true);
    for (const [style, row] of Object.entries(STYLE_TAKES)) for (const key of TECHNIQUE_KEYS) {
      expect(row[key].length, `${style} ${key}`).toBeGreaterThan(0);
      for (const take of row[key]) {
        expect(names.has(take.take), `${style} ${key}: ${take.take}`).toBe(true);
        expect(take.contact).toBeGreaterThan(.3); expect(take.contact).toBeLessThan(.75);
      }
    }
  });
  it('spread a style\'s fighters over its takes', () => {
    const fists = RELEASED_FIGHTERS.filter(id => styleOf(id) === 'fists');
    expect(new Set(fists.map(id => styleTake(id, 'rush').take)).size).toBe(2);
  });
  it('fit every released fighter\'s body for all nine techniques: on its own joints, finite, never refused', async () => {
    const refused: string[] = [];
    for (const id of RELEASED_FIGHTERS as readonly FighterId[]) {
      const { source } = await assembleFighter(id);
      for (const key of TECHNIQUE_KEYS) {
        const fit = styleMove(source.scene, source.animations, id, key);
        if (!fit) { refused.push(`${id} ${key}`); continue; }
        expect(fit.clip.duration, `${id} ${key}`).toBeGreaterThan(.5);
        for (const track of fit.clip.tracks) {
          expect(THREE.PropertyBinding.findNode(source.scene, THREE.PropertyBinding.parseTrackName(track.name).nodeName), `${id} ${track.name}`).toBeTruthy();
          expect(Array.from(track.values).every(Number.isFinite), `${id} ${track.name}`).toBe(true);
        }
      }
    }
    if (process.env.STYLE_REPORT) fs.writeFileSync(process.env.STYLE_REPORT, JSON.stringify(styleReport(), null, 1));
    // A refusal leaves that body on its button's own clip (Fighter's enderClip): allowed, but rare.
    expect(refused.length, refused.join(', ')).toBeLessThanOrEqual(Math.ceil(RELEASED_FIGHTERS.length * TECHNIQUE_KEYS.length * .03));
  }, 600000);
});

/** Where a fitted take holds the body, sampled: how high the head stays over the hips (a share of the stance's) and how
 *  far ahead of the hips the hand or foot that moves fastest gets (a share of the stance's height, the opponent at +z). */
function posture(scene: THREE.Object3D, clip: THREE.AnimationClip, contact: number, stance?: THREE.AnimationClip) {
  const names: string[] = []; scene.traverse(o => { if ((o as THREE.Bone).isBone) names.push(o.name); });
  const map = resolveSkeleton(names), bone = (k: string) => { const n = map.get(k); let hit: THREE.Object3D | undefined; scene.traverse(o => { if (!hit && (o as THREE.Bone).isBone && o.name === n) hit = o; }); return hit; };
  const hips = bone('Hips')!, head = bone('Head') ?? bone('Neck')!, ends = ['LeftHand', 'RightHand', 'LeftFoot', 'RightFoot'].map(bone).filter((o): o is THREE.Object3D => !!o);
  const mixer = new THREE.AnimationMixer(scene), at = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
  const pose = (c: THREE.AnimationClip, t: number) => { mixer.stopAllAction(); const a = mixer.clipAction(c); a.play(); a.time = t; mixer.update(0); scene.updateMatrixWorld(true); };
  if (stance) pose(stance, 0);
  // (In the file's own units: some rigs are a centimetre one at a hundredth of the others' size until Fighter scales it.)
  const tall = Math.max(1e-6, at(head).y - Math.min(...ends.slice(2).map(o => at(o).y))), over = Math.max(1e-6, at(head).y - at(hips).y);
  let lowest = Infinity;
  for (let i = 1; i <= 12; i++) { pose(clip, clip.duration * i / 13); lowest = Math.min(lowest, (at(head).y - at(hips).y) / over); }
  pose(clip, clip.duration * contact);
  const reach = Math.max(...ends.map(o => (at(o).z - at(hips).z) / tall));
  mixer.stopAllAction(); mixer.uncacheRoot(scene);
  return { lowest, reach };
}

describe('the techniques as the bodies throw them', () => {
  it('reads a back named from the top down in the order it hangs', () => {
    // Meshy's rig: Hips > Spine02 > Spine01 > Spine > neck. By name, Spine is its chest and Spine02 its waist.
    const names = ['Hips', 'Spine02', 'Spine01', 'Spine', 'neck'], parent = [-1, 0, 1, 2, 3];
    const joints = new Map<Canonical, number>([['Hips', 0], ['Spine', 3], ['Spine1', 1], ['Neck', 4]]);
    orderSpine(joints, parent, () => true);
    expect([joints.get('Spine'), joints.get('Spine1'), joints.get('Spine2')].map(i => names[i!])).toEqual(['Spine02', 'Spine01', 'Spine']);
    // A back in order (Mixamo's) is left as named.
    const mixamo = new Map<Canonical, number>([['Hips', 0], ['Spine', 1], ['Spine1', 2], ['Spine2', 3], ['Neck', 4]]);
    orderSpine(mixamo, parent, () => true);
    expect([...mixamo.values()]).toEqual([0, 1, 2, 3, 4]);
  });
  it('keep every released body standing - the head over the hips - and throw each blow at the opponent', async () => {
    const folded: string[] = [], wide: string[] = [];
    let rows = 0;
    for (const id of RELEASED_FIGHTERS as readonly FighterId[]) {
      const { source } = await assembleFighter(id);
      const stance = findClipIn(source.animations, ['_Idle', 'Idle', 'taisei-ready', '02-STANCE', 'stance', 'idle']);
      for (const key of TECHNIQUE_KEYS) {
        const fit = styleMove(source.scene, source.animations, id, key);
        if (!fit) continue;
        rows++;
        const { lowest, reach } = posture(source.scene, fit.clip, fit.contact, stance);
        // A low sweep is a kick-style fighter's (K.sweeping, K.sweepkick, K.stepin, K.backflip): never anyone else's.
        if (lowest < .45 && !(styleOf(id) === 'kicks' && ['delay', 'counter', 'hhh', 'wakeUp'].includes(key))) folded.push(`${id} ${key} ${styleTake(id, key).take} ${lowest.toFixed(2)}`);
        if (reach < .02) wide.push(`${id} ${key} ${styleTake(id, key).take} ${reach.toFixed(2)}`);
      }
    }
    expect(rows).toBeGreaterThan(RELEASED_FIGHTERS.length * 11);
    expect(folded, folded.join('; ')).toEqual([]);
    expect(wide.length, wide.join('; ')).toBeLessThanOrEqual(Math.ceil(rows * .02));
  }, 900000);
});
