import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COMBO_KEYS, comboMove, hasCombos } from '../src/game/combos';
import type { FighterId } from '../src/game/types';
import { COMBO_CLIPS, COMBO_FORM_CLIPS, type ComboClip } from '../src/render/comboClips';
import { FIGHTERS } from '../src/config';
import { IDLE_PROFILES } from '../src/render/idle/profile';

const VOL1: readonly FighterId[] = ['taisei', 'konta', 'gummy', 'kosho', 'ouga', 'shirokane', 'shiden', 'kenzo', 'koko', 'nigo',
  'kagari', 'ward', 'kuon', 'oro', 'gaunt', 'setsu'];

interface Gltf { nodes?: { name?: string }[]; animations?: { name: string; channels: { sampler: number; target: { node?: number } }[]; samplers: { input: number }[] }[];
  accessors: { max?: number[] }[] }
const files = new Map<string, Gltf>();
function gltf(url: string): Gltf {
  let json = files.get(url);
  if (!json) {
    const glb = fs.readFileSync(`public${url}`);
    json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString()) as Gltf;
    files.set(url, json);
  }
  return json;
}
const clipsOf = (url: string) => new Map((gltf(url).animations ?? []).map(a => [a.name,
  Math.max(...a.channels.map(c => gltf(url).accessors[a.samplers[c.sampler].input].max?.[0] ?? 0))] as const));
/** three.js's own spelling of a node in a track (PropertyBinding.sanitizeNodeName). */
const sanitized = (name = '') => name.replace(/\s/g, '_').replace(/[[\]./:]/g, '');

/** Every clip a fighter's own body plays, by name, as FighterLibrary and Fighter put them together: the body's, those of
 *  `extraModels` and the idle profile's model in turn replacing the body's of the same name, then the rush model's
 *  appended where the body has no clip of that name. */
function bodyClips(id: FighterId) {
  const def = FIGHTERS[id];
  const clips = new Map(clipsOf(def.model));
  for (const url of [...def.extraModels ?? [], IDLE_PROFILES[id]?.model]) if (url) for (const [name, length] of clipsOf(url)) clips.set(name, length);
  if (def.rushModel) for (const [name, length] of clipsOf(def.rushModel)) if (!clips.has(name)) clips.set(name, length);
  return clips;
}

function checkRow(label: string, own: ComboClip, clips: Map<string, number>, duration?: number) {
  expect(clips.has(own.clip), `${label}: no clip named ${own.clip}`).toBe(true);
  const length = clips.get(own.clip)!;
  if (own.span !== undefined) expect(Math.abs(own.span - length), `${label}: ${own.clip} is ${length.toFixed(3)} s, not ${own.span}`).toBeLessThan(.03);
  const played = own.from !== undefined ? own.to! - own.from : length;
  if (own.from !== undefined) {
    expect(own.to, `${label}: a segment needs both ends`).toBeDefined();
    expect(own.from, label).toBeGreaterThanOrEqual(0);
    expect(own.to! <= length + .01 && own.from < own.to!, `${label}: ${own.from}-${own.to} of ${length.toFixed(2)} s`).toBe(true);
  }
  // Where the blow lands: inside what is played, never on its first or last frame.
  const contact = own.contact ?? .5;
  expect(contact, `${label}: contact share`).toBeGreaterThan(.05);
  expect(contact, `${label}: contact share`).toBeLessThan(.95);
  // Played at a pace a blow can be read at: the shop's run from half speed to three times, most of them 0.8-1.7.
  if (duration) {
    const rate = played / duration;
    expect(rate, `${label}: ${played.toFixed(2)} s of clip over a ${duration.toFixed(2)} s move`).toBeGreaterThan(.45);
    expect(rate, `${label}: ${played.toFixed(2)} s of clip over a ${duration.toFixed(2)} s move`).toBeLessThan(2.6);
  }
}

describe('the Vol.1 enders\' clips', () => {
  it('names a clip each body plays - its own, its rush\'s, its extra files\' or its idle\'s - and a segment inside it', () => {
    for (const id of VOL1) {
      const row = COMBO_CLIPS[id];
      if (hasCombos(id)) expect(row, `${id} has combo enders and no clips for them`).toBeDefined();
      if (!row) continue;
      const clips = bodyClips(id);
      for (const key of COMBO_KEYS) {
        const own = row[key];
        if (hasCombos(id)) expect(own, `${id} ${key}`).toBeDefined();
        if (own) checkRow(`${id} ${key}`, own, clips, hasCombos(id) ? comboMove(id, key)?.duration : undefined);
      }
    }
  });

  it('measures every segment\'s take, so a body with another take under the same name throws the slot\'s clip', () => {
    for (const id of VOL1) for (const key of COMBO_KEYS) {
      const own = COMBO_CLIPS[id]?.[key];
      if (own) expect(own.span, `${id} ${key}: ${own.clip} needs its span`).toBeDefined();
    }
  });

  it('names a form\'s own clips in its own body', () => {
    for (const id of VOL1) {
      const row = COMBO_FORM_CLIPS[id];
      if (!row) continue;
      const form = FIGHTERS[id].formModel;
      expect(form, `${id} has form clips and no form`).toBeDefined();
      const clips = clipsOf(form!);
      for (const key of COMBO_KEYS) {
        const own = row[key];
        if (own) checkRow(`${id} form ${key}`, own, clips, hasCombos(id) ? comboMove(id, key, true)?.duration : undefined);
      }
    }
  });


  it('binds the new takes (the <id>-enders files) to the body they are for, bone by bone', () => {
    for (const id of VOL1) {
      const def = FIGHTERS[id];
      const nodes = new Set((gltf(def.model).nodes ?? []).map(n => sanitized(n.name)));
      for (const url of def.extraModels ?? []) {
        if (!/-enders\d*\.glb$/.test(url)) continue;
        const json = gltf(url);
        expect(json.animations?.length, `${url} carries no clips`).toBeGreaterThan(0);
        // Animation only: no mesh, skin or texture (they are the body's).
        expect((json as { meshes?: unknown[] }).meshes ?? [], url).toHaveLength(0);
        for (const clip of json.animations ?? []) {
          const targets = clip.channels.map(c => sanitized(json.nodes?.[c.target.node ?? -1]?.name));
          const bound = targets.filter(name => nodes.has(name)).length;
          expect(bound / targets.length, `${url} ${clip.name}: ${bound} of ${targets.length} tracks find a bone`).toBeGreaterThan(.95);
        }
      }
    }
  });
});
