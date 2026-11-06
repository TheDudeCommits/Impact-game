import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MOVES } from '../src/game/moves';
import { RELEASED_FIGHTERS } from '../src/game/rosterAvailability';
import { NATIVE_EFFECTS } from '../src/engine/vfx/casting';
import areaLooks from '../src/engine/sim/areaLooks.json';
import { ARMORY_MANIFEST } from '../src/render/vfx/armory/withheld';
import { ArmoryHost } from '../src/render/vfx/armory/host';
import { ArmoryEffectType } from '../src/render/vfx/armory/effect';
import { SoundBank } from '../src/render/vfx/armory/sound';
import { ARMORY_SOUND_NAMES } from '../src/render/vfx/armory/withheld';
import { castingFx, playerFx, roomChunkIds, roomFxIds } from '../src/render/vfx/armory/roomFx';
import { ARMORY_CASTINGS } from '../src/render/vfx/armory/withheld';
import { armoryRollout, CAST, LIVE } from '../src/render/vfx/armory/rollout';
import { nextFrame, prefetchRoomFx, warmEnabled, warmRoomAssets } from '../src/loading/matchWarmup';
import { capTextures, currentTextureCap, setTextureCap, textureCapFor } from '../src/render/textureCap';
import { CombatAudio } from '../src/audio/CombatAudio';

/** Launch night, 12 October 2026: what a match's load warms is read from the game's data, not from a list kept by hand. */
describe('the effects a room warms', () => {

  it('a room asks for each effect once, and never for an arcade enemy', () => {
    const room = [{ fighter: 'hinomoto' as const }, { fighter: 'hinomoto' as const }, { fighter: 'ampere' as const }, { fighter: 'taisei' as const, enemy: 'grunt' }];
    const ids = roomFxIds(room);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining([...playerFx({ fighter: 'hinomoto' }), ...playerFx({ fighter: 'ampere' })]));
    expect(ids).not.toEqual(expect.arrayContaining(playerFx({ fighter: 'taisei' }).filter(id => !playerFx({ fighter: 'hinomoto' }).includes(id) && !playerFx({ fighter: 'ampere' }).includes(id))));
  });


});


describe('the sound a room waits for', () => {

  it('CombatAudio.ready resolves at once with nothing asked, and at its cap with a load that never ends', async () => {
    const audio = new CombatAudio();
    const t0 = Date.now();
    await audio.ready(5000);
    expect(Date.now() - t0).toBeLessThan(1000);
    (audio as unknown as { cueLoads: Map<string, Promise<void>> }).cueLoads.set('never', new Promise<void>(() => {}));
    const t1 = Date.now();
    await audio.ready(60);
    expect(Date.now() - t1).toBeGreaterThanOrEqual(50);
    expect(Date.now() - t1).toBeLessThan(2000);
    const done = new CombatAudio();
    (done as unknown as { cueLoads: Map<string, Promise<void>> }).cueLoads.set('done', Promise.resolve());
    const t2 = Date.now();
    await done.ready(5000);
    expect(Date.now() - t2).toBeLessThan(1000);
  });
});

describe('the match warm-up never holds a match up', () => {
  it('stops at its cap whatever is still being waited for, and starts nothing after', async () => {
    let seals = 0;
    // A game's audio that never answers, a sound wait as long as you like, and a telegraph that paints slowly: the cap wins.
    const audio = { ready: () => new Promise<void>(() => {}) };
    const areaFx = { warmSeal: () => { seals++; return new THREE.Texture(); } };
    const t0 = Date.now();
    await warmRoomAssets([{ fighter: 'taisei' }, { fighter: 'konta' }], { current: () => true, cap: 120, soundCap: 60_000, audio, areaFx });
    expect(Date.now() - t0).toBeLessThan(3000);
    const after = seals;
    await nextFrame(); await nextFrame();
    expect(seals).toBe(after);
  });

  it('a player the data does not know breaks neither the fetch ahead nor the warm-up', async () => {
    const odd = [{ fighter: 'nobody' as never }, { get fighter(): never { throw new Error('a player that throws'); } }];
    expect(() => prefetchRoomFx(odd as never)).not.toThrow();
    await expect(warmRoomAssets(odd as never, { current: () => true, soundCap: 50 })).resolves.toBeUndefined();
  });

  it('is a switch: ?nowarm turns the whole warm-up off, and nothing is painted or fetched', async () => {
    const g = globalThis as unknown as { location?: unknown };
    const saved = g.location;
    g.location = { search: '?nowarm' };
    try {
      expect(warmEnabled()).toBe(false);
      let seals = 0;
      await warmRoomAssets([{ fighter: 'taisei' }], { current: () => true, areaFx: { warmSeal: () => { seals++; return new THREE.Texture(); } } });
      expect(seals).toBe(0);
    } finally { g.location = saved; }
    expect(warmEnabled()).toBe(true);
  });

  it('does not reject when what it waits on fails', async () => {
    const audio = { ready: () => Promise.reject(new Error('no audio')) };
    const areaFx = { warmSeal: () => { throw new Error('no canvas'); } };
    await expect(warmRoomAssets([{ fighter: 'taisei' }], { current: () => true, soundCap: 50, audio, areaFx })).resolves.toBeUndefined();
  });

  it('a resize that never answers leaves the image as it is, and the model loads', async () => {
    class Bitmap { constructor(public width: number, public height: number) {} close() {} }
    const g = globalThis as unknown as Record<string, unknown>, saved = { ImageBitmap: g.ImageBitmap, createImageBitmap: g.createImageBitmap };
    g.ImageBitmap = Bitmap; g.createImageBitmap = () => new Promise(() => {});
    try {
      const big = new Bitmap(4096, 4096), scene = new THREE.Group();
      scene.add(new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ map: new THREE.Texture(big as unknown as HTMLImageElement) })));
      expect(await capTextures({ scene, scenes: [scene] } as never, 2048, 40)).toBe(0);
    } finally { g.ImageBitmap = saved.ImageBitmap; g.createImageBitmap = saved.createImageBitmap; }
  });
});

