import * as THREE from 'three';
import { ArenaSimulation } from '../src/game/simulation';
import { CombatTimeline } from '../src/render/CombatTimeline';
import { Fighter } from '../src/render/Fighter';
import { LANDED } from '../src/game/landedBlows';
import { Prediction } from '../src/game/prediction';
import { MOVES } from '../src/game/moves';
import { rushMove } from '../src/game/awakening';
import { assembleFighter, popBase } from './popHarness';
import type { AttackSlot, CombatEvent, FighterId, PlayerInput, PlayerState } from '../src/game/types';

/** Round 3e (REACT): the third blind critic's motion measure, headless.
 *
 *  The critic sampled the right hand and the head in the body's own space on
 *  every drawn frame, and flagged a frame whose step was over 8 cm (hand) or
 *  6 cm (head) and over three times the median of the four neighbouring
 *  frames' steps plus 2 cm (`criticPops`, its lib.mjs `pops`). This repeats
 *  its two captures that matter here without a browser:
 *  - `victimRun`: a body taking a scripted string - the simulation the server
 *    runs, broadcast at 30 Hz into the client's own CombatTimeline a one-way
 *    trip late and drawn from it (as every remote body is, and the local one
 *    while the server owns it), each event handed to `impact` as main.ts
 *    hands it over, the ledger fed as the client feeds it;
 *  - `localRun`: the local fighter's own moves (dashes, specials), drawn from
 *    the newest tick of its own simulation as `Prediction.sample` draws it.
 *  scripts/probe_react.mts prints the roster. */
export const TICK = 1 / 60;
export type ReactSample = { t: number; action: string; clip?: string; ct?: number; blend?: number; el: number; head: number[]; hand: number[]; hips?: number[]; group: number[]; grounded: boolean };
export type Press = { tick: number; attack?: AttackSlot; move?: [number, number]; dash?: boolean; jump?: boolean; guard?: boolean };
export type ReactOptions = { latency?: number; rate?: number; jitter?: number; seed?: number; delay?: number };

/** mulberry32 */
export function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6d2b79f5) | 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(2 * Math.PI * r());
const frameStep = (r: () => number, rate: number, jitter: number) => Math.max(.008, Math.min(.034, 1 / rate + gauss(r) * jitter / 1000));

/** The critic's rule (its lib.mjs `pops`), over one key of the samples. */
export function criticPops(rows: ReactSample[], key: 'head' | 'hand' | 'hips', thresholdCm: number) {
  const d: ({ i: number; dist: number } | null)[] = [];
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1][key], b = rows[i][key];
    if (!a || !b) { d.push(null); continue; }
    const dt = (rows[i].t - rows[i - 1].t) * 1000;
    d.push({ i, dist: Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * 100 * (16.67 / Math.max(8, dt)) });
  }
  const out: { i: number; cm: number; n: number; action: string; clip: string; blend?: number; ct?: number }[] = [];
  for (let k = 0; k < d.length; k++) {
    const c = d[k]; if (!c) continue;
    const nb = [d[k - 2], d[k - 1], d[k + 1], d[k + 2]].filter((x): x is { i: number; dist: number } => !!x).map(x => x.dist).sort((a, b) => a - b);
    const med = nb.length ? nb[Math.floor(nb.length / 2)] : 0;
    if (c.dist > thresholdCm && c.dist > 3 * med + 2) {
      const s = rows[c.i], p = rows[c.i - 1];
      out.push({ i: c.i, cm: +c.dist.toFixed(1), n: +med.toFixed(1), action: `${p.action}->${s.action}`, clip: `${p.clip}->${s.clip}`, blend: s.blend, ct: s.ct });
    }
  }
  return out;
}
/** Hand (8 cm) and head (6 cm) pops together, the critic's thresholds. */
export const allPops = (rows: ReactSample[]) => [...criticPops(rows, 'hand', 8).map(p => ({ ...p, key: 'hand' })), ...criticPops(rows, 'head', 6).map(p => ({ ...p, key: 'head' }))];

const v3 = new THREE.Vector3();
function sample(body: Fighter, t: number, state: PlayerState): ReactSample {
  const e = body.motionEvidence();
  const hipsBone = body.joints.get('Hips');
  const hips = hipsBone ? body.group.worldToLocal(hipsBone.getWorldPosition(v3)).toArray() : undefined;
  return { t, action: e.action, clip: e.clip, ct: e.clipTime, blend: e.blend, el: e.elapsed, head: e.head ?? [0, 0, 0], hand: e.handR ?? [0, 0, 0], hips, group: body.group.position.toArray(), grounded: state.grounded };
}
export async function buildBody(id: FighterId, name: string) {
  const { source, rush } = await assembleFighter(id);
  const body = new Fighter(popBase(id, name), source, false, rush);
  body.prepareRush();
  return body;
}
const styleOf = (e: CombatEvent) => e.fighter && e.slot ? (e.slot === 'light' && (e.chain ?? 0) > 0 ? rushMove(e.fighter, e.chain!, false) : MOVES[e.fighter][e.slot]).style : undefined;

