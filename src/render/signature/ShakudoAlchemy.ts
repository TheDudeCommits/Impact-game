import { isEnderKey } from '../../game/combos';
import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import { SHAKUDO_AWAKENING, SHAKUDO_MOVES } from '../../game/fighters/shakudo';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { SIGNATURE, involvesLocal } from './context';
import { reaction, STONE, STONE_DARK, StoneBatch, transmutationCircle } from './AlchemyParts';
import { STAR } from './GlowBatch';
import { MoveStage, type StageLook } from './MoveStage';
import { blowFloor } from './blowFloor';
import { bolt, sweep } from './StageStrokes';

export const isShakudoAlchemy = (id: string | undefined) => id === 'shakudo';
export const SHAKUDO_ALCHEMY_ASSETS: readonly string[] = Object.freeze([]);
export const SHAKUDO_ALCHEMY_LIMITS = Object.freeze({ stones: 96, marks: 10, lances: 4, confirms: 8 });
export const SHAKUDO_ALCHEMY_BEATS = Object.freeze({ clap: .294, release: .72, final: 3.3 });
const BRANCH = Object.freeze({ lh: 'Swage', llh: 'Upset', lllh: 'Drop Forge', llls: 'Stone Breaker', airHeavy: 'Anvil Drop', airSpecial: 'Slag Fall' });
export const SHAKUDO_BLADE_SOCKET = Object.freeze({ joint: 'ShakudoBladeTip', tip: Object.freeze([-.0895596656990405, -.32976020227090624, .11274550202276012]), sourceVertex: 196 });
export function shakudoStrikeSocket(action: string, elapsed: number, clip?: string, index?: number): 'RightHand' | 'LeftHand' | 'LeftToeBase' | 'Both' | 'Blade' {
  if (clip === 'TANREN: White Heat' || action === 'ultimate' && !clip) { const contact = index ?? (elapsed > 2.9 ? 2 : elapsed > .95 ? 1 : 0); return contact === 2 ? 'Both' : contact === 1 ? 'Blade' : 'RightHand'; }
  if (clip === 'Hot Edge' || clip === 'Drop Forge' || action === 'heavy' && !clip) return 'Blade';
  if (clip === 'Bedrock Pike' || clip === 'Stone Breaker' || clip === 'Slag Fall' || action === 'special' && !clip) return 'Both';
  if (clip === 'Anvil Drop') return 'LeftToeBase'; if (clip === 'Rush 2') return 'LeftHand'; return 'RightHand';
}
export function shakudoAuthoredKick(clip?: string) { return clip === 'Anvil Drop'; }
export function shakudoAuthoredGround(clip?: string) { return clip === 'Bedrock Pike' || clip === 'Stone Breaker' || clip === 'Slag Fall' || clip === 'TANREN: White Heat'; }
export function shakudoStrikePoint(f: Fighter, out: THREE.Vector3, clip?: string, sourceTime?: number, index?: number) {
  const s = f.state; if (!clip && isEnderKey(s.branch)) clip = BRANCH[s.branch]; if (!clip && s.action === 'light' && s.chain) clip = `Rush ${s.chain}`;
  const joint = shakudoStrikeSocket(s.action, sourceTime ?? s.actionTime * s.actionDuration, clip, index);
  if (joint === 'Both') return out.copy(f.handL).lerp(f.handR, .5);
  if (joint === 'Blade') { const b = f.bones?.get('shakudobladetip'); if (b) return b.localToWorld(out.set(SHAKUDO_BLADE_SOCKET.tip[0], SHAKUDO_BLADE_SOCKET.tip[1], SHAKUDO_BLADE_SOCKET.tip[2])); }
  if (joint === 'LeftToeBase') { const b = f.bones?.get('lefttoebase') ?? f.bones?.get('leftfoot'); if (b) return b.getWorldPosition(out); }
  return out.copy(joint === 'LeftHand' ? f.handL : f.handR);
}

