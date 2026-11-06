import { writeFileSync } from 'node:fs';
import { ArenaSimulation } from '../../src/game/simulation';
import { buildCollision, initRapier } from '../../src/game/rapierCollision';
import { stageColliders } from '../../src/game/environmentLayout';
import { MOVES, PLAYER_RADIUS } from '../../src/game/moves';
import { ROYALE_STAGES, STAGES, type StageId } from '../../src/game/stages';
import type { CombatEvent, FighterId, PlayerInput } from '../../src/game/types';

export type Behaviour = 'standing' | 'jogging' | 'strafing' | 'guarding';
export type Room = 'duel' | 'royale';
export type Hands = 'still' | 'stick' | 'soft';
export interface TrialSpec { fighter: FighterId; distance: number; behaviour: Behaviour; awakened?: boolean; room?: Room; hands?: Hands; variant?: number; victim?: FighterId;
  /** Thrown first, and the ultimate pressed as a player cancels into it once that has landed: the special (R pressed
   *  just after its last fist), or the heavy (just after its blow). */
  prelude?: Prelude }
/** When R goes down after the prelude's own press (seconds): just after the Gatling's ninth fist, or in the middle of
 *  it (after its fourth, a cancel); just after the Bazooka's palms. */
const PRELUDE_PRESS = { special: 1.3, 'special-mid': .8, heavy: .5 } as const;
export type Prelude = keyof typeof PRELUDE_PRESS;
export interface TrialResult {
  landed: boolean; finisher: boolean; verdict: 'confirm' | 'whiff' | 'none' | 'hit' | 'blocked' | 'guard-break' | 'dodge'; stage: StageId;
  /** Round 8 (ULT AIM): an area ultimate's (a bomb's) blast - where it went off, how far the partner's centre was from
   *  it then (m, along the floor), and how long the ball flew. */
  blast?: { x: number; z: number; off: number; flight: number };
  /** Centre to centre at the press, and at the opener's due time; how far the thrower travelled in between; how far
   *  the cast's line pointed off the partner then (degrees). */
  gapAtPress: number; gapAtOpener: number | null; travel: number | null; offAim: number | null; damage: number;
}

const DT = 1 / 60, PRE_ROLL = .8, AFTER = 2.6, JOG = .5, STRAFE_TURN = .7;
/** Round 8 (ULT AIM): an area ultimate (a bomb: no confirm) lands when its blast catches the partner - a hit, or a guard
 *  it blocks or breaks - and the partner keeps doing what it does until the blast has gone off (a hit-confirm opener is
 *  decided within 1.6 s of the press; a bomb is let go up to 1.5 s in and flies on). */
const areaWindow = (move: { confirm?: unknown; contacts: readonly number[] }) => move.confirm ? 1.6 : Math.max(1.6, move.contacts[0] + 1.6);
let ready: Promise<unknown> | undefined;
export const prepare = () => (ready ??= initRapier());

