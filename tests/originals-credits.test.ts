import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ATTRIBUTIONS, OPEN_WORKS, legalPage } from '../src/ui/legal';
import { UNSHIPPED_ARMORY, UNSHIPPED_ARMORY_FILES } from '../src/originals/credits';
import { launchUnshipped } from '../src/originals/launchShip';
import { armoryRuntime } from '../src/engine/client/forgeLive';
import '../src/render/vfx/armory/forgeFx';

/** Originals fork (3 November 2026): every open-licence work the package ships is credited on the LEGAL page as its licence
 *  asks (src/originals/credits.ts), and what a licence forbids a commercial game is kept out. */
const credited = (file: string) => [...ATTRIBUTIONS, ...OPEN_WORKS].some(c => c.files.some(f => f === file || (f.endsWith('/') && file.startsWith(f))));
const glbExtras = (file: string) => { const b = fs.readFileSync(file), n = b.readUInt32LE(12); return JSON.parse(b.subarray(20, 20 + n).toString()).asset?.extras as { license?: string } | undefined; };

describe('the open-licence credits', () => {
  it('credit every CC BY recording of Arcade Survival\'s sound bank', () => {
    const bank = JSON.parse(fs.readFileSync('public/assets/audio/survival/manifest.json', 'utf8')) as { assets: { file: string; license?: string }[] };
    const owed = bank.assets.filter(a => /CC-?BY/i.test(a.license ?? '')).map(a => a.file.slice(1));
    expect(owed.length).toBe(36);
    expect(owed.filter(file => !credited(file))).toEqual([]);
  });

  it('credit every ambience file that is not synthesised', () => {
    const files = (JSON.parse(fs.readFileSync('src/audio/data/ambience.json', 'utf8')) as { files: Record<string, { source: string }> }).files;
    const owed = Object.entries(files).filter(([, f]) => !/^synthesised/.test(f.source)).map(([name]) => `assets/audio/ambience/${name}.m4a`);
    expect(owed.filter(file => !credited(file))).toEqual([]);
  });

  it('credit every Armory model its file records as CC BY', () => {
    const models = ['cinematic/models', 'extended/models', 'remake'].flatMap(dir => fs.readdirSync(`public/assets/armory/${dir}`).filter(f => f.endsWith('.glb')).map(f => `assets/armory/${dir}/${f}`));
    const owed = models.filter(file => /CC-?BY/i.test(glbExtras(`public/${file}`)?.license ?? ''));
    expect(owed).toEqual(['assets/armory/cinematic/models/magical_gyroscope.glb', 'assets/armory/extended/models/snake.glb']);
    expect(owed.filter(file => !credited(file))).toEqual([]);
  });

  it('credit the open code the Forge\'s effects are made of: Effekseer and its samples, the Elemental Sandbox, the p27 pack', () => {
    const page = legalPage();
    for (const words of ['Effekseer for WebGL', 'AndrewFM, NextSoft, Pierre, Suzuki (ICS LAB) and tktk', 'Elemental Sandbox (threejs-vfx)', 'mohamedachrefelouafi', 'Ability-ThreeJS-Project', 'itzmitto', 'rollshade'])
      expect(page, words).toContain(words);
    expect(credited('assets/armory/fxlib/effekseer/effekseer.min.js')).toBe(true);
    expect(credited('assets/armory/fxlib/effekseer/fx/tktk01.efk')).toBe(true);
  });

  it('keep the non-commercial dragon out: off the Forge\'s list and out of the package', () => {
    expect(armoryRuntime()!.effects().some(e => UNSHIPPED_ARMORY.has(e.id))).toBe(false);
    expect(armoryRuntime()!.effects().some(e => e.id === 'cin_gyro')).toBe(true);
    expect(launchUnshipped([...UNSHIPPED_ARMORY_FILES, 'assets/armory/remake/phoenix.glb'])).toEqual([...UNSHIPPED_ARMORY_FILES]);
  });
});
