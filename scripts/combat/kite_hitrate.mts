import fs from 'node:fs';
import { ArenaSimulation, LAG_COMPENSATION } from '../../src/game/simulation';
import { MOVES, SIMULATION_HZ, meleeReach } from '../../src/game/moves';
import { isReleasedFighter } from '../../src/game/rosterAvailability';
import type { AttackSlot, CombatEvent, FighterId, PlayerInput, PlayerState } from '../../src/game/types';

const args = process.argv.slice(2);
const jsonAt = args.indexOf('--json'), jsonOut = jsonAt >= 0 ? args[jsonAt + 1] : undefined;
const DT = 1 / SIMULATION_HZ;
const SECONDS = Number(process.env.SECONDS ?? 24);
const LAG = Number(process.env.LAG ?? 0) / 1000;
const SLOTS = (process.env.SLOTS ?? 'light,heavy,special,ultimate').split(',') as AttackSlot[];
const MODES = (process.env.MODES ?? 'run,kite,hop').split(',') as Mode[];
const FIGHTERS = (process.env.FIGHTERS ? process.env.FIGHTERS.split(',') : (Object.keys(MOVES) as FighterId[]).filter(f => isReleasedFighter(f))) as FighterId[];
type Mode = 'run' | 'kite' | 'hop';
export type Tally = { casts: number; landed: number; dodged: number; minutes: number; misses?: Record<string, number> };