/** A small seeded stream (mulberry32), one per trial. */
function stream(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Whether a body standing at (x, z) on `stage` is inside it and clear of its landmarks (two capsule radii). */
function clear(stage: StageId, x: number, z: number) {
  const { halfX, halfZ } = STAGES[stage], gap = PLAYER_RADIUS * 2;
  if (Math.abs(x) > halfX - gap - .5 || Math.abs(z) > halfZ - gap - .5) return false;
  return !stageColliders(stage).landmarks.some(c => c.y - c.halfY < 1.8 && Math.abs(x - c.x) < c.halfX + gap && Math.abs(z - c.z) < c.halfZ + gap);
}

/** Where the pair stands: the thrower at `a`, the partner `distance` off along `(ux, uz)` - on clear ground, with
 *  clear ground between them and three metres either side of the partner (room to jog and circle), drawn off `rnd`. */
function placePair(stage: StageId, distance: number, rnd: () => number, room: Room) {
  const { halfX, halfZ } = STAGES[stage];
  for (let tries = 0; tries < 4000; tries++) {
    const bearing = rnd() * Math.PI * 2, ux = Math.sin(bearing), uz = Math.cos(bearing);
    const spread = room === 'duel' ? .25 : .8;
    const cx = (rnd() * 2 - 1) * halfX * spread, cz = (rnd() * 2 - 1) * halfZ * spread;
    const a = { x: cx - ux * distance / 2, z: cz - uz * distance / 2 }, b = { x: cx + ux * distance / 2, z: cz + uz * distance / 2 };
    let ok = true;
    for (let k = 0; k <= 12 && ok; k++) { const f = k / 12; ok = clear(stage, a.x + (b.x - a.x) * f, a.z + (b.z - a.z) * f); }
    for (const side of [-3, -1.5, 1.5, 3]) if (ok) ok = clear(stage, b.x + uz * side, b.z - ux * side) && clear(stage, a.x + uz * side * .5, a.z - ux * side * .5);
    if (ok) return { a, b, ux, uz };
  }
  throw new Error(`no clear ground for ${distance} m on ${stage}`);
}

export function trial(spec: TrialSpec): TrialResult {
  const { fighter, distance, behaviour, awakened = false, room = 'duel', hands = 'still', variant = 0, prelude } = spec;
  const PRE = prelude ? PRELUDE_PRESS[prelude] : PRE_ROLL;
  const rnd = stream(0x9e3779b9 ^ (variant * 7919 + Math.round(distance * 131) + ['standing', 'jogging', 'strafing', 'guarding'].indexOf(behaviour) * 104729 + (awakened ? 31337 : 0) + (room === 'royale' ? 65537 : 0) + (prelude === 'special' ? 3571 : prelude === 'heavy' ? 7883 : prelude ? 9973 : 0)));
  const stage: StageId = room === 'duel' ? 'sunfall-arena' : ROYALE_STAGES[variant % ROYALE_STAGES.length];
  const sim = new ArenaSimulation({ roomMode: 'match', stage, collision: buildCollision(stage), seed: 1 + variant });
  const victim: FighterId = spec.victim ?? (fighter === 'taisei' ? 'ouga' : 'taisei');
  sim.addPlayer('a', fighter, 'A', false);
  sim.addPlayer('b', victim, 'B', false);
  // A royale's crowd: two more fighters well away from the pair, standing (they never come into it).
  if (room === 'royale') { sim.addPlayer('c', 'konta', 'C', false); sim.addPlayer('d', 'kenzo', 'D', false); }
  sim.startMatch();
  const { a: at, b: bt, ux, uz } = placePair(stage, distance, rnd, room);
  // Across the line: (uz, -ux) or its opposite.
  const side = rnd() < .5 ? 1 : -1, px = uz * side, pz = -ux * side;
  const jogFrom = behaviour === 'jogging' ? 3.75 * PRE : 0;
  sim.place('a', { x: at.x, y: 0, z: at.z }, Math.atan2(ux, uz));
  sim.place('b', { x: bt.x - px * jogFrom, y: 0, z: bt.z - pz * jogFrom }, Math.atan2(-ux, -uz));
  if (room === 'royale') {
    const { halfX, halfZ } = STAGES[stage];
    let k = 0;
    for (const id of ['c', 'd']) for (let tries = 0; tries < 400; tries++) {
      const x = (rnd() * 2 - 1) * (halfX - 2), z = (rnd() * 2 - 1) * (halfZ - 2);
      if (clear(stage, x, z) && Math.hypot(x - at.x, z - at.z) > 16 && Math.hypot(x - bt.x, z - bt.z) > 16) { sim.place(id, { x, y: 0, z }, 0); k++; break; }
    }
    void k;
  }
  const A = sim.actors.get('a')!, B = sim.actors.get('b')!;
  A.state.ultimate = 100;
  if (awakened) { A.state.awakened = true; A.state.awakenedUntil = 1e9; }
  const events: CombatEvent[] = [];
  const seq: Record<string, number> = { a: 1, b: 1, c: 1, d: 1 };
  // When the circling partner turns back, relative to the press.
  const turnPhase = rnd() * STRAFE_TURN;
  const move = MOVES[fighter].ultimate;
  let pressAt = 0, opener: { gap: number; travel: number; off: number } | null = null, from = { x: 0, z: 0 };
  const hp0 = B.state.hp;
  const area = !move.confirm, until = areaWindow(move);
  const total = Math.round((PRE + (area ? Math.max(AFTER, move.contacts[0] + 2) : AFTER)) / DT);
  // A bomb in flight (the simulation's own list): where it is going, and when it was let go.
  const shots = (sim as unknown as { projectiles: { actorId: string; slot: string; end: { x: number; z: number }; startAt: number }[] }).projectiles;
  let flying: { x: number; z: number; startAt: number } | undefined, blast: TrialResult['blast'];
  for (let i = 0; i < total; i++) {
    const t = i * DT - PRE, p = A.state, q = B.state;
    const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz) || 1;
    const press = i === Math.round(PRE / DT);
    if (press) { pressAt = sim.serverTime + DT; from = { x: p.x, z: p.z }; }
    const chasing = hands === 'stick' && t >= 0 && t <= move.contacts[0] + .05;
    const mine: PlayerInput = { seq: seq.a++, moveX: chasing ? dx / d : 0, moveZ: chasing ? dz / d : 0, yaw: Math.atan2(dx, dz),
      targetId: 'b', lock: hands !== 'soft', attack: press ? 'ultimate' : prelude && i === 0 ? (prelude === 'heavy' ? 'heavy' : 'special') : undefined };
    sim.submitInput('a', mine);
    // The partner.
    let mx = 0, mz = 0;
    if (behaviour === 'jogging' && t < until) { mx = px * JOG; mz = pz * JOG; }
    if (behaviour === 'strafing' && t < until) {
      const leg = Math.floor((t + PRE + turnPhase) / STRAFE_TURN), dir = (leg % 2 === 0 ? 1 : -1) * side;
      mx = -dz / d * dir; mz = dx / d * dir;
    }
    sim.submitInput('b', { seq: seq.b++, moveX: mx, moveZ: mz, yaw: Math.atan2(-dx, -dz), guard: behaviour === 'guarding' && t < until });
    for (const id of ['c', 'd']) if (sim.actors.has(id)) sim.submitInput(id, { seq: seq[id]++, moveX: 0, moveZ: 0, yaw: 0 });
    sim.step(DT);
    events.push(...sim.drainEvents());
    if (area && !blast) {
      const shot = shots.find(s => s.actorId === 'a' && s.slot === 'ultimate');
      if (shot) flying = { x: shot.end.x, z: shot.end.z, startAt: shot.startAt };
      else if (flying) blast = { x: +flying.x.toFixed(2), z: +flying.z.toFixed(2), off: +Math.hypot(B.state.x - flying.x, B.state.z - flying.z).toFixed(2), flight: +(sim.serverTime - flying.startAt).toFixed(3) };
    }
    // The opener's due time: where the two are, and where the cast's line points.
    if (!opener && t >= 0 && A.cast?.slot === 'ultimate' && sim.serverTime - A.cast.start >= move.contacts[0] - 1e-9) {
      const c = A.cast, ex = B.state.x - A.state.x, ez = B.state.z - A.state.z, n = Math.hypot(ex, ez) || 1;
      const cos = (c.direction.x * ex + c.direction.z * ez) / (Math.hypot(c.direction.x, c.direction.z) * n || 1);
      opener = { gap: n, travel: Math.hypot(A.state.x - from.x, A.state.z - from.z), off: Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI };
    }
  }
  const mineEvents = events.filter(e => e.actorId === 'a');
  const confirm = mineEvents.find(e => e.kind === 'confirm' && e.targetId === 'b');
  const whiff = mineEvents.find(e => e.kind === 'whiff');
  const finisher = mineEvents.some(e => e.kind === 'hit' && e.targetId === 'b' && e.contactIndex === move.contacts.length - 1);
  // An area ultimate's blast on the partner: hit, blocked, or through a guard; or slipped (a dodge).
  const caught = area ? mineEvents.find(e => e.slot === 'ultimate' && e.targetId === 'b' && (e.kind === 'hit' || e.kind === 'blocked' || e.kind === 'guard-break')) : undefined;
  const slipped = area && mineEvents.some(e => e.slot === 'ultimate' && e.targetId === 'b' && e.kind === 'dodge');
  const verdict: TrialResult['verdict'] = confirm ? 'confirm' : caught ? caught.kind as TrialResult['verdict'] : slipped ? 'dodge' : whiff ? 'whiff' : 'none';
  const result: TrialResult = { landed: area ? !!caught : !!confirm, finisher, verdict, stage, ...(blast ? { blast } : {}),
    gapAtPress: +Math.hypot(bt.x - at.x, bt.z - at.z).toFixed(2), gapAtOpener: opener ? +opener.gap.toFixed(2) : null,
    travel: opener ? +opener.travel.toFixed(2) : null, offAim: opener ? +opener.off.toFixed(1) : null, damage: hp0 - B.state.hp };
  void pressAt;
  sim.dispose();
  return result;
}

