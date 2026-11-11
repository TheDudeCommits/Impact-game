import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { FIGHTERS } from '../src/config';
import { fighterAssetPaths } from '../scripts/fighterAssets';
import { AUDIO_CUES } from '../src/audio/cuePlan';
import { HOME_MUSIC_IDS, MUSIC_TRACKS, selectMusicTracks } from '../src/audio/musicTracks';
import { AWAKENINGS, moveFor } from '../src/game/awakening';
import { displayMove } from '../src/originals/apply';
import { ITEMS } from '../src/game/economy/catalog';
import { OUTFITS } from '../src/game/economy/outfits';
import type { FighterId } from '../src/game/types';
import { ORIGINALS, ORIGINAL_IDS as EVERY_ORIGINAL } from '../src/originals/roster';
import { ORIGINAL_HOME, ORIGINAL_SCORE, SOUNDTRACK } from '../src/originals/score';
import VOICES from '../src/originals/voices.json';
/** Efforts recorded longer than their line's max, by cue (none now). */
const OVER_MAX: { lines: Record<string, number> } = { lines: {} };
import { SHOP_R6P } from '../src/originals/shop/r6p';
import { SHOP_R6B } from '../src/originals/shop/r6b';
import { Fighter, bindClips } from '../src/render/Fighter';
import { IDLE_PROFILES } from '../src/render/idle/profile';
import { RAKSHASA_ASSET } from '../src/render/signature/ThreeBlade';
import { GUARDIAN_ASSET } from '../src/render/signature/GuardianShell';
import { KNIFE_ASSET, SPIRIT_CALLERS, SWORD_SPIRIT_ASSETS } from '../src/render/SwordSpiritEffects';
import { commandList } from '../src/ui/commandList';
import { mangaPortrait } from '../src/ui/MangaHome';
import MOVE_ART from '../src/ui/moveArtVersions.json';
import SPRITES from '../public/assets/home/sprites/manifest.json';
import { glbJson } from './extraClips';
import { base, loadRig } from './rigHarness';


const ORIGINAL_IDS = EVERY_ORIGINAL.filter(id => ['taisei', 'konta', 'gummy', 'nigo', 'ouga', 'shirokane', 'shiden', 'kenzo', 'kosho', 'kagari', 'ward', 'koko', 'oro', 'kuon', 'gaunt', 'setsu'].includes(id));
/** The file each original's own assets are named for. */
const OWN: Record<string, RegExp> = { taisei: /\/wukong-/, konta: /\/(konta|homura)-px/, gummy: /\/(lucy|sunrise)-px/, nigo: /\/nigo-/,
  ouga: /\/ouga-px/, shirokane: /\/shirokane-/, shiden: /\/shiden-/, kenzo: /\/kenzo-/, kosho: /\/kosho-px/, kagari: /\/kagari-px/, ward: /\/ward-/,
  koko: /\/koko-/, oro: /\/oro-/, kuon: /\/kuon-px/, gaunt: /\/gaunt-/, setsu: /\/setsu-/ };

afterEach(() => vi.restoreAllMocks());

