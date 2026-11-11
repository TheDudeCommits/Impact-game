import fs from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { loadRigWithExtras } from './extraClips';
import { FIGHTERS } from '../src/config';
import { IDLE_PROFILES } from '../src/render/idle/profile';
import { Fighter } from '../src/render/Fighter';
import { SetsuEffects } from '../src/render/SetsuEffects';
import type { PlayerState } from '../src/game/types';
import { base, loadRig } from './rigHarness';
import { ORIGINALS } from '../src/originals/roster';

const def = FIGHTERS.setsu;
const CANONICAL = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];
// The round-16 set, carried onto the new skeleton, plus his own idle loop.
const SET = ['_Idle', 'Idle Pockets', 'Setsu idle fidget', 'Block', 'Snow Claw', 'Dash', 'Die fall', 'down_end', 'down_lp', 'Hit 01', 'jump',
  'Jump Fall', 'Jump spin', 'Ikazuchi', 'Run', 'shake', 'slammed', 'stun', 'Sekkou', 'Walk', 'Whirlwind'];

function header(path: string) {
  const file = fs.readFileSync(`public${path}`), length = file.readUInt32LE(12);
  return { file, json: JSON.parse(file.subarray(20, 20 + length).toString()), bin: file.subarray(20 + length + 8) };
}
/** Width and height of a JPEG or PNG held in a GLB's binary chunk. */
function imageSize(blob: Buffer) {
  if (blob[0] === 0x89) return [blob.readUInt32BE(16), blob.readUInt32BE(20)];
  for (let i = 2; i < blob.length;) {
    const marker = blob[i + 1];
    if (marker >= 0xc0 && marker <= 0xc2) return [blob.readUInt16BE(i + 7), blob.readUInt16BE(i + 5)];
    i += 2 + blob.readUInt16BE(i + 2);
  }
  return [0, 0];
}

let body: GLTF, rush: { animations: THREE.AnimationClip[] };
beforeAll(async () => {
  body = await loadRig(def.model);
  // His rush stages as he plays them: the takes' `Rush 1`-`Rush 3`, bound onto the body as FighterLibrary binds them.
  rush = { animations: (await loadRigWithExtras('setsu')).animations.filter(clip => /^Rush \d$/.test(clip.name)) };
}, 120_000);