/** Taisei strings seven lights into the victim, launches it with his heavy,
 *  chases the launch with four lights (the air string re-hitting a body
 *  already launched), launches again and strings three more - the browser
 *  capture's scripted re-hit segment (scripts/capture_react.mjs). */
export const REHIT: Press[] = [
  ...[0, 9, 18, 27, 36, 45, 54].map(t => ({ tick: 30 + t, attack: 'light' as const })),
  { tick: 30 + 114, attack: 'heavy' }, ...[141, 150, 159, 168].map(t => ({ tick: 30 + t, attack: 'light' as const })),
  { tick: 30 + 234, attack: 'heavy' }, ...[261, 270, 279].map(t => ({ tick: 30 + t, attack: 'light' as const })),
];

/** A body taking `presses` from `attacker`, drawn as the client draws a body
 *  the server owns. Returns the victim's samples and the events handed over. */
export function victimRun(victim: Fighter, striker: Fighter, presses: Press[], ticks: number, options: ReactOptions = {}) {
  const latency = options.latency ?? .05, rate = options.rate ?? 60, jitter = options.jitter ?? 1.8, random = rng(options.seed ?? 7);
  const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 11 });
  sim.addPlayer('a', striker.state.fighter, 'A', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('b', victim.state.fighter, 'B', false, { x: 0, y: 0, z: 1.6 });
  sim.startMatch();
  LANDED.reset();
  const timeline = new CombatTimeline({ delayMs: options.delay ?? 60 });
  const inbox: { at: number; snapshot: ReturnType<ArenaSimulation['snapshot']> }[] = [];
  let tick = 0, seq = 0, clock = 0;
  const samples: ReactSample[] = [], handed: CombatEvent[] = [];
  const step = () => {
    const press = presses.find(p => p.tick === tick);
    const a = sim.getPlayer('a')!, b = sim.getPlayer('b')!;
    const yaw = Math.atan2(b.x - a.x, b.z - a.z);
    const input: PlayerInput = { seq: ++seq, moveX: press?.move?.[0] ?? 0, moveZ: press?.move?.[1] ?? 0, yaw, targetId: 'b', lock: true };
    if (press?.attack) input.attack = press.attack;
    if (press?.dash) input.dash = true;
    if (press?.jump) input.jump = true;
    sim.submitInput('a', input);
    sim.submitInput('b', { seq, moveX: 0, moveZ: 0, yaw: Math.atan2(a.x - b.x, a.z - b.z) });
    sim.step(); tick++;
    if (tick % 2 === 0) inbox.push({ at: tick * TICK + latency, snapshot: sim.snapshot(true) });
  };
  try {
    while (tick < ticks) {
      const frame = frameStep(random, rate, jitter);
      clock += frame;
      while ((tick + 1) * TICK <= clock + 1e-9) step();
      while (inbox.length && inbox[0].at <= clock + 1e-9) {
        const { at, snapshot } = inbox.shift()!;
        LANDED.authoritative(snapshot, 'b');
        timeline.push(snapshot, at * 1000);
      }
      const presented = timeline.sample(clock * 1000);
      if (!presented) continue;
      const shownA = presented.snapshot.players.find(p => p.id === 'a')!, shownB = presented.snapshot.players.find(p => p.id === 'b')!;
      for (const e of presented.events) {
        handed.push(e);
        if ((e.kind !== 'hit' && e.kind !== 'blocked') || !e.endpoint || !e.damage) continue;
        const heading = e.origin ? new THREE.Vector3(e.endpoint.x - e.origin.x, e.endpoint.y - e.origin.y, e.endpoint.z - e.origin.z) : undefined;
        const landed = e.kind === 'hit', detail = { chain: e.chain, fromBehind: e.fromBehind, reaction: e.reaction, ...(e.lift ? { lift: e.lift } : {}) };
        const struck = e.targetId === 'b' ? victim : e.targetId === 'a' ? striker : undefined, by = e.actorId === 'a' ? striker : victim;
        struck?.impact(true, e.slot, styleOf(e), e.contactIndex, heading, landed ? e.damage : e.damage * 2.2, e.endpoint.y - (e.targetId === 'b' ? shownB.y : shownA.y), detail);
        if (landed && (e.slot === 'light' || e.slot === 'heavy')) by.impact(false, e.slot, undefined, undefined, heading, e.damage, undefined, detail);
        if (!landed) by.impact(false, e.slot, undefined, undefined, heading, e.damage, undefined, detail);
      }
      LANDED.deliver(presented.events); LANDED.clock = presented.time;
      striker.targetDistance = victim.targetDistance = Math.hypot(shownB.x - shownA.x, shownB.z - shownA.z);
      striker.targetPoint = (striker.targetPoint ?? new THREE.Vector3()).set(shownB.x, shownB.y + 1.45, shownB.z);
      victim.targetPoint = (victim.targetPoint ?? new THREE.Vector3()).set(shownA.x, shownA.y + 1.45, shownA.z);
      striker.update(Math.min(frame, .05), shownA, true, frame);
      victim.update(Math.min(frame, .05), shownB, true, frame);
      (Fighter as unknown as { settleContacts(): void }).settleContacts();
      if (tick >= 30) samples.push(sample(victim, clock, shownB));
    }
  } finally { sim.dispose(); }
  return { samples, events: handed };
}

