// Round 4b (COMBAT): mashing against the deliberate strings, and what each ender does to the body it lands on, for the
// main game's sixteen - headless, seeded, on the simulation the server runs (no collision world: open floor).
//
// The blind critic (round 4) found mashing J at 90 ms dealing 90-109% of the best Light x3 ender for 11 of 12 fighters,
// and every ender throwing every fighter's victim the same height, for the same time. This measures both:
//
//   strings   L, LL, LLL, LLLL, LH, LLH, LLLH, LLLS pressed at CADENCE ms between presses (300), and JL, JH, JS
//             (a held jump, the press JUMP_DELAY later);
//   mash      MASH presses of J at 90 ms (12, as the critic's), and a sustained one (30);
//   physics   for each ender, off its own hit: how high the body rose, how long it was off the floor, down, dazed,
//             how far it travelled along the floor, and what it did (the reactions it went through).
//
//   npx tsx scripts/combos/mash_probe.mts [--json out.json] [--md out.md]   (FIGHTERS=taisei,gaunt CADENCE=300)
import fs from 'node:fs';
import { ArenaSimulation } from '../../src/game/simulation';
import type { AttackSlot, CombatEvent, FighterId, PlayerInput } from '../../src/game/types';
import { HOME_FIGHTERS } from '../../src/ui/MangaHome';

const args = process.argv.slice(2);
const flag = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const FIGHTERS = (process.env.FIGHTERS?.split(',') as FighterId[] | undefined) ?? [...HOME_FIGHTERS];
const CADENCE = Number(process.env.CADENCE ?? 300) / 1000;
const OPPONENT = (process.env.OPPONENT ?? 'konta') as FighterId;
const GAP = Number(process.env.GAP ?? 1.5);
const JUMP_DELAY = Number(process.env.JUMP_DELAY ?? .25);

type Press = { at: number; input: Partial<PlayerInput> };
export interface Probe {
  damage: number; hits: { t: number; move?: string; slot?: AttackSlot; branch?: string; chain?: number; damage: number; reaction?: string }[];
  dodged: number; casts: { t: number; move?: string; slot?: AttackSlot; branch?: string; chain?: number; y: number }[];
  /** Off the first hit of `from` (an ender's branch, or the first hit): the body's rise, airtime, floor time, daze. */
  rise: number; airborne: number; down: number; dazed: number; travel: number; reactions: string[]; chased: boolean;
}

