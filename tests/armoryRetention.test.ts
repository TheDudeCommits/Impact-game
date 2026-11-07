import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ARMORY_MANIFEST } from '../src/render/vfx/armory/vendor/manifest';
import { ArmoryHost } from '../src/render/vfx/armory/host';
import { ArmoryEffectType } from '../src/render/vfx/armory/effect';
import { FxStage } from '../src/render/vfx/armory/fxStage';
import { EffectRegistry } from '../src/render/vfx/engine/Effect';

/** Launch night, 12 October 2026: the Armory's effects of rooms past are let go as a room is entered (ArmoryHost.retainTypes). */
const CANDIDATES = ['dragonbreath', 'arts_dragonflame', 'ext_aether', 'cin_dragon'];
const objects = (root: THREE.Object3D) => { let n = 0; root.traverse(() => n++); return n; };

/** Two effect types built in one scene's host, in Node, the way the room's load builds them (quick prewarm). */
async function build(host: ArmoryHost, scene: THREE.Scene, skip: () => void) {
  const types: ArmoryEffectType[] = [];
  for (const id of CANDIDATES) {
    if (types.length === 2) break;
    try {
      const Klass = await ARMORY_MANIFEST[id].load();
      const type = new ArmoryEffectType(host, id, Klass, 2);
      type.prewarm(scene, true);
      (host.types as Map<string, unknown>).set(id, type);
      types.push(type);
    } catch (error) { if (!/document is not defined|Failed to parse URL|Invalid URL/.test(String(error))) throw error; }
  }
  if (types.length < 2) { skip(); }
  return types;
}

describe('the Armory host between rooms', () => {
  it('lets go of the types a room does not draw - pool, scene objects, buffers - and keeps the ones it does', async ({ skip }) => {
    const scene = new THREE.Scene(), host = ArmoryHost.for(scene);
    try {
      const [keep, drop] = await build(host, scene, skip);
      const spaceRoots = (type: ArmoryEffectType) => type.instances.map(i => (i as unknown as { space: { root: THREE.Object3D } }).space.root);
      const geometries = new Set<THREE.BufferGeometry>();
      for (const root of spaceRoots(drop)) root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) geometries.add(m.geometry); });
      const disposed = new Set<THREE.BufferGeometry>();
      for (const geometry of geometries) geometry.addEventListener('dispose', () => disposed.add(geometry));
      const before = objects(host.root);
      expect(host.types.size).toBe(2);
      const gone = host.retainTypes(new Set([keep.effectId]));
      expect(gone).toEqual([drop.effectId]);
      expect([...host.types.keys()]).toEqual([keep.effectId]);
      // Its pool is gone: nothing more is handed out; what stays is the kept type's, whole.
      expect(drop.acquire()).toBeNull();
      expect(keep.acquire()).toBeTruthy();
      expect(objects(host.root)).toBeLessThan(before);
      for (const root of spaceRoots(drop)) expect(root.parent).toBeNull();
      // The buffers its meshes made on the card go with it (three frees a geometry on `dispose`).
      expect(disposed.size).toBe(geometries.size);
      // A second pass has nothing left to let go, and keeping all keeps all.
      expect(host.retainTypes(new Set([keep.effectId]))).toEqual([]);
      expect(host.retainTypes(new Set(CANDIDATES))).toEqual([]);
    } finally { host.dispose(); }
  });

  it('the stage forgets them too, so a later room that wants one builds it again', async ({ skip }) => {
    const scene = new THREE.Scene();
    const stage = new FxStage(scene, { quality: 'high', density: 1 } as never);
    try {
      const ids: string[] = [];
      for (const id of CANDIDATES) {
        if (ids.length === 2) break;
        try { if (await stage.ensure(id)) ids.push(id); } catch (error) { if (!/document is not defined|Failed to parse URL|Invalid URL/.test(String(error))) throw error; }
      }
      if (ids.length < 2) return skip();
      const [keep, drop] = ids;
      expect(stage.ready(keep) && stage.ready(drop)).toBe(true);
      const first = stage.host.types.get(drop);
      expect(stage.retain(new Set([keep]))).toEqual([drop]);
      expect(stage.ready(drop)).toBe(false);
      expect(stage.ready(keep)).toBe(true);
      expect(stage.host.types.has(drop)).toBe(false);
      expect(stage.registry.get(`armory/${drop}`)).toBeUndefined();
      expect(stage.registry.get(`armory/${keep}`)).toBeTruthy();
      // Wanted again: built again, a new type, ready.
      expect(await stage.ensure(drop)).toBe(true);
      expect(stage.ready(drop)).toBe(true);
      expect(stage.host.types.get(drop)).not.toBe(first);
    } finally { stage.dispose(); }
  });

  it('the registry can unregister a type', () => {
    const registry = new EffectRegistry();
    const type = { id: 'armory/x', capacity: 1, cost: { draws: 0, gpuMs: 0 }, prewarm() {}, acquire: () => null };
    registry.register(type);
    expect(registry.get('armory/x')).toBe(type);
    registry.unregister('armory/x');
    expect(registry.get('armory/x')).toBeUndefined();
  });
});

