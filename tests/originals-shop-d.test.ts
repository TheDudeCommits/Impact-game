import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FIGHTERS } from '../src/config';
import { fighterAssetPaths } from '../scripts/fighterAssets';
import { AWAKENINGS, moveFor, rushMove } from '../src/game/awakening';
import { COMBO_KEYS, comboMove } from '../src/game/combos';
import { ITEMS } from '../src/game/economy/catalog';
import { OUTFITS } from '../src/game/economy/outfits';
import { MOVES } from '../src/game/moves';
import type { FighterId } from '../src/game/types';
import { displayMove } from '../src/originals/apply';
import { ORIGINALS, ORIGINAL_IDS } from '../src/originals/roster';
import { SHOP_D } from '../src/originals/shop/d';
import { bindClips } from '../src/render/Fighter';
import { IDLE_PROFILES } from '../src/render/idle/profile';
import { commandList } from '../src/ui/commandList';
import { mangaPortrait } from '../src/ui/MangaHome';
import MOVE_ART from '../src/ui/moveArtVersions.json';
import SPRITES from '../public/assets/home/sprites/manifest.json';
import { glbJson } from './extraClips';
import { loadRig } from './rigHarness';


interface Spec {
  name: string; series: string; awakening: string;
  /** The file names its own assets carry. */
  own: RegExp;
  /** Its files and its donors', in merge order (build_d.sh), base and form. */
  carried: [string[], string[]][];
  clips: string[];
  /** Held blades: file, bone, hand, mesh node. */
  blades?: [string, string, string, string][];
  /** Files whose long coat hangs on Detail_CLOTH_Coat chains. */
  coats?: string[];
  /** Joints of its own the body must have, each under the one named: [joint, parent]. */
  joints?: [string, string][];
}

const F = '/assets/fighters/';
const SPECS: Partial<Record<FighterId, Spec>> = {
  vesper: {
    name: 'Vesper', series: 'Grave Hound', awakening: 'BLACK VESPERS', own: /\/vesper-/,
    carried: [
      [['vesper-tr1', 'vesper-idle1'], ['vesper-mx3', 'vesper-fanim1', 'vesper-fanim2', 'vesper-fanim3', 'vesper-fanim4', 'vesper-fanim5', 'vesper-idle1']],
      [['vesper-awakened-tr1'], ['vesper-black-vespers-mx2', 'vesper-black-vespers-react1', 'vesper-black-vespers-fanim1', 'vesper-black-vespers-fanim2']],
    ],
    clips: ['Pale Lance', 'victory_in', 'victory_lp', 'down_lp', 'Feather Slash', 'Reverse Quill', 'Updraft', 'awaken-black-vespers'],
    blades: [[F + 'vesper-tr1.glb', 'weapon_sabre_R', 'RightHand', 'weapon_sabre_hand_R']],
    coats: [F + 'vesper-tr1.glb'],
  },
  imago: {
    name: 'Imago', series: 'Salvage Wilds', awakening: 'SWARM ASCENDANT', own: /\/imago-/,
    carried: [[['imago-tr1', 'imago-idle1'], ['imago-mx2', 'imago-fanim1', 'imago-fanim3', 'imago-idle2']]],
    clips: ['Hive Burst', 'down_lp', 'Chitin Jab', 'Mantis Hook', 'Rising Barb', 'Stinger Storm', 'awaken-swarm'],
    coats: [F + 'imago-tr1.glb'],
    // The tail, on the King's joints (round 5: his own modelled tail, hung on them by scripts/originals/shop/tail_r5.py): sprung by the slot's profile.
    joints: [['Tail', 'Hips'], ['Detail_BONE_Tail1', 'Tail'], ['Detail_BONE_Tail2', 'Detail_BONE_Tail1'], ['Detail_BONE_Tail3', 'Detail_BONE_Tail2'],
      ['Detail_BONE_Tail4', 'Detail_BONE_Tail3'], ['Detail_BONE_Tail5', 'Detail_BONE_Tail4']],
  },
  gaku: {
    name: 'Gaku', series: 'Salvage Wilds', awakening: 'KOMAINU', own: /\/gaku-/,
    carried: [
      [['gaku-tr1', 'gaku-idle1'], ['gaku-mx1', 'gaku-fanim1', 'gaku-fanim3', 'gaku-idle1']],
      [['gaku-awakened-tr1'], ['gaku-adult-mx1', 'gaku-adult-react1', 'gaku-adult-fanim1']],
    ],
    clips: ['down_lp', 'Cub Jab', 'Scav Kick', 'Rising Paw', 'awaken-gaku'],
  },
  levin: {
    name: 'Levin', series: 'Ropewalk', awakening: 'KEPPEKI', own: /\/levin-/,
    carried: [[['levin-tr1'], ['levin-ao1', 'levin-fanim1', 'levin-fanim2', 'levin-fanim3']]],
    clips: ['Fuse Lance', 'down_lp', 'Nick', 'Heel Tap', 'Lift Off', 'Crosshatch', 'awaken-captain'],
    // His two short swords (5 November 2026: shop/build_levin.sh recipe_levin, shop/levin_sword.py), each on its own bone under
    // its hand. (No long coat since then: his ivory half-cloak hangs on chains from his left shoulder, shop/cape_chains_r6.py.)
    blades: [[F + 'levin-tr1.glb', 'weapon_blade_R', 'RightHand', 'weapon_blade_hand_R'], [F + 'levin-tr1.glb', 'weapon_blade_L', 'LeftHand', 'weapon_blade_hand_L']],
    joints: [['Detail_CLOTH_Cape_0_0', 'Spine2'], ['Detail_CLOTH_Cape_1_0', 'Spine2'], ['Detail_CLOTH_Cape_2_0', 'Spine2']],
  },
};
const GLYPH: Partial<Record<FighterId, string>> = { vesper: '鴉', imago: '蟲', gaku: '獅', levin: '掃' };
const FORM_CLIPS: Partial<Record<FighterId, string[]>> = {
  vesper: ['Feather Slash', 'Reverse Quill', 'Updraft', 'Pale Lance', 'down_lp', 'awaken-black-vespers'],
  gaku: ['down_lp', 'jump', 'Jump Fall', 'Block', 'Lion Fist', 'awaken-gaku'],
};