export const DISTANCES = [3, 6, 9, 12] as const;
export const BEHAVIOURS: readonly Behaviour[] = ['standing', 'jogging', 'strafing', 'guarding'];

/** One cell of the table: `trials` trials, the share that landed. */
export function cell(spec: Omit<TrialSpec, 'variant'>, trials: number) {
  const runs: TrialResult[] = [];
  for (let v = 0; v < trials; v++) runs.push(trial({ ...spec, variant: v }));
  return { rate: runs.filter(r => r.landed).length / trials, finisher: runs.filter(r => r.finisher).length / trials, runs };
}

/** Ground hits (8 October 2026): when R goes down after the knockdown ender (combos.ts `lllh`: Light, Light, Light,
 *  Heavy, a press every 0.24 s from 1.6 m) has put the partner on the floor - seconds after the body is down. Early, the
 *  opener comes due while it is still down; late, while it is getting up (both used to be evade: a dodge, and a whiff). */
export const ENDER_DELAYS = [.05, .3, .55, .8] as const;
export interface EnderResult { knocked: boolean; landed: boolean; finisher: boolean; verdict: 'confirm' | 'whiff' | 'none'; at: string; stage: StageId; damage: number }

/** One ender then R: the same seeded placement as `trial` (`distance` 1.6 m), the thrower Tab-locked on the partner, who
 *  stands still. `at` is what the partner was when the ultimate's first blow (or stop) reached it. */
