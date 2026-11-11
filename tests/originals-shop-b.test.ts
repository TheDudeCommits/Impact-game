import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { FIGHTERS } from '../src/config';
import { fighterAssetPaths } from '../scripts/fighterAssets';
import { AWAKENINGS, moveFor, rushMove } from '../src/game/awakening';
import { SHOP_COMBOS } from '../src/game/combosShop';
import { ITEMS } from '../src/game/economy/catalog';
import { OUTFITS } from '../src/game/economy/outfits';
import type { FighterId } from '../src/game/types';
import { displayMove } from '../src/originals/apply';
import { ORIGINALS } from '../src/originals/roster';
import { SHOP_B } from '../src/originals/shop/b';
import { bindClips } from '../src/render/Fighter';
import { isDynamicBoneName } from '../src/render/SecondaryMotion';
import { IDLE_PROFILES } from '../src/render/idle/profile';
import { commandList } from '../src/ui/commandList';
import { mangaPortrait } from '../src/ui/MangaHome';
import MOVE_ART from '../src/ui/moveArtVersions.json';
import SPRITES from '../public/assets/home/sprites/manifest.json';
import { glbJson } from './extraClips';
import { loadRig } from './rigHarness';


/** The file each original's own assets are named for. */
const OWN: Partial<Record<FighterId, RegExp>> = {
  'wuming': /\/wuming-/, jirenga: /\/gandang-/, 'jinlin': /\/jinlin-/, 'gohaku': /\/tongbi-/,
};
const CARRIED: Partial<Record<FighterId, [string[], string[]][]>> = {
  'wuming': [[['wuming-tr1'], ['wuming-sz1', 'wuming-fanim1', 'wuming-fanim2', 'wuming-fanim3', 'wuming-fanim4']]],
  jirenga: [[['gandang-tr1'], ['jirenga-sz1', 'jirenga-fanim1', 'jirenga-fanim2', 'jirenga-fanim3']]],
  'jinlin': [
    [['jinlin-tr1'], ['jinlin-sz1', 'jinlin-fanim1', 'jinlin-fanim2', 'jinlin-fanim3']],
    [['jinlin-awakened-tr1'], ['jinlin-black1', 'jinlin-black-react1', 'jinlin-fanim2', 'jinlin-fanim3']]],
  'gohaku': [[['tongbi-tr1', 'tongbi-idle1'],
    ['gohaku-sz1', 'gohaku-fanim1', 'gohaku-fanim2', 'gohaku-fanim3', 'gohaku-fanim4', 'gohaku-idle1']]],
};
const IDS = Object.keys(SHOP_B) as FighterId[];
const files = (id: FighterId) => {
  const f = FIGHTERS[id];
  return [f.model, f.portrait, f.rushModel, ...(f.extraModels ?? []), IDLE_PROFILES[id]?.model, f.formModel].filter((file): file is string => !!file);
};

afterEach(() => vi.restoreAllMocks());

