import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STAGES } from '../src/game/stages';
import { STAGE_PROPS } from '../src/game/stageProps';
import { BUILT_PLACES, RETIRED_KIT } from '../src/originals/stages';
import { launchUnshipped } from '../src/originals/launchShip';
import { lookFor } from '../src/render/look/stageLooks';

const code = (file: string) => fs.readFileSync(file, 'utf8').split('\n').filter(line => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');

describe('r10: the places r9 left on the earlier model (stages-old: back on them)', () => {
  it('Kuroyuki Hall, Thornwood Ward, the Drifting Isle and the Cinder Flats are each dressed by their own file', () => {
    for (const id of ['kuroyuki-hall', 'thornwood-ward', 'drifting-isle', 'cinder-flats'] as const) {
      const text = code(`src/originals/places/${id}.ts`);
      expect(text, id).toMatch(/export (async )?function dress\(/);
      expect(text, id).not.toMatch(/fillText|strokeText/);
      // Either built whole (the Forge, no model shipped) or dressed off its model (shipped).
      if (BUILT_PLACES[id]) { expect(text, id).toMatch(/new Forge\(/); continue; }
      expect(text, id).toMatch(/c\.model|inventory\(|hideWhere\(/);
      expect(launchUnshipped([STAGES[id].model!.slice(1)]), id).toEqual([]);
    }
  });

  it("keeps Thornwood Ward's old street kit out: tarped cars and street cabinets in its boxes", () => {
    const text = code('src/originals/places/thornwood-ward.ts');
    expect(text).not.toMatch(/kit\.load\(\[[^\]]*thornwood-ward\//);
    if (!BUILT_PLACES['thornwood-ward']) expect(text).toMatch(/cc0\/covered-car/);
    expect(launchUnshipped([...RETIRED_KIT]).sort()).toEqual([...RETIRED_KIT].sort());
    const elsewhere = fs.readdirSync('src/originals/places').filter(f => f.endsWith('.ts') && f !== 'thornwood-ward.ts').map(f => code(`src/originals/places/${f}`)).join('\n');
    expect(elsewhere).not.toMatch(/thornwood-ward\//);
    // Every box the kit's pieces filled is still there (the boxes are untouched).
    const pieces = new Set((STAGE_PROPS['thornwood-ward'] ?? []).map(p => p.piece));
    expect([...pieces].some(p => /^thornwood-ward\//.test(p))).toBe(true);
    // The ward by night: its haze a near-black green.
    expect(lookFor('thornwood-ward').air!.color).toBe(0x1c2420);
  });

  it("lays its own haze on its distance, not the withheld fortress's amber", () => {
    const air = lookFor('kuroyuki-hall').air!;
    expect(air.color).toBe(0x281c1c);
    expect(air.color).not.toBe(0x7a4a20);
    expect(air.start).toBeGreaterThan(26);
  });
});
