import fs from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FIGHTERS } from '../src/config';
import { AWAKENINGS } from '../src/game/awakening';
import { COMBO_KEYS, comboMove } from '../src/game/combos';
import { ITEMS } from '../src/game/economy/catalog';
import { MOVES, RUSH } from '../src/game/moves';
import type { FighterId } from '../src/game/types';
import { displayMove } from '../src/originals/apply';
import { ORIGINALS } from '../src/originals/roster';
import { SHOP_E } from '../src/originals/shop/e';
import { COMBO_CLIPS } from '../src/render/comboClips';
import { IDLE_PROFILES } from '../src/render/idle/profile';
import { commandList } from '../src/ui/commandList';
import { glbJson } from './extraClips';
import { loadRig } from './rigHarness';


const MINE: Record<string, { name: string; series: string; own: RegExp }> = {
  ippon: { name: 'Ippon', series: 'Blast Radius', own: /\/ippon-/ },
  sekka: { name: 'Sekka', series: 'Black Snow', own: /\/sekka-/ },
  asahi: { name: 'Asahi', series: 'Black Snow', own: /\/asahi-/ },
  'rook': { name: 'Rook', series: 'Gatefall', own: /\/rook-/ },
};
const IDS = (Object.keys(SHOP_E) as FighterId[]).filter(id => id in MINE);
const GLYPH_E: Record<string, string> = { ippon: '拳', sekka: '鬼', asahi: '旭', 'rook': '墓' };

/** Every name the slot's tables show: the four moves (awake or not), the rush stages, the combo enders, the banner. */
const tableNames = (id: FighterId) => [
  ...(['light', 'heavy', 'special', 'ultimate'] as const).map(slot => MOVES[id][slot].name),
  ...RUSH[id].map(stage => stage.name),
  ...COMBO_KEYS.map(key => comboMove(id, key)?.name).filter((name): name is string => !!name),
  AWAKENINGS[id].name,
];
const files = (id: FighterId) => [FIGHTERS[id].model, ...(FIGHTERS[id].extraModels ?? [])];
const clipLengths = (file: string) => {
  const json = glbJson(file) as unknown as { animations?: { name: string; samplers: { input: number }[] }[]; accessors: { max?: number[] }[] };
  return new Map((json.animations ?? []).map(a => [a.name, Math.max(...a.samplers.map(s => json.accessors[s.input].max![0]))]));
};