/** The local fighter pressing `presses` itself, beside a standing opponent
 *  `gap` metres ahead: drawn from the newest tick of its own simulation, its
 *  position eased between the last two (Prediction.sample). */
export function localRun(body: Fighter, other: Fighter, presses: Press[], ticks: number, gap = 3, options: ReactOptions = {}) {
  const rate = options.rate ?? 60, jitter = options.jitter ?? 1.8, random = rng(options.seed ?? 7);
  const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 11 });
  sim.addPlayer('a', body.state.fighter, 'A', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('b', other.state.fighter, 'B', false, { x: 0, y: 0, z: gap });
  sim.startMatch();
  LANDED.reset();
  let tick = 0, seq = 0, clock = 0, previous = { ...sim.getPlayer('a')! };
  const samples: ReactSample[] = [];
  const held: { move?: [number, number] } = {};
  const step = () => {
    const press = presses.find(p => p.tick === tick);
    if (press && 'move' in press) held.move = press.move;
    previous = { ...sim.getPlayer('a')! };
    const input: PlayerInput = { seq: ++seq, moveX: held.move?.[0] ?? 0, moveZ: held.move?.[1] ?? 0, yaw: 0, targetId: 'b', lock: true };
    if (press?.attack) input.attack = press.attack;
    if (press?.dash) input.dash = true;
    if (press?.jump) input.jump = true;
    if (press?.guard) input.guard = true;
    sim.submitInput('a', input);
    sim.submitInput('b', { seq, moveX: 0, moveZ: 0, yaw: Math.PI });
    sim.step(); tick++;
  };
  try {
    while (tick < ticks) {
      const frame = frameStep(random, rate, jitter);
      clock += frame;
      while ((tick + 1) * TICK <= clock + 1e-9) step();
      const alpha = THREE.MathUtils.clamp((clock - tick * TICK) / TICK, 0, 1);
      const a = sim.getPlayer('a')!, b = sim.getPlayer('b')!;
      const shown: PlayerState = { ...a, x: previous.x + (a.x - previous.x) * alpha, y: previous.y + (a.y - previous.y) * alpha, z: previous.z + (a.z - previous.z) * alpha };
      body.targetDistance = other.targetDistance = Math.hypot(b.x - shown.x, b.z - shown.z);
      body.targetPoint = (body.targetPoint ?? new THREE.Vector3()).set(b.x, b.y + 1.45, b.z);
      other.targetPoint = (other.targetPoint ?? new THREE.Vector3()).set(shown.x, shown.y + 1.45, shown.z);
      body.update(Math.min(frame, .05), shown, true, frame);
      other.update(Math.min(frame, .05), { ...b }, true, frame);
      (Fighter as unknown as { settleContacts(): void }).settleContacts();
      if (tick >= 30) samples.push(sample(body, clock, shown));
    }
  } finally { sim.dispose(); }
  return samples;
}

/** The critic's movement script around its dash (critic_motion.mjs), with two
 *  more entries: a dash out of a forward run, out of a strafe, out of a
 *  backward run (the backdash), out of standing, and out of a light. */
export const DASHES: Press[] = [
  { tick: 40, move: [0, 1] }, { tick: 76, dash: true }, { tick: 100, move: undefined },
  { tick: 150, move: [1, 0] }, { tick: 186, dash: true }, { tick: 210, move: undefined },
  { tick: 260, move: [0, -1] }, { tick: 296, dash: true }, { tick: 320, move: undefined },
  { tick: 380, dash: true },
  { tick: 450, attack: 'light' }, { tick: 462, dash: true },
];
export const DASH_TICKS = 540;

/** The LOCAL fighter taking `presses` from a remote striker: the client's own
 *  Prediction (the local copy, reconciled on each snapshot a one-way trip
 *  late) drawing the body, the timeline a display delay behind for the
 *  striker and for every event, as main.ts does - the critic's "hurt"
 *  segment, where the body it measured was its own. */