export function enderTrial(fighter: FighterId, delay: number, room: Room, variant: number, victim: FighterId = fighter === 'taisei' ? 'ouga' : 'taisei'): EnderResult {
  const rnd = stream(0x51ed27 ^ (variant * 7919 + Math.round(delay * 1000) + (room === 'royale' ? 65537 : 0)));
  const stage: StageId = room === 'duel' ? 'sunfall-arena' : ROYALE_STAGES[variant % ROYALE_STAGES.length];
  const sim = new ArenaSimulation({ roomMode: 'match', stage, collision: buildCollision(stage), seed: 1 + variant });
  sim.addPlayer('a', fighter, 'A', false);
  sim.addPlayer('b', victim, 'B', false);
  sim.startMatch();
  // Room behind the partner for the throw: the pair at one end of eight metres of clear ground.
  const { a: at, ux, uz } = placePair(stage, 8, rnd, room);
  sim.place('a', { x: at.x, y: 0, z: at.z }, Math.atan2(ux, uz));
  sim.place('b', { x: at.x + ux * 1.6, y: 0, z: at.z + uz * 1.6 }, Math.atan2(-ux, -uz));
  const A = sim.actors.get('a')!, B = sim.actors.get('b')!;
  const events: CombatEvent[] = [];
  let seq = 1, seqB = 1, downAt = -1, pressed = false, atFirst = '';
  const hp0 = B.state.hp;
  for (let i = 0; i < Math.round(6 / DT); i++) {
    const t = i * DT, p = A.state, q = B.state, dx = q.x - p.x, dz = q.z - p.z;
    if (downAt < 0 && B.reaction === 'knockdown') downAt = sim.serverTime;
    const string = [0, .24, .48, .72].findIndex(s => Math.abs(t - s) < DT / 2);
    let attack: PlayerInput['attack'] = string >= 0 ? (string < 3 ? 'light' : 'heavy') : undefined;
    if (!pressed && downAt >= 0 && sim.serverTime >= downAt + delay) { attack = 'ultimate'; pressed = true; A.state.ultimate = 100; }
    sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: 0, yaw: Math.atan2(dx, dz), targetId: 'b', lock: true, attack });
    sim.submitInput('b', { seq: seqB++, moveX: 0, moveZ: 0, yaw: Math.atan2(-dx, -dz) });
    const was = B.reaction ?? 'free';
    sim.step(DT);
    for (const e of sim.drainEvents()) {
      events.push(e);
      if (!atFirst && e.actorId === 'a' && e.slot === 'ultimate' && (e.kind === 'hit' || e.kind === 'dodge' || e.kind === 'confirm')) atFirst = was;
    }
  }
  const mine = events.filter(e => e.actorId === 'a' && e.slot === 'ultimate');
  const confirm = mine.find(e => e.kind === 'confirm' && e.targetId === 'b'), whiff = mine.find(e => e.kind === 'whiff');
  const last = MOVES[fighter].ultimate.contacts.length - 1;
  const finisher = mine.some(e => e.kind === 'hit' && e.targetId === 'b' && (e.contactIndex ?? 0) === last);
  sim.dispose();
  return { knocked: downAt >= 0, landed: !!confirm || (!MOVES[fighter].ultimate.confirm && mine.some(e => e.kind === 'hit' && e.targetId === 'b')),
    finisher, verdict: confirm ? 'confirm' : whiff ? 'whiff' : 'none', at: atFirst || 'none', stage, damage: hp0 - B.state.hp };
}

