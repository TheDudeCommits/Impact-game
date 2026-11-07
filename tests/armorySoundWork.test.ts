import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHUNK, SoundBank, Slices, planRenders, voicedLayers, wav } from '../src/render/vfx/armory/sound';
import { ARMORY_SOUND_NAMES, ARMORY_SOUND_PROFILES } from '../src/render/vfx/armory/vendor/sounds';
import type { ArmorySoundLayer, ArmorySoundName } from '../src/render/vfx/armory/types';
import type { ArmorySoundOut } from '../src/render/vfx/armory/soundOut';

/**
 * Launch day 7 (13 October 2026): the Armory's sound for a room was rendered in ONE OfflineAudioContext (262 s of synth
 * for a twelve-fighter match: 26-49 s to come back on a busy Mac, long after the load's 3 s wait), and finished inside the
 * fight - a 140-440 ms callback cutting and encoding all of it, then 200-400 files handed to the game's audio to decode in
 * one frame (scripts/night/load_hitches.mjs royale, `audio` hitches, +2.5 s to +47.6 s of the match).
 *
 * The rule kept here: the bank's sound is made in small renders and in slices, and handed to the game's audio a few files
 * at a time, so whenever it finishes - behind the loading screen or in the fight - no frame waits on it.
 */

// The Armory's recipes and the browser's OfflineAudioContext are not here: stand-ins that count what the bank asks of them.
const fake = vi.hoisted(() => {
  const state = { kits: [] as unknown[], voices: [] as { ctx: unknown; kit: { ac: unknown }; at: number }[] };
  const recipe = (kit: { ac: unknown }, out: { ctx: unknown }, at: number) => { state.voices.push({ ctx: out.ctx, kit, at }); return { end: at + 1, stop() {} }; };
  const recipes = {
    RECIPES: new Proxy({}, { get: (_t, name) => typeof name === 'string' ? recipe : undefined }),
    RECIPE_INFO: new Proxy({}, { get: () => ({ loop: false, about: '', params: {} }) }),
    makeKit: (ac: unknown) => { state.kits.push(ac); return { ac, white: 'white', pink: 'pink' }; },
  };
  return { state, recipes };
});
vi.mock('../src/render/vfx/armory/vendor/sounds', async importOriginal => ({ ...(await importOriginal<object>()), loadRecipes: async () => fake.recipes }));

class FakeContext {
  static all: FakeContext[] = [];
  readonly destination = {};
  constructor(readonly channels: number, readonly length: number, readonly sampleRate: number) { FakeContext.all.push(this); }
  createGain() { return { ctx: this, connect() {} }; }
  async startRendering() {
    const data = new Float32Array(this.length);
    for (let i = 0; i < data.length; i += 5) data[i] = Math.sin(i / 30) * .4;
    return { getChannelData: () => data };
  }
}

const synthLayers = (ids: readonly string[]) => {
  const out = new Map<string, [string, ArmorySoundLayer, Extract<ArmorySoundName, { type: 'synth' }>]>();
  for (const id of ids) for (const mode of ['bed', 'full'] as const) for (const layer of voicedLayers(ARMORY_SOUND_PROFILES[id], mode)) {
    const name = ARMORY_SOUND_NAMES[layer.sound];
    if (name?.type !== 'synth') continue;
    const key = JSON.stringify([layer.sound, layer.gain, layer.pitch ?? 1, layer.params ?? {}]);
    out.set(key, [key, layer, name]);
  }
  return [...out.values()];
};
/** A room's worth: the effects a twelve-fighter match builds, a spread of the catalogue. */
const roomIds = () => Object.keys(ARMORY_SOUND_PROFILES).filter((_, i) => i % 34 === 5);