describe('the match warm-up with nothing to warm', () => {
  it('resolves without a director, a telegraph, a renderer or audio, and never rejects', async () => {
    await nextFrame();
    await expect(warmRoomAssets([{ fighter: 'taisei' }, { fighter: 'konta' }], { current: () => true, soundCap: 50 })).resolves.toBeUndefined();
  });
  it('stops warming seals once the room it is for has been left', async () => {
    let painted = 0;
    const areaFx = { warmSeal: () => { painted++; return new THREE.Texture(); } };
    await warmRoomAssets([{ fighter: 'taisei' }, { fighter: 'konta' }], { current: () => false, areaFx, soundCap: 50 });
    expect(painted).toBe(0);
  });
});

describe('texture caps by quality', () => {
  it('High keeps every image; Medium shrinks what a stage ships over 2048; Low holds 1024', () => {
    expect(textureCapFor('high')).toBe(Infinity);
    expect(textureCapFor('medium')).toBe(2048);
    expect(textureCapFor('low')).toBe(1024);
  });

  it('shrinks only an image over the cap, in its shared source, closing the larger one', async () => {
    class Bitmap { closed = false; constructor(public width: number, public height: number) {} close() { this.closed = true; } }
    const g = globalThis as unknown as Record<string, unknown>, saved = { ImageBitmap: g.ImageBitmap, createImageBitmap: g.createImageBitmap };
    const made: [number, number][] = [];
    g.ImageBitmap = Bitmap;
    g.createImageBitmap = async (_image: Bitmap, o: { resizeWidth: number; resizeHeight: number }) => { made.push([o.resizeWidth, o.resizeHeight]); return new Bitmap(o.resizeWidth, o.resizeHeight); };
    try {
      const big = new Bitmap(4096, 4096), mid = new Bitmap(2048, 2080), small = new Bitmap(512, 512);
      const textures = [big, mid, small].map(image => { const t = new THREE.Texture(image as unknown as HTMLImageElement); return t; });
      // The same source on two materials is one image: shrunk once.
      const twin = new THREE.Texture(); twin.source = textures[0].source;
      const scene = new THREE.Group();
      scene.add(new THREE.Mesh(new THREE.BufferGeometry(), [new THREE.MeshBasicMaterial({ map: textures[0] }), new THREE.MeshBasicMaterial({ map: twin }), new THREE.MeshBasicMaterial({ map: textures[1], alphaMap: textures[2] })]));
      const gltf = { scene, scenes: [scene] } as never;
      expect(await capTextures(gltf, Infinity)).toBe(0);
      expect(made).toEqual([]);
      // 4096 -> 2048; 2048 x 2080 is over by its height: 2016 x 2048. The twin's source is the same image, shrunk once.
      expect(await capTextures(gltf, 2048)).toBe(2);
      expect(made).toEqual([[2048, 2048], [2016, 2048]]);
      expect(big.closed).toBe(true);
      expect(mid.closed).toBe(true);
      expect((textures[0].source.data as unknown as Bitmap).width).toBe(2048);
      expect(twin.source.data).toBe(textures[0].source.data);
      expect(small.closed).toBe(false);
      expect(await capTextures(gltf, 1024)).toBe(2);
      expect(made.slice(2)).toEqual([[1024, 1024], [1008, 1024]]);
      expect(small.closed).toBe(false);
    } finally { g.ImageBitmap = saved.ImageBitmap; g.createImageBitmap = saved.createImageBitmap; }
  });

  it('holds the cap models are loaded under until the next quality is applied', () => {
    const before = currentTextureCap();
    setTextureCap(textureCapFor('low'));
    expect(currentTextureCap()).toBe(1024);
    setTextureCap(before);
  });
});