/** Round 7 (WARD ULT): the fighter under study - ULT_FIGHTER, Gummy unless set: the one measured awakened as well, and
 *  the one a candidate is for. */
export const FOCUS = (process.env.ULT_FIGHTER ?? 'gummy') as FighterId;

/** A candidate opener tried without editing moves.ts: `GUMMY_ULT='{"range":11,...}'` merged over his ultimate (a
 *  null removes a field), `"reach"` standing in for his measured reach (contactReach.json - which a REACH_OVERRIDE row
 *  shadows, as Gummy's own does since round 6). Round 7: `ULT='{...}'` is the same for the ULT_FIGHTER. */
export async function candidate(json: string | undefined, fighter: FighterId = 'gummy') {
  if (!json) return;
  const over = JSON.parse(json) as Record<string, unknown>;
  const move = MOVES[fighter].ultimate as unknown as Record<string, unknown>;
  if (over.reach !== undefined) {
    const reach = (await import('../../src/game/data/contactReach.json')).default as unknown as Record<string, Record<string, number>>;
    (reach[fighter] ??= {}).ultimate = over.reach as number; delete over.reach;
  }
  for (const [k, v] of Object.entries(over)) { if (v === null) delete move[k]; else move[k] = v; }
}
/** Both candidates the environment names: GUMMY_ULT for Gummy, ULT for the ULT_FIGHTER. */
export async function candidates() { await candidate(process.env.GUMMY_ULT, 'gummy'); await candidate(process.env.ULT, FOCUS); }

