import fs from 'node:fs';
import * as THREE from 'three';
import { FIGHTERS } from '../src/config';
import { ArenaSimulation } from '../src/game/simulation';
import { MOVES } from '../src/game/moves';
import { rushMove } from '../src/game/awakening';
import { Fighter, bindClips } from '../src/render/Fighter';
import { IDLE_PROFILES } from '../src/render/idle/profile';
import { loadRig } from './rigHarness';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';

/** Round 3c (ANIM): the second blind critic's pop measurement, headless.
 *
 *  The critic sampled the local fighter's head and right hand every drawn
 *  frame of a light rush string, a heavy and a special in real Chrome, and
 *  counted a frame whose head moved over 8 cm or whose hand moved over 20 cm
 *  and at least three times both neighbouring frames' steps. This repeats it
 *  without a browser: the simulation the client predicts with stepped on its
 *  own 60 Hz tick, a render loop with the critic's frame jitter (so a drawn
 *  frame sees none, one or two ticks, as the local move clock is seen in the
 *  game), the opponent drawn a tenth of a second behind, and every hit event
 *  handed to `impact` a round trip after its tick, as main.ts does.
 *  scripts/probe_pops.mts prints it for the roster; tests/animationPops.test.ts
 *  holds it. */
export const POP_TICK = 1 / 60;
export type PopPhase = { name: string; presses: { tick: number; attack: 'light' | 'heavy' | 'special' }[]; ticks: number; gap: number };
/** The critic's script: twelve lights 150 ms apart, then a heavy, then a special. */
export const POP_PHASES: PopPhase[] = [
  { name: 'rush', presses: Array.from({ length: 12 }, (_, i) => ({ tick: 30 + i * 9, attack: 'light' as const })), ticks: 30 + 12 * 9 + 96, gap: 1.8 },
  { name: 'heavy', presses: [{ tick: 30, attack: 'heavy' }], ticks: 30 + 132, gap: 1.8 },
  { name: 'special', presses: [{ tick: 30, attack: 'special' }], ticks: 30 + 180, gap: 4.4 },
];
export type PopSample = { t: number; hips?: number[]; head: number[]; hand: number[]; headW: number[]; handW: number[]; clip?: string; ct?: number; el: number; root: number; blend?: number; action: string; ticks: number };

/** The body as FighterLibrary.load assembles it: rush clips, extra clips and
 *  the idle profile's own file joined by bone name. */
export async function assembleFighter(id: FighterId) {
  const source = await loadRig(FIGHTERS[id].model);
  let rush: THREE.AnimationClip[] | undefined;
  const url = FIGHTERS[id].rushModel;
  if (url && fs.existsSync(`public${url}`)) rush = bindClips(source.scene, (await loadRig(url)).animations, id);
  for (const extra of [...(FIGHTERS[id].extraModels ?? []), IDLE_PROFILES[id]?.model]) {
    if (!extra || !fs.existsSync(`public${extra}`)) continue;
    const clips = bindClips(source.scene, (await loadRig(extra)).animations, id);
    const names = new Set(clips.map(c => c.name));
    source.animations = [...source.animations.filter(c => !names.has(c.name)), ...clips];
  }
  return { source, rush };
}
export function popBase(fighter: FighterId, id: string): PlayerState {
  return { id, name: id.toUpperCase(), fighter, x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 0, action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0,
    target: null, alive: true, isBot: false, grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } };
}
/** mulberry32 */
function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6d2b79f5) | 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(2 * Math.PI * r());
export type PopOptions = { latency?: number; rate?: number; jitter?: number; seed?: number; remoteDelay?: number };

