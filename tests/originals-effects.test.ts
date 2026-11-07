import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SUZURAN_TWIN_LION_ASSETS } from '../src/render/signature/SuzuranTwinLions';
import { TSUBUTE_POP_GREEN_TEXTURES } from '../src/render/signature/TsubutePopGreen';
import { DRAGON_EYES, JAW_OPEN, SEA_DRAGON_ASSET } from '../src/render/signature/BriarShapes';
import { MAIN_EFFECT_FILES, OWN_EFFECT_FILES, SWAN_HEAD } from '../src/originals/effects';
import { MADAKE_GATES_ASSETS } from '../src/render/signature/MadakeGates';
import { launchUnshipped } from '../src/originals/launchShip';

const glb = (file: string) => { const b = fs.readFileSync(file), n = b.readUInt32LE(12); return JSON.parse(b.subarray(20, 20 + n).toString()); };

describe('the originals\' own effect files', () => {
  it('are what Suzuran\'s, Tsubute\'s and Svanhild\'s modules load, and are on disk', () => {
    const urls = [...SUZURAN_TWIN_LION_ASSETS, TSUBUTE_POP_GREEN_TEXTURES.wolf, TSUBUTE_POP_GREEN_TEXTURES.bird, SEA_DRAGON_ASSET];
    for (const url of urls) {
      expect(url).toMatch(/^\/assets\/vfx\/originals\/[a-z-]+\.(webp|glb)$/);
      expect(fs.existsSync(`public${url}`), url).toBe(true);
      expect(MAIN_EFFECT_FILES as readonly string[]).not.toContain(url.slice(1));
    }
  });

  it('give the swan the module\'s frame: the lower mandible weighted, its gap and its eyes', () => {
    const head = glb(`public${SEA_DRAGON_ASSET}`);
    expect(head.meshes).toHaveLength(1);
    expect(Object.keys(head.meshes[0].primitives[0].attributes)).toEqual(expect.arrayContaining(['POSITION', 'NORMAL', '_JAW']));
    expect(head.materials ?? []).toEqual([]);
    expect(JAW_OPEN).toBe(SWAN_HEAD.jawOpen);
    expect(DRAGON_EYES).toBe(SWAN_HEAD.eyes);
    expect(fs.statSync(`public${SEA_DRAGON_ASSET}`).size).toBeLessThan(400_000);
  });

  it('keep every one of the earlier effect files out of the package, held slots\' too', () => {
    expect(launchUnshipped([...MAIN_EFFECT_FILES, 'assets/vfx/originals/still-bell.webp', 'assets/vfx/ink-impacts.png'])).toEqual([...MAIN_EFFECT_FILES]);
  });
});

describe('Rift War\'s files, the mode open (rift-war, 4 November 2026)', () => {
  it('ship with the mode', () => {
    const files = ['assets/moba/troops/dawn-guardian.glb', 'assets/moba/structures/dawn-nexus.glb', 'assets/environment/rift-war/forest-floor.webp', 'assets/survival/motion/grunt-husk.glb'];
    expect(launchUnshipped(files)).toEqual([]);
  });
});