const UP = new THREE.Vector3(0, 1, 0);
const lin = (r: number, g: number, b: number) => new THREE.Color(r, g, b);
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
/** The alchemical reaction: blue lightning with a white heart, and the blue it throws on the room. */
const ALCH: StageLook = { core: lin(2.7, 3, 3.3), main: lin(.5, 1.3, 2.3), rim: lin(.15, .4, 1), light: lin(.75, 1, 1.3), element: { spike: 0xe8f7ff, rim: 0x3fa6ff, light: 0x8fd0ff, ink: 0x06121e }, shell: 0x9fd8ff, edge: 0x1a4a9a, flame: -1, dark: false, heart: .5 };
const HEAVY = SHAKUDO_MOVES.heavy, SPECIAL = SHAKUDO_MOVES.special, ULT = SHAKUDO_MOVES.ultimate;
const FIRST = ULT.contacts[0], SECOND = ULT.contacts[1], LAST = ULT.contacts[2], CLAP = SHAKUDO_ALCHEMY_BEATS.clap;
/** How long the blade's arc hangs after the blow; how far apart the Bedrock Pike's spikes stand along its line, how long
 *  each takes to rise and how long the row stands after the lance has landed (seconds, metres). */
const ARC = .22, SPACING = .8, RISE = .09, STANDS = .45, SINKS = .4;
const CUT = 0, SPIRE = 1, SPIRES = 2;
type Confirm = { actor: string; target: string; seq: number; floor: number; final: boolean };
type Mark = { kind: number; born: number; life: number; size: number; seed: number; at: THREE.Vector3; dir: THREE.Vector3; live: boolean };
/** A Bedrock Pike's line: where it left his hands, the way it went, how far it has run and when it was last seen. */
type Lance = { actor: string; origin: THREE.Vector3; heading: THREE.Vector3; reach: number; born: number; seen: number; floor: number; live: boolean };

