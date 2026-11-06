import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { STAGES, type StageId } from '../src/game/stages';
import { WITHHELD_SKIES, ORIGINAL_STAGES, SKY_OVERRIDES, stageSky } from '../src/originals/stages';
import { LOOK_CHANGES, originalLook } from '../src/originals/looks';
import { STAGE_LOOKS, lookFor } from '../src/render/look/stageLooks';

const code = (file: string) => fs.readFileSync(file, 'utf8').split('\n').filter(line => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');

describe('r7: the places re-imagined', () => {


  it("lays each place's light over the earlier without writing the earlier table", () => {
    for (const id of Object.keys(LOOK_CHANGES) as StageId[]) {
      expect(id in STAGES, id).toBe(true);
      const main = STAGE_LOOKS[id as keyof typeof STAGE_LOOKS]!, before = JSON.stringify(main);
      const look = lookFor(id);
      expect(look, id).not.toBe(main);
      const change = LOOK_CHANGES[id]!;
      if (change.fog?.color !== undefined) expect(look.fog.color, id).toBe(change.fog.color);
      if (change.key?.color !== undefined) expect(look.key.color, id).toBe(change.key.color);
      if (!change.key?.dir) expect(look.key.dir, id).toEqual(main.key.dir);
      else expect(look.key.dir, id).toEqual(change.key.dir);
      expect(JSON.stringify(STAGE_LOOKS[id as keyof typeof STAGE_LOOKS]), id).toBe(before);
      expect(originalLook(id, main), id).not.toBe(main);
    }
    expect(originalLook('harbor', STAGE_LOOKS.harbor)).toBe(STAGE_LOOKS.harbor);
  });

});
