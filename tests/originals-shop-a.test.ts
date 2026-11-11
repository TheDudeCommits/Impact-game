import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { FIGHTERS } from '../src/config';
import { fighterAssetPaths } from '../scripts/fighterAssets';
import { AWAKENINGS, AWAKENED_MOVES, moveFor } from '../src/game/awakening';
import { COMBO_KEYS, comboMove } from '../src/game/combos';
import { ITEMS } from '../src/game/economy/catalog';
import { OUTFITS } from '../src/game/economy/outfits';
import { MOVES, RUSH } from '../src/game/moves';
import type { FighterId } from '../src/game/types';
import { displayMove } from '../src/originals/apply';
import { ORIGINALS } from '../src/originals/roster';
import { SHOP_A } from '../src/originals/shop/a';
import { Fighter, bindClips } from '../src/render/Fighter';
import { IDLE_PROFILES } from '../src/render/idle/profile';
import { commandList } from '../src/ui/commandList';
import MOVE_ART from '../src/ui/moveArtVersions.json';
import SPRITES from '../public/assets/home/sprites/manifest.json';
import { glbJson } from './extraClips';
import { base, loadRig } from './rigHarness';


/** The files each original's own assets are named for. */
const OWN: Partial<Record<FighterId, RegExp>> = { gorai: /\/gorai-/, haldor: /\/haldor-/, sorrel: /\/sorrel-/, dorado: /\/dorado-/ };
/** Each body's files as build_a.sh carries them, and its donor's in merge order (FIGHTERS' own file order). */
const CARRIED: [FighterId, string, string[]][] = [
  ['gorai', 'gorai-tr1', ['gorai-br1', 'gorai-fanim1', 'gorai-fanim3']],
  ['gorai', 'gorai-awakened-tr1', ['gorai-wyrm-br1', 'gorai-wyrm-react1']],
  ['haldor', 'haldor-tr1', ['haldor-br1', 'haldor-fanim1', 'haldor-fanim2']],
  ['sorrel', 'sorrel-tr1', ['sorrel-br1', 'sorrel-fanim1', 'sorrel-fanim2']],
  ['dorado', 'dorado-tr1', ['dorado-ds1', 'dorado-fanim1', 'dorado-fanim2']],
];
/** The weapon each body holds: the bone retarget_prop.py hangs under its right hand and the mesh the renderer reads as
 *  steel held in that hand (Fighter.ts HELD), keyed in every clip the donor's weapon bone is. */
const WEAPONS: Partial<Record<FighterId, [string, string]>> = {
  gorai: ['weapon_club_R', 'weapon_club_hand_R'], haldor: ['weapon_glaive_R', 'weapon_glaive_hand_R'],
  sorrel: ['weapon_cutlass_R', 'weapon_cutlass_hand_R'], dorado: ['weapon_cutlass_R', 'weapon_cutlass_hand_R'],
};
const IDS = Object.keys(SHOP_A) as FighterId[];
const built = (id: FighterId) => IDS.includes(id);

afterEach(() => vi.restoreAllMocks());