if (import.meta.url === `file://${process.argv[1]}`) {
  await prepare();
  await candidates();
  const out = process.argv[2], label = process.argv[3] ?? 'run';
  const trials = Number(process.env.TRIALS ?? 24);
  const fighters = (process.env.FIGHTERS ?? [...new Set([FOCUS, 'gummy', 'kenzo', 'shirokane', 'kosho', 'nigo', 'koko'])].join(',')).split(',') as FighterId[];
  const handsList = (process.env.HANDS ?? 'still,stick').split(',') as Hands[];
  const rooms = (process.env.ROOMS ?? 'duel,royale').split(',') as Room[];
  const forms = (process.env.FORMS ?? 'fresh,awakened').split(',');
  const table: Record<string, unknown> = {};
  const pct = (v: number) => `${Math.round(v * 100)}`.padStart(4);
  // ENDER=1: the knockdown ender, then R ENDER_DELAYS seconds after the body is down (ground hits, 8 October 2026).
  if (process.env.ENDER) {
    for (const fighter of fighters) for (const room of rooms) {
      let line = `lllh>R ${fighter.padEnd(13)} ${room.padEnd(6)}`;
      const row: Record<string, unknown> = {};
      for (const delay of ENDER_DELAYS) {
        const runs = Array.from({ length: trials }, (_, v) => enderTrial(fighter, delay, room, v));
        const knocked = runs.filter(r => r.knocked), landed = knocked.filter(r => r.landed);
        const at: Record<string, number> = {};
        for (const r of knocked) at[r.at] = (at[r.at] ?? 0) + 1;
        row[`+${delay}s`] = { knocked: knocked.length, rate: knocked.length ? landed.length / knocked.length : 0,
          finisher: knocked.length ? knocked.filter(r => r.finisher).length / knocked.length : 0, at, misses: knocked.filter(r => !r.landed).slice(0, 4) };
        line += `${pct(knocked.length ? landed.length / knocked.length : 0)}${knocked.length < trials ? `(${knocked.length})` : ''}`;
      }
      console.log(line);
      table[`lllh>R/${fighter}/${room}`] = row;
    }
    console.log(`(columns: R pressed ${ENDER_DELAYS.join(' / ')} s after the knockdown ender put them down - % of ${trials} trials (of those knocked down) whose ultimate landed)`);
    if (out) writeFileSync(out, JSON.stringify({ label, when: new Date().toISOString(), trials, delays: ENDER_DELAYS, table }, null, 1) + '\n');
    process.exit(0);
  }
  // PRELUDE=special,heavy: the cancels a player makes into it, at a standing partner (columns: 3 6 9 12 m).
  if (process.env.PRELUDE) {
    for (const prelude of process.env.PRELUDE.split(',') as Prelude[]) for (const fighter of fighters) for (const room of rooms) for (const form of forms) {
      if (fighter !== FOCUS && form === 'awakened' && !process.env.ALL_FORMS) continue;
      let line = `${prelude.padEnd(11)}>R ${fighter.padEnd(8)} ${room.padEnd(6)} ${form.padEnd(8)}`;
      const row: Record<string, unknown> = {};
      for (const distance of DISTANCES) {
        const c = cell({ fighter, distance, behaviour: 'standing', awakened: form === 'awakened', room, hands: 'still', prelude }, trials);
        row[`${prelude}-${distance}`] = { rate: c.rate, finisher: c.finisher,
          misses: c.runs.filter(r => !r.landed).slice(0, 4).map(r => ({ gap: r.gapAtPress, atOpener: r.gapAtOpener, travel: r.travel, off: r.offAim, stage: r.stage })) };
        line += pct(c.rate);
      }
      console.log(line);
      table[`${prelude}>R/${fighter}/${room}/${form}`] = row;
    }
    if (out) writeFileSync(out, JSON.stringify({ label, when: new Date().toISOString(), trials, distances: DISTANCES, table }, null, 1) + '\n');
    process.exit(0);
  }
  for (const fighter of fighters) for (const hands of handsList) for (const room of rooms) for (const form of forms) {
    // The comparison fighters: fresh only, unless asked.
    if (fighter !== FOCUS && form === 'awakened' && !process.env.ALL_FORMS) continue;
    const row: Record<string, unknown> = {};
    let line = `${fighter.padEnd(8)} ${hands.padEnd(5)} ${room.padEnd(6)} ${form.padEnd(8)}`;
    for (const behaviour of BEHAVIOURS) {
      for (const distance of DISTANCES) {
        const c = cell({ fighter, distance, behaviour, awakened: form === 'awakened', room, hands }, trials);
        row[`${behaviour}-${distance}`] = { rate: c.rate, finisher: c.finisher,
          misses: c.runs.filter(r => !r.landed).slice(0, 4).map(r => ({ gap: r.gapAtPress, atOpener: r.gapAtOpener, travel: r.travel, off: r.offAim, stage: r.stage })) };
        line += pct(c.rate);
      }
      line += ' |';
    }
    console.log(line);
    table[`${fighter}/${hands}/${room}/${form}`] = row;
  }
  console.log(`(columns: standing 3 6 9 12 | jogging 3 6 9 12 | strafing 3 6 9 12 | guarding 3 6 9 12 - % of ${trials} trials whose opener confirmed)`);
  if (out) writeFileSync(out, JSON.stringify({ label, when: new Date().toISOString(), trials, distances: DISTANCES, behaviours: BEHAVIOURS, table }, null, 1) + '\n');
}
