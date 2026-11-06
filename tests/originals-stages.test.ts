import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { STAGES, type StageId } from '../src/game/stages';
import { DUEL_KICKER, GATED_STAGES, LAST_STAND, WITHHELD_SKIES, ORIGINAL_STAGES, RETIRED_SKIES, SAFE_STAGES, SKY_OVERRIDES, STAGE_SKIES, shownStage, stageSky } from '../src/originals/stages';
import { stageSafe } from '../src/originals/launch';
import { launchUnshipped } from '../src/originals/launchShip';
import { ARENAS, DUEL_ARENAS } from '../src/game/social/custom';


const ids = Object.keys(STAGES) as StageId[];

describe('the stages as the game shows them', () => {
  it('names every stage', () => {
    expect(Object.keys(ORIGINAL_STAGES).sort()).toEqual([...ids].sort());
    for (const id of ids) {
      expect(ORIGINAL_STAGES[id].name.length, id).toBeGreaterThan(3);
      expect(ORIGINAL_STAGES[id].scene.length, id).toBeGreaterThan(3);
      expect(shownStage(id)).toEqual({ name: ORIGINAL_STAGES[id].name, scene: ORIGINAL_STAGES[id].scene });
    }
  });


  it('gives the launch gate every stage, safe or left out', () => {
    expect([...SAFE_STAGES, ...GATED_STAGES].sort()).toEqual([...ids].sort());
    for (const id of SAFE_STAGES) expect(ORIGINAL_STAGES[id].safe).toBe(true);
    for (const id of GATED_STAGES) expect(ORIGINAL_STAGES[id].safe).toBe(false);
  });

  it('is what the interface prints: no screen reads a stage name from the game table', () => {
    const files = ['src/main.ts', ...fs.readdirSync('src/ui', { recursive: true }).map(f => path.join('src/ui', String(f)))]
      .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    const direct = /STAGES\s*\[[^\]]+\]\s*\??\.\s*(name|scene)\b|STAGES\.\w+\.(name|scene)\b|arenaName\(/;
    const offenders = files.filter(f => direct.test(fs.readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });



  it('pictures every place a picker offers with the game\'s own render, and ships none of a place the gate keeps out', () => {
    const offered = [...new Set([...ARENAS.royale, ...ARENAS['bad-blood'], ...ARENAS['last-stand'], ...DUEL_ARENAS])];
    const files = offered.flatMap(id => ['', '-thumb'].map(end => `assets/stages/previews/${id}${end}.webp`));
    for (const file of files) expect(fs.existsSync(`public/${file}`), file).toBe(true);
    const gated = GATED_STAGES.map(id => `assets/stages/previews/${id}.webp`);
    const away = launchUnshipped([...files, ...gated]);
    expect(away.sort()).toEqual([...files.filter(file => !stageSafe(file.replace(/^.*\/|(-thumb)?\.webp$/g, ''))), ...gated].sort());
  }, 60000);
});
