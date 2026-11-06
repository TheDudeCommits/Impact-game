// Round 4b (COMBAT): every Vol.1 string into every ender at a player's rhythm (250, 300 and 350 ms between presses),
// against the passive training bot - which connect (tests/comboCadence.test.ts holds them all to it).
//   npx tsx scripts/combos/cadence.mts [--md out.md]
import fs from 'node:fs';
import { ArenaSimulation } from '../../src/game/simulation';
import type { AttackSlot, CombatEvent, FighterId, PlayerInput } from '../../src/game/types';
import { HOME_FIGHTERS } from '../../src/ui/MangaHome';
import { comboMove, type ComboKey, type EnderKey } from '../../src/game/combos';

type Press = { at: number; input: Partial<PlayerInput> };
const L = (n: number, c: number): Press[] => Array.from({ length: n }, (_, i) => ({ at: i * c, input: { attack: 'light' as AttackSlot } }));
const ender = (n: number, slot: AttackSlot, c: number): Press[] => [...L(n, c), { at: n * c, input: { attack: slot } }];
/** Light, Light, Heavy; the light that chases the launch once it is up; two air lights; the air ender. */
const air = (slot: AttackSlot, c: number): Press[] => {
  const chase = 2 * c + .45;
  return [...ender(2, 'heavy', c), ...[0, 1, 2].map(i => ({ at: chase + i * c, input: { attack: 'light' as AttackSlot } })),
    { at: chase + 3 * c, input: { attack: slot } }];
};
/** Each ender's string. Jump + Heavy ends the air string - the launcher, the timed light that chases it and two air
 *  lights - and Jump + Special is the ground smash, a jump and the smash a beat after it beside a body on the floor
 *  (thrown after an air string it lands under a body still up in the air, as it is meant to). */
export const CADENCE_STRINGS: Record<EnderKey, (c: number) => Press[]> = {
  lh: c => ender(1, 'heavy', c), llh: c => ender(2, 'heavy', c), lllh: c => ender(3, 'heavy', c), llls: c => ender(3, 'special', c),
  airHeavy: c => air('heavy', c),
  airSpecial: c => [{ at: 0, input: { jump: true, jumpHeld: true } }, { at: c, input: { attack: 'special' as AttackSlot, jumpHeld: true } }],
};
export const CADENCES = [.25, .3, .35];

/** The string against a passive opponent 1.5 m in front; every event the attacker made. */
export function throwString(fighter: FighterId, presses: Press[], seconds = 4, opponent: FighterId = 'konta') {
  const sim = new ArenaSimulation({ trainingBot: false, seed: 13 });
  try {
    sim.addPlayer('a', fighter, 'A', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('b', opponent, 'B', false, { x: 0, y: 0, z: 1.5 });
    let seq = 1, held = false;
    const send = (more: Partial<PlayerInput> = {}) => sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', jumpHeld: held, ...more });
    sim.submitInput('b', { seq: 1, moveX: 0, moveZ: 0, yaw: Math.PI, targetId: 'a' });
    send();
    for (let i = 0; i < 12; i++) { sim.step(); sim.snapshot(true); }
    const t0 = sim.serverTime, queue = [...presses], events: CombatEvent[] = [];
    for (let i = 0; i < seconds * 60; i++) {
      while (queue.length && queue[0].at <= sim.serverTime - t0 + 1e-6) { const p = queue.shift()!.input; if (p.jumpHeld !== undefined) held = p.jumpHeld; send(p); }
      sim.step();
      events.push(...sim.snapshot(true).events.filter(e => e.actorId === 'a'));
    }
    return events;
  } finally { sim.dispose(); }
}

/** Whether `key`'s string, at `cadence`, threw its ender and landed it. */
export function lands(fighter: FighterId, key: EnderKey, cadence: number) {
  const events = throwString(fighter, CADENCE_STRINGS[key](cadence));
  const thrown = events.some(e => e.kind === 'cast' && e.branch === key);
  const hit = events.some(e => e.kind === 'hit' && e.branch === key && e.targetId === 'b');
  return hit ? 'hit' : thrown ? 'whiff' : 'not thrown';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const keys = Object.keys(CADENCE_STRINGS) as EnderKey[];
  const rows = ['| fighter | ' + CADENCES.flatMap(c => keys.map(k => `${k} @${Math.round(c * 1000)}`)).join(' | ') + ' |', '|---|' + '---|'.repeat(CADENCES.length * keys.length)];
  let missed = 0, total = 0;
  for (const id of HOME_FIGHTERS) {
    const cells = CADENCES.flatMap(c => keys.map(k => { const r = lands(id, k, c); total++; if (r !== 'hit') missed++; return r === 'hit' ? 'ok' : `**${r.toUpperCase()}**`; }));
    rows.push(`| ${id} | ${cells.join(' | ')} |`);
  }
  rows.unshift(`${total - missed} of ${total} enders connect (16 fighters, six enders, ${CADENCES.map(c => c * 1000).join('/')} ms between presses, passive bot).`, '');
  const md = rows.join('\n');
  console.log(md);
  const i = process.argv.indexOf('--md');
  if (i > 0) fs.writeFileSync(process.argv[i + 1], md + '\n');
  void comboMove;
}