export function kiteRun(fighter: FighterId, slot: AttackSlot, mode: Mode, seed: number, seconds = SECONDS, lag = LAG): Tally {
  const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed });
  // As the server's rooms run (REWIND=0 to see a room without lag compensation).
  if (process.env.REWIND !== '0') sim.rewind = LAG_COMPENSATION;
  sim.addPlayer('a', fighter, 'A', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('b', 'taisei', 'B', false, { x: 0, y: 0, z: 3 });
  sim.place('a', { x: 0, y: 0, z: 0 }, 0); sim.place('b', { x: 0, y: 0, z: 3 }, Math.PI);
  for (let i = 0; i < 20; i++) sim.step(DT);
  sim.drainEvents();
  const A = sim.actors.get('a')!, B = sim.actors.get('b')!;
  const history: { t: number; s: PlayerState }[] = [];
  const tally: Tally = { casts: 0, landed: 0, dodged: 0, minutes: seconds / 60 };
  const reacting = (s: PlayerState) => !s.grounded && s.action !== 'jump' && s.action !== 'idle' && s.action !== 'run' || ['hurt', 'launched', 'knockdown', 'getup', 'stun', 'flinch', 'defeated'].includes(s.action);
  const counted = new Set<number>(), landed = new Set<number>(), dodged = new Set<number>();
  let sa = 0, sb = 0, nextPress = 0, nextDash = 0;
  const pending = new Map<number, number>(); let current: number | undefined;
  const move = MOVES[fighter][slot], reach = move.style === 'melee' ? meleeReach(fighter, slot, move) : Math.min(move.range, 14);
  for (let i = 0; i < seconds / DT; i++) {
    const now = sim.serverTime;
    history.push({ t: now, s: { ...B.state } });
    while (history.length > 2 && history[1].t <= now - lag) history.shift();
    const seen = lag > 0 ? history[0].s : B.state, view = lag > 0 ? history[0].t : now;
    const p = A.state, dx = seen.x - p.x, dz = seen.z - p.z, d = Math.hypot(dx, dz) || 1;
    if (slot === 'ultimate') p.ultimate = 100;
    p.stamina = p.maxStamina ?? 100;
    // The attacker: chase on the stick, swing when it looks close enough (a beat apart, as a hand presses).
    const wants = d < reach + 1.6 && now >= nextPress && !A.cast;
    if (wants) nextPress = now + .25;
    const chase = d > Math.max(1.2, reach * .7);
    // Out of reach by more than a step, a dash after them (a hand does not let a runner go at a jog).
    const dash = !A.cast && d > reach + 2.2 && d < 9 && now >= nextDash;
    if (dash) nextDash = now + .6;
    const input: PlayerInput = { seq: ++sa, moveX: chase ? dx / d : 0, moveZ: chase ? dz / d : 0, yaw: Math.atan2(dx, dz),
      targetId: 'b', lock: true, ...(wants ? { attack: slot } : {}), ...(dash ? { dash: true } : {}) };
    if (lag > 0) (input as PlayerInput & { view?: number }).view = view;
    sim.submitInput('a', input);
    // The target.
    const q = B.state, ex = q.x - p.x, ez = q.z - p.z, e = Math.hypot(ex, ez) || 1, t = i * DT;
    const weave = Math.floor(t / .7) % 2 ? 1 : -1;
    let mx = 0, mz = 0, jump = false, held = false;
    if (mode === 'hop') {
      // Round the attacker at two to three metres, jumping all the time.
      const want = 2.6, out = (e - want) * -.8;
      mx = ex / e * out - ez / e * weave; mz = ez / e * out + ex / e * weave;
      jump = q.grounded && i % 18 === 0; held = true;
    } else {
      mx = ex / e * .85 - ez / e * weave * .55; mz = ez / e * .85 + ex / e * weave * .55;
      if (mode === 'kite') { jump = q.grounded && t % 1.1 < DT * 2; held = true; }
    }
    const n = Math.hypot(mx, mz) || 1;
    sim.submitInput('b', { seq: ++sb, moveX: mx / n, moveZ: mz / n, yaw: Math.atan2(-ex, -ez), ...(jump ? { jump: true } : {}), jumpHeld: held });
    sim.step(DT);
    for (const ev of sim.drainEvents() as CombatEvent[]) {
      if (process.env.DIAG && ev.actorId === 'a' && ev.kind === 'release' && ev.contactIndex === 0 && ev.slot === slot && current !== undefined && counted.has(current) && !landed.has(current)) pending.set(current, sim.serverTime);
      if (ev.actorId === 'a' && ev.kind === 'cast' && ev.actionSeq !== undefined) current = ev.actionSeq;
      if (ev.actorId !== 'a' || ev.actionSeq === undefined) continue;
      // Only a swing thrown in the open counts: one into a body already reeling from the last is a combo, not a hit-rate.
      if (ev.kind === 'cast' && ev.slot === slot && !counted.has(ev.actionSeq) && !reacting(B.state)) { counted.add(ev.actionSeq); tally.casts++; }
      if (!counted.has(ev.actionSeq) || ev.targetId !== 'b') continue;
      if ((ev.kind === 'hit' || ev.kind === 'confirm' || ev.kind === 'blocked') && !landed.has(ev.actionSeq)) { landed.add(ev.actionSeq); tally.landed++; }
      if (ev.kind === 'dodge' && !dodged.has(ev.actionSeq)) { dodged.add(ev.actionSeq); tally.dodged++; }

    }
    if (process.env.DIAG) for (const [seq, at] of pending) if (sim.serverTime - at > .14) {
      pending.delete(seq);
      if (landed.has(seq)) continue;
      const P = A.state, Q = B.state, gx = Q.x - P.x, gz = Q.z - P.z, flat = Math.hypot(gx, gz), dy = Q.y - P.y;
      const off = Math.acos(Math.max(-1, Math.min(1, (Math.sin(P.yaw) * gx + Math.cos(P.yaw) * gz) / (flat || 1)))) * 57.3;
      const why = Math.abs(dy) > 1.5 ? (dy > 0 ? 'high' : 'low') : flat > reach + .5 ? 'far' : off > 40 ? 'off-line' : 'close-miss';
      (tally.misses ??= {})[why] = (tally.misses[why] ?? 0) + 1;
    }
    // Back to its feet: a knockdown or a death is not what is being measured.
    if (!B.state.alive || B.state.hp < 300) { B.state.hp = B.state.maxHp; B.state.alive = true; }
  }
  sim.dispose?.();
  return tally;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows: ({ fighter: FighterId; slot: AttackSlot; mode: Mode } & Tally)[] = [];
  for (const fighter of FIGHTERS) for (const slot of SLOTS) for (const mode of MODES) {
    const t = kiteRun(fighter, slot, mode, 17 + fighter.length * 31 + slot.length * 7 + mode.length);
    rows.push({ fighter, slot, mode, ...t });
  }
  const pct = (a: number, b: number) => b ? Math.round(a / b * 100) : 0;
  for (const mode of MODES) for (const slot of SLOTS) {
    const r = rows.filter(x => x.mode === mode && x.slot === slot), c = r.reduce((s, x) => s + x.casts, 0), l = r.reduce((s, x) => s + x.landed, 0);
    const minutes = r.reduce((s, x) => s + x.minutes, 0);
    const misses: Record<string, number> = {};
    for (const x of r) for (const [k, v] of Object.entries(x.misses ?? {})) misses[k] = (misses[k] ?? 0) + v;
    console.log(`${mode.padEnd(5)} ${slot.padEnd(9)} ${String(pct(l, c)).padStart(3)}%  ${process.env.DIAG ? JSON.stringify(misses) : ''}  (${l}/${c} casts, ${r.reduce((s, x) => s + x.dodged, 0)} dodged, ${(l / minutes).toFixed(1)} openings landed a minute)`);
  }
  const all = (m: Mode) => { const r = rows.filter(x => x.mode === m); return pct(r.reduce((s, x) => s + x.landed, 0), r.reduce((s, x) => s + x.casts, 0)); };
  console.log('overall', MODES.map(m => `${m} ${all(m)}%`).join('  '));
  if (process.env.WORST) {
    const worst = [...rows].filter(r => r.casts > 3).sort((a, b) => a.landed / a.casts - b.landed / b.casts).slice(0, Number(process.env.WORST));
    for (const r of worst) console.log('  worst', r.fighter, r.slot, r.mode, `${r.landed}/${r.casts}`);
  }
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ lag: LAG * 1000, seconds: SECONDS, rows }, null, 1));
}