describe('team A\'s originals (the Dust Sea\'s great captains)', () => {

  it('draw only their own bodies, clips and portraits, and every one of them ships', () => {
    for (const id of IDS) {
      const f = FIGHTERS[id];
      const files = [f.model, f.portrait, f.rushModel, ...(f.extraModels ?? []), IDLE_PROFILES[id]?.model, f.formModel]
        .filter((file): file is string => !!file);
      for (const file of files) {
        expect(file, id).toMatch(OWN[id]!);
        expect(fs.existsSync(`public${file}`), file).toBe(true);
      }
      expect([f.formExtraModels, f.openHandsModel], id).toEqual([undefined, undefined]);
      for (const path of fighterAssetPaths(f)) expect(`/${path}`, id).toMatch(OWN[id]!);
    }
  });

  it('show their own 2D art once it is laid out, each sheet fetched by its own bytes', () => {
    // scripts/originals/prepare_home_art.py, prepare_pose_sheet.py and prepare_move_cards.py write the slot's own files
    // and the hashes the game versions them by (`?v=<hash>`, cached a year).
    const sha = (file: string) => createHash('sha256').update(fs.readFileSync(`public/assets/${file}`)).digest('hex');
    for (const id of IDS.filter(i => SHOP_A[i]!.homeArt)) {
      for (const file of [`home/fighters/${id}.webp`, `home/portraits/${id}.webp`]) expect(fs.existsSync(`public/assets/${file}`), file).toBe(true);
      const sheet = SPRITES.fighters.find(f => f.id === id) as { file: string; poster: string; sha256?: string; posterSha256?: string; sourceFile?: string };
      expect([sheet.sha256, sheet.posterSha256], id).toEqual([sha(`home/sprites/${sheet.file}`), sha(`home/sprites/${sheet.poster}`)]);
      expect(sheet.sourceFile, id).toMatch(/^(poses\.png|sorrel-restyle-|dorado-restyle-)/);
      expect(MOVE_ART[id as keyof typeof MOVE_ART], id).toBe(sha(`ui/moves/${id}.webp`).slice(0, 12));
    }
  });

  it('awaken as their own: Gorai into the STORM WYRM, a body of his own in the half-wyrm form\'s place', () => {
    if (!built('gorai')) return;
    expect(AWAKENINGS.gorai.kind).toBe('form');
    expect(FIGHTERS.gorai.formModel).toBe('/assets/fighters/gorai-awakened-tr1.glb');
    expect(displayMove('gorai', AWAKENINGS.gorai.name)).toBe('STORM WYRM');
  });

  it('carry their weapons in their own right hands through every clip', () => {
    for (const id of IDS) {
      const [boneName, meshName] = WEAPONS[id]!;
      for (const file of [FIGHTERS[id].model, FIGHTERS[id].formModel].filter((f): f is string => !!f && OWN[id]!.test(f))) {
        const json = glbJson(file);
        const bone = json.nodes.findIndex(n => n.name === boneName), hand = json.nodes.findIndex(n => n.name === 'RightHand');
        expect(bone, `${file} ${boneName}`).toBeGreaterThan(-1);
        expect(json.nodes[hand].children ?? [], `${file} ${boneName}`).toContain(bone);
        expect(json.nodes.some(n => n.name === meshName), `${file} ${meshName}`).toBe(true);
        const keyed = (json.animations ?? []).filter(a => a.channels.some(c => c.target.node === bone)).length;
        expect(keyed, `${file} ${boneName}`).toBeGreaterThan(15);
      }
    }
  });




  it('bind every clip on their own bodies, and key every joint the transfer moves in every clip', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const CORE = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder',
      'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];
    for (const id of IDS) for (const file of [FIGHTERS[id].model, FIGHTERS[id].formModel].filter((f): f is string => !!f && OWN[id]!.test(f))) {
      const rig = await loadRig(file);
      const bound = bindClips(rig.scene, rig.animations, id);
      expect(bound.map(c => c.name), file).toEqual(rig.animations.map(c => c.name));
      const json = glbJson(file);
      const present = json.nodes.map((n, i) => [n.name ?? '', i] as const).filter(([n]) => CORE.includes(n));
      for (const clip of json.animations ?? []) {
        const keyed = new Set(clip.channels.filter(c => c.target.path === 'rotation').map(c => c.target.node));
        expect(present.filter(([, i]) => !keyed.has(i)).map(([n]) => n), `${file} ${clip.name}`).toEqual([]);
      }
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it('hang their long coats (and the STORM WYRM\'s tail) on spring chains off the hips, never keyed, which the solver swings', async () => {
    for (const id of IDS) for (const file of [FIGHTERS[id].model, FIGHTERS[id].formModel].filter((f): f is string => !!f && OWN[id]!.test(f))) {
      expect(SHOP_A[id]!.coat, id).toBeDefined();
      const json = glbJson(file);
      const chains = json.nodes.map((n, i) => [n.name ?? '', i] as const).filter(([n]) => n.startsWith('Detail_CLOTH_Coat_'));
      expect(chains.length, file).toBeGreaterThanOrEqual(12);
      const hips = json.nodes.findIndex(n => n.name === 'Hips');
      for (const [, root] of chains.filter(([n]) => n.endsWith('_0'))) expect(json.nodes[hips].children ?? [], file).toContain(root);
      // Never moved by a clip: a link a clip keys (a resampling export keys them) holds its rest throughout.
      const keyed = (json.animations ?? []).flatMap(a => a.channels.filter(c => chains.some(([, i]) => i === c.target.node)).map(c => ({ a, c })));
      const rig = await loadRig(file);
      for (const { a, c } of keyed) {
        const clip = rig.animations.find(k => k.name === a.name)!, name = json.nodes[c.target.node].name!;
        const track = clip.tracks.find(t => t.name === `${name}.${c.target.path === 'rotation' ? 'quaternion' : c.target.path === 'translation' ? 'position' : 'scale'}`)!;
        const rest = rig.scene.getObjectByName(name)!, at = c.target.path === 'rotation' ? rest.quaternion.toArray() : c.target.path === 'translation' ? rest.position.toArray() : rest.scale.toArray();
        for (let k = 0; k < track.values.length; k++) expect(Math.abs(Math.abs(track.values[k]) - Math.abs(at[k % at.length])), `${file} ${a.name} moves ${name}`).toBeLessThan(1e-4);
      }
      const fighter = new Fighter(base(id), rig);
      try { expect(fighter.motionEvidence().springBones, file).toBeGreaterThanOrEqual(chains.length); } finally { fighter.dispose(); }
    }
  });

  it('stand on their boots in their idles, never on a tail or a coat\'s hem', async () => {
    // The renderer stands a body on its idle's lowest point, leaving out what it carries (Fighter.ts CARRIED). The model's
    // skin gave the STORM WYRM's tail to a thigh, and in the half-wyrm form's crouched idle it dropped 0.7 m under his
    // feet - the whole form would have floated by it. His tail below the coat is a mesh of its own the silhouette leaves
    // out, and every body's lowest point in its idle is its own boots.
    const CARRIED = /weapon|equipment-held|^awaken-on|wings/i, FEET = /^(Left|Right)(Foot|ToeBase)$/;
    for (const id of IDS) for (const file of [FIGHTERS[id].model, FIGHTERS[id].formModel].filter((f): f is string => !!f && OWN[id]!.test(f))) {
      const rig = await loadRig(file);
      const mixer = new THREE.AnimationMixer(rig.scene);
      mixer.clipAction(rig.animations.find(c => c.name === '_Idle')!).play(); mixer.update(0); rig.scene.updateMatrixWorld(true);
      let lowest = Infinity, feet = Infinity;
      const v = new THREE.Vector3();
      rig.scene.traverse(o => {
        const m = o as THREE.SkinnedMesh;
        if (!m.isSkinnedMesh || CARRIED.test(m.name)) return;
        const index = m.geometry.getAttribute('skinIndex'), weight = m.geometry.getAttribute('skinWeight');
        for (let i = 0; i < m.geometry.getAttribute('position').count; i += 2) {
          m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld);
          lowest = Math.min(lowest, v.y);
          let top = 0, at = 0;
          for (let j = 0; j < 4; j++) if (weight.getComponent(i, j) > top) { top = weight.getComponent(i, j); at = index.getComponent(i, j); }
          if (FEET.test(m.skeleton.bones[at]?.name ?? '')) feet = Math.min(feet, v.y);
        }
      });
      expect(lowest, `${file}: its idle's lowest point is ${(feet - lowest).toFixed(2)} m under its boots`).toBeGreaterThan(feet - .03);
    }
    if (built('gorai')) expect(glbJson(FIGHTERS.gorai.formModel!).nodes.some(n => n.name === 'wyrm-tail-wings')).toBe(true);
  });


  it('keep each carried clip at its donor\'s length, so every contact lands where the donor\'s did', () => {
    const lengths = (file: string) => {
      const json = glbJson(file) as unknown as { animations?: { name: string; samplers: { input: number }[] }[]; accessors: { max?: number[] }[] };
      return new Map((json.animations ?? []).map(a => [a.name, Math.max(...a.samplers.map(s => json.accessors[s.input].max![0]))]));
    };
    for (const [id, mine, donors] of CARRIED) {
      if (!built(id)) continue;
      // The donor's clips as the runtime binds them: a later file's clip replaces an earlier one of the same name.
      const want = new Map<string, number>();
      if (donors.some(d => !fs.existsSync('public' + `/assets/fighters/${d}.glb`))) continue;
      for (const d of donors) for (const [name, seconds] of lengths(`/assets/fighters/${d}.glb`)) want.set(name, seconds);
      let checked = 0;
      for (const [name, seconds] of lengths(`/assets/fighters/${mine}.glb`)) {
        if (!want.has(name)) continue;
        expect(seconds, `${id} ${mine} ${name}`).toBeCloseTo(want.get(name)!, 3);
        checked++;
      }
      // Every clip the donor's files carry is carried (a still `down_lp` keeps a frame of its own).
      expect(checked, `${id} ${mine}`).toBe(want.size);
    }
  });
});
