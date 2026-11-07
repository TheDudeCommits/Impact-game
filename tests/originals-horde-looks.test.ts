import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MotionLibrary } from '../src/render/horde/motion';
import { FLESH_LOOKS, sculptLook, ARMS } from '../src/render/horde/fleshLooks';
import { LOOKS, buildLook } from '../src/render/horde/looks';
import { GRUNTS, GRUNT_ALIASES, GRUNT_INDEX, WEARS, gruntKind } from '../src/survival/horde/kinds';

/** Originals fork (survival-clean, 7 November 2026): every kind's code-built fallback looks (drawn when its model is off or
 *  fails to load) are the fork's own, after its own model, and build; the old ids still read; the Skiff Guard is gone. */
const realFetch = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = (async (url: string) => {
    const bytes = fs.readFileSync(`public${url}`);
    return { json: async () => JSON.parse(bytes.toString()), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  }) as unknown as typeof fetch;
});
afterAll(() => { globalThis.fetch = realFetch; });

describe('the horde\'s fallback looks', () => {
  it('sculpt and kit-build every kind the horde fields', async () => {
    const motion = await MotionLibrary.load();
    for (const kind of GRUNTS) {
      const body = WEARS[kind.id] ?? kind.id;
      const sculpt = sculptLook(body, motion.rest);
      expect(sculpt, kind.id).toBeDefined();
      expect(sculpt!.getAttribute('position').count, kind.id).toBeGreaterThan(300);
      expect(buildLook(body, motion.rest, motion.height).geometry.getAttribute('position').count, kind.id).toBeGreaterThan(100);
    }
  }, 120_000);
  it('keep no look of the retired kinds', () => {
    for (const gone of ['skiff-guard', 'skiff-sniper', 'tusker', 'tusker-shield', 'gamorrean']) {
      expect(FLESH_LOOKS[gone]).toBeUndefined(); expect(LOOKS[gone]).toBeUndefined(); expect(ARMS[gone]).toBeUndefined();
    }
    expect(fs.existsSync('public/assets/survival/motion/grunt-skiff-guard.glb')).toBe(false);
  });
  it('read every old kind id as its new one', () => {
    for (const [old, id] of Object.entries(GRUNT_ALIASES)) {
      expect(GRUNTS.some(k => k.id === old), old).toBe(false);
      expect(gruntKind(old).id).toBe(id);
      expect(GRUNT_INDEX.get(old)).toBe(GRUNT_INDEX.get(id));
    }
  });
});