export class ShakudoAlchemy {
  private readonly stage: MoveStage;
  private readonly stones: StoneBatch;
  private confirms: Confirm[] = Array.from({ length: SHAKUDO_ALCHEMY_LIMITS.confirms }, () => ({ actor: '', target: '', seq: -1, floor: 0, final: false }));
  private marks: Mark[] = Array.from({ length: SHAKUDO_ALCHEMY_LIMITS.marks }, () => ({ kind: 0, born: -1e9, life: 0, size: 1, seed: 0, at: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1), live: false }));
  private lances: Lance[] = Array.from({ length: SHAKUDO_ALCHEMY_LIMITS.lances }, () => ({ actor: '', origin: new THREE.Vector3(), heading: new THREE.Vector3(0, 0, 1), reach: 0, born: 0, seen: -1e9, floor: 0, live: false }));
  private seen = new Float64Array(128).fill(-1); private seenTime = new Float64Array(128).fill(-1);
  private cursor = 0; private confirmCursor = 0; private markCursor = 0; private disposed = false;
  private p = new THREE.Vector3(); private a = new THREE.Vector3(); private b = new THREE.Vector3(); private c = new THREE.Vector3(); private d = new THREE.Vector3();
  private heading = new THREE.Vector3(); private side = new THREE.Vector3(); private dir = new THREE.Vector3(); private ground = new THREE.Vector3(); private strike = new THREE.Vector3(); private across = new THREE.Vector3();
  constructor(scene: THREE.Scene, kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) { this.stage = MoveStage.for(scene, kit); this.stones = new StoneBatch(scene, 'edward-alchemy-stone', SHAKUDO_ALCHEMY_LIMITS.stones); }
  load(_ids: readonly string[]) { return Promise.resolve(); }
  private cancel(id: string, victim = false) { for (const c of this.confirms) if (c.actor === id || victim && c.target === id && !c.final) c.actor = ''; }
  private mark(kind: number, at: THREE.Vector3, dir: THREE.Vector3, born: number, life: number, size: number) {
    const m = this.marks[this.markCursor++ % this.marks.length];
    m.kind = kind; m.at.copy(at); m.dir.copy(dir); m.born = born; m.life = life; m.size = size; m.seed = (Math.abs(at.x * 7.9 + at.z * 5.1 + born * 3.3)) % 71; m.live = true;
  }

  handle(e: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    if (e.kind === 'eliminated' || e.kind === 'respawn') { this.cancel(e.actorId, true); return; }
    if (!isShakudoAlchemy(e.fighter)) return;
    if (e.kind === 'whiff' || e.kind === 'rejected') { this.cancel(e.actorId); return; }
    if (e.kind !== 'hit' && e.kind !== 'confirm') return;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === e.id && this.seenTime[i] === e.serverTime) return;
    const index = this.cursor++ % this.seen.length; this.seen[index] = e.id; this.seenTime[index] = e.serverTime;
    const actor = fighters?.get(e.actorId), victim = e.targetId ? fighters?.get(e.targetId) : undefined, seq = e.actionSeq ?? actor?.state.actionSeq ?? -1;
    let floor = blowFloor(actor, victim, Infinity);
    if (e.kind === 'confirm') {
      if (e.slot === 'ultimate' && !e.branch && e.targetId) Object.assign(this.confirms[this.confirmCursor++ % this.confirms.length], { actor: e.actorId, target: e.targetId, seq, final: false, floor: Number.isFinite(floor) ? floor : 0 });
      return;
    }
    if (!victim && !e.endpoint) return;
    const final = e.slot === 'ultimate' && !e.branch && e.contactIndex === ULT.contacts.length - 1, point = this.p, st = this.stage, t = e.serverTime;
    if (victim) bodyCentre(victim, point); else point.set(e.endpoint!.x, e.endpoint!.y, e.endpoint!.z);
    if (!Number.isFinite(floor)) floor = point.y - 1.05;
    // The last blow needs its confirm still standing (a whiff, an interruption or a new action has cancelled it).
    let confirmed = false;
    if (final) for (const c of this.confirms) if (c.actor === e.actorId && c.seq === seq) { c.final = true; floor = c.floor; confirmed = true; }
    if (final && !confirmed) return;
    const dir = this.dir;
    if (actor) { dir.subVectors(point, actor.group.position).setY(0); if (dir.lengthSq() < .01) dir.set(Math.sin(actor.state.yaw ?? 0), 0, Math.cos(actor.state.yaw ?? 0)); dir.normalize(); } else dir.set(0, 0, 1);
    const ground = this.ground.set(point.x, floor, point.z);
    if (e.slot === 'light') { st.burst(point, ALCH, .38, t, { dir, floor, clean: true }); return; }
    if (e.slot === 'heavy') {
      // Hot Edge: the cut is the blow (one line through the body, the reaction snapping off it); a small blast under it.
      const big = e.branch ? .85 : 1;
      // (A step past the body, and small: he has closed to arm's length by the blow, he is small, and a blast on the
      // body it lands on was on him too.)
      this.mark(CUT, point, dir, t, .32, 1.5 * big);
      st.burst(this.a.copy(point).addScaledVector(dir, .6), ALCH, .5 * big, t, { dir, floor });
      st.shock(this.b.copy(ground).addScaledVector(dir, .6), ALCH, 3.6 * big, t, .4);
      return;
    }
    if (e.slot === 'special') {
      if (e.branch === 'airSpecial') { st.burst(point, ALCH, 2, t, { floor }); st.shock(ground, ALCH, 4.5, t, .45); this.mark(SPIRE, ground, dir, t, 1.1, .8); return; }
      // Bedrock Pike landing: a spire three metres tall up through its victim, smaller ones round it, the reaction off it.
      const big = e.branch ? .7 : 1;
      this.mark(SPIRE, ground, dir, t, 1.3, big);
      st.burst(point, ALCH, 1.8 * big, t, { dir, floor });
      st.shock(ground, ALCH, 5.5 * big, t, .45);
      st.scar(ground, ALCH, 2.6 * big, t + .1, 1.8);
      return;
    }
    if (e.slot !== 'ultimate' || e.branch) return;
    if (!final) {
      // The opener is the steel fist; the second blow is a spire out of the floor under his victim.
      st.burst(point, ALCH, e.contactIndex ? 1.5 : 1, t, { dir, floor });
      if (e.contactIndex) { this.mark(SPIRE, ground, dir, t, .9, .72); st.shock(ground, ALCH, 5, t, .5); }
      return;
    }
    if (involvesLocal(e.actorId, e.targetId)) SIGNATURE.screen?.impactFrame?.(.47, point);
    // TANREN: WHITE HEAT: five spires up through them, five metres tall, the floor cracked blue under a blast.
    this.mark(SPIRES, ground, dir, t, 1.7, 1);
    st.burst(point, ALCH, 2.6, t, { dir, floor });
    st.shatter(this.a.copy(ground).setY(floor + .06), UP, ALCH, 7, t + .03, 1.2);
    st.shock(ground, ALCH, 10, t, .6);
    st.scar(ground, ALCH, 4.5, t + .15, 2);
  }

  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) {
    if (this.disposed) return;
    const st = this.stage.open(time); this.stones.begin();
    for (const f of fighters.values()) {
      const s = f.state; if (!isShakudoAlchemy(s.fighter) || !s.alive) continue;
      if (s.action === 'awaken') { this.awakening(f, time); continue; }
      if (s.whiffedAt !== undefined || (s.action !== 'light' && s.action !== 'heavy' && s.action !== 'special' && s.action !== 'ultimate')) continue;
      const elapsed = s.actionTime * s.actionDuration, seed = (s.actionSeq ?? 0) * 6.1, feet = f.group.position, heading = this.face(f), side = this.side, strike = f.strikePoint(this.strike), tick = Math.floor(time * 30);
      if (s.action === 'light') {
        // Rivet: sparks of the reaction on the steel fist.
        const k = Math.sin(clamp(s.actionTime) * Math.PI);
        bolt(st, this.a.copy(strike).addScaledVector(heading, -.45).setY(strike.y + .12), strike, .035, ALCH.main, .9 * k, tick, .12, 4, ALCH.heart);
        st.glow(strike, .26, ALCH.main, .6 * k); st.light(strike, 2.3, ALCH, .25 * k);
      } else if (s.action === 'heavy') {
        // Hot Edge: the reaction runs up the steel-limb to the blade's point; the cut's arc hangs across his front at the
        // blade's own reach whether or not it lands (what it does to a body is the hit's: `handle`).
        const contact = s.branch ? s.actionDuration * .55 : HEAVY.contacts[0];
        if (elapsed < contact) {
          const k = clamp(elapsed / contact);
          // (Two thin bolts and a glint, no halo: he is small, and his blade arm is across his own body from behind.)
          for (let i = 0; i < 2; i++) bolt(st, f.handR, strike, .03, ALCH.main, k, tick + i * 7, .1, 4, ALCH.heart);
          st.glow(strike, .14, ALCH.core, .8 * k, STAR, .2, 3); st.light(strike, 2.6, ALCH, .3 * k);
        } else if (elapsed < contact + ARC) {
          const w = (elapsed - contact) / ARC, cut = clamp(w / .3), fade = 1 - w * w;
          // (A slanted plane, low on his right to high ahead of him, about a point a step in front of him: from behind
          // him it crosses the body it cuts and never comes back over his own.)
          this.p.copy(feet).addScaledVector(heading, .7).setY(feet.y + 1.05);
          this.c.copy(heading).multiplyScalar(.8).addScaledVector(side, .6).normalize(); this.d.copy(UP).addScaledVector(side, -.62).normalize();
          sweep(st, this.p, this.c, this.d, 1.7, -.7, -.7 + 1.8 * cut, .2, ALCH, 1.3 * fade, 10);
          st.light(this.a.copy(this.p).addScaledVector(heading, .9).setY(feet.y + .5), 4, ALCH, .3 * fade);
        }
      } else if (s.action === 'special' && !s.branch) {
        // Bedrock Pike's wind-up: the clap, then a circle on the floor under his hands and the reaction standing off it.
        const release = SPECIAL.contacts[0];
        if (elapsed < release) this.transmute(f, elapsed, release, 1.5, time, seed);
      } else if (s.action === 'ultimate' && !s.branch && s.confirmedAt === undefined && elapsed < FIRST + .12) {
        const k = clamp(elapsed / FIRST);
        bolt(st, this.a.copy(strike).addScaledVector(heading, -.5).setY(strike.y + .15), strike, .04, ALCH.main, k, tick, .14, 4, ALCH.heart);
        st.charge(strike, ALCH, .24, k, seed);
      }
    }
    this.lancesFrom(flights, fighters, time);
    for (const c of this.confirms) {
      if (!c.actor) continue;
      const actor = fighters.get(c.actor), victim = fighters.get(c.target), s = actor?.state;
      if (!actor || !s?.alive || !victim?.state.alive && !c.final || s.action !== 'ultimate' || s.branch || (s.actionSeq ?? -1) !== c.seq || s.whiffedAt !== undefined) { c.actor = ''; continue; }
      const elapsed = s.actionTime * s.actionDuration;
      if (elapsed > ULT.duration) { c.actor = ''; continue; }
      if (!c.final && elapsed < LAST && victim) this.gather(actor, victim, c, elapsed, time);
    }
    for (const m of this.marks) {
      if (!m.live) continue;
      const age = time - m.born;
      if (age >= m.life) { m.live = false; continue; }
      if (age >= 0) this.drawMark(m, age, time);
    }
    this.stones.end(); st.close();
  }

  /** The way he faces, and his right (`side`). */
  private face(f: Fighter) {
    const yaw = f.state.yaw ?? f.group.rotation.y;
    this.side.set(Math.cos(yaw), 0, -Math.sin(yaw));
    return this.heading.set(Math.sin(yaw), 0, Math.cos(yaw));
  }
  /** The clap and what follows it: a flash between the palms at the clap, then a circle on the floor a step ahead of
   *  him, drawn out as the wind-up runs, lightning from his hands down to it and standing off it. */
  private transmute(f: Fighter, elapsed: number, release: number, radius: number, time: number, seed: number) {
    const st = this.stage, feet = f.group.position, hands = this.a.copy(f.handR).lerp(f.handL, .5), tick = Math.floor(time * 30);
    if (elapsed < CLAP) { const k = clamp(elapsed / CLAP); st.charge(hands, ALCH, .2, k, seed); return; }
    const k = clamp((elapsed - CLAP) / Math.max(.05, release - CLAP)), clap = 1 - clamp((elapsed - CLAP) / .14);
    if (clap > 0) { st.glow(hands, .5 + .5 * clap, ALCH.core, clap, STAR, .22, tick); st.light(hands, 4, ALCH, .7 * clap); }
    this.p.copy(feet).addScaledVector(this.heading, .9);
    transmutationCircle(st, this.p, radius, ALCH, .25 + .75 * k, .9, time * .5);
    reaction(st, this.p, radius, 1.1 + .7 * k, ALCH, .5 + .5 * k, time, seed, 5);
    for (let i = -1; i <= 1; i += 2) bolt(st, i > 0 ? f.handR : f.handL, this.b.copy(this.p).addScaledVector(this.side, i * .5), .04, ALCH.main, .9, tick + i * 5, .2, 5, ALCH.heart);
    st.light(this.b.copy(this.p).setY(feet.y + .6), 4.5, ALCH, .3 + .4 * k);
    st.charge(hands, ALCH, .26, k, seed);
  }

  /** The Bedrock Pike on its way: ONE authoritative projectile, drawn as the line it has run: a row of spikes heaved out
   *  of the floor behind it, each risen as it passed, the reaction and its light at its head. The row stands a moment
   *  after the lance is gone, and sinks. */
  private lancesFrom(flights: ReadonlyMap<string, Flight>, fighters: ReadonlyMap<string, Fighter>, time: number) {
    const st = this.stage, speed = SPECIAL.speed ?? 27;
    for (const flight of flights.values()) {
      if (!isShakudoAlchemy(flight.fighter) || flight.slot !== 'special' || flight.branch || !flight.released || !flight.actorId) continue;
      let lance = this.lances.find(l => l.live && l.actor === flight.actorId && time - l.seen < .2);
      if (!lance) {
        lance = this.lances.find(l => !l.live) ?? this.lances[0];
        lance.actor = flight.actorId; lance.live = true; lance.reach = 0; lance.born = time;
        lance.origin.copy(flight.origin ?? flight.position); lance.heading.copy(flight.heading).setY(0); if (lance.heading.lengthSq() < 1e-6) lance.heading.set(0, 0, 1); lance.heading.normalize();
        lance.floor = fighters.get(flight.actorId)?.group.position.y ?? flight.position.y - 1.1;
        lance.born -= Math.max(0, this.p.subVectors(flight.position, lance.origin).dot(lance.heading)) / speed;
      }
      lance.reach = Math.max(lance.reach, this.p.subVectors(flight.position, lance.origin).dot(lance.heading)); lance.seen = time;
      // Its head: the reaction running along the floor under it, and its light.
      this.a.set(flight.position.x, lance.floor, flight.position.z);
      reaction(st, this.a, .7, 1.4, ALCH, 1, time, lance.born * 31, 4);
      st.glow(this.b.copy(this.a).setY(lance.floor + .6), .9, ALCH.main, .7); st.glow(this.b, .3, ALCH.core, .9, STAR, .2, Math.floor(time * 24));
      st.light(this.b, 6, ALCH, 1);
    }
    for (const lance of this.lances) {
      if (!lance.live) continue;
      const gone = time - lance.seen;
      if (gone > STANDS + SINKS || gone < -.5) { lance.live = false; continue; }
      const sunk = clamp((gone - STANDS) / SINKS), lean = this.d.copy(lance.heading).multiplyScalar(.5).setY(1).normalize();
      for (let i = 1, n = Math.min(40, Math.floor(lance.reach / SPACING)); i <= n; i++) {
        const along = i * SPACING, passed = time - (lance.born + along / speed), rise = clamp(passed / RISE) * (1 - sunk);
        if (rise <= .02) continue;
        const wide = (hash(i * 3.7 + lance.born) - .5) * .5, tall = (.75 + .7 * hash(i * 1.9 + lance.born)) * (1 + Math.min(.6, along * .04));
        this.p.copy(lance.origin).addScaledVector(lance.heading, along).setY(lance.floor - .05); this.p.x += lance.heading.z * wide; this.p.z -= lance.heading.x * wide;
        this.stones.pillar(this.p, lean, .34 + .14 * hash(i + lance.born), tall * rise, i * 1.3, i % 3 ? STONE : STONE_DARK);
      }
    }
  }

  /** TANREN: White Heat from the confirm to the last blow: the room to night, the circle drawn under the pair and
   *  grown to ten metres across, the reaction standing off all of it; after the second blow a wall of stone raised behind
   *  his victim (behind: the pair is read in front of it). */
  private gather(actor: Fighter, victim: Fighter, c: Confirm, elapsed: number, time: number) {
    const st = this.stage, g = clamp((elapsed - FIRST) / (LAST - FIRST)), seed = c.seq * 2.3, feet = actor.group.position, heading = this.face(actor);
    const prey = bodyCentre(victim, this.c);
    this.dir.subVectors(prey, feet).setY(0); if (this.dir.lengthSq() < .01) this.dir.copy(heading); this.dir.normalize();
    // (The circle is centred past the middle of the pair and its lines kept thin and under white: they lie on the floor
    // at both fighters' feet, and a stroke is drawn over a body.)
    const centre = this.ground.set(feet.x + (prey.x - feet.x) * .7, c.floor, feet.z + (prey.z - feet.z) * .7);
    st.dim(.3 + .45 * g, c.actor, c.target);
    transmutationCircle(st, centre, 2.4 + 2.4 * clamp(g * 1.6), ALCH, clamp((elapsed - FIRST) / .5), .5 + .2 * g, time * .3, .6);
    // (The lightning stands round the one it is for, not round him: he is small, and is lost behind a bolt.)
    this.p.set(prey.x, c.floor, prey.z).addScaledVector(this.dir, .6);
    reaction(st, this.p, 1.8 + 2.2 * g, 1.4 + 1.4 * g, ALCH, .5 + .5 * g, time, seed, 5 + Math.round(4 * g));
    st.light(this.p.setY(c.floor + .8), 6 + 2 * g, ALCH, .3 + .3 * g);
    // The wall: five slabs in an arc past the victim, raised one after another from the second blow.
    const across = this.across.set(this.dir.z, 0, -this.dir.x);
    for (let i = -2; i <= 2; i++) {
      const rise = clamp((elapsed - SECOND - .1 - Math.abs(i) * .07) / .16); if (rise <= 0) continue;
      const ang = i * .5;
      this.p.set(prey.x, c.floor - .05, prey.z).addScaledVector(this.dir, 2.4 * Math.cos(ang) + .4).addScaledVector(across, 2.9 * Math.sin(ang));
      this.stones.pillar(this.p, UP, 1.25 - .1 * Math.abs(i), (3.2 - .35 * Math.abs(i)) * rise, i * 1.7 + seed, i % 2 ? STONE_DARK : STONE);
    }
    this.a.copy(actor.handR).lerp(actor.handL, .5);
    st.glow(this.a, .2 + .1 * g, ALCH.core, .6 + .3 * g, STAR, .2, Math.floor(time * 24));
    if (g > .8) st.speed(.5 * (g - .8) / .2, c.actor, c.target);
  }

  private drawMark(m: Mark, age: number, time: number) {
    const st = this.stage, w = age / m.life;
    if (m.kind === CUT) {
      // The blade's cut through the body: one rising line across the way the blow came, the reaction snapping off it.
      const fade = (1 - w) * (1 - w), reach = m.size * clamp(age / .05);
      this.d.set(m.dir.z, 0, -m.dir.x).multiplyScalar(.7).addScaledVector(UP, .7).normalize();
      this.a.copy(m.at).addScaledVector(this.d, -reach); this.b.copy(m.at).addScaledVector(this.d, reach);
      st.streak(this.a, this.b, .16 * (.4 + .6 * fade), ALCH.main, 1.2 * fade, ALCH.heart);
      for (let i = 0; i < 2; i++) bolt(st, m.at, this.p.copy(m.at).addScaledVector(this.d, (i ? 1 : -1) * reach * .8).setY(m.at.y + (i ? .9 : -.5)), .035, ALCH.main, fade, Math.floor(time * 30) + i * 9, .2, 4, ALCH.heart);
      return;
    }
    // A spire (or, for the last blow, five) up through where the blow landed: it rises in a tenth of a second out of
    // the reaction, stands, and sinks; smaller stones round its foot.
    const rise = clamp(age / .1), sunk = clamp((w - .72) / .28), up = rise * (1 - sunk * sunk), across = this.across.set(m.dir.z, 0, -m.dir.x), many = m.kind === SPIRES;
    this.p.copy(m.at); this.p.y -= .05;
    for (let i = many ? -2 : 0; i <= (many ? 2 : 0); i++) {
      const lean = this.d.copy(UP).addScaledVector(across, i * .22).addScaledVector(m.dir, .12).normalize();
      this.a.copy(this.p).addScaledVector(across, i * .85);
      this.stones.pillar(this.a, lean, (many ? 1.05 - .14 * Math.abs(i) : .78) * m.size, (many ? 5 - .9 * Math.abs(i) : 3) * m.size * up, m.seed + i * 1.9, i % 2 ? STONE_DARK : STONE);
    }
    // (The stones round its foot come up past it and to its sides, never on the side the blow came from: he stands there.)
    const away = Math.atan2(m.dir.z, m.dir.x);
    for (let i = 0, n = st.n(many ? 7 : 5, 3); i < n; i++) {
      const ang = away + ((i + .5) / n - .5) * 3.5, r = (many ? 2.1 : .95) * m.size * (.7 + .5 * hash(i + m.seed));
      this.a.set(m.at.x + Math.cos(ang) * r, m.at.y - .05, m.at.z + Math.sin(ang) * r);
      this.stones.pillar(this.a, this.d.set(Math.cos(ang) * .35, 1, Math.sin(ang) * .35).normalize(), (.3 + .2 * hash(i * 3 + m.seed)) * m.size, (.7 + .9 * hash(i * 7 + m.seed)) * m.size * up, i * 2.1, i % 2 ? STONE : STONE_DARK);
    }
    const lit = (1 - w) * (1 - w);
    reaction(st, this.a.copy(this.p).addScaledVector(m.dir, many ? 1.2 : .3), (many ? 2.6 : 1.3) * m.size, (many ? 3 : 1.8) * m.size, ALCH, lit, time, m.seed, many ? 9 : 5);
    st.light(this.a.copy(m.at).setY(m.at.y + 1), (many ? 8 : 5) * Math.max(.7, m.size), ALCH, .6 * lit);
  }

  /** KUROGANE's entrance, as it was laid out (the clap, the transmutation, the blade drawn out of the steel-limb
   *  as the reaction runs along it), in the stage's parts. */
  private awakening(f: Fighter, time: number) {
    const st = this.stage, w = clamp(f.state.actionTime), B = SHAKUDO_AWAKENING.beats, tick = Math.floor(time * 30);
    if (w < B.clap || w > .97) return;
    this.face(f);
    const hands = this.a.copy(f.handR).lerp(f.handL, .5), clap = 1 - clamp((w - B.clap) / .1), fade = clamp((.97 - w) / .1);
    if (clap > 0) { st.glow(hands, .4 + .4 * clap, ALCH.core, clap, STAR, .22, tick); st.light(hands, 3.5, ALCH, .6 * clap); }
    if (w > B.transmute) { transmutationCircle(st, f.group.position, 1.3, ALCH, clamp((w - B.transmute) / .12), .8 * fade, time * .5); reaction(st, f.group.position, 1.1, 1.2, ALCH, .7 * fade, time, 3, 4); }
    if (w > B.bladeRevealStart) { const tip = f.strikePoint(this.strike); for (let i = 0; i < 2; i++) bolt(st, f.handR, tip, .035, ALCH.main, fade, tick + i * 7, .12, 4, ALCH.heart); }
  }
  reset() {
    for (const c of this.confirms) c.actor = ''; for (const m of this.marks) m.live = false; for (const l of this.lances) l.live = false;
    this.seen.fill(-1); this.seenTime.fill(-1); this.cursor = this.confirmCursor = this.markCursor = 0;
    this.stones.begin(); this.stones.end(); this.stage.reset();
  }
  dispose() { if (this.disposed) return; this.reset(); this.disposed = true; this.stones.dispose(); this.stage.release(); }
}