/** One phase of the script, drawn: every frame's sample of the attacker. */
export function runPopPhase(body: Fighter, bot: Fighter, id: FighterId, phase: PopPhase, random: () => number, options: PopOptions = {}) {
  const latency = options.latency ?? .12, rate = options.rate ?? 60, jitter = options.jitter ?? 1.8, remoteDelay = options.remoteDelay ?? .1;
  const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 11 });
  sim.addPlayer('a', id, 'A', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('b', 'taisei', 'B', false, { x: 0, y: 0, z: phase.gap });
  sim.startMatch();
  let seq = 0, tick = 0, clock = 0, previousA = { ...sim.getPlayer('a')! };
  const history: { time: number; state: PlayerState }[] = [];
  const pending: { at: number; event: CombatEvent }[] = [];
  const step = () => {
    const press = phase.presses.find(p => p.tick === tick);
    previousA = { ...sim.getPlayer('a')! };
    sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', lock: true, ...(press ? { attack: press.attack } : {}) });
    sim.submitInput('b', { seq, moveX: 0, moveZ: 0, yaw: Math.PI });
    sim.step(); tick++;
    const time = tick * POP_TICK;
    history.push({ time, state: structuredClone(sim.getPlayer('b')!) });
    if (history.length > 40) history.shift();
    for (const e of sim.snapshot(true).events) if (e.kind === 'hit' || e.kind === 'blocked') pending.push({ at: time + latency, event: e });
  };
  const samples: PopSample[] = [];
  const total = phase.ticks + 30;
  try {
    while (tick < total) {
      const frame = Math.max(.008, Math.min(.034, 1 / rate + gauss(random) * jitter / 1000));
      const before = tick;
      clock += frame;
      while ((tick + 1) * POP_TICK <= clock + 1e-9) step();
      const alpha = THREE.MathUtils.clamp((clock - tick * POP_TICK) / POP_TICK, 0, 1);
      const a = sim.getPlayer('a')!;
      const shown: PlayerState = { ...a, x: previousA.x + (a.x - previousA.x) * alpha, y: previousA.y + (a.y - previousA.y) * alpha, z: previousA.z + (a.z - previousA.z) * alpha };
      const want = clock - remoteDelay;
      let j = 0; while (j + 1 < history.length && history[j + 1].time <= want) j++;
      const h0 = history[j]?.state ?? sim.getPlayer('b')!, h1 = history[j + 1]?.state ?? h0, w = history[j + 1] ? THREE.MathUtils.clamp((want - history[j].time) / POP_TICK, 0, 1) : 0;
      const other: PlayerState = { ...h0, x: h0.x + (h1.x - h0.x) * w, y: h0.y + (h1.y - h0.y) * w, z: h0.z + (h1.z - h0.z) * w };
      for (let k = pending.length - 1; k >= 0; k--) {
        if (pending[k].at > clock) continue;
        const e = pending.splice(k, 1)[0].event;
        const heading = e.origin && e.endpoint ? new THREE.Vector3(e.endpoint.x - e.origin.x, e.endpoint.y - e.origin.y, e.endpoint.z - e.origin.z) : undefined;
        const landed = e.kind === 'hit', detail = { chain: e.chain, fromBehind: e.fromBehind, reaction: e.reaction, ...(e.lift ? { lift: e.lift } : {}) };
        const style = e.fighter && e.slot ? (e.slot === 'light' && (e.chain ?? 0) > 0 ? rushMove(e.fighter, e.chain!, false) : MOVES[e.fighter][e.slot]).style : undefined;
        const victim = e.targetId === 'a' ? body : e.targetId === 'b' ? bot : undefined, attacker = e.actorId === 'a' ? body : e.actorId === 'b' ? bot : undefined;
        victim?.impact(true, e.slot, style, e.contactIndex, heading, landed ? e.damage : (e.damage ?? 0) * 2.2, e.endpoint ? e.endpoint.y - other.y : undefined, detail);
        if (landed && (e.slot === 'light' || e.slot === 'heavy')) attacker?.impact(false, e.slot, undefined, undefined, heading, e.damage, undefined, detail);
        if (!landed) attacker?.impact(false, e.slot, undefined, undefined, heading, e.damage, undefined, detail);
      }
      body.targetDistance = Math.hypot(other.x - shown.x, other.z - shown.z);
      body.targetPoint = (body.targetPoint ?? new THREE.Vector3()).set(other.x, other.y + 1.45, other.z);
      bot.targetDistance = body.targetDistance;
      bot.targetPoint = (bot.targetPoint ?? new THREE.Vector3()).set(shown.x, shown.y + 1.45, shown.z);
      body.update(Math.min(frame, .05), shown, true, frame);
      bot.update(Math.min(frame, .05), other, true, frame);
      if (tick < 30) continue;
      const e = body.motionEvidence();
      const world = (p: number[] | null) => { const v = new THREE.Vector3(...(p ?? [0, 0, 0])); body.group.localToWorld(v); return v.toArray(); };
      const hipsBone = body.joints.get('Hips'), hips = hipsBone ? body.group.worldToLocal(hipsBone.getWorldPosition(new THREE.Vector3())).toArray() : undefined;
      samples.push({ t: clock, hips, head: e.head ?? [0, 0, 0], hand: e.handR ?? [0, 0, 0], headW: world(e.head), handW: world(e.handR), clip: e.clip, ct: e.clipTime, el: e.elapsed, root: e.rootOffset, blend: e.blend, action: e.action, ticks: tick - before });
    }
  } finally { sim.dispose?.(); }
  return samples;
}
const d3 = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** The critic's detector over one run of samples, for one key. */
export function findPops(rows: PopSample[], key: 'head' | 'hand' | 'headW' | 'handW', limit: number) {
  const out: { i: number; d: number; prev: number; next: number }[] = [];
  for (let i = 1; i < rows.length - 1; i++) {
    const d0 = d3(rows[i - 1][key], rows[i][key]), d1 = d3(rows[i][key], rows[i + 1][key]), dn = i + 2 < rows.length ? d3(rows[i + 1][key], rows[i + 2][key]) : 0;
    if (d1 > limit && d1 > 3 * Math.max(d0, dn, 1e-4)) out.push({ i: i + 1, d: +d1.toFixed(3), prev: +d0.toFixed(3), next: +dn.toFixed(3) });
  }
  return out;
}
/** Head and hand pops together, in the fighter's space and in the world. */
export function countPops(samples: PopSample[]) {
  const local = [...findPops(samples, 'head', .08).map(p => ({ ...p, key: 'head' })), ...findPops(samples, 'hand', .2).map(p => ({ ...p, key: 'hand' }))];
  const world = [...findPops(samples, 'headW', .08).map(p => ({ ...p, key: 'head' })), ...findPops(samples, 'handW', .2).map(p => ({ ...p, key: 'hand' }))];
  return { local, world };
}
/** A fighter and a Taisei to hit, built as the game builds them. */
export async function popPair(id: FighterId) {
  const mine = await assembleFighter(id), foe = await assembleFighter('taisei');
  const body = new Fighter(popBase(id, 'a'), mine.source, false, mine.rush);
  body.prepareRush();
  const bot = new Fighter(popBase('taisei', 'b'), foe.source, false, foe.rush);
  bot.prepareRush();
  return { body, bot, random: rng(7) };
}