/** One string against a passive opponent: `presses` at their times (seconds from the start), `seconds` watched. */
export function probe(fighter: FighterId, presses: Press[], seconds: number, from?: (e: CombatEvent) => boolean, opponent = OPPONENT, gap = GAP): Probe {
  const sim = new ArenaSimulation({ trainingBot: false, seed: 7 });
  try {
    sim.addPlayer('a', fighter, 'A', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('b', opponent, 'B', false, { x: 0, y: 0, z: gap });
    let seq = 1, jumpHeld = false;
    const send = (more: Partial<PlayerInput> = {}) => sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', jumpHeld, ...more });
    sim.submitInput('b', { seq: 1, moveX: 0, moveZ: 0, yaw: Math.PI, targetId: 'a' });
    send();
    for (let i = 0; i < 12; i++) { sim.step(); sim.snapshot(true); }
    const t0 = sim.serverTime, b = sim.actors.get('b')!, a = sim.actors.get('a')!;
    const queue = [...presses].sort((x, y) => x.at - y.at);
    const out: Probe = { damage: 0, hits: [], dodged: 0, casts: [], rise: 0, airborne: 0, down: 0, dazed: 0, travel: 0, reactions: [], chased: false };
    let marked: number | undefined, x0 = 0, z0 = 0;
    const ticks = Math.round(seconds * 60);
    for (let i = 0; i < ticks; i++) {
      const now = sim.serverTime - t0;
      while (queue.length && queue[0].at <= now + 1e-6) {
        const press = queue.shift()!;
        if (press.input.jump) jumpHeld = press.input.jumpHeld ?? true;
        if (press.input.jumpHeld === false) jumpHeld = false;
        send(press.input);
      }
      sim.step();
      for (const e of sim.snapshot(true).events) {
        const t = +(sim.serverTime - t0).toFixed(3);
        if (e.kind === 'cast' && e.actorId === 'a') out.casts.push({ t, move: e.move, slot: e.slot, branch: e.branch, chain: e.chain, y: +a.state.y.toFixed(2) });
        if (e.kind === 'hit' && e.actorId === 'a' && e.targetId === 'b') {
          out.damage += e.damage ?? 0;
          out.hits.push({ t, move: e.move, slot: e.slot, branch: e.branch, chain: e.chain, damage: e.damage ?? 0, reaction: e.reaction });
          if (marked === undefined && (!from || from(e))) { marked = i; x0 = b.state.x; z0 = b.state.z; }
        }
        if (e.kind === 'dodge' && e.actorId === 'a') out.dodged++;
        if (e.kind === 'chase' && e.actorId === 'a') out.chased = true;
      }
      if (marked !== undefined) {
        out.rise = Math.max(out.rise, b.state.y);
        if (!b.state.grounded) out.airborne += 1 / 60;
        if (b.reaction === 'knockdown') out.down += 1 / 60;
        if (b.reaction === 'stun') out.dazed += 1 / 60;
        out.travel = Math.max(out.travel, Math.hypot(b.state.x - x0, b.state.z - z0));
        const r = b.reaction ?? 'free';
        if (out.reactions[out.reactions.length - 1] !== r) out.reactions.push(r);
      }
    }
    out.rise = +out.rise.toFixed(2); out.airborne = +out.airborne.toFixed(2); out.down = +out.down.toFixed(2);
    out.dazed = +out.dazed.toFixed(2); out.travel = +out.travel.toFixed(2);
    return out;
  } finally { sim.dispose(); }
}

const L = (n: number, cadence = CADENCE): Press[] => Array.from({ length: n }, (_, i) => ({ at: i * cadence, input: { attack: 'light' as AttackSlot } }));
const ender = (lights: number, slot: AttackSlot, cadence = CADENCE): Press[] => [...L(lights, cadence), { at: lights * cadence, input: { attack: slot } }];
const air = (slot: AttackSlot, held = true): Press[] => [{ at: 0, input: { jump: true, jumpHeld: held } }, ...(held ? [] : [{ at: .1, input: { jumpHeld: false } }]),
  { at: JUMP_DELAY, input: { attack: slot } }];
export const STRINGS = {
  L: () => L(1), LL: () => L(2), LLL: () => L(3), LLLL: () => L(4),
  LH: () => ender(1, 'heavy'), LLH: () => ender(2, 'heavy'), LLLH: () => ender(3, 'heavy'), LLLS: () => ender(3, 'special'),
  JL: () => air('light'), JLL: () => [...air('light'), { at: JUMP_DELAY + CADENCE, input: { attack: 'light' as AttackSlot } }, { at: JUMP_DELAY + 2 * CADENCE, input: { attack: 'light' as AttackSlot } }],
  JH: () => air('heavy'), JS: () => air('special'),
  MASH: () => L(12, .09), MASH30: () => L(30, .09),
  // What a deliberate player does with the same 3.4 s a sustained mash takes: a stun and the string it buys, or a
  // launch, the timed light that chases it, the air string and the air strike that ends it.
  STUN_ROUTE: () => [...ender(3, 'special'), ...ender(3, 'heavy').map(p => ({ ...p, at: p.at + 4 * CADENCE }))],
  LAUNCH_ROUTE: () => [...ender(2, 'heavy'), { at: 2 * CADENCE + .45, input: { attack: 'light' as AttackSlot } },
    ...[1, 2].map(i => ({ at: 2 * CADENCE + .45 + i * CADENCE, input: { attack: 'light' as AttackSlot } })),
    { at: 2 * CADENCE + .45 + 3 * CADENCE, input: { attack: 'heavy' as AttackSlot } }],
} satisfies Record<string, () => Press[]>;
const ENDER_OF: Partial<Record<keyof typeof STRINGS, string>> = { LH: 'lh', LLH: 'llh', LLLH: 'lllh', LLLS: 'llls', JH: 'airHeavy', JS: 'airSpecial' };

if (import.meta.url === `file://${process.argv[1]}`) {
  const table: Record<string, Record<string, Probe>> = {};
  for (const id of FIGHTERS) {
    table[id] = {};
    for (const [key, presses] of Object.entries(STRINGS)) {
      const branch = ENDER_OF[key as keyof typeof STRINGS];
      table[id][key] = probe(id, presses(), key.startsWith('MASH') || key.endsWith('ROUTE') ? 3.4 : 3, branch ? e => e.branch === branch : undefined);
      // The ender's own throw, watched to its end (a knockdown can still be on the floor at 3 s).
      if (branch) table[id][key + '_physics'] = probe(id, presses(), 4.5, e => e.branch === branch);
    }
    // Jump + Heavy where it is meant to land: the end of the launch, the chase and the air string.
    table[id].JH_physics = probe(id, STRINGS.LAUNCH_ROUTE(), 4.5, e => e.branch === 'airHeavy');
  }
  const rows: string[] = [];
  rows.push(`Cadence ${Math.round(CADENCE * 1000)} ms; opponent ${OPPONENT} at ${GAP} m, passive. Damage dealt in 3 s (MASH: 12 presses at 90 ms, MASH30: 30, watched 3.4 s).`, '');
  rows.push('| fighter | L | LL | LLL | LLLL | LH | LLH | LLLH | LLLS | JL | JH | JS | MASH | best ender | MASH / best | LLLH / LLLL | MASH30 | best 3.4 s route | MASH30 / route | mash chases |');
  rows.push('|---|' + '---|'.repeat(19));
  for (const id of FIGHTERS) {
    const r = table[id], best = Math.max(r.LLLH.damage, r.LLLS.damage), route = Math.max(r.STUN_ROUTE?.damage ?? 0, r.LAUNCH_ROUTE?.damage ?? 0, best);
    rows.push(`| ${id} | ${['L', 'LL', 'LLL', 'LLLL', 'LH', 'LLH', 'LLLH', 'LLLS', 'JL', 'JH', 'JS', 'MASH'].map(k => r[k].damage).join(' | ')} | ${best} | ${(r.MASH.damage / best * 100).toFixed(0)}% | ${(r.LLLH.damage / r.LLLL.damage * 100).toFixed(0)}% | ${r.MASH30.damage} | ${route} | ${(r.MASH30.damage / route * 100).toFixed(0)}% | ${r.MASH.chased || r.MASH30.chased ? 'yes' : 'no'} |`);
  }
  rows.push('', 'Ender physics, off the ender\'s own hit, watched 4.5 s: rise m / airborne s / down s / dazed s / travel m. JH is thrown at the end of LLH, the timed light that chases it and two air lights (it is the air string\'s ender); JS from a held jump at a body on the floor.', '');
  rows.push('| fighter | LH | LLH | LLLH | LLLS | JH | JS |');
  rows.push('|---|---|---|---|---|---|---|');
  for (const id of FIGHTERS) {
    const r = table[id];
    rows.push(`| ${id} | ${(['LH', 'LLH', 'LLLH', 'LLLS', 'JH', 'JS'] as const).map(k => { const p = r[k + '_physics'], b = ENDER_OF[k]!; const landed = p.hits.some(h => h.branch === b); return landed ? `${p.rise}/${p.airborne}/${p.down}/${p.dazed}/${p.travel}` : `MISS (${p.hits.length} hits)`; }).join(' | ')} |`);
  }
  rows.push('', 'Jump + Light: what is thrown, and how high the thrower is when it starts.', '');
  rows.push('| fighter | JL move | cast y | JL string |');
  rows.push('|---|---|---|---|');
  for (const id of FIGHTERS) {
    const r = table[id], first = r.JL.casts.find(c => c.slot === 'light');
    rows.push(`| ${id} | ${first?.move ?? '-'} | ${first?.y ?? '-'} | ${r.JLL.casts.filter(c => c.slot === 'light').map(c => c.move).join(' > ')} |`);
  }
  const md = rows.join('\n');
  console.log(md);
  const json = flag('--json'), mdOut = flag('--md');
  if (json) fs.writeFileSync(json, JSON.stringify(table, null, 1));
  if (mdOut) fs.writeFileSync(mdOut, md + '\n');
}