describe('the originals', () => {
  it('draw only their own bodies, clips, idles and portraits, and every one of them ships', () => {
    for (const id of ORIGINAL_IDS) {
      const f = FIGHTERS[id];
      const files = [f.model, f.portrait, f.rushModel, ...(f.extraModels ?? []), IDLE_PROFILES[id]?.model, f.formModel]
        .filter((file): file is string => !!file);
      for (const file of files) {
        expect(file, id).toMatch(OWN[id]);
        expect(fs.existsSync(`public${file}`), file).toBe(true);
      }
    }
  });


  it('show their own 2D art, each sheet fetched by its own bytes', () => {
    const sha = (file: string) => createHash('sha256').update(fs.readFileSync(`public/assets/${file}`)).digest('hex');
    for (const id of ORIGINAL_IDS) {
      expect(ORIGINALS[id]!.homeArt, id).toBe(true);
      expect(mangaPortrait(id), id).not.toContain('manga-home');
      for (const file of [`home/fighters/${id}.webp`, `home/portraits/${id}.webp`]) expect(fs.existsSync(`public/assets/${file}`), file).toBe(true);
      const sheet = SPRITES.fighters.find(f => f.id === id) as { file: string; poster: string; sha256?: string; posterSha256?: string };
      expect([sheet.sha256, sheet.posterSha256], id).toEqual([sha(`home/sprites/${sheet.file}`), sha(`home/sprites/${sheet.poster}`)]);
      expect(MOVE_ART[id as keyof typeof MOVE_ART], id).toBe(sha(`ui/moves/${id}.webp`).slice(0, 12));
    }
  });

  it('carry their blades in their own hands (and teeth), through every clip', () => {
    // The renderer reads a weapon_*hand mesh rigid on a bone under a hand as held steel.
    const blades: [string, string, string, string][] = [
      [FIGHTERS.nigo.model, 'weapon_cleaver_R', 'RightHand', 'weapon_cleaver_hand_R'], [FIGHTERS.nigo.formModel!, 'weapon_cleaver_R', 'RightHand', 'weapon_cleaver_hand_R'],
      [FIGHTERS.shiden.model, 'weapon_katana_R', 'RightHand', 'weapon_katana_hand_R'],
      [FIGHTERS.shirokane.model, 'prop_kunai_R', 'RightHand', 'shirokane_equipment-held_kunai'],
      [FIGHTERS.ward.model, 'weapon_nodachi_R', 'RightHand', 'weapon_nodachi_hand_R'],
      [FIGHTERS.gaunt.model, 'weapon_slab_R', 'RightHand', 'weapon_slab_hand_R'], [FIGHTERS.gaunt.formModel!, 'weapon_slab_R', 'RightHand', 'weapon_slab_hand_R'],
      // Kenzo fights with two (his redesign took the third, in his teeth, away).
      ...[FIGHTERS.kenzo.model, FIGHTERS.kenzo.formModel!].flatMap(file => [[file, 'weapon_katana_R', 'RightHand', 'weapon_katana_hand_R'],
        [file, 'weapon_katana_L', 'LeftHand', 'weapon_katana_hand_L']] as [string, string, string, string][]),
    ];
    for (const file of [FIGHTERS.kenzo.model, FIGHTERS.kenzo.formModel!]) {
      expect((glbJson(file) as unknown as { nodes: { name?: string }[] }).nodes.some(n => /mouth/.test(n.name ?? '')), `${file}: no blade in his teeth`).toBe(false);
    }
    for (const [file, boneName, handName, meshName] of blades) {
      const json = glbJson(file) as unknown as { nodes: { name?: string; children?: number[] }[]; meshes: { name?: string }[]; animations?: { name: string; channels: { target: { node: number } }[] }[] };
      const bone = json.nodes.findIndex(n => n.name === boneName);
      const hand = json.nodes.findIndex(n => n.name === handName);
      expect(bone, `${file} ${boneName}`).toBeGreaterThan(-1);
      expect(json.nodes[hand].children ?? [], `${file} ${boneName}`).toContain(bone);
      // The node is the object the renderer names (three.js takes a mesh's name from its node).
      expect(json.nodes.some(n => n.name === meshName), `${file} ${meshName}`).toBe(true);
      const keyed = (json.animations ?? []).filter(a => a.channels.some(c => c.target.node === bone)).length;
      expect(keyed, `${file} ${boneName}`).toBeGreaterThan(15);
    }
  });

  it('name no borrowed file anywhere in their definitions, under any field', () => {
    // The packager ships every /assets/ path a definition names (scripts/fighterAssets.ts), and the game loads them.
    for (const id of ORIGINAL_IDS) for (const path of fighterAssetPaths(FIGHTERS[id])) expect(`/${path}`, id).toMatch(OWN[id]);
  });









  it('hang their long coats on spring chains off the hips, never keyed, which the solver swings', async () => {
    const coats: [FighterId, string][] = [['konta', FIGHTERS.konta.model],
      ['nigo', FIGHTERS.nigo.model], ['nigo', FIGHTERS.nigo.formModel!],
      ...(['shirokane', 'shiden', 'kenzo', 'ward', 'koko', 'kuon', 'gaunt'] as const).map(id => [id, FIGHTERS[id].model] as [FighterId, string]),
      ['kenzo', FIGHTERS.kenzo.formModel!], ['gaunt', FIGHTERS.gaunt.formModel!]];
    for (const [id, file] of coats) {
      const json = glbJson(file);
      const chains = json.nodes.map((n, i) => [n.name ?? '', i] as const).filter(([n]) => n.startsWith('Detail_CLOTH_Coat_'));
      expect(chains.length, file).toBeGreaterThanOrEqual(12);
      const hips = json.nodes.findIndex(n => n.name === 'Hips');
      for (const [, root] of chains.filter(([n]) => n.endsWith('_0'))) expect(json.nodes[hips].children ?? [], file).toContain(root);
      // Never moved by a clip: a link a clip keys (a resampling export keys the roots' scale) holds its rest throughout.
      const keyed = (json.animations ?? []).flatMap(a => a.channels.filter(c => chains.some(([, i]) => i === c.target.node)).map(c => ({ a, c })));
      const rig = await loadRig(file);
      for (const { a, c } of keyed) {
        const clip = rig.animations.find(k => k.name === a.name)!, name = json.nodes[c.target.node].name!;
        const track = clip.tracks.find(t => t.name === `${name}.${c.target.path === 'rotation' ? 'quaternion' : c.target.path === 'translation' ? 'position' : 'scale'}`)!;
        const rest = rig.scene.getObjectByName(name)!, at = c.target.path === 'rotation' ? rest.quaternion.toArray() : c.target.path === 'translation' ? rest.position.toArray() : rest.scale.toArray();
        for (let k = 0; k < track.values.length; k++) expect(Math.abs(Math.abs(track.values[k]) - Math.abs(at[k % at.length])), `${file} ${a.name} moves ${name}`).toBeLessThan(1e-4);
      }
      const fighter = new Fighter(base(id), rig);
      // (kenzo-build: Kenzo's base body springs his beard's three chains too, Detail_CLOTH_Beard_*: tests/originals-kenzo-beard.test.ts.)
      const beard = json.nodes.filter(n => /^Detail_CLOTH_Beard_/.test(n.name ?? '')).length;
      try { expect(fighter.motionEvidence().springBones, file).toBe(chains.length + beard); } finally { fighter.dispose(); }
    }
  });

  it('carry every clip from beside the body with its travel, on the body\'s own joints', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const id of ORIGINAL_IDS) {
      const body = await loadRig(FIGHTERS[id].model);
      for (const url of [FIGHTERS[id].rushModel!, ...(FIGHTERS[id].extraModels ?? [])]) {
        const clips = (await loadRig(url)).animations, bound = bindClips(body.scene, clips, id);
        expect(bound.map(c => c.name), url).toEqual(clips.map(c => c.name));
        bound.forEach((clip, i) => expect(clip.tracks.length, `${url} ${clip.name}`).toBe(clips[i].tracks.length));
      }
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it('key every joint the transfer moves in every clip, so the renderer\'s layers never pile up on a stale pose', () => {
    // A joint no playing clip keys is never put back, and the hit lean compounded on it.
    const CORE = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder',
      'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];
    for (const id of ORIGINAL_IDS) for (const file of [FIGHTERS[id].model, FIGHTERS[id].rushModel, ...(FIGHTERS[id].extraModels ?? []), FIGHTERS[id].formModel].filter((f): f is string => !!f)) {
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
    // As scripts/originals/build_fighter.sh carries them: each original's files, and its donor's in merge order.
    const pairs: [FighterId, string[], string[]][] = [
      ['taisei', ['wukong-tr1', 'wukong-rush1', 'wukong-transmission1', 'wukong-awaken1', 'wukong-idle1', 'wukong-enders1', 'wukong-enders2', 'wukong-hurts1'],
        ['taisei-sz1', 'taisei-rush1', 'taisei-transmission1', 'taisei-awaken1', 'taisei-idle1', 'taisei-enders1', 'taisei-enders2', 'taisei-fanim1', 'taisei-fanim2', 'taisei-fanim3', 'taisei-fanim4', 'taisei-fanim5', 'taisei-fanim6', 'taisei-fanim7', 'taisei-fanim8', 'taisei-fanim9']],
      ['konta', ['konta-px1', 'konta-pxrush1', 'konta-pxenders1', 'konta-pxidle1'], ['konta-adult4', 'konta-rush2', 'konta-takes1', 'konta-idle2']],
      ['gummy', ['lucy-px1', 'lucy-pxrush1', 'lucy-pxenders1', 'lucy-pxenders2', 'lucy-pxidleb1'], ['gummy-br2', 'gummy-rush1', 'gummy-enders1', 'gummy-enders2', 'gummy-idleb1', 'gummy-fanim1', 'gummy-r5-moves1', 'gummy-fanim2', 'gummy-fanim3', 'gummy-fanim4']],
      ['gummy', ['sunrise-px1', 'sunrise-pxmoves1', 'sunrise-pxreact1'], ['gummy-daybreak-br1', 'gummy-r5-g5moves1', 'gummy-g5react1']],
      ['konta', ['homura-px1'], ['kurobi-no2']],
      ['nigo', ['nigo-awakened-tr1'], ['nightfall-bl2', 'nigo-nightfall-react1', 'nigo-nightfall-fanim1']],
      // Round 3.
      ['ouga', ['ouga-px1', 'ouga-pxrush1', 'ouga-pxstraight1', 'ouga-pxawaken1', 'ouga-pxenders1', 'ouga-pxidle1'],
        ['ouga-combat1', 'ouga-rush1', 'ouga-straight1', 'ouga-awaken1', 'ouga-enders1', 'ouga-fanim1', 'ouga-fanim2', 'ouga-fanim3', 'ouga-fanim4', 'ouga-fanim5', 'ouga-fanim6', 'ouga-idle1']],
      ['shirokane', ['shirokane-tr1', 'shirokane-rush1', 'shirokane-enders1', 'shirokane-idle1'],
        ['shirokane-combat2', 'shirokane-rush1', 'shirokane-enders1', 'shirokane-fanim1', 'shirokane-fanim2', 'shirokane-fanim3', 'shirokane-fanim4', 'shirokane-fanim5', 'shirokane-idle1']],
      ['shiden', ['shiden-tr1', 'shiden-rush1', 'shiden-enders1', 'shiden-idle1'],
        ['shiden-arp1', 'shiden-rush1', 'shiden-enders1', 'shiden-fanim1', 'shiden-fanim2', 'shiden-fanim3', 'shiden-fanim4', 'shiden-fanim5', 'shiden-fanim6', 'shiden-idle1']],
      ['kenzo', ['kenzo-tr1', 'kenzo-rush1', 'kenzo-enders1', 'kenzo-enders2', 'kenzo-idleb1'],
        ['kenzo-br3', 'kenzo-rush1', 'kenzo-enders1', 'kenzo-enders2', 'kenzo-fanim1', 'kenzo-fanim2', 'kenzo-fanim3', 'kenzo-fanim4', 'kenzo-idleb1']],
      ['kenzo', ['kenzo-awakened-tr1'], ['kenzo-rakshasa-br1', 'kenzo-rakshasa-react1']],
      ['kosho', ['kosho-px1', 'kosho-pxrush1', 'kosho-pxenders1', 'kosho-pxfmoves1', 'kosho-pxidleb1'],
        ['kosho-br2', 'kosho-rush1', 'kosho-enders1', 'kosho-fmoves1', 'kosho-fanim1', 'kosho-fanim2', 'kosho-fanim3', 'kosho-fanim4', 'kosho-idleb1']],
      ['kagari', ['kagari-px1', 'kagari-pxrush1', 'kagari-pxenders1', 'kagari-pxfmoves1'], ['kagari-br1', 'kagari-rush1', 'kagari-enders1', 'kagari-fmoves1', 'kagari-fanim1', 'kagari-fanim2', 'kagari-fanim3', 'kagari-fanim4']],
      ['ward', ['ward-tr1', 'ward-rush1', 'ward-enders1', 'ward-ult1'], ['ward-br1', 'ward-rush1', 'ward-enders1', 'ward-fanim1', 'ward-fanim2', 'ward-fanim3', 'ward-fanim4', 'ward-ult1']],
      ['koko', ['koko-tr1', 'koko-rush1', 'koko-enders1', 'koko-idle1'],
        ['koko-combat2', 'koko-fanim1', 'koko-fanim2', 'koko-fanim3', 'koko-fanim5', 'koko-idle1']],
      ['koko', ['koko-spirit-tr1', 'koko-spirit-fanim1'], ['iron-spirit1', 'iron-spirit-fanim1', 'koko-enders1']],
      ['oro', ['oro-tr1', 'oro-rush1', 'oro-enders1', 'oro-enders2', 'oro-idleb1'],
        ['oro-eoh1', 'oro-fanim1', 'oro-enders2', 'oro-fanim2', 'oro-fanim3', 'oro-fanim5', 'oro-idleb1']],
      ['oro', ['oro-spirit-tr1', 'oro-spirit-fanim1'], ['clock-spirit1', 'clock-spirit-fanim1', 'oro-enders1', 'oro-enders2']],
      ['kuon', ['kuon-px1', 'kuon-pxrush1', 'kuon-pxenders1', 'kuon-pxenders2', 'kuon-pxidle1'],
        ['kuon-cc1', 'kuon-rush1', 'kuon-enders1', 'kuon-enders2', 'kuon-fanim1', 'kuon-fanim2', 'kuon-fanim3', 'kuon-fanim4', 'kuon-idle1']],
      ['gaunt', ['gaunt-tr1', 'gaunt-rush1', 'gaunt-enders2', 'gaunt-idleb1'], ['gaunt-dvl1', 'gaunt-rush1', 'gaunt-fmoves1', 'gaunt-enders2', 'gaunt-fanim1', 'gaunt-fanim2', 'gaunt-fanim3', 'gaunt-idleb1']],
      ['gaunt', ['gaunt-awakened-tr1'], ['gaunt-berserker1', 'gaunt-berserker-react1', 'gaunt-fanim3']],
      ['setsu', ['setsu-tr1', 'setsu-rush1', 'setsu-enders1'], ['setsu-r3', 'setsu-enders1', 'setsu-fanim1', 'setsu-fanim2', 'setsu-fanim3', 'setsu-fanim4', 'setsu-fanim5']],
    ];
    for (const [id, mine, donors] of pairs) {
      const want = new Map<string, number>();
      if (donors.some(d => !fs.existsSync('public' + `/assets/fighters/${d}.glb`))) continue;
      for (const d of donors) for (const [name, seconds] of lengths(`/assets/fighters/${d}.glb`)) want.set(name, seconds);
      let checked = 0;
      for (const m of mine) for (const [name, seconds] of lengths(`/assets/fighters/${m}.glb`)) {
        if (!want.has(name)) continue;
        expect(seconds, `${id} ${m} ${name}`).toBeCloseTo(want.get(name)!, 3);
        checked++;
      }
      // A whole fighter's files carry dozens; a body of its own (a form, a spirit: KoKo's carries Iron Spirit's 19) fewer.
      expect(checked, id).toBeGreaterThan(mine.length > 2 ? 20 : 10);
    }
  });
});
