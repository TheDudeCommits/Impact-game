import { describe, expect, it } from 'vitest';
import { COMBO_KEYS } from '../src/game/combos';
import { TECHNIQUE_KEYS } from '../src/game/techniques';
import { ArenaSimulation } from '../src/game/simulation';
import type { CombatEvent, FighterId } from '../src/game/types';

/** (5 October) The main game's sixteen have combo enders (combosVol1.ts), so their bots end landed strings with them
 *  (botEnder). Seeded bot-against-bot fights, so each is one fixed fight rather than a probability. */
function fight(a: FighterId, b: FighterId, seed: number, seconds = 40) {
  const sim = new ArenaSimulation({ roomMode: 'match', trainingBot: false, seed });
  sim.addPlayer('a', a, 'A', true, { x: 0, y: 0, z: 0 });
  sim.addPlayer('b', b, 'B', true, { x: 0, y: 0, z: 4 });
  sim.startMatch();
  for (const id of ['a', 'b']) sim.actors.get(id)!.botSkill = .7;
  const events: CombatEvent[] = [];
  let sound = true;
  try {
    for (let t = 0; t < 60 * seconds; t++) {
      sim.step(); events.push(...sim.snapshot(true).events);
      for (const id of ['a', 'b']) { const p = sim.getPlayer(id)!; if (![p.x, p.y, p.z, p.hp].every(Number.isFinite) || p.hp < 0) sound = false; }
    }
  } finally { sim.dispose(); }
  return { events, sound };
}

describe('the main game\'s bots fight with their enders', () => {
  it('end landed strings with them, every kind of them, and keep the fight sound', { timeout: 120_000 }, () => {
    const keys = new Set<string>();
    // Round 5 (PARRY): Nigo against Gaunt moved from seed 8 to 3 - the bots' guard (botDefend) draws on the seeded
    // stream, and on seed 8 Gaunt blocked or parried every string Nigo landed before it could be ended.
    // (2 November 2026, techniques: the bots' stick moves draw on the stream too, which re-deals the fights; Gummy against
    // Kenzo is seed 4 now, where the ground smash comes out.)
    for (const [a, b, seed] of [['gummy', 'kenzo', 4], ['kenzo', 'kuon', 3], ['nigo', 'gaunt', 3], ['gaunt', 'kosho', 8], ['setsu', 'ouga', 8],
      ['ward', 'taisei', 8], ['oro', 'gummy', 3], ['shiden', 'ward', 6], ['ouga', 'nigo', 8]] as [FighterId, FighterId, number][]) {
      // (6 October, the feel pass: the big blows' longer hold re-deals these seeded fights; Shiden against
      // Ward is seed 4 now, where his ground smash still comes out - it did on 8 before.)
      // (10 October, parry for people: the bots' parries wait for a person's reaction, which re-deals them again;
      // Shiden against Ward is seed 24, where the ground smash comes out.)
      // (24 October, v75: the air strike's fling - its body thrown three and a half metres down and away - re-deals them
      // once more; Shiden against Ward is seed 6, where the ground smash comes out.)
      const { events, sound } = fight(a, b, seed);
      expect(sound, `${a} against ${b}: positions and health stay real`).toBe(true);
      // (2 November 2026: a bot's branches are its enders and, since then, the techniques every style has.)
      const branched = events.filter(e => e.kind === 'cast' && e.actorId === 'a' && e.branch);
      for (const e of branched) expect([...COMBO_KEYS, ...TECHNIQUE_KEYS]).toContain(e.branch);
      const enders = branched.filter(e => (COMBO_KEYS as readonly string[]).includes(e.branch!));
      expect(enders.length, `${a} against ${b} (seed ${seed}) ends a string`).toBeGreaterThan(0);
      for (const e of enders) keys.add(e.branch!);
      // A ground smash strikes where the feet land.
      for (const release of events.filter(e => e.kind === 'release' && e.actorId === 'a' && e.branch === 'airSpecial'))
        expect(release.endpoint!.y, `${a}'s ground smash`).toBeLessThan(.8);
    }
    expect(keys.size, [...keys].join(', ')).toBe(COMBO_KEYS.length);
  });
});