export function localVictimRun(victim: Fighter, striker: Fighter, presses: Press[], ticks: number, options: ReactOptions = {}) {
  const latency = options.latency ?? .05, rate = options.rate ?? 60, jitter = options.jitter ?? 1.8, random = rng(options.seed ?? 7);
  const server = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 11 });
  server.addPlayer('a', striker.state.fighter, 'A', false, { x: 0, y: 0, z: 0 });
  server.addPlayer('b', victim.state.fighter, 'B', false, { x: 0, y: 0, z: 1.6 });
  server.startMatch();
  LANDED.reset();
  const prediction = new Prediction();
  prediction.start('b', server.snapshot(true, true));
  const timeline = new CombatTimeline({ delayMs: options.delay ?? 60 });
  const upload: { at: number; input: PlayerInput }[] = [], inbox: { at: number; snapshot: ReturnType<ArenaSimulation['snapshot']> }[] = [];
  let tick = 0, seq = 0, clock = 0, sent = 0;
  const samples: ReactSample[] = [];
  const step = () => {
    const press = presses.find(p => p.tick === tick);
    const a = server.getPlayer('a')!, b = server.getPlayer('b')!;
    const input: PlayerInput = { seq: ++seq, moveX: 0, moveZ: 0, yaw: Math.atan2(b.x - a.x, b.z - a.z), targetId: 'b', lock: true };
    if (press?.attack) input.attack = press.attack;
    server.submitInput('a', input);
    while (upload.length && upload[0].at <= tick * TICK + 1e-9) server.submitInput('b', upload.shift()!.input);
    server.step(); tick++;
    if (tick % 2 === 0) inbox.push({ at: tick * TICK + latency, snapshot: server.snapshot(true, true) });
  };
  try {
    while (tick < ticks) {
      const frame = frameStep(random, rate, jitter);
      clock += frame;
      while ((tick + 1) * TICK <= clock + 1e-9) {
        // The local fighter stands still: one input a tick, a one-way trip to the server.
        const input: PlayerInput = { seq: ++sent, moveX: 0, moveZ: 0, yaw: Math.PI };
        prediction.submit(input); upload.push({ at: tick * TICK + latency, input });
        step();
      }
      while (inbox.length && inbox[0].at <= clock + 1e-9) {
        const { at, snapshot } = inbox.shift()!;
        prediction.reconcile(snapshot);
        timeline.push(snapshot, at * 1000);
      }
      const presented = timeline.sample(clock * 1000);
      if (!presented) continue;
      const shownA = presented.snapshot.players.find(p => p.id === 'a')!, serverB = presented.snapshot.players.find(p => p.id === 'b')!;
      const shownB = prediction.sample(frame, serverB, THREE.MathUtils.clamp((clock - tick * TICK) / TICK, 0, 1)) ?? serverB;
      for (const e of presented.events) {
        if ((e.kind !== 'hit' && e.kind !== 'blocked') || !e.endpoint || !e.damage) continue;
        const heading = e.origin ? new THREE.Vector3(e.endpoint.x - e.origin.x, e.endpoint.y - e.origin.y, e.endpoint.z - e.origin.z) : undefined;
        const landed = e.kind === 'hit', detail = { chain: e.chain, fromBehind: e.fromBehind, reaction: e.reaction, ...(e.lift ? { lift: e.lift } : {}) };
        const struck = e.targetId === 'b' ? victim : striker, by = e.actorId === 'a' ? striker : victim;
        struck.impact(true, e.slot, styleOf(e), e.contactIndex, heading, landed ? e.damage : e.damage * 2.2, e.endpoint.y - (e.targetId === 'b' ? serverB.y : shownA.y), detail);
        if (landed && (e.slot === 'light' || e.slot === 'heavy')) by.impact(false, e.slot, undefined, undefined, heading, e.damage, undefined, detail);
      }
      LANDED.deliver(presented.events); LANDED.clock = presented.time;
      striker.targetDistance = victim.targetDistance = Math.hypot(shownB.x - shownA.x, shownB.z - shownA.z);
      striker.targetPoint = (striker.targetPoint ?? new THREE.Vector3()).set(shownB.x, shownB.y + 1.45, shownB.z);
      victim.targetPoint = (victim.targetPoint ?? new THREE.Vector3()).set(shownA.x, shownA.y + 1.45, shownA.z);
      striker.update(Math.min(frame, .05), shownA, true, frame);
      victim.update(Math.min(frame, .05), shownB, true, frame);
      (Fighter as unknown as { settleContacts(): void }).settleContacts();
      if (tick >= 30) samples.push(sample(victim, clock, shownB));
    }
  } finally { prediction.stop(); server.dispose(); }
  return samples;
}
