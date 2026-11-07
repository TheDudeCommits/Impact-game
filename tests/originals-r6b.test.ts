import { createHash } from 'node:crypto';
import { HOME_VOICE_OF } from '../src/originals/homeVoices';
import { voiceFile } from './voiceFiles';
import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { fighterAssetPaths } from '../scripts/fighterAssets';
import { AUDIO_CUES } from '../src/audio/cuePlan';
import { VOICE_CUES } from '../src/audio/voiceCues';
import { FIGHTERS } from '../src/config';
import { AWAKENINGS, moveFor, rushMove } from '../src/game/awakening';
import { COMBO_KEYS, comboMove } from '../src/game/combos';
import { MOVES } from '../src/game/moves';
import type { FighterId } from '../src/game/types';
import { displayMove } from '../src/originals/apply';
import { ORIGINAL_AREAS, shownAreaCard, shownAreaJa } from '../src/originals/area';
import { ORIGINAL_EMBLEMS } from '../src/originals/emblems';
import { cueFighter, fighterShown, LAUNCH } from '../src/originals/launch';
import { FORM_BUSTS } from '../src/originals/formBusts';
import { OWN_ART } from '../src/originals/ownArt';
import { ORIGINALS } from '../src/originals/roster';
import { R6B_ART, R6B_HOLD, R6B_VOICES_PENDING, R6B_WAITING, SHOP_R6B } from '../src/originals/shop/r6b';
import VOICES from '../src/originals/voices.json';
import { commandList } from '../src/ui/commandList';
import { BONSHO_BODHISATTVA_ASSETS, BonshoBodhisattva } from '../src/render/signature/BonshoBodhisattva';
import { AKAITO_GHOST_BRIDE_ASSETS, AkaitoGhostBride } from '../src/render/signature/AkaitoGhostBride';
import { SPIRIT_CALLERS, SWORD_SPIRIT_ASSETS } from '../src/render/SwordSpiritEffects';
import { YODAKA_TIGER_ASSET, YodakaFlameTiger } from '../src/render/signature/YodakaFlameTiger';
import { companionPlacement } from '../src/originals/companionLooks';
import { launchUnshipped } from '../src/originals/launchShip';
import { glbJson } from './extraClips';
import { loadRig } from './rigHarness';


const sha = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const cues = VOICES.cues as Record<string, { file: string; seconds: number; voice: string }>;
const ALL = { ...SHOP_R6B, ...R6B_WAITING } as Partial<Record<FighterId, NonNullable<(typeof SHOP_R6B)[FighterId]>>>;

function companion(id: FighterId, own: string, main: string) {
  const ownUrl = `/assets/fighters/${own}`, mainUrl = `/assets/fighters/${main}`;
  expect(ORIGINALS[id]?.companion?.model).toBe(ownUrl);
  expect(SPIRIT_CALLERS[id]!.asset).toBe(ownUrl);
  expect([...SWORD_SPIRIT_ASSETS]).toContain(ownUrl);
  expect([...SWORD_SPIRIT_ASSETS]).not.toContain(mainUrl);
  type Doc = { images?: unknown[] };
  const mine = glbJson(ownUrl) as unknown as Doc;
  expect(mine.images ?? []).toEqual([]);   // its own base colours, nothing painted
  const away = new Set(launchUnshipped([mainUrl.slice(1), ownUrl.slice(1)]));
  expect(away.has(ownUrl.slice(1))).toBe(!fighterShown(id));
}

/** Every move name the tables know for a slot, awake or not. */
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

