import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BANK, LINES, PITCH, VOICE_OF, everyTake } from '../src/audio/survivalBank';
import { ORIGINAL_HORDE_FAMILIES, ORIGINAL_HORDE_VOICE_OF, hordeFuse } from '../src/originals/hordeVoices';
import { objectiveSample, objectiveTakes } from '../src/audio/ObjectiveAudio';
import MANIFEST from '../public/assets/audio/survival/manifest.json';

const rows = new Map((MANIFEST as unknown as { assets: { id: string; license?: string; source?: string }[] }).assets.map(a => [a.id, a]));
describe('the new bodies\' voices', () => {
  it('voices the Automaton in iron, the Leaper as a hyena, the Doctor as a woman, the Salt Court behind masks, the Sapling in wood', () => {
    expect(VOICE_OF.automaton as string).toBe('iron');
    expect(VOICE_OF['graft-leaper'] as string).toBe('hyena');
    expect(VOICE_OF['graft-doctor'] as string).toBe('woman');
    for (const kind of ['tribunal-guard', 'tribunal-guard-rifle', 'tribunal-guard-shield', 'tribunal-guard-sniper']) expect(VOICE_OF[kind] as string, kind).toBe('masked');
    expect(VOICE_OF['pale-sapling'] as string).toBe('wood');
    for (const [kind, voice] of Object.entries(ORIGINAL_HORDE_VOICE_OF)) {
      const line = (LINES as unknown as Record<string, Record<string, string>>)[voice];
      for (const moment of ['swing', 'cry', 'hurt', 'die']) expect((BANK as Record<string, number>)[line[moment]], `${kind}: ${moment}`).toBeGreaterThan(0);
      expect(PITCH[kind], kind).toBeGreaterThan(.5);
    }
    const lines = LINES as unknown as Record<string, Record<string, string>>;
    expect(lines.woman.cry).toBe('woman-cry');
    expect(lines.iron.cry).toBe('furnace-roar');
  });
  it('hisses a self-destruct up like a fuse, and nothing else', () => {
    expect(hordeFuse('explode')).toBe('fuse-hiss');
    expect(hordeFuse('melee')).toBeUndefined();
  });
});

/** polish7 (5 November 2026): Last Stand asked for wood-cry-3 and wood-die-3, which never existed (the wood voice has 2 of
 *  each): src/audio/ObjectiveAudio.ts cycled every family through takes 1-3. Every horde voice any path can ask for is on disk. */
describe('every horde voice the game can ask for', () => {
  const lines = LINES as unknown as Record<string, Record<string, string>>;
  const onDisk = (url: string) => fs.existsSync(`public${url}`);
  it('every survival sound named in the source exists', () => {
    const missing: string[] = [];
    const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [`${dir}/${e.name}`] : []);
    for (const file of walk('src')) for (const m of fs.readFileSync(file, 'utf8').matchAll(/\/assets\/audio\/survival\/[\w-]+\.m4a/g)) if (!onDisk(m[0])) missing.push(`${file}: ${m[0]}`);
    expect(missing).toEqual([]);
  });
});