describe('team E\'s shop originals', () => {
  it('stand in their slots under their own names, in series of their own', () => {
    expect(IDS.length).toBeGreaterThan(0);
    for (const id of IDS) {
      expect([FIGHTERS[id].name, FIGHTERS[id].series], id).toEqual([MINE[id].name, MINE[id].series]);
      expect(ORIGINALS[id], id).toBe(SHOP_E[id]);
      expect(ORIGINALS[id]!.homeArt, id).toBe(true);
    }
  });

  it('draw only their own bodies, clips, idles, forms and portraits, and every one of them ships', () => {
    for (const id of IDS) {
      const f = FIGHTERS[id];
      const own = [...files(id), f.portrait, IDLE_PROFILES[id]?.model, f.formModel].filter((file): file is string => !!file);
      for (const file of own) {
        expect(file, id).toMatch(MINE[id].own);
        expect(fs.existsSync(`public${file}`), file).toBe(true);
      }
      for (const file of f.formExtraModels ?? []) { expect(file, id).toMatch(/-tr1-area1\.glb$/); expect(file, id).toMatch(MINE[id].own); }
    }
  });



  it('keep each carried clip at its donor\'s length, so every contact lands where the donor\'s did', () => {
    // As scripts/originals/shop/build_e.sh carries them: each original's files, and its donor's in merge order.
    const pairs: [FighterId, string[], string[]][] = [
      ['ippon', ['ippon-tr1', 'ippon-idle1'], ['ippon-ow1', 'ippon-fanim1', 'ippon-fanim2', 'ippon-fanim3', 'ippon-fanim4', 'ippon-idle1']],
      ['sekka', ['sekka-tr1', 'sekka-idle1'], ['sekka-hc1', 'sekka-fanim1', 'sekka-idle2']],
      ['asahi', ['asahi-tr1'], ['asahi-av1', 'asahi-fanim1', 'asahi-fanim2', 'asahi-fanim3']],
      ['rook', ['rook-tr1', 'rook-idle1'], ['rook-mx2', 'rook-fanim1', 'rook-fanim2', 'rook-fanim3', 'rook-idle1']],
      ['rook', ['rook-awakened-tr1'], ['rook-monarch-mx1', 'rook-monarch-react1', 'rook-monarch-fanim1']],
    ];
    for (const [id, mine, donors] of pairs.filter(([id]) => IDS.includes(id))) {
      const want = new Map<string, number>();
      if (donors.some(d => !fs.existsSync('public' + `/assets/fighters/${d}.glb`))) continue;
      for (const d of donors) for (const [name, seconds] of clipLengths(`/assets/fighters/${d}.glb`)) want.set(name, seconds);
      let checked = 0;
      for (const m of mine) for (const [name, seconds] of clipLengths(`/assets/fighters/${m}.glb`)) {
        if (!want.has(name)) continue;
        expect(seconds, `${id} ${m} ${name}`).toBeCloseTo(want.get(name)!, 3);
        checked++;
      }
      expect(checked, `${id} ${mine[0]}`).toBeGreaterThan(20);
    }
  });

  it('carry their own weapons in their own hands, through every clip', () => {
    // scripts/originals/retarget_prop.py: Asahi's katana on a blade bone (Fighter.ts BLADE_BONE, HELD), as Asahi's
    // rides his own; Rook's daggers on prop bones, held equipment, as Rook's are skinned to his hands.
    const held: [FighterId, (f: typeof FIGHTERS[FighterId]) => string | undefined, string, string, string][] = [
      ['asahi', f => f.model, 'weapon_katana_R', 'RightHand', 'weapon_katana_hand_R'],
      ...(['model', 'formModel'] as const).flatMap(key => [
        ['rook', (f: typeof FIGHTERS[FighterId]) => f[key], 'prop_dagger_R', 'RightHand', 'rook_equipment-held_dagger_R'],
        ['rook', (f: typeof FIGHTERS[FighterId]) => f[key], 'prop_dagger_L', 'LeftHand', 'rook_equipment-held_dagger_L']] as [FighterId, (f: typeof FIGHTERS[FighterId]) => string | undefined, string, string, string][]),
    ];
    for (const [id, pick, boneName, handName, meshName] of held.filter(([id]) => IDS.includes(id))) {
      const file = pick(FIGHTERS[id])!;
      const json = glbJson(file) as unknown as { nodes: { name?: string; children?: number[] }[]; animations?: { name: string; channels: { target: { node: number } }[] }[] };
      const bone = json.nodes.findIndex(n => n.name === boneName), hand = json.nodes.findIndex(n => n.name === handName);
      expect(bone, `${file} ${boneName}`).toBeGreaterThan(-1);
      expect(json.nodes[hand].children ?? [], `${file} ${boneName}`).toContain(bone);
      expect(json.nodes.some(n => n.name === meshName), `${file} ${meshName}`).toBe(true);
      const keyed = (json.animations ?? []).filter(a => a.channels.some(c => c.target.node === bone)).length;
      expect(keyed, `${file} ${boneName}`).toBeGreaterThan(15);
    }
  });

  it('hang their long coats on spring chains off the hips', () => {
    // scripts/originals/shop/coat_e.py (coat_chains.py): Asahi's haori, Rook's coat and the Hollow Crown's feather cloak.
    const coats: [FighterId, string | undefined][] = [['asahi', FIGHTERS.asahi.model], ['rook', FIGHTERS['rook'].model],
      ['rook', FIGHTERS['rook'].formModel]];
    for (const [id, file] of coats.filter(([id]) => IDS.includes(id))) {
      expect(ORIGINALS[id]!.coat, id).toBeDefined();
      const json = glbJson(file!);
      const chains = json.nodes.map((n, i) => [n.name ?? '', i] as const).filter(([n]) => n.startsWith('Detail_CLOTH_Coat_'));
      // Asahi's haori is open down the front, so its skirt is only the back's and sides' sectors (nine chains).
      expect(chains.length, file).toBeGreaterThanOrEqual(id === 'asahi' ? 9 : 12);
      const hips = json.nodes.findIndex(n => n.name === 'Hips');
      for (const [, root] of chains.filter(([n]) => n.endsWith('_0'))) expect(json.nodes[hips].children ?? [], file).toContain(root);
    }
  });

  const at = (model: THREE.Object3D, clip: THREE.AnimationClip, time: number) => {
    const mixer = new THREE.AnimationMixer(model), action = mixer.clipAction(clip).play();
    action.time = time; mixer.update(0); model.updateMatrixWorld(true);
    return () => { mixer.stopAllAction(); mixer.uncacheRoot(model); };
  };
  const named = (model: THREE.Object3D, name: string) => model.getObjectByName(name)!;
  const where = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());

  it('awaken as their own: Rook wakes into the Hollow Crown, a body of its own', () => {
    if (!IDS.includes('rook')) return;
    expect(AWAKENINGS['rook'].kind).toBe('form');
    expect(FIGHTERS['rook'].formModel).toBe('/assets/fighters/rook-awakened-tr1.glb');
    expect(displayMove('rook', AWAKENINGS['rook'].name)).toBe('HOLLOW CROWN');
  });
});