describe("team B's originals (the Last Sun)", () => {

  it('draw only their own bodies, clips, idles, forms and portraits, and every one of them ships', () => {
    for (const id of IDS) {
      for (const file of files(id)) {
        expect(file, id).toMatch(OWN[id]!);
        expect(fs.existsSync(`public${file}`), file).toBe(true);
      }
      for (const path of fighterAssetPaths(FIGHTERS[id])) expect(`/${path}`, id).toMatch(OWN[id]!);
      expect(FIGHTERS[id].formExtraModels, id).toBeUndefined();
    }
  });



  it('show their own 2D art once it is laid out, each sheet fetched by its own bytes', () => {
    const sha = (file: string) => createHash('sha256').update(fs.readFileSync(`public/assets/${file}`)).digest('hex');
    for (const id of IDS.filter(i => SHOP_B[i]!.homeArt)) {
      expect(mangaPortrait(id), id).not.toContain('manga-home');
      const sheet = SPRITES.fighters.find(f => f.id === id) as { file: string; poster: string; sha256?: string; posterSha256?: string };
      expect([sheet.sha256, sheet.posterSha256], id).toEqual([sha(`home/sprites/${sheet.file}`), sha(`home/sprites/${sheet.poster}`)]);
      expect(MOVE_ART[id as keyof typeof MOVE_ART], id).toBe(sha(`ui/moves/${id}.webp`).slice(0, 12));
    }
  });

  it('carry every clip from beside the body, on the body\'s own joints', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const id of IDS) {
      const body = await loadRig(FIGHTERS[id].model);
      for (const url of [FIGHTERS[id].rushModel, ...(FIGHTERS[id].extraModels ?? []), IDLE_PROFILES[id]?.model].filter((u): u is string => !!u)) {
        const clips = (await loadRig(url)).animations, bound = bindClips(body.scene, clips, id);
        expect(bound.map(c => c.name), url).toEqual(clips.map(c => c.name));
      }
      // The slot's own clip names, every one on the body: its moves, its rush stages, its awakening and its idle.
      const names = new Set(body.animations.map(c => c.name));
      const slot = FIGHTERS[id] as { clips?: string[]; rushClips?: string[] };
      for (const clip of [...(slot.clips ?? []), ...(slot.rushClips ?? []), ...(AWAKENINGS[id].clips ?? []).filter(c => c !== '_Idle'), '_Idle', 'Run', 'Block', 'Hit 01', 'down_lp'])
        expect(names.has(clip), `${id} ${clip}`).toBe(true);
    }
    expect(warn).not.toHaveBeenCalled();
  });


  it('key every joint the transfer moves in every clip, so the renderer\'s layers never pile up on a stale pose', () => {
    const CORE = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder',
      'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];
    for (const id of IDS) for (const file of files(id).filter(f => f.endsWith('.glb'))) {
      const json = glbJson(file);
      const present = json.nodes.map((n, i) => [n.name ?? '', i] as const).filter(([n]) => CORE.includes(n));
      for (const clip of json.animations ?? []) {
        const keyed = new Set(clip.channels.filter(c => c.target.path === 'rotation').map(c => c.target.node));
        expect(present.filter(([, i]) => !keyed.has(i)).map(([n]) => n), `${file} ${clip.name}`).toEqual([]);
      }
    }
  });

  it('keep each carried clip at its donor\'s length, so every contact lands where the donor\'s did', () => {
    const lengths = (file: string) => {
      const json = glbJson(file) as unknown as { animations?: { name: string; samplers: { input: number }[] }[]; accessors: { max?: number[] }[] };
      return new Map((json.animations ?? []).map(a => [a.name, Math.max(...a.samplers.map(s => json.accessors[s.input].max![0]))]));
    };
    for (const id of IDS) for (const [mine, donors] of CARRIED[id]!) {
      const want = new Map<string, number>();
      if (donors.some(d => !fs.existsSync('public' + `/assets/fighters/${d}.glb`))) continue;
      for (const d of donors) for (const [name, seconds] of lengths(`/assets/fighters/${d}.glb`)) want.set(name, seconds);
      let checked = 0;
      for (const m of mine) for (const [name, seconds] of lengths(`/assets/fighters/${m}.glb`)) {
        if (!want.has(name)) continue;
        expect(seconds, `${id} ${m} ${name}`).toBeCloseTo(want.get(name)!, 3);
        checked++;
      }
      // Every clip of the slot's set: the body's twenty-odd.
      expect(checked, `${id} ${mine}`).toBeGreaterThan(20);
    }
  });

  it('wear the crown tint on dark hair over the head, where the slot awakens by it', async () => {
    // Fighter.ts crownWeight: the hair above the head joint, skinned to it, is what Wuming's LOTUS IN FLAME turns pink.
    for (const id of IDS.filter(i => AWAKENINGS[i].hair !== undefined)) {
      const rig = await loadRig(FIGHTERS[id].model);
      let head = 0, crown = 0;
      rig.scene.updateMatrixWorld(true);
      rig.scene.traverse(o => { if ((o as THREE.Bone).isBone && o.name === 'Head') head = o.getWorldPosition(new THREE.Vector3()).y; });
      rig.scene.traverse(o => {
        const mesh = o as THREE.SkinnedMesh;
        if (!mesh.isSkinnedMesh) return;
        const position = mesh.geometry.getAttribute('position');
        const index = mesh.skeleton.bones.findIndex(b => b.name === 'Head');
        const joints = mesh.geometry.getAttribute('skinIndex'), weights = mesh.geometry.getAttribute('skinWeight');
        for (let i = 0; i < position.count; i++) {
          if (position.getY(i) < head + .03) continue;
          let w = 0;
          for (let k = 0; k < 4; k++) if (joints.getComponent(i, k) === index) w += weights.getComponent(i, k);
          if (w > .5) crown++;
        }
      });
      expect(crown, id).toBeGreaterThan(80);
    }
  });


});
