import fs from 'node:fs';
import { HOME_VOICE_OF } from '../src/originals/homeVoices';
import { describe, expect, it } from 'vitest';
import { fighterAssetPaths } from '../scripts/fighterAssets';
import { AUDIO_CUES } from '../src/audio/cuePlan';
import { FIGHTERS } from '../src/config';
import type { FighterId } from '../src/game/types';
import { AWAKENINGS, moveFor, rushMove } from '../src/game/awakening';
import { COMBO_KEYS, comboMove } from '../src/game/combos';
import { MOVES } from '../src/game/moves';
import { displayMove } from '../src/originals/apply';
import { ORIGINAL_AREAS } from '../src/originals/area';
import { ORIGINAL_EMBLEMS } from '../src/originals/emblems';
import { fighterShown } from '../src/originals/launch';
import { ORIGINALS, type OriginalFighter } from '../src/originals/roster';
import { R6P_DRAWN, R6P_HOLD, R6P_WAITING, SHOP_R6P } from '../src/originals/shop/r6p';
import VOICES from '../src/originals/voices.json';
/** Voice cues that play another cue in their place (none now). */
const STANDINS: Record<string, string> = {};
import { commandList } from '../src/ui/commandList';
import { glbJson } from './extraClips';
import { PSYCHE_PALM_SURFACES } from '../src/render/signature/PsycheBloomPose';

const ALL = { ...SHOP_R6P, ...R6P_WAITING } as Partial<Record<FighterId, OriginalFighter>>;
const entries = (table: Partial<Record<FighterId, OriginalFighter>>) =>
  Object.entries(table) as [FighterId, OriginalFighter][];
const cues = VOICES.cues as Record<string, { file: string }>;

function known(id: FighterId) {
  const names = new Set<string>();
  for (const slot of ['light', 'heavy', 'special', 'ultimate'] as const) {
    names.add(MOVES[id][slot].name);
    for (const awake of [false, true]) names.add(moveFor(id, slot, awake).name);
  }
  for (let stage = 0; stage < 3; stage++) for (const awake of [false, true]) names.add(rushMove(id, stage, awake).name);
  for (const key of COMBO_KEYS) for (const awake of [false, true]) { const move = comboMove(id, key, awake); if (move) names.add(move.name); }
  names.add(AWAKENINGS[id].name);
  return names;
}

describe("Round 6's new fighters (the Pixel port's batch)", () => {

  it('wait closed (R6P_WAITING) until their voices are routed: no table shows them', () => {
    for (const [id] of entries(R6P_WAITING)) {
      expect(ORIGINALS[id], id).toBeUndefined();
      expect(id in SHOP_R6P, id).toBe(false);
    }
  });


  it('speak, once open, every cue of their slot from their own recorded lines, with no stand-in', () => {
    for (const [id] of entries(SHOP_R6P)) {
      const mine = Object.keys(AUDIO_CUES).filter(cue => cue.startsWith(`vo-${id}-`));
      expect(mine.length, id).toBeGreaterThan(5);
      for (const cue of mine) {
        expect(cues[cue]?.file, `${id} ${cue}`).toBeTruthy();
        expect(fs.existsSync(`public/assets/audio/v2/${cues[cue].file}`), cue).toBe(true);
        expect(cue in STANDINS, `${cue} still has a stand-in`).toBe(false);
      }
      expect((VOICES.home as Record<string, unknown>)[HOME_VOICE_OF[id]], `${id} home line`).toBeDefined();
    }
  });

  it("replace the earlier effect files their slots would ship with their own (scripts/originals/pixel/make_*.py)", () => {
    type Json = { nodes: { name?: string; mesh?: number }[]; meshes: { primitives: { attributes: Record<string, number>; targets?: unknown[]; material?: number }[] }[];
      accessors: { min?: number[]; max?: number[] }[]; materials?: { pbrMetallicRoughness?: { baseColorTexture?: unknown } }[]; animations?: { name: string }[] };
    const json = (file: string) => glbJson(file) as unknown as Json;
    const bounds = (j: Json, mesh: number) => { const a = j.accessors[j.meshes[mesh].primitives[0].attributes.POSITION]; return [a.min!, a.max!]; };
    const textured = (j: Json, mesh: number) => !!j.materials?.[j.meshes[mesh].primitives[0].material ?? -1]?.pbrMetallicRoughness?.baseColorTexture;
    // Shakugo's hound (ShakugoMagma's projectile): one textured mesh, muzzle along +Z, 3 to 7 m long, centred.
    const hound = json('/assets/fighters/shakugo-hound-projectile.glb');
    expect(hound.meshes).toHaveLength(1);
    expect(hound.nodes.find(n => n.mesh === 0)?.name).toBe('Shakugo_Magma_Hound');
    expect(textured(hound, 0)).toBe(true);
    const [lo, hi] = bounds(hound, 0);
    expect(hi[2] - lo[2]).toBeGreaterThan(3); expect(hi[2] - lo[2]).toBeLessThan(7);
    for (let i = 0; i < 3; i++) expect(Math.abs(hi[i] + lo[i]) / 2).toBeLessThan(.01);
    // His meteor fist (SHAKUGO_FIST_SOURCE while he stands in the slot): the mesh, the two nodes and the clip the effect reads.
    const fist = json('/assets/fighters/shakugo-magma1.glb');
    for (const name of ['Shakugo_Magma_Left', 'LArm_Upper_Fore_Magma_038', 'LArm_Upper_Palm_Magma_041']) expect(fist.nodes.some(n => n.name === name), name).toBe(true);
    expect(fist.animations?.map(a => a.name)).toEqual(['Slag Knuckle']);
    expect(textured(fist, fist.nodes.find(n => n.name === 'Shakugo_Magma_Left')!.mesh!)).toBe(true);
    // Psyche's ghost hand (PsycheFleur's arm): the node it looks up, seven morphs, its palm where the contact table puts it.
    const arm = json('/assets/fighters/psyche-grown-arm1.glb');
    const node = arm.nodes.find(n => n.name === 'Psyche_Grown_Arm')!;
    expect(node).toBeDefined();
    expect(arm.meshes[node.mesh!].primitives[0].targets).toHaveLength(7);
    expect(textured(arm, node.mesh!)).toBe(true);
    const [alo, ahi] = bounds(arm, node.mesh!);
    const [x, y, z] = PSYCHE_PALM_SURFACES[0];
    expect(x).toBeGreaterThan(alo[0]); expect(x).toBeLessThan(ahi[0]);
    expect(Math.abs(y - ahi[1])).toBeLessThan(.02); expect(z).toBeGreaterThan(alo[2]); expect(z).toBeLessThan(ahi[2]);
  });
});
