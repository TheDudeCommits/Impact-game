import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STAGES } from '../src/game/stages';
import { STAGE_PROPS } from '../src/game/stageProps';
import { BUILT_PLACES, RETIRED_KIT } from '../src/originals/stages';
import { launchUnshipped } from '../src/originals/launchShip';
import { lookFor } from '../src/render/look/stageLooks';

const code = (file: string) => fs.readFileSync(file, 'utf8').split('\n').filter(line => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');

describe('r10: the places r9 left on the earlier model (stages-old: back on them)', () => {

  it("lays its own haze on its distance, not the withheld fortress's amber", () => {
    const air = lookFor('kuroyuki-hall').air!;
    expect(air.color).toBe(0x281c1c);
    expect(air.color).not.toBe(0x7a4a20);
    expect(air.start).toBeGreaterThan(26);
  });
});