describe('the Armory sound of rooms past', () => {
  it('lets go of the files only effects no longer built voiced, and keeps what a kept effect plays', async () => {
    const { SoundBank, voicedLayers } = await import('../src/render/vfx/armory/sound');
    const { ARMORY_SOUND_NAMES, ARMORY_SOUND_PROFILES } = await import('../src/render/vfx/armory/vendor/sounds');
    const layersOf = (id: string) => ['bed', 'full'].flatMap(mode => voicedLayers(ARMORY_SOUND_PROFILES[id], mode as 'bed' | 'full')).filter(l => ARMORY_SOUND_NAMES[l.sound]);
    const ids = Object.keys(ARMORY_SOUND_PROFILES).filter(id => layersOf(id).length);
    // Two effects with a layer of their own each (a layer is keyed by its sound and settings; effects may share one).
    const key = (l: ReturnType<typeof layersOf>[number]) => JSON.stringify([l.sound, l.gain, l.pitch ?? 1, l.params ?? {}]);
    let pair: [string, string] | undefined;
    for (const a of ids) for (const b of ids) { if (a === b) continue; const keysB = new Set(layersOf(b).map(key)); if (layersOf(a).some(l => !keysB.has(key(l)))) { pair = [a, b]; break; } if (pair) break; }
    if (!pair) return;
    const [kept, gone] = pair;
    const bank = new SoundBank(), held = new Map<string, number>();
    let n = 0;
    for (const id of [kept, gone]) for (const layer of layersOf(id)) bank.provide(layer, [`blob:test/${n++}`]);
    const out = { sample() {}, preload() {}, sampleSeconds: (url: string) => held.get(url), release: (urls: readonly string[]) => { for (const u of urls) held.delete(u); } };
    for (const url of bank.addresses) held.set(url, 1);
    const before = bank.addresses.length, wantedByKept = new Set(layersOf(kept).map(key));
    const released = bank.retain([kept]);
    expect(released.length).toBeGreaterThan(0);
    expect(bank.addresses.length).toBe(before - released.length);
    out.release(released);
    // Every layer the kept effect voices is still made and still loaded.
    for (const layer of layersOf(kept)) { expect(wantedByKept.has(key(layer))).toBe(true); const picked = bank.pick(layer, out as never); expect(picked, 'a kept effect keeps its sound').toBeTruthy(); }
    // The game's audio no longer holds what was let go; a second pass lets go of nothing more.
    for (const url of released) expect(held.has(url)).toBe(false);
    expect(bank.retain([kept])).toEqual([]);
    expect(bank.settled(out as never)).toBe(true);
  });
});
