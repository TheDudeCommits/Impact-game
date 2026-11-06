import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIGHTERS } from '../src/config';
import { fighterAssetPaths } from '../scripts/fighterAssets';
import { AWAKENINGS, moveFor, rushMove } from '../src/game/awakening';
import { COMBO_KEYS, comboMove } from '../src/game/combos';
import { ITEMS } from '../src/game/economy/catalog';
import { OUTFITS } from '../src/game/economy/outfits';
import { airRushName } from '../src/game/moves';
import type { FighterId } from '../src/game/types';
import { displayMove } from '../src/originals/apply';
import { ORIGINALS } from '../src/originals/roster';
import { SHOP_C } from '../src/originals/shop/c';
import { IDLE_PROFILES } from '../src/render/idle/profile';
import { NINJA_ASSETS } from '../src/render/NinjaEffects';
import { GUARDIAN_USERS, guardianAsset } from '../src/render/signature/GuardianShell';
import { commandList } from '../src/ui/commandList';
import { glbJson } from './extraClips';


const SLOTS = ['tobari', 'akagane', 'shiun', 'magatsu'] as const;
type Slot = typeof SLOTS[number];
/** The file prefix each original's own assets are named for. */
const OWN: Record<Slot, RegExp> = { tobari: /\/tobari-/, akagane: /\/akagane-/, shiun: /\/shiun-/, magatsu: /\/magatsu-/ };
const SHOWN: Record<Slot, [string, string]> = {
  tobari: ['Tobari', 'Hidden Ash'], akagane: ['Akagane', 'Hidden Ash'], shiun: ['Shiun', 'Cinder Requiem'], magatsu: ['Magatsu', 'Hex Fallout'],
};
/** All four, each in SHOP_C since its body was built (the launch gate shows a shop fighter once ORIGINALS has it). */
const MINE = SLOTS.filter(id => SHOP_C[id]);
/** The air string's three stages are every fighter's own plain words (moves.ts AIR_RUSH_NAMES), nobody's technique. */
const PLAIN = new Set(['Knee Hitch', 'Kick Loose', 'Drop Knot']);

/** Every move name the tables know for a fighter, awake or not: its four slots, its rush stages, its air string, its
 *  combo enders, and its awakening. */
function tableNames(id: FighterId) {
  const names = new Set<string>();
  for (const slot of ['light', 'heavy', 'special', 'ultimate'] as const) for (const awake of [false, true]) names.add(moveFor(id, slot, awake).name);
  for (let stage = 0; stage < 4; stage++) for (const awake of [false, true]) names.add(rushMove(id, stage, awake).name);
  for (let stage = 0; stage < 4; stage++) { const name = airRushName(id, stage); if (name) names.add(name); }
  for (const key of COMBO_KEYS) for (const awake of [false, true]) { const move = comboMove(id, key, awake); if (move) names.add(move.name); }
  names.add(AWAKENINGS[id].name);
  return [...names];
}

describe('team C\'s shop originals', () => {
  it('stand in their slots, each an original of its series', () => {
    expect(MINE).toEqual([...SLOTS]);
    for (const id of MINE) {
      expect([FIGHTERS[id].name, FIGHTERS[id].series], id).toEqual(SHOWN[id]);
      expect(ORIGINALS[id], id).toBe(SHOP_C[id]);
      expect((FIGHTERS[id] as { normalization?: unknown }).normalization, id).toBeUndefined();
      for (const file of FIGHTERS[id].formExtraModels ?? []) expect(file, id).toMatch(/^\/assets\/fighters\/[a-z]+-[a-z-]*tr1-area1\.glb$/);
    }
  });

  it('draw only their own bodies, clips, idles, portraits and forms, and every one of them ships', () => {
    for (const id of MINE) {
      const f = FIGHTERS[id];
      const files = [f.model, f.portrait, f.rushModel, ...(f.extraModels ?? []), IDLE_PROFILES[id]?.model, f.formModel].filter((file): file is string => !!file);
      for (const file of files) {
        expect(file, id).toMatch(OWN[id]);
        expect(fs.existsSync(`public${file}`), file).toBe(true);
      }
      // The packager ships every /assets/ path a definition names (scripts/fighterAssets.ts).
      for (const path of fighterAssetPaths(f)) expect(`/${path}`, id).toMatch(OWN[id]);
    }
  });




  it('carry Shiun\'s sword in his own right hand through every clip', () => {
    if (!SHOP_C.shiun) return;
    const json = glbJson(FIGHTERS.shiun.model) as unknown as { nodes: { name?: string; children?: number[] }[]; animations?: { name: string; channels: { target: { node: number } }[] }[] };
    const bone = json.nodes.findIndex(n => n.name === 'weapon_katana_R'), hand = json.nodes.findIndex(n => n.name === 'RightHand');
    expect(bone).toBeGreaterThan(-1);
    expect(json.nodes[hand].children ?? []).toContain(bone);
    expect(json.nodes.some(n => n.name === 'weapon_katana_hand_R')).toBe(true);
    expect((json.animations ?? []).filter(a => a.channels.some(c => c.target.node === bone)).length).toBeGreaterThan(15);
  });

  it('key every joint the transfer moves in every clip, so the renderer\'s layers never pile up on a stale pose', () => {
    const CORE = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder',
      'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];
    for (const id of MINE) for (const file of [FIGHTERS[id].model, ...(FIGHTERS[id].extraModels ?? []), FIGHTERS[id].formModel].filter((f): f is string => !!f)) {
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
    // As scripts/originals/shop/build_c.sh carries them: each original's files, and its donor's in merge order.
    const pairs: [Slot, string[], string[]][] = [
      ['tobari', ['tobari-tr1', 'tobari-idle1'], ['tobari-ff2', 'tobari-fanim1', 'tobari-fanim2', 'tobari-fanim3', 'tobari-idle1']],
      ['tobari', ['tobari-tengu-tr1'], ['tobari-ff2', 'tobari-fanim1', 'tobari-fanim2', 'tobari-fanim3']],
      ['akagane', ['akagane-tr1', 'akagane-idle1'], ['akagane-ff2', 'akagane-fanim1', 'akagane-fanim2', 'akagane-fanim3', 'akagane-idle1']],
      ['shiun', ['shiun-tr1'], ['shiun-hm1', 'shiun-fanim1', 'shiun-fanim2', 'shiun-fanim3']],
      ['shiun', ['shiun-awakened-tr1'], ['shiun-bb1', 'shiun-bb-react1']],
      ['magatsu', ['magatsu-tr1', 'magatsu-idle1'], ['magatsu-gm1', 'magatsu-fanim1', 'magatsu-fanim2', 'magatsu-fanim3', 'magatsu-fanim4', 'magatsu-idle1']],
      ['magatsu', ['magatsu-awakened-tr1'], ['magatsu-heian-mx1', 'magatsu-heian-react1']],
    ];
    for (const [id, mine, donors] of pairs) {
      if (!SHOP_C[id]) continue;
      const want = new Map<string, number>();
      if (donors.some(d => !fs.existsSync('public' + `/assets/fighters/${d}.glb`))) continue;
      for (const d of donors) for (const [name, seconds] of lengths(`/assets/fighters/${d}.glb`)) want.set(name, seconds);
      let checked = 0;
      for (const m of mine) for (const [name, seconds] of lengths(`/assets/fighters/${m}.glb`)) {
        if (!want.has(name)) continue;
        expect(seconds, `${id} ${m} ${name}`).toBeCloseTo(want.get(name)!, 3);
        checked++;
      }
      expect(checked, `${id} ${mine[0]}`).toBeGreaterThan(20);
    }
  });
});
