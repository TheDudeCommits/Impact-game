import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STAGES, type StageId } from '../src/game/stages';
import { BUILT_PLACES, RETIRED_FILES, STILL_LOADED } from '../src/originals/stages';
import { ownStageModel } from '../src/originals/ownModels';
import { launchUnshipped } from '../src/originals/launchShip';
import { modeOpen } from '../src/originals/launch';

const code = (file: string) => fs.readFileSync(file, 'utf8').split('\n').filter(line => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');
const built = Object.keys(BUILT_PLACES) as StageId[];

describe('r8: the places built whole in code', () => {
  it('has places', () => expect(built.length).toBeGreaterThan(0));

  it("each builds every piece itself: none of the earlier dressing, nothing read off a model", () => {
    for (const id of built) {
      const file = `src/originals/places/${id}.ts`, text = code(file);
      expect(id in STAGES, id).toBe(true);
      expect(text, file).toMatch(/export (async )?function dress\(/);
      expect(text, file).toMatch(/new Forge\(/);
      expect(text, file).not.toMatch(/from '\.\.\/\.\.\/render\/stages\/(?!build|dressing|ambient|glow|hero|near|crowd|StageKit)[a-zA-Z]+'/);
      expect(text, file).not.toMatch(/\b(hideWhere|inventory|repaintMaterial|dropWhere)\(/);
      expect(text, file).not.toMatch(/c\.model\b|model\.traverse/);
      expect(text, file).not.toMatch(/fillText|strokeText/);
    }
  });

  it('loads no model for them, and every other place its own', async () => {
    for (const id of built) {
      const gltf = await ownStageModel(id);
      expect(gltf?.scene.children.length, id).toBe(0);
    }
    expect(ownStageModel('harbor')).toBeUndefined();
  });


  it("keeps the retired files' sources and hangs none of them", () => {
    for (const file of RETIRED_FILES) expect(fs.existsSync(`public/${file}`), file).toBe(true);
    const places = fs.readdirSync('src/originals/places').filter(f => f.endsWith('.ts')).map(f => code(`src/originals/places/${f}`)).join('\n');
    for (const file of RETIRED_FILES) expect(places, file).not.toContain(file.split('/').pop()!.replace(/\.\w+$/, ''));
  });
});