describe('Setsu (round 3 body)', () => {
  it.skipIf(!!ORIGINALS.setsu)('ships a new file, inside the roster budgets, on the canonical skeleton', () => {
    expect(def.model).toBe('/assets/fighters/setsu-r3.glb');
    expect(def.rushModel).toBeUndefined();
    const { file, json, bin } = header(def.model);
    expect(file.length, 'bytes').toBeLessThan(6 * 1024 * 1024);
    const triangles = json.meshes.flatMap((m: { primitives: { indices: number }[] }) => m.primitives)
      .reduce((sum: number, p: { indices: number }) => sum + json.accessors[p.indices].count / 3, 0);
    expect(triangles).toBeGreaterThan(20_000);
    expect(triangles, 'triangles').toBeLessThan(50_000);
    expect(json.images).toHaveLength(1);
    const view = json.bufferViews[json.images[0].bufferView];
    const [w, h] = imageSize(bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength));
    expect([w, h]).toEqual([2048, 2048]);
    expect(json.skins).toHaveLength(1);
    expect(json.skins[0].joints.map((j: number) => json.nodes[j].name).sort()).toEqual([...CANONICAL].sort());
    // The hair is its own mesh, so the look's hair shading (toonKind) finds it.
    expect(json.meshes.map((m: { name: string }) => m.name).sort()).toEqual(['setsu_body', 'setsu_hair']);
  });

  it('carries the whole set, every clip keying every joint, every track binding', () => {
    const names = body.animations.map(c => c.name);
    // Setsu's body carries his own takes too, the victory and the awakening with them.
    expect([...names].sort()).toEqual([...SET, ...ORIGINALS.setsu ? ['victory_in', 'victory_lp', 'Setsu awaken'] : []].sort());
    for (const clip of def.clips!) expect(names, clip).toContain(clip);
    for (const clip of body.animations) {
      const nodes = new Set<string>();
      for (const track of clip.tracks) {
        const parsed = THREE.PropertyBinding.parseTrackName(track.name);
        expect(THREE.PropertyBinding.findNode(body.scene, parsed.nodeName), `${clip.name}: ${parsed.nodeName}`).toBeTruthy();
        if (parsed.propertyName === 'quaternion') nodes.add(parsed.nodeName);
      }
      // His rig adds fingers, twist and helper joints to the canonical ones (every clip keys 52
      // of its 77; no clip keys the twist and helper joints, so they stay at rest): every canonical joint keyed.
      if (ORIGINALS.setsu) expect(CANONICAL.filter(joint => !nodes.has(joint)), `${clip.name} leaves joints unkeyed`).toEqual([]);
      else expect([...nodes].sort(), `${clip.name} leaves joints unkeyed`).toEqual([...CANONICAL].sort());
    }
  });


  it('loads into a fighter that resolves every joint its effects are drawn from', () => {
    const fighter = new Fighter(base('setsu'), body);
    try {
      // SetsuEffects arcs between these, and the charge sits on the hands.
      for (const joint of ['Head', 'Spine1', 'Hips', 'LeftHand', 'RightHand', 'LeftForeArm', 'RightForeArm', 'LeftLeg', 'RightLeg'])
        expect(fighter.joints.get(joint), joint).toBeTruthy();
      fighter.model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(fighter.model);
      expect(box.max.y - box.min.y, 'normalised height').toBeGreaterThan(1.5);
      expect(box.max.y - box.min.y, 'normalised height').toBeLessThan(1.66);
    } finally { fighter.dispose(); }
  });

  it('stands in the idle his profile names, hands in his pockets', () => {
    const profile = IDLE_PROFILES.setsu!;
    expect(profile.clip).toBe('Idle Pockets');
    expect(profile.fidgets).toEqual(['Setsu idle fidget']);
    const fighter = new Fighter(base('setsu'), body);
    try {
      for (let i = 0; i < 90; i++) fighter.update(1 / 60, base('setsu'), true, 1 / 60);
      expect(fighter.motionEvidence().clip).toBe('Idle Pockets');
      // The wrists sit at the waistband, either side of the fly, and in front
      // of the body: the fingers are down in the shorts.
      const hips = fighter.group.worldToLocal(fighter.joints.get('Hips')!.getWorldPosition(new THREE.Vector3()));
      for (const side of ['Left', 'Right']) {
        const wrist = fighter.group.worldToLocal(fighter.joints.get(side + 'Hand')!.getWorldPosition(new THREE.Vector3()));
        expect(Math.abs(wrist.y - hips.y), `${side} wrist height against the hips`).toBeLessThan(.12);
        expect(Math.abs(wrist.x - hips.x), `${side} wrist off the centre line`).toBeLessThan(.2);
        expect(wrist.z - hips.z, `${side} wrist in front of the hips`).toBeGreaterThan(.02);
      }
    } finally { fighter.dispose(); }
  });

  it('starts the authored strikes from his guard, not from his pockets', () => {
    // characterMotion bakes his light and ultimate on the first frame of the
    // body's `_Idle`: that is the guard, hands up in front of the chest.
    const mixer = new THREE.AnimationMixer(body.scene);
    mixer.clipAction(body.animations.find(c => c.name === '_Idle')!).play();
    mixer.update(0); body.scene.updateMatrixWorld(true);
    const at = (name: string) => body.scene.getObjectByName(name)!.getWorldPosition(new THREE.Vector3());
    for (const side of ['Left', 'Right']) {
      expect(at(side + 'Hand').y - at('Hips').y, `${side} hand raised`).toBeGreaterThan(.15);
      expect(at(side + 'Hand').z - at('Hips').z, `${side} hand forward`).toBeGreaterThan(ORIGINALS.setsu ? .12 : .15);
    }
    mixer.stopAllAction();
  });

  it('lights his body when awakened, never a disc on the floor under him', () => {
    // The SETSUNA flicker is a light volume at the chest (LightVolumes: a
    // sphere that lights whatever surface lies inside it). At its old 2.6 m it
    // swallowed the tile and drew a lit disc under him - an owner rule says
    // no awakened fighter stands on one. Held standing, guarding, running,
    // in the air and knocked down: everything but his attacks, whose charged
    // hands light what is near them the way every lightning user's do.
    const scene = new THREE.Scene(), effects = new SetsuEffects(scene);
    const fighter = new Fighter(base('setsu'), body, false, rush.animations);
    const lights = (effects as unknown as { kit: { lights: { mesh: THREE.InstancedMesh } } }).kit.lights.mesh;
    const matrix = new THREE.Matrix4(), centre = new THREE.Vector3(), scale = new THREE.Vector3(), turn = new THREE.Quaternion();
    const script: [PlayerState['action'], number][] = [['idle', 1.5], ['guard', .6], ['run', .8], ['jump', .7], ['hurt', .6], ['idle', .5]];
    let time = 10, lit = 0, lowest = Infinity, z = 0;
    try {
      for (const [action, seconds] of script) {
        for (let i = 0; i < Math.ceil(seconds * 60); i++) {
          time += 1 / 60;
          const finite = action === 'jump' || action === 'hurt';
          if (action === 'run') z += 6 / 60;
          const y = action === 'jump' ? Math.max(0, 6 * (i / 60) - 9 * (i / 60) ** 2) : 0;
          const state: PlayerState = { ...base('setsu'), action, z, y, grounded: y <= 0, awakened: true, awakenedUntil: time + 20, guarding: action === 'guard',
            actionSeq: finite ? 3 : undefined, actionStarted: 10, actionDuration: finite ? seconds : 0, actionTime: finite ? Math.min(.999, i / 60 / seconds) : 0 };
          fighter.update(1 / 60, state, true, 1 / 60);
          fighter.group.updateMatrixWorld(true);
          effects.update(time, new Map([['k', fighter]]), 1);
          for (let n = 0; n < lights.count; n++) {
            lights.getMatrixAt(n, matrix); matrix.decompose(centre, turn, scale);
            lowest = Math.min(lowest, centre.y - scale.x - fighter.group.position.y); lit++;
          }
        }
      }
      expect(lit, 'the awakened light is drawn').toBeGreaterThan(100);
      expect(lowest, 'the light volume\'s lowest point, above his feet').toBeGreaterThan(.39);
    } finally { effects.dispose(); fighter.dispose(); }
  });

  it('resolves the rush plan onto the new skeleton', () => {
    for (const [stage, pattern] of def.rushClips!.entries()) {
      const found = rush.animations.filter(c => c.name === pattern);
      expect(found, `stage ${stage + 1}`).toHaveLength(1);
      for (const track of found[0].tracks)
        expect(THREE.PropertyBinding.findNode(body.scene, THREE.PropertyBinding.parseTrackName(track.name).nodeName), track.name).toBeTruthy();
    }
    const fighter = new Fighter(base('setsu'), body, false, rush.animations);
    fighter.prepareRush(); fighter.dynamics = false;
    try {
      for (let i = 0; i < 30; i++) fighter.update(1 / 60, base('setsu'), true, 1 / 60);
      for (let chain = 1; chain <= 3; chain++) {
        const state: PlayerState = { ...base('setsu'), action: 'light', chain, actionSeq: 10 + chain, actionStarted: 2 + chain, actionDuration: .6, actionTime: .2 };
        for (let i = 0; i < 4; i++) fighter.update(1 / 60, state, true, 1 / 60);
        expect(fighter.motionEvidence().clip, `chain ${chain}`).toBe(`Rush ${chain}`);
      }
    } finally { fighter.dispose(); }
  });
});
