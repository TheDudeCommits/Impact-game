import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STAGES, type StageId } from '../src/game/stages';
import { BUILT_PLACES, STILL_LOADED } from '../src/originals/stages';
import { launchUnshipped } from '../src/originals/launchShip';
import { originalLiquid } from '../src/originals/grounds';
import { LIQUID_FLOORS } from '../src/game/footing';

const code = (file: string) => fs.readFileSync(file, 'utf8').split('\n').filter(line => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');

describe('r9: the last places on the earlier model, and Last Stand\'s backdrop', () => {
  it('builds the Sunfall Arena in code; stages-old puts the other three back on their models', () => {
    expect(BUILT_PLACES['sunfall-arena']).toBeTruthy();
    // Each of the other three is either still built whole (the Forge, no model) or back on its model (dressed off it, shipped).
    for (const id of ['ash-colosseum', 'mirror-mere', 'starfall-crater'] as const) {
      const text = code(`src/originals/places/${id}.ts`);
      if (BUILT_PLACES[id]) expect(text, id).toMatch(/new Forge\(/);
      else {
        expect(text, id).toMatch(/c\.model|inventory\(|hideWhere\(/);
        expect(launchUnshipped([STAGES[id].model!.slice(1)]), id).toEqual([]);
      }
    }
  });

  it("builds Last Stand's backdrop in code, letters nothing, and loads no stage's model for it", () => {
    const text = code('src/originals/places/ashCrag.ts');
    expect(text).toMatch(/export async function lastStandBackdrop\(/);
    expect(text).toMatch(/new Forge\(/);
    expect(text).not.toMatch(/GLTFLoader|\.glb|fillText|strokeText/);
    const host = fs.readFileSync('src/render/objectives/AshwoodVillage.ts', 'utf8');
    expect(host).toMatch(/if\(await lastStandBackdrop\(this\.root\)\)return;/);
  });

  it("leaves no built place's model loaded by anything else (Rift War's map builds its own), so none ships", () => {
    expect(Object.keys(STILL_LOADED)).toEqual([]);
    const models = (Object.keys(BUILT_PLACES) as StageId[]).map(id => STAGES[id].model!.slice(1));
    expect(launchUnshipped(models).sort()).toEqual([...models].sort());
  });


  it("splashes the Mirror Mere's pale water, not blood", () => {
    const mere = originalLiquid('mirror-mere')!;
    expect(mere.kind).toBe('water');
    expect(mere.level).toBe(LIQUID_FLOORS['mirror-mere']!.level);
    expect(mere.lit).not.toBe(LIQUID_FLOORS['mirror-mere']!.lit);
    expect(originalLiquid('ashfall-weir')).toBe(LIQUID_FLOORS['ashfall-weir']);
    expect(originalLiquid('harbor')).toBeUndefined();
  });
});