describe("round 6's new fighters, the second batch", () => {
  it('stand in their slots under their own names, on their own bodies, built and on disk', () => {
    for (const id of Object.keys(SHOP_R6B) as FighterId[]) {
      const own = SHOP_R6B[id]!;
      expect(FIGHTERS[id].name, id).toBe(own.name);
      const stem = own.model.match(/\/([a-z]+)-tr1\.glb$/)?.[1];
      expect(stem, id).toBe(own.name.toLowerCase().replace(/[^a-z]/g, ''));
      for (const file of fighterAssetPaths(FIGHTERS[id]).map(p => `/${p}`).filter(f => f.endsWith('.glb'))) {
        expect(file, id).toMatch(new RegExp(`/${stem}(-awakened)?-tr1(-area1)?\\.glb$`));
        expect(fs.existsSync(`public${file}`), file).toBe(true);
      }
      if (FIGHTERS[id].formModel) expect(FIGHTERS[id].formModel, id).toBe(`/assets/fighters/${stem}-awakened-tr1.glb`);
      expect(own.portrait, id).toBe(`/assets/fighters/${stem}-portrait.png`);
      expect(fs.existsSync(`public${own.portrait}`), id).toBe(true);
    }
  });


  it('speak every cue main has for the slot, from the game\'s own folder (or, still being recorded, none and stay hidden)', () => {
    for (const id of Object.keys(SHOP_R6B) as FighterId[]) {
      const need = Object.keys(VOICE_CUES).filter(cue => cueFighter(cue) === id);
      if (R6B_VOICES_PENDING.includes(id)) {
        expect(fighterShown(id), id).toBe(false);
        expect(need.filter(cue => cues[cue]).length, `${id}: half wired`).toBe(0);
        continue;
      }
      expect(need.length, id).toBeGreaterThan(5);
      for (const cue of need) {
        const line = cues[cue];
        expect(line, `${id} ${cue}`).toBeDefined();
        expect((AUDIO_CUES as Record<string, string>)[cue], cue).toBe(line.file);
        expect(line.file, cue).toMatch(/^voice\/originals\/[a-z]+\/[a-z0-9-]+\.wav$/);
        expect(voiceFile(`voice/originals/${line.file.split('/')[2]}/${cue}.wav`) === line.file || /\/[a-z-]+-[0-9a-f]{8}\.wav$/.test(line.file), cue).toBe(true);
        const wav = fs.readFileSync(`public/assets/audio/v2/${line.file}`);
        expect([wav.readUInt16LE(22), wav.readUInt32LE(24), wav.readUInt16LE(34)], cue).toEqual([1, 48000, 16]);
      }
      // Its home line, where one is wired, is the file the manifest describes.
      const home = (VOICES.home as Record<string, { text: string; file: string }>)[HOME_VOICE_OF[id]];
      if (home) {
        const entry = (JSON.parse(fs.readFileSync('public/assets/audio/home/manifest.json', 'utf8')).assets as Record<string, string>[]).find(a => a.fighter === id)!;
        expect(entry.sourceUrl, id).toMatch(/^higgsfield:elevenlabs_v4\//);
        expect(entry.runtimeSha256, id).toBe(sha(`public${home.file}`));
        expect(entry.line, id).toBe(home.text);
      }
    }
  });

  it('wear their own HUD busts, rendered from their bodies', () => {
    for (const id of Object.keys(SHOP_R6B) as FighterId[]) {
      // (An awakened bust only where the plate shows one: a form that looks different, src/originals/formBusts.ts.)
      const files = [`${id}.webp`, ...(FORM_BUSTS.has(id) ? [`${id}-form.webp`] : [])];
      for (const file of files) expect(OWN_ART.busts[file], file).toBe(sha(`public/assets/hud/busts/${file}`));
    }
  });

  it('stay held until their drawn 2D set lands, so none of the earlier files for the slot ships', () => {
    for (const id of Object.keys(SHOP_R6B) as FighterId[]) {
      expect(LAUNCH.hold.includes(id), id).toBe(!R6B_ART.includes(id));
      if (!R6B_ART.includes(id)) expect(fighterShown(id), id).toBe(false);
    }
    expect(R6B_HOLD.every(id => id in SHOP_R6B)).toBe(true);
  });

  it("raise Bonsho's own bell guardian in the sculpture's place, with the earlier seven parts at the earlier joints, and never ship the earlier", async () => {
    const own = '/assets/fighters/bonsho-guardian1.glb', main = '/assets/fighters/bonsho-bodhisattva1.glb';
    expect([...BONSHO_BODHISATTVA_ASSETS]).toEqual([own]);
    expect(glbJson(own).images ?? []).toEqual([]);   // plain bronze: the renderer colours it, nothing painted
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(url => loadRig(url) as never);
    const scene = new THREE.Scene(), fx = new BonshoBodhisattva(scene, { budget: 1 });
    try {
      await fx.load(['bonsho']);
      for (const part of ['BodhiTorso', ...['Left', 'Right'].flatMap(s => ['Upper', 'Fore', 'Hand'].map(p => `Bodhi${s}${p}`))])
        expect(scene.getObjectByName(`bonsho-${part}`), part).toBeTruthy();
    } finally { fx.dispose(); vi.restoreAllMocks(); }
    const away = new Set(launchUnshipped([main.slice(1), own.slice(1)]));
    expect(away.has(own.slice(1))).toBe(!fighterShown('bonsho'));
  });

  it("manifest Akaito's own ghost bride in the spirit's place, on the earlier twelve joints and three takes, and never ship the earlier", async () => {
    const own = '/assets/fighters/akaito-bride2.glb', main = '/assets/fighters/akaito-ghost-bride1.glb';
    expect([...AKAITO_GHOST_BRIDE_ASSETS]).toEqual([own]);
    expect(glbJson(own).images ?? []).toEqual([]);   // plain: the renderer tints her its own pale violet
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(url => loadRig(url) as never);
    const scene = new THREE.Scene(), fx = new AkaitoGhostBride(scene, { budget: 1 } as never);
    try {
      await fx.load(['akaito']);
      let skinned = 0; scene.traverse(o => { if (o instanceof THREE.SkinnedMesh) skinned++; });
      expect(skinned).toBeGreaterThan(0);
      expect(scene.getObjectByName('GhostBrideJaw')).toBeTruthy();
    } finally { fx.dispose(); vi.restoreAllMocks(); }
    const away = new Set(launchUnshipped([main.slice(1), own.slice(1)]));
    expect(away.has(own.slice(1))).toBe(!fighterShown('akaito'));
  });

  it("Kinu fights through her own puppet, on the earlier spirit's joints and takes, and never ships the earlier spirit", () => companion('kinu', 'kinu-puppet1.glb', 'stone-free1.glb'));

  it("Kinu's puppet stands where the earlier spirit stood (the slot's own placement)", () => {
    expect(companionPlacement({ id: 'a-spirit', fighter: 'kinu' })).toEqual({ scale: 1, position: [0, 0, 0] });
    expect(companionPlacement({ id: 'a', fighter: 'kinu' })).toBeUndefined();   // Kinu herself is fit by her own height
  });

  it("Gosu fights through his own mender, on the earlier spirit's joints and takes, and never ships the earlier spirit", () => companion('gosu', 'gosu-mender1.glb', 'crazy-diamond1.glb'));


  it("never draws or ships the earlier Flame Tiger in Yodaka's slot: his Fire Owl is drawn in its place", async () => {
    expect(ORIGINALS.yodaka?.name).toBe('Yodaka');
    expect(YODAKA_TIGER_ASSET).toBe('/assets/vfx/originals/fire-owl.webp');
    expect(fs.existsSync(`public${YODAKA_TIGER_ASSET}`)).toBe(true);
    expect(launchUnshipped([YODAKA_TIGER_ASSET.slice(1)])).toEqual([]);
    const load = vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation(() => new THREE.Texture());
    const fx = new YodakaFlameTiger(new THREE.Scene(), { budget: 1 });
    try { void fx.load(['yodaka']); expect(load.mock.calls.map(call => call[0])).toEqual([YODAKA_TIGER_ASSET]); } finally { fx.dispose(); vi.restoreAllMocks(); }
  });

  it("hold Yodaka's own blade where the earlier renderer reads Yodaka's by name", () => {
    const nodes = glbJson('/assets/fighters/yodaka-tr1.glb').nodes;
    const at = (name: string) => nodes.findIndex(n => n.name === name);
    expect(nodes[at('weapon_katana_R')].children).toContain(at('YodakaBladeBase'));
    expect((nodes[at('YodakaBladeBase')] as { children?: number[] }).children).toEqual([at('YodakaBladeTip')]);
    const tip = (nodes[at('YodakaBladeTip')] as { translation?: number[] }).translation!;
    expect(Math.hypot(...tip)).toBeGreaterThan(.6);
  });

});

describe("Cardo's face (owner-fix, 4 November 2026: \"Cardo's face is all messed up on his model, fix it\")", () => {
  // Tripo skinned his mouth and chin to the chest and shoulders (the head's share under 0.5 below the top lip), so every
  // head tilt dragged the grin down into a smear. scripts/originals/shop/face_weights_r6.py gives the face to the head.
  it('is carried by his head, the mouth and chin with it', () => {
    const bytes = fs.readFileSync('public/assets/fighters/cardo-tr1.glb');
    const jsonLength = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
    const bin = 20 + jsonLength + 8;
    const node = json.nodes.find((n: { name?: string; mesh?: number }) => n.name === 'Body' && n.mesh !== undefined);
    const attributes = json.meshes[node.mesh].primitives[0].attributes;
    const at = (index: number) => { const a = json.accessors[index], v = json.bufferViews[a.bufferView]; return { a, start: bin + (v.byteOffset ?? 0) + (a.byteOffset ?? 0) }; };
    const pos = at(attributes.POSITION), joints = at(attributes.JOINTS_0), weights = at(attributes.WEIGHTS_0);
    expect(joints.a.componentType).toBe(5121);
    const head = json.skins[node.skin].joints.findIndex((j: number) => json.nodes[j].name === 'Head');
    let n = 0, share = 0;
    for (let k = 0; k < pos.a.count; k++) {
      const x = bytes.readFloatLE(pos.start + 12 * k), y = bytes.readFloatLE(pos.start + 12 * k + 4), z = bytes.readFloatLE(pos.start + 12 * k + 8);
      // the lower face: mouth and chin, the front of the head's box (metres, the body built at 1.55)
      if (y < 1.2 || y > 1.28 || z < .15 || x < -.2 || x > 0) continue;
      n++;
      for (let i = 0; i < 4; i++) if (bytes[joints.start + 4 * k + i] === head) share += bytes.readFloatLE(weights.start + 16 * k + 4 * i);
    }
    expect(n).toBeGreaterThan(100);
    expect(share / n, 'the head carries the mouth and chin').toBeGreaterThan(.65);
  });
});