const IDS = (Object.keys(SHOP_D) as FighterId[]).filter(id => SPECS[id]);
const spec = (id: FighterId) => SPECS[id]!;
const lengths = (file: string) => {
  const json = glbJson(file) as unknown as { animations?: { name: string; samplers: { input: number }[] }[]; accessors: { max?: number[] }[] };
  return new Map((json.animations ?? []).map(a => [a.name, Math.max(...a.samplers.map(s => json.accessors[s.input].max![0]))]));
};

afterEach(() => vi.restoreAllMocks());

describe('team D\'s shop originals', () => {
  it('are the shop\'s originals in their slots, each under its own name and series', () => {
    expect(IDS.length).toBeGreaterThan(0);
    for (const id of Object.keys(SHOP_D) as FighterId[]) expect(SPECS[id], `${id} has no spec here`).toBeDefined();
    for (const id of IDS) {
      expect(ORIGINAL_IDS, id).toContain(id);
      expect([FIGHTERS[id].name, FIGHTERS[id].series], id).toEqual([spec(id).name, spec(id).series]);
      expect((FIGHTERS[id] as { normalization?: unknown }).normalization, id).toBeUndefined();
    }
  });

  it('draw only their own bodies, clips, idles and portraits, and every one of them ships', () => {
    for (const id of IDS) {
      const f = FIGHTERS[id];
      const files = [f.model, f.portrait, f.rushModel, ...(f.extraModels ?? []), IDLE_PROFILES[id]?.model, f.formModel]
        .filter((file): file is string => !!file);
      for (const file of files) {
        expect(file, id).toMatch(spec(id).own);
        expect(fs.existsSync(`public${file}`), file).toBe(true);
      }
      // The packager ships every /assets/ path a definition names (scripts/fighterAssets.ts).
      for (const path of fighterAssetPaths(f)) expect(`/${path}`, id).toMatch(spec(id).own);
    }
  });

  it('swap in their own awakened bodies, which carry their forms\' takes themselves', () => {
    for (const id of IDS) {
      const f = FIGHTERS[id];
      expect(f.formExtraModels, id).toBeUndefined();
      if (AWAKENINGS[id].kind !== 'form') { expect(f.formModel, id).toBeUndefined(); continue; }
      expect(f.formModel, id).toMatch(spec(id).own);
      const names = new Set((glbJson(f.formModel!).animations ?? []).map(a => a.name));
      for (const clip of FORM_CLIPS[id] ?? []) expect(names.has(clip), `${id} form ${clip}`).toBe(true);
    }
  });

  it('show their own 2D art once it is laid out, each sheet fetched by its own bytes', () => {
    // The home figure, the portrait every HUD face is cut from, the pose sheet and the move cards are replaced in place
    // (scripts/originals/prepare_*.py from the artworks agent's set): the sheets go out as `?v=<hash>`, cached a year.
    const sha = (file: string) => createHash('sha256').update(fs.readFileSync(`public/assets/${file}`)).digest('hex');
    for (const id of IDS.filter(id => ORIGINALS[id]!.homeArt)) {
      expect(mangaPortrait(id), id).not.toContain('manga-home');
      for (const file of [`home/fighters/${id}.webp`, `home/portraits/${id}.webp`]) expect(fs.existsSync(`public/assets/${file}`), file).toBe(true);
      const sheet = SPRITES.fighters.find(f => f.id === id) as { file: string; poster: string; sha256?: string; posterSha256?: string };
      expect([sheet.sha256, sheet.posterSha256], id).toEqual([sha(`home/sprites/${sheet.file}`), sha(`home/sprites/${sheet.poster}`)]);
      expect(MOVE_ART[id as keyof typeof MOVE_ART], id).toBe(sha(`ui/moves/${id}.webp`).slice(0, 12));
    }
  });





  it('carry their blades in their own hands, through every clip', () => {
    // scripts/originals/retarget_prop.py: the renderer reads a weapon_*hand mesh rigid on a bone under a hand as held steel.
    for (const id of IDS) for (const [file, boneName, handName, meshName] of spec(id).blades ?? []) {
      const json = glbJson(file);
      const bone = json.nodes.findIndex(n => n.name === boneName), hand = json.nodes.findIndex(n => n.name === handName);
      expect(bone, `${file} ${boneName}`).toBeGreaterThan(-1);
      expect(json.nodes[hand].children ?? [], `${file} ${boneName}`).toContain(bone);
      expect(json.nodes.some(n => n.name === meshName), `${file} ${meshName}`).toBe(true);
      const keyed = (json.animations ?? []).filter(a => a.channels.some(c => c.target.node === bone)).length;
      expect(keyed, `${file} ${boneName}`).toBeGreaterThan(15);
    }
  });

  it('grow the joints of their own their bodies need, each where it hangs', () => {
    for (const id of IDS) for (const [joint, parent] of spec(id).joints ?? []) {
      const json = glbJson(FIGHTERS[id].model);
      const at = json.nodes.findIndex(n => n.name === joint), up = json.nodes.findIndex(n => n.name === parent);
      expect(at, `${id} ${joint}`).toBeGreaterThan(-1);
      expect(json.nodes[up]?.children ?? [], `${id} ${joint} under ${parent}`).toContain(at);
    }
  });

  it('hang their long coats on spring chains off the hips, which no clip keys', () => {
    for (const id of IDS) for (const file of spec(id).coats ?? []) {
      const json = glbJson(file);
      const chains = json.nodes.map((n, i) => [n.name ?? '', i] as const).filter(([n]) => n.startsWith('Detail_CLOTH_Coat_'));
      expect(chains.length, file).toBeGreaterThanOrEqual(12);
      const hips = json.nodes.findIndex(n => n.name === 'Hips');
      for (const [, root] of chains.filter(([n]) => n.endsWith('_0'))) expect(json.nodes[hips].children ?? [], file).toContain(root);
      expect(ORIGINALS[id]!.coat, id).toBeDefined();
    }
  });

  it('bind every clip file beside the body onto its own joints', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const id of IDS) {
      const f = FIGHTERS[id];
      const body = await loadRig(f.model);
      for (const url of [f.rushModel, ...(f.extraModels ?? []), IDLE_PROFILES[id]?.model].filter((x): x is string => !!x)) {
        const clips = (await loadRig(url)).animations, bound = bindClips(body.scene, clips, id);
        expect(bound.map(c => c.name), url).toEqual(clips.map(c => c.name));
        bound.forEach((clip, i) => expect(clip.tracks.length, `${url} ${clip.name}`).toBe(clips[i].tracks.length));
      }
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it('key every joint the transfer moves in every clip', () => {
    // scripts/originals/hold_still.py: a joint no playing clip keys is never put back, and the hit lean compounded on it.
    const CORE = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder',
      'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];
    for (const id of IDS) for (const file of [FIGHTERS[id].model, FIGHTERS[id].rushModel, ...(FIGHTERS[id].extraModels ?? []), IDLE_PROFILES[id]?.model, FIGHTERS[id].formModel].filter((f): f is string => !!f)) {
      const json = glbJson(file);
      const present = json.nodes.map((n, i) => [n.name ?? '', i] as const).filter(([n]) => CORE.includes(n));
      for (const clip of json.animations ?? []) {
        const keyed = new Set(clip.channels.filter(c => c.target.path === 'rotation').map(c => c.target.node));
        expect(present.filter(([, i]) => !keyed.has(i)).map(([n]) => n), `${file} ${clip.name}`).toEqual([]);
      }
    }
  });

  it('keep each carried clip at its donor\'s length, so every contact lands where the donor\'s did', () => {
    for (const id of IDS) for (const [mine, donors] of spec(id).carried) {
      const want = new Map<string, number>();
      if (donors.some(d => !fs.existsSync('public' + `${F}${d}.glb`))) continue;
      for (const d of donors) for (const [name, seconds] of lengths(`${F}${d}.glb`)) want.set(name, seconds);
      let checked = 0;
      for (const m of mine) for (const [name, seconds] of lengths(`${F}${m}.glb`)) {
        if (!want.has(name)) continue;
        expect(seconds, `${id} ${m} ${name}`).toBeCloseTo(want.get(name)!, 3);
        checked++;
      }
      expect(checked, `${id} ${mine[0]}`).toBeGreaterThan(mine.length > 1 ? 20 : 10);
    }
  });
});
