import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { MASH_SCALE, MOVES, RHYTHM_BONUS, type MoveDefinition } from '../src/game/moves';
import type { AttackSlot, CombatEvent, FighterId, PlayerInput } from '../src/game/types';
import { HOME_FIGHTERS } from '../src/ui/MangaHome';
import { probe, STRINGS } from '../scripts/combos/mash_probe.mts';

type Press = { at: number; input: Partial<PlayerInput> };
const L = (n: number, c: number): Press[] => Array.from({ length: n }, (_, i) => ({ at: i * c, input: { attack: 'light' as AttackSlot } }));

/** `presses` against `target` 1.5 m in front - a roster fighter, or a survival boss with a kit. */
function hits(fighter: FighterId, presses: Press[], kit = false) {
  const sim = new ArenaSimulation({ trainingBot: false, seed: 21 });
  try {
    sim.addPlayer('a', fighter, 'A', false, { x: 0, y: 0, z: 0 });
    if (kit) {
      const swing: MoveDefinition = { ...MOVES.taisei.light };
      sim.addCombatant('b', { team: 'rift', kit: { light: swing, heavy: swing, special: swing, ultimate: swing }, maxHp: 5000, spawn: { x: 0, y: 0, z: 1.5 }, yaw: Math.PI });
      sim.setTeam('a', 'heroes');
    } else sim.addPlayer('b', 'konta', 'B', false, { x: 0, y: 0, z: 1.5 });
    let seq = 1;
    const send = (more: Partial<PlayerInput> = {}) => sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', ...more });
    send();
    if (!kit) sim.submitInput('b', { seq: 1, moveX: 0, moveZ: 0, yaw: Math.PI, targetId: 'a' });
    for (let i = 0; i < 12; i++) { sim.step(); sim.snapshot(true); }
    const t0 = sim.serverTime, queue = [...presses], out: CombatEvent[] = [];
    for (let i = 0; i < 180; i++) {
      while (queue.length && queue[0].at <= sim.serverTime - t0 + 1e-6) send(queue.shift()!.input);
      sim.step();
      out.push(...sim.snapshot(true).events.filter(e => e.kind === 'hit' && e.actorId === 'a' && e.targetId === 'b'));
    }
    return out;
  } finally { sim.dispose(); }
}
const firstOfEach = (events: CombatEvent[]) => [0, 1, 2, 3].map(stage => events.find(e => e.chain === stage && e.slot === 'light')?.damage ?? 0);

describe('a mashed string is worth less than a deliberate one', () => {
  it('scales every stage of a string mashed into, and none of one pressed at a pace', () => {
    const paced = firstOfEach(hits('kenzo', L(4, .3))), mashed = firstOfEach(hits('kenzo', L(12, .09)));
    expect(paced.every(d => d > 0), 'the paced string lands every stage').toBe(true);
    // The first press opens the string clean; every stage the mash carries on is scaled.
    expect(mashed[0]).toBe(paced[0]);
    for (const stage of [1, 2, 3]) expect(mashed[stage] / paced[stage], `stage ${stage}`).toBeCloseTo(MASH_SCALE, 1);
  });

  it('leaves a survival boss\'s string as it was: a crowd and a boss are not a duel', () => {
    const paced = firstOfEach(hits('kenzo', L(4, .3), true)), mashed = firstOfEach(hits('kenzo', L(12, .09), true));
    expect(mashed.slice(1).every(d => d > 0)).toBe(true);
    expect(mashed.slice(1)).toEqual(paced.slice(1));
  });

  it('gives every Vol.1 fighter\'s best Light x3 ender a clear lead over twelve presses mashed at 90 ms', () => {
    // The critic's own test: 12 presses at 90 ms against L+L+L+H and L+L+L+S at a rhythm. It was 88-109% (Ward 181%:
    // his enders missed at 300 ms).
    for (const id of HOME_FIGHTERS) {
      const mash = probe(id, STRINGS.MASH(), 3.4).damage;
      const best = Math.max(probe(id, STRINGS.LLLH(), 3).damage, probe(id, STRINGS.LLLS(), 3).damage);
      expect(mash / best, `${id}: the mash takes ${mash} against ${best}`).toBeLessThan(.75);
      expect(probe(id, STRINGS.MASH(), 3.4).chased, `${id}: and never chases`).toBe(false);
    }
  });

  it('pays Light x3, Heavy on the beat about 1.3-1.5 times Light x4, fighter by fighter', () => {
    for (const id of HOME_FIGHTERS) {
      const ender = probe(id, STRINGS.LLLH(), 3).damage, finisher = probe(id, STRINGS.LLLL(), 3).damage;
      expect(ender / finisher, `${id}: ${ender} against ${finisher}`).toBeGreaterThanOrEqual(1.28);
      expect(ender / finisher, `${id}: ${ender} against ${finisher}`).toBeLessThanOrEqual(1.5);
    }
  });

  it('pays the ender on the beat RHYTHM_BONUS over the same ender pressed on top of the last light', () => {
    for (const id of ['taisei', 'gaunt', 'setsu'] as FighterId[]) {
      const beat = hits(id, [...L(3, .3), { at: .9, input: { attack: 'heavy' } }]).find(e => e.branch === 'lllh')!;
      // Pressed 60 ms after the third light: rushed, it is queued behind the string - the same ender, off the beat.
      const rushed = hits(id, [...L(3, .3), { at: .66, input: { attack: 'heavy' } }]).find(e => e.branch === 'lllh')!;
      expect(beat, `${id}: on the beat`).toBeDefined(); expect(rushed, `${id}: rushed`).toBeDefined();
      expect(beat.damage! / rushed.damage!, id).toBeCloseTo(RHYTHM_BONUS, 1);
    }
  });
});
