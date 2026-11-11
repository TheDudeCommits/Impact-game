import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { FIGHTERS } from '../src/config';
import contactFrames from '../src/game/data/contactFrames.json';
import type { FighterId, PlayerState } from '../src/game/types';
import { Fighter } from '../src/render/Fighter';
import { ORIGINALS } from '../src/originals/roster';
import { appendClips, findClipIn } from '../src/render/clipMatch';

async function parse(buffer: Buffer) {
  return new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer, "");
}
async function loadRig(path: string) {
  const file = fs.readFileSync(`public${path}`), length = file.readUInt32LE(12);
  const json = JSON.parse(file.subarray(20, 20 + length).toString());
  json.materials = (json.materials ?? []).map((m: { name: string }) => ({ name: m.name }));
  delete json.images; delete json.textures; delete json.samplers;
  const data = Buffer.from(JSON.stringify(json)), padded = Buffer.concat([data, Buffer.alloc((4 - data.length % 4) % 4, 32)]);
  const tail = file.subarray(20 + length), result = Buffer.alloc(20 + padded.length + tail.length);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16); padded.copy(result, 20); tail.copy(result, 20 + padded.length);
  return parse(result);
}
const baseState = (fighter: FighterId): PlayerState => ({ id: 'rush-test', name: 'R', fighter, x: 0, y: 0, z: 0, yaw: 0,
  hp: 1000, maxHp: 1000, stamina: 100, ultimate: 0, action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0,
  target: null, alive: true, isBot: false, grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } });
const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const TABLE = contactFrames as Record<string, Record<string, number>>;
const withRush = (Object.keys(FIGHTERS) as FighterId[]).filter(id => FIGHTERS[id].rushModel);

