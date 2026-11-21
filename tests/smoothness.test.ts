import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import { AB_NAMES } from '../src/render/look/abSwitch';

/** No frozen frame on a knockout, no rebuild between a Duel's rounds, and the GPU pipelines made at the load:
 *  what a fight must never stop for. */
const read = (path: string) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

describe('the smoothness pass', () => {
  it('holds no painted still on a knockout unless the switch asks for it', () => {
    const effects = read('../src/render/CombatEffects.ts');
    const knockout = effects.slice(effects.indexOf('private knockout('), effects.indexOf('private frame('));
    expect(knockout).toMatch(/if \(abOff\('kostill'\)\) this\.screen\?\.paintedFreeze\?\.\(/);
    expect(knockout.match(/paintedFreeze/g)).toHaveLength(1);
    expect(AB_NAMES).toContain('kostill');
  });

  it('keeps a Duel\'s two bodies from round to round of a set, and builds them afresh for a new set', () => {
    const main = read('../src/main.ts');
    expect(main).toMatch(/if\(duelRoundKey&&\(duelRoundKey\.split\(':'\)\[0\]!==duelKey\.split\(':'\)\[0\]\|\|abOff\('roundbodies'\)\)\)\{clearFighters\(\);\}duelRoundKey=duelKey;/);
    expect(AB_NAMES).toContain('roundbodies');
  });

  it('warms the GPU pipelines in a target with the frame\'s own samples', () => {
    const renderer = read('../src/render/GameRenderer.ts');
    expect(renderer).not.toMatch(/target\.samples=0;target\.setSize\(16,16\)/);
    expect(renderer).toMatch(/private warmFrame\(\)\{\s*const frame=this\.composer\.renderTarget1[^]*?old\.samples===frame\.samples[^]*?frame\.clone\(\);\s*target\.setSize\(16,16\);/);
    expect(renderer).toMatch(/this\.renderer\.setRenderTarget\(this\.warmFrame\(\)\);this\.renderer\.render\(this\.scene,this\.camera\);/);
  });
});
