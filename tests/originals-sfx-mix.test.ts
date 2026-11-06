import { describe, expect, it } from 'vitest';
import { planCombatAudio } from '../src/audio/cuePlan';
import { ALL_FIGHTERS, fighterShown } from '../src/originals/launch';
import type { CombatEvent, FighterId } from '../src/game/types';
import MIX from '../src/originals/sfxMix.json';

const table = MIX as unknown as { launch: number; keep: string[]; area: Record<string, { draw?: number; seal?: number; cast?: number; release?: number; strike?: number; strikeLast?: number }> };
let id = 1;
const event = (props: Partial<CombatEvent>) => ({ id: id++, kind: 'cast', serverTime: 100, actorId: 'a', targetId: 'b', seed: 3, ...props }) as CombatEvent;
const gainOf = (layers: { cue: string; gain: number }[], cue: RegExp) => layers.find(l => cue.test(l.cue))?.gain;

describe('the area moves at Impact\'s level', () => {
  const shown = (ALL_FIGHTERS as readonly FighterId[]).filter(fighterShown);
  it('has a row for every shown fighter but Barrow, who stays as he was', () => {
    expect(table.keep).toEqual(['barrow']);
    for (const fighter of shown) if (!table.keep.includes(fighter)) expect(table.area[fighter], fighter).toBeTruthy();
    expect(table.area.barrow).toBeUndefined();
  });
  it('only ever quietens: seals at or under their old gains, trims at or under 0 dB, the launcher under its old .35', () => {
    expect(table.launch).toBeGreaterThan(.05);
    expect(table.launch).toBeLessThan(.35);
    for (const [fighter, row] of Object.entries(table.area)) {
      if (row.draw !== undefined) expect(row.draw, fighter).toBeLessThanOrEqual(.35);
      if (row.seal !== undefined) expect(row.seal, fighter).toBeLessThanOrEqual(.45);
      for (const trim of [row.cast, row.release, row.strike, row.strikeLast]) if (trim !== undefined) expect(trim, fighter).toBeLessThanOrEqual(0);
      expect(row.cast, `${fighter}: cast and release are trimmed together`).toBe(row.release);
    }
  });
  it('plays the table: the seals\' gains and the trims, and the launcher', () => {
    const row = table.area.gaku;
    const cast = planCombatAudio(event({ fighter: 'gaku', slot: 'area', kind: 'cast' }), false);
    expect(gainOf(cast, /^fx-orig-seal-draw$/)).toBeCloseTo(row.draw! * 10 ** ((row.cast ?? 0) / 20), 3);
    const release = planCombatAudio(event({ fighter: 'gaku', slot: 'area', kind: 'release', due: 101 }), false);
    expect(gainOf(release, /^fx-orig-seal-cast/)).toBeCloseTo(row.seal! * 10 ** ((row.release ?? 0) / 20), 3);
    const launched = planCombatAudio(event({ kind: 'hit', fighter: 'kenzo', slot: 'heavy', reaction: 'launched' }), false);
    expect(gainOf(launched, /^fx-orig-launch-[12]$/)).toBe(table.launch);
    const barrow = planCombatAudio(event({ kind: 'hit', fighter: 'barrow', slot: 'heavy', reaction: 'launched' }), false);
    expect(gainOf(barrow, /^fx-orig-launch-[12]$/)).toBe(.35);
    const barrowCast = planCombatAudio(event({ fighter: 'barrow', slot: 'area', kind: 'cast' }), false);
    expect(gainOf(barrowCast, /^fx-orig-seal-draw$/)).toBe(.35);
  });
});