describe('the Armory sound is rendered in small contexts', () => {
  it('no render holds more than CHUNK seconds, unless one layer alone does; every layer is rendered once, whole', () => {
    const jobs = synthLayers(Object.keys(ARMORY_SOUND_PROFILES));
    const plan = planRenders(jobs, fake.recipes as never);
    expect(plan.length).toBeGreaterThan(jobs.length / 4);
    const pieces = plan.flat();
    expect(new Set(pieces.map(p => p.key)).size).toBe(jobs.length);
    for (const chunk of plan) {
      const span = chunk[chunk.length - 1].at + chunk[chunk.length - 1].length + .25;
      const keys = new Set(chunk.map(p => p.key));
      if (keys.size > 1) expect(span, `a render of ${keys.size} layers`).toBeLessThanOrEqual(CHUNK + .001);
      // A layer's pieces are together (its variants are cut out of one render).
      for (const key of keys) expect(pieces.filter(p => p.key === key).every(p => chunk.includes(p))).toBe(true);
      // And their places never overlap.
      for (let i = 1; i < chunk.length; i++) expect(chunk[i].at).toBeGreaterThanOrEqual(chunk[i - 1].at + chunk[i - 1].length);
    }
  });

  it('a room\'s sound is not one pass: its 262 s of synth are many renders of a few seconds', () => {
    const jobs = synthLayers(roomIds());
    const plan = planRenders(jobs, fake.recipes as never);
    const total = plan.flat().reduce((n, p) => n + p.length + .25, 0);
    expect(total).toBeGreaterThan(100);
    expect(plan.length).toBeGreaterThanOrEqual(Math.floor(total / (CHUNK * 2)));
    const longest = Math.max(...plan.map(c => c[c.length - 1].at + c[c.length - 1].length));
    expect(longest).toBeLessThan(total / 4);
  });

  describe('through the bank', () => {
    let urls = 0;
    beforeEach(() => {
      FakeContext.all.length = 0; fake.state.kits.length = 0; fake.state.voices.length = 0; urls = 0;
      vi.stubGlobal('OfflineAudioContext', FakeContext);
      vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:test/${urls++}`);
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    });
    afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

    const asked = (bank: SoundBank, ids: readonly string[]) => { for (const id of ids) { bank.need(id, 'bed'); bank.need(id, 'full'); } };

    it('renders in contexts of a few seconds, builds the Armory\'s noise buffers once and lends them to each, and makes every layer', async () => {
      const bank = new SoundBank({ pause: () => Promise.resolve() });
      const ids = roomIds();
      asked(bank, ids);
      const jobs = synthLayers(ids), expected = planRenders(jobs, fake.recipes as never);
      await bank.prepare();
      expect(FakeContext.all.length).toBe(expected.length);
      expect(FakeContext.all.length).toBeGreaterThan(5);
      for (const ctx of FakeContext.all) expect(ctx.sampleRate).toBe(48000);
      const longestLayer = Math.max(...expected.map(c => c[c.length - 1].at + c[c.length - 1].length + .25));
      for (const ctx of FakeContext.all) expect(ctx.length / 48000).toBeLessThanOrEqual(Math.max(CHUNK, longestLayer) + .3);
      // One kit for the page, each voice built with a kit that belongs to the context it plays in.
      expect(fake.state.kits).toHaveLength(1);
      expect(fake.state.voices.length).toBe(expected.flat().length);
      for (const voice of fake.state.voices) { expect(voice.kit.ac).toBe(voice.ctx); expect((voice.kit as unknown as { white: string }).white).toBe('white'); }
      // Every synth layer asked for is made, as WAV blob addresses with the gain that puts its level back.
      for (const [, layer] of jobs) expect(bank.pick(layer, { sampleSeconds: () => 1 } as unknown as ArmorySoundOut), layer.sound).toBeTruthy();
      expect(bank.addresses.filter(url => url.startsWith('blob:test/'))).toHaveLength(urls);
      expect(urls).toBeGreaterThan(jobs.length);
    });

    it('works in slices: it gives the thread back between graphs, cuts and files, not once per room', async () => {
      // A clock that moves 5 ms (more than a slice) each time it is read: every look at it finds a slice spent.
      let t = 0;
      vi.spyOn(performance, 'now').mockImplementation(() => (t += 5));
      let pauses = 0;
      const bank = new SoundBank({ pause: () => { pauses++; return Promise.resolve(); } });
      asked(bank, roomIds().slice(0, 4));
      await bank.prepare();
      expect(fake.state.voices.length).toBeGreaterThan(20);
      expect(pauses).toBeGreaterThanOrEqual(fake.state.voices.length * 2);
      expect(bank.addresses.length).toBeGreaterThan(10);
    });

    it('with a slice not spent it does not wait at all (a quiet page is not slowed)', async () => {
      let pauses = 0;
      const bank = new SoundBank({ pause: () => { pauses++; return Promise.resolve(); } });
      vi.spyOn(performance, 'now').mockImplementation(() => 1000);
      asked(bank, roomIds().slice(0, 2));
      await bank.prepare();
      expect(pauses).toBe(0);
      expect(bank.addresses.length).toBeGreaterThan(0);
    });

    it('a later layer is rendered on its own, in contexts of its own, as the fight can ask', async () => {
      const bank = new SoundBank({ pause: () => Promise.resolve() });
      asked(bank, roomIds().slice(0, 3));
      await bank.prepare();
      const before = FakeContext.all.length, kits = fake.state.kits.length;
      const later = Object.keys(ARMORY_SOUND_PROFILES).filter(id => !roomIds().slice(0, 3).includes(id) && synthLayers([id]).length > 3)[0];
      asked(bank, [later]);
      expect(bank.pending).toBeGreaterThan(0);
      await bank.prepare();
      expect(FakeContext.all.length).toBeGreaterThan(before);
      expect(fake.state.kits).toHaveLength(kits);
      expect(bank.pending).toBe(0);
    });
  });

  it('Slices gives the thread back only when a slice is spent, and sooner-and-longer while a room loads', async () => {
    let t = 0, pauses = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => t);
    const wait = () => { pauses++; return Promise.resolve(); };
    const calm = new Slices(() => false, wait);
    await calm.tick(); t = 3; await calm.tick();
    expect(pauses).toBe(0);
    t = 4.5; await calm.tick();
    expect(pauses).toBe(1);
    // While a room loads a slice is longer: 8 ms is not yet spent, 13 ms is.
    t = 20;
    const rush = new Slices(() => true, wait);
    t = 28; await rush.tick();
    expect(pauses).toBe(1);
    t = 33; await rush.tick();
    expect(pauses).toBe(2);
    vi.restoreAllMocks();
  });
});

describe('a room load waits on the sound in longer slices', () => {
  it('readySound holds the bank in a rush while it waits, and lets it go when it is done or capped', async () => {
    const { readySound } = await import('../src/render/vfx/armory/runtime');
    const { soundBank } = await import('../src/render/vfx/armory/sound');
    const bank = soundBank();
    const seen: number[] = [];
    vi.spyOn(bank, 'prepare').mockImplementation(() => { seen.push(bank.rushing); return Promise.resolve(); });
    await readySound(30);
    expect(seen).toEqual([1]);
    expect(bank.rushing).toBe(0);
    // Capped with the work still going: the rush ends with the wait, the work goes on in idle time.
    vi.spyOn(bank, 'prepare').mockImplementation(() => { seen.push(bank.rushing); return new Promise<void>(() => {}); });
    await readySound(30);
    expect(seen).toEqual([1, 1]);
    expect(bank.rushing).toBe(0);
    vi.restoreAllMocks();
  });
});

describe('a WAV is the same bytes as before it was written through a typed array', () => {
  /** The writer as it was (a DataView, sample by sample). */
  const reference = (data: Float32Array, rate: number, k: number) => {
    const n = data.length, buffer = new ArrayBuffer(44 + n * 2), v = new DataView(buffer);
    const text = (at: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i)); };
    text(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); text(8, 'WAVE');
    text(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    text(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, data[i] * k)) * 0x7fff), true);
    return new Uint8Array(buffer);
  };
  it('for quiet, loud and clipping samples, and the empty one', async () => {
    const data = new Float32Array(5000);
    let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < data.length; i++) data[i] = (rnd() * 2 - 1) * (i < 1000 ? .01 : i < 3000 ? .7 : 3);
    for (const k of [1, .98 / 3, 5, 1 / .01]) expect(new Uint8Array(await wav(data, 48000, k).arrayBuffer())).toEqual(reference(data, 48000, k));
    expect(new Uint8Array(await wav(new Float32Array(0), 48000).arrayBuffer())).toEqual(reference(new Float32Array(0), 48000, 1));
  });
});