describe('rush string clips', () => {
  it('every fighter names three rush stages', () => {
    for (const id of Object.keys(FIGHTERS) as FighterId[]) {
      const clips = FIGHTERS[id].rushClips;
      if (!clips) continue;
      expect(clips, id).toHaveLength(3);
    }
  });

  it.each(withRush)('%s: the rush file binds onto the body, names its stages, and has their contacts', async id => {
    const def = FIGHTERS[id];
    expect(fs.existsSync(`public${def.rushModel}`), `${def.rushModel} missing`).toBe(true);
    const body = await loadRig(def.model);
    const rush = await parse(fs.readFileSync(`public${def.rushModel}`));
    // Resolved the way Fighter.findClip resolves a pattern: exact, then a
    // substring. Each stage has to resolve to its own clip in the rush file
    // and to nothing in the body, or a body clip would shadow it.
    const clips = def.rushClips!.map((pattern, stage) => {
      const found = rush.animations.filter(c => clean(c.name) === clean(pattern));
      expect(found, `${id} stage ${stage + 1}: "${pattern}"`).toHaveLength(1);
      // (The renderer finds a clip by its exact name first (clipMatch.ts findClipIn) over the body's clips with the rush
      // file's appended (appendClips), and Taisei's body carries his stage takes 'DZ Rush 1-3' (Fighter.ts DREAM_STAGES),
      // which contain the names without shadowing them. So the stage is resolved as the renderer resolves it, and still
      // fails if a body clip would answer first.)
      expect(findClipIn(appendClips(body.animations, rush.animations), [pattern]), `${id}: a body clip answers to "${pattern}"`).toBe(found[0]);
      return found[0];
    });
    expect(new Set(clips).size).toBe(3);
    // Every track lands on a node of the body, and every node the body's own
    // clips move is moved by every rush clip: a mixer only writes what the
    // running clip has tracks for, so an unkeyed joint keeps the last clip's pose.
    const bodyTracks = new Set(body.animations.flatMap(c => c.tracks.map(t => t.name)));
    for (const clip of clips) {
      for (const track of clip.tracks) {
        const parsed = THREE.PropertyBinding.parseTrackName(track.name);
        expect(THREE.PropertyBinding.findNode(body.scene, parsed.nodeName), `${id} ${clip.name}: ${parsed.nodeName}`).toBeTruthy();
      }
      const own = new Set(clip.tracks.map(t => t.name));
      const missing = [...bodyTracks].filter(t => !own.has(t));
      expect(missing, `${id} ${clip.name} leaves joints unkeyed`).toEqual([]);
      expect(clip.duration, `${id} ${clip.name}`).toBeGreaterThan(.3);
      expect(clip.duration, `${id} ${clip.name}`).toBeLessThan(2);
    }
    // The contact the renderer aligns each stage to, measured on this file
    // (scripts/measure_rush_clips.mts), inside the clip rather than on an end.
    for (let stage = 1; stage <= 3; stage++) {
      const fraction = TABLE[id]?.[`rush${stage}`];
      expect(fraction, `${id} rush${stage}`).toBeGreaterThan(.1);
      expect(fraction, `${id} rush${stage}`).toBeLessThan(.9);
    }
  }, 60_000);

  it.each(withRush)('%s: the rush clips stand on the idle\'s floor and stay near the capsule', async id => {
    const def = FIGHTERS[id];
    const gltf = await loadRig(def.model);
    const rush = await parse(fs.readFileSync(`public${def.rushModel}`));
    const fighter = new Fighter(baseState(id), { ...gltf, animations: [...gltf.animations, ...rush.animations] } as GLTF);
    fighter.dynamics = false;
    try {
      const shown = (o: THREE.Object3D) => { for (let n: THREE.Object3D | null = o; n; n = n.parent) if (!n.visible) return false; return true; };
      const skins: THREE.SkinnedMesh[] = [];
      // The body: what it carries (LANCET's sheath, a blade) may dip under the
      // floor in a low cut, and a hidden transformation shell is not there.
      fighter.model.traverse(o => { if ((o as THREE.SkinnedMesh).isSkinnedMesh && !/-ink$/.test(o.name) && !/weapon|sheath|sword|blade|katana|kunai|knife/i.test(o.name) && shown(o)) skins.push(o as THREE.SkinnedMesh); });
      const hips = fighter.joints.get('Hips')!;
      const pose = (clip: THREE.AnimationClip, fraction: number) => {
        const action = fighter.mixer.clipAction(clip);
        fighter.mixer.stopAllAction(); action.reset(); action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();
        action.time = Math.min(clip.duration * fraction, clip.duration - 1e-6); fighter.mixer.update(0); fighter.model.updateMatrixWorld(true);
      };
      // The body's own surface: vertices led by a garment chain are left
      // out - Gaunt's mantle drapes below his knees and sweeps through the
      // tile in any deep lunge, and the spring solver owns it at runtime.
      const surface = skins.map(skin => {
        const idx = skin.geometry.attributes.skinIndex, w = skin.geometry.attributes.skinWeight, keep: number[] = [];
        for (let i = 0; i < idx.count; i++) {
          let top = 0, bone = '';
          for (let j = 0; j < 4; j++) if (w.getComponent(i, j) > top) { top = w.getComponent(i, j); bone = skin.skeleton.bones[idx.getComponent(i, j)].name; }
          if (!/^Detail_CLOTH/.test(bone)) keep.push(i);
        }
        return { skin, keep };
      });
      const v = new THREE.Vector3();
      const floor = () => {
        let low = Infinity;
        for (const { skin, keep } of surface) for (const i of keep) { skin.getVertexPosition(i, v); v.applyMatrix4(skin.matrixWorld); if (v.y < low) low = v.y; }
        return low;
      };
      const idle = ['_Idle', 'taisei-ready'].map(n => fighter.clips.find(c => c.name === n)).find(Boolean) ?? fighter.clips[0];
      const idleFloors: number[] = [];
      for (let i = 0; i <= 4; i++) { pose(idle, i / 4); idleFloors.push(floor()); }
      const idleFloor = Math.min(...idleFloors), stance = idleFloors.sort((a, b) => a - b)[2];
      const height = def.height ?? 1.7;
      for (const clip of rush.animations) {
        const own = fighter.clips.find(c => c.name === clip.name)!;
        let low = Infinity, flat = 0;
        pose(own, 0);
        const start = fighter.group.worldToLocal(hips.getWorldPosition(new THREE.Vector3()));
        for (let i = 0; i <= 16; i++) {
          pose(own, i / 16);
          low = Math.min(low, floor());
          const p = fighter.group.worldToLocal(hips.getWorldPosition(new THREE.Vector3()));
          flat = Math.max(flat, Math.hypot(p.x - start.x, p.z - start.z));
        }
        // Every rush clip ends in its stance, so its settled last frame is the
        // datum: it stands where the idle stands (scripts/rush_lifts.json is
        // what puts a retarget there). In between, a deep lunge may press a
        // toe through the tile - the sweep Ward's own heavy is
        // built on does, by 11.7% of him - but never the body.
        pose(own, 1);
        expect(Math.abs(floor() - stance), `${id} ${clip.name}: settles ${(floor() - stance).toFixed(3)} m off the idle's floor`).toBeLessThan(.03);
        expect(Math.abs(low - idleFloor) / height, `${id} ${clip.name}: floor ${(low - idleFloor).toFixed(3)} m off the idle's`).toBeLessThan(id === 'taisei' && ORIGINALS.taisei ? .16 : id === 'ouga' && ORIGINALS.ouga ? .18 : .125);
        // Travel is the simulation's; a clip carries only a step of its own.
        expect(flat, `${id} ${clip.name}: hips travel ${flat.toFixed(2)} m`).toBeLessThan(2.2);
      }
    } finally { fighter.dispose(); }
  }, 120_000);
});
