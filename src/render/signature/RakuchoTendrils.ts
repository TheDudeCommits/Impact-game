import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import { RAKUCHO_MOVES } from '../../game/fighters/rakucho';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { SIGNATURE, involvesLocal } from './context';
import { ABYSS, BLOOD } from './FlameSprites';
import { STAR } from './GlowBatch';
import { MoveStage, WAVE, type StageLook } from './MoveStage';
import { blowFloor } from './blowFloor';
import { limb, sweep } from './StageStrokes';
import { RAKUCHO, RakuchoRibbons, rakuchoRibbonsOn, rakuchoTip } from '../../originals/rakuchoRibbons';

export { RAKUCHO_KNUCKLE_LOCAL, RAKUCHO_TIP_LENGTHS, rakuchoStrikeJoint, rakuchoAuthoredJabStep, rakuchoContactPoint } from './RakuchoTendrilsContact';
export const isRakuchoTendrils = (id: string | undefined) => id === 'rakucho';
export const RAKUCHO_TENDRILS_LIMITS = Object.freeze({ marks: 12, confirms: 6 });
const UP = new THREE.Vector3(0, 1, 0);
const lin = (r: number, g: number, b: number) => new THREE.Color(r, g, b);
const clamp = (v: number) => Math.max(0, Math.min(1, v));
/** The tendril's crimson: Rc cells lit from inside, and the red they throw on a room. Its flames are the dark crimson
 *  ones (blood, not fire). */
const TENDRIL: StageLook = { core: lin(3.1, .8, .95), main: lin(1.9, .07, .17), rim: lin(.7, .03, .08), light: lin(1.3, .14, .2), element: { spike: 0xff6f88, rim: 0xd0102e, light: 0xe0203a, ink: 0x120709 }, shell: 0xd0102e, edge: 0x3a0510, flame: BLOOD, dark: false, heart: 0 };
/** The same with nothing white in it, and barely past the bloom (a red that stays red): the tendril's veins, a cut's
 *  line, the cracks its last blow leaves. */
const VEIN: StageLook = { ...TENDRIL, core: lin(2.2, .13, .25), main: lin(1.4, .045, .11) };
/** The crimson shell: black that covers what is behind it, its edge burning crimson (red on dark, as the centipede is drawn). */
const CRIMSON_SHELL: StageLook = { core: lin(2.9, .5, .7), main: lin(1.7, .1, .2), rim: lin(.55, .03, .08), light: lin(1, .14, .2), element: { spike: 0xff9bb0, rim: 0xc20a26, light: 0xd0102e, ink: 0x120709 }, shell: 0xc20a26, edge: 0x120709, flame: ABYSS, dark: true, heart: 0,
  sphere: { body: lin(.03, .004, .008), core: lin(.55, .03, .07), rimA: lin(2.6, .22, .3), rimB: lin(1.5, .06, .12), spin: 1.3 } };
const HEAVY = RAKUCHO_MOVES.heavy, SPECIAL = RAKUCHO_MOVES.special, ULT = RAKUCHO_MOVES.ultimate;
const FIRST = ULT.contacts[0], LAST = ULT.contacts[ULT.contacts.length - 1];
/** How long the reap's arc and the pierce's four lances hang in the air after the blow they belong to (seconds). */
const REAP = .26, LANCE = .34;
const CUT = 0, PIERCE = 1, STRIKE = 2;
type Confirm = { actor: string; target: string; seq: number; final: boolean; floor: number };
/** What a blow leaves in the air for a moment: the cut across a body, the four lances through it, the centipede's fall. */
type Mark = { kind: number; actor: string; born: number; life: number; size: number; seed: number; at: THREE.Vector3; dir: THREE.Vector3; floor: number; live: boolean };

export class RakuchoTendrils {
  private readonly stage: MoveStage;
  private confirms: Confirm[] = Array.from({ length: RAKUCHO_TENDRILS_LIMITS.confirms }, () => ({ actor: '', target: '', seq: -1, final: false, floor: 0 }));
  private marks: Mark[] = Array.from({ length: RAKUCHO_TENDRILS_LIMITS.marks }, () => ({ kind: 0, actor: '', born: -1e9, life: 0, size: 1, seed: 0, at: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1), floor: 0, live: false }));
  private seen = new Float64Array(128).fill(-1); private seenTime = new Float64Array(128).fill(-1);
  private cursor = 0; private confirmCursor = 0; private markCursor = 0; private disposed = false;
  private p = new THREE.Vector3(); private a = new THREE.Vector3(); private b = new THREE.Vector3(); private c = new THREE.Vector3(); private d = new THREE.Vector3();
  private heading = new THREE.Vector3(); private side = new THREE.Vector3(); private dir = new THREE.Vector3(); private ground = new THREE.Vector3();
  private readonly ribbons?: RakuchoRibbons;
  private root = new THREE.Vector3(); private via = new THREE.Vector3(); private tip = new THREE.Vector3(); private strike = new THREE.Vector3();
  constructor(scene: THREE.Scene, kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) { this.stage = MoveStage.for(scene, kit); if (RAKUCHO) this.ribbons = new RakuchoRibbons(scene); }
  load(_ids: readonly string[]) { return Promise.resolve(); }
  private cancel(id: string, victim = false) { for (const c of this.confirms) if (c.actor === id || victim && c.target === id && !c.final) c.actor = ''; }
  private mark(kind: number, actor: string, at: THREE.Vector3, dir: THREE.Vector3, floor: number, born: number, life: number, size: number) {
    const m = this.marks[this.markCursor++ % this.marks.length];
    m.kind = kind; m.actor = actor; m.at.copy(at); m.dir.copy(dir); m.floor = floor; m.born = born; m.life = life; m.size = size; m.seed = (Math.abs(at.x * 13.1 + at.z * 7.7 + born * 3.3)) % 53; m.live = true;
  }
  private marked(actor: string, kind: number) { for (const m of this.marks) if (m.live && m.kind === kind && m.actor === actor) return true; return false; }

  handle(e: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    this.ribbons?.handle(e);
    if (e.kind === 'eliminated' || e.kind === 'respawn') { this.cancel(e.actorId, true); return; }
    if (!isRakuchoTendrils(e.fighter)) return;
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
    // The way the blow travelled: from him to where it landed, else the way he faces.
    const dir = this.dir;
    if (actor) { dir.subVectors(point, actor.group.position).setY(0); if (dir.lengthSq() < .01) dir.set(Math.sin(actor.state.yaw ?? 0), 0, Math.cos(actor.state.yaw ?? 0)); dir.normalize(); } else dir.set(0, 0, 1);
    const ground = this.ground.set(point.x, floor, point.z);
    if (e.slot === 'light') { st.burst(point, TENDRIL, .45, t, { dir, floor, clean: true }); return; }
    if (e.slot === 'heavy') {
      // Ribbon Lash: the cut is the blow (a red cross through the body), the blast under it small and brief.
      const big = e.branch ? .85 : 1;
      this.mark(CUT, e.actorId, point, dir, floor, t, .34, 1.5 * big);
      st.burst(point, TENDRIL, .95 * big, t, { dir, floor });
      st.shock(ground, TENDRIL, 4 * big, t, .4);
      st.scar(ground, CRIMSON_SHELL, 1.7 * big, t + .05, 1.3);
      return;
    }
    if (e.slot === 'special') {
      if (e.branch === 'airSpecial') { st.burst(point, TENDRIL, 2, t, { floor }); st.shock(ground, TENDRIL, 4.5, t, .45); st.scar(ground, CRIMSON_SHELL, 3.2, t, 1.8); return; }
      // Four Bookmarks: four lances through the body and out of its back, the blast, black flame standing where they
      // stood and the dark left on the floor.
      const big = e.branch ? .7 : 1;
      this.mark(PIERCE, e.actorId, point, dir, floor, t, .55, big);
      st.burst(point, TENDRIL, 2 * big, t, { dir, floor });
      st.erupt(ground, UP, CRIMSON_SHELL, .7 * big, 4.2 * big, t + .05, .75);
      st.shock(ground, TENDRIL, 5.5 * big, t, .45);
      st.scar(ground, CRIMSON_SHELL, 3.2 * big, t + .05, 1.9);
      return;
    }
    if (e.slot !== 'ultimate' || e.branch) return;
    if (!final) {
      // The opener is his fist; the second and third blows are the tails', each a red cross cut through the body.
      st.burst(point, TENDRIL, e.contactIndex ? 1.25 + .2 * e.contactIndex : 1, t, { dir, floor });
      if (e.contactIndex) { this.mark(CUT, e.actorId, point, dir, floor, t, .4, 1.6 + .3 * e.contactIndex); st.shock(ground, TENDRIL, 3.5 + e.contactIndex, t, .45); }
      return;
    }
    if (involvesLocal(e.actorId, e.targetId)) SIGNATURE.screen?.impactFrame?.(.42, point);
    // LAST CHAPTER: the centipede comes down through them. The floor cracked crimson, a pillar of black flame where
    // they stood, tails driven up out of the stone round it a beat after (by then they are thrown), the dark left.
    this.mark(STRIKE, e.actorId, point, dir, floor, t, .6, 1);
    st.burst(point, TENDRIL, 2.6, t, { dir, floor });
    st.shatter(this.a.copy(ground).setY(floor + .06), UP, VEIN, 7, t + .03, 1.3);
    st.shock(ground, TENDRIL, 9, t, .6);
    st.erupt(ground, UP, CRIMSON_SHELL, 1.15, 9, t + .06, .8);
    for (let i = 0; i < 3; i++) {
      const ang = i * 2.094 + .5;
      this.a.set(ground.x + Math.cos(ang) * 2.9, floor, ground.z + Math.sin(ang) * 2.9); this.b.set(Math.cos(ang) * .32, 1, Math.sin(ang) * .32).normalize();
      st.erupt(this.a, this.b, TENDRIL, .42, 5.2, t + .2 + i * .05, .55);
    }
    st.scar(ground, CRIMSON_SHELL, 5.5, t + .1, 2.2);
  }

  update(time: number, fighters: ReadonlyMap<string, Fighter>, _flights?: ReadonlyMap<string, Flight>) {
    if (this.disposed) return;
    const st = this.stage.open(time);
    this.ribbons?.update(time, fighters, st, TENDRIL);
    for (const f of fighters.values()) {
      const s = f.state; if (!isRakuchoTendrils(s.fighter) || !s.alive) continue;
      if (s.action === 'awaken') { this.awakening(f); continue; }
      if (s.whiffedAt !== undefined || (s.action !== 'light' && s.action !== 'heavy' && s.action !== 'special' && s.action !== 'ultimate')) continue;
      const elapsed = s.actionTime * s.actionDuration, seed = (s.actionSeq ?? 0) * 6.1, feet = f.group.position, strike = f.strikePoint(this.strike);
      const heading = this.face(f), side = this.side;
      if (s.action === 'light') {
        // Torn Page: the fist trails blood-red through the swing.
        const k = Math.sin(clamp(s.actionTime) * Math.PI);
        st.glow(strike, .3, TENDRIL.main, .6 * k); st.glow(strike, .11, TENDRIL.core, .8 * k);
        st.tongue(this.p.copy(strike).addScaledVector(heading, -.28), this.a.copy(heading).multiplyScalar(-1).setY(.4).normalize(), .3, .4 + .5 * k, TENDRIL, k, seed);
        st.light(this.p.copy(strike).addScaledVector(heading, .4), 2.2, TENDRIL, .25 * k);
      } else if (s.action === 'heavy') {
        // Ribbon Lash: the tails' tips light as they draw back; at the blow the arc they cut hangs across his front, at
        // their own reach, whether or not it lands (what it does to a body is the hit's: `handle`).
        const contact = s.branch ? s.actionDuration * .55 : HEAVY.contacts[0];
        if (elapsed < contact) {
          const k = clamp(elapsed / contact);
          st.charge(strike, TENDRIL, .2, k, seed);
          st.tongue(this.p.copy(strike).setY(strike.y + .15), UP, .3, .5 + .5 * k, TENDRIL, k, seed);
        } else if (elapsed < contact + REAP) {
          const u = (elapsed - contact) / REAP, cut = clamp(u / .35), fade = 1 - u * u;
          this.p.copy(feet).setY(feet.y + 1.05);
          sweep(st, this.p, heading, side, 2.5, -1.35, -1.35 + 2.7 * cut, .34, VEIN, 1.5 * fade, 12);
          sweep(st, this.p, heading, side, 2.05, -1.2, -1.2 + 2.4 * cut, .2, TENDRIL, fade, 10);
          st.light(this.a.copy(this.p).addScaledVector(heading, 2), 5, TENDRIL, .5 * fade);
        }
      } else if (s.action === 'special' && !s.branch) {
        const release = SPECIAL.contacts[0];
        if (elapsed < release) {
          // Four Bookmarks's wind-up: four tails rise over his shoulders, the floor goes dark under him, and the red
          // gathers over his head, where his own back does not hide it from the lens behind him.
          const k = clamp(elapsed / release);
          st.pool(this.p.copy(feet), 2.2 + 1.2 * k, CRIMSON_SHELL, k, seed);
          this.tails(f, k, 1, time, seed, this.a.copy(feet).addScaledVector(heading, .5).setY(feet.y + 2.75));
          st.charge(this.a, TENDRIL, .34, k, seed);
        } else if (elapsed < release + LANCE && !this.marked(s.id, PIERCE)) {
          // Thrown: the four lances at their own reach, whether or not anyone is there (a body they land in is the hit's,
          // which draws them into it instead).
          const u = (elapsed - release) / LANCE;
          this.tails(f, 1, 1 - u, time, seed, this.a.copy(feet).addScaledVector(heading, 3.3).setY(feet.y + 1.1), clamp(u / .16));
        }
      } else if (s.action === 'ultimate' && !s.branch && s.confirmedAt === undefined && elapsed < FIRST + .12) {
        // The opener: the fist, red gathering on it.
        const k = clamp(elapsed / FIRST);
        st.charge(strike, TENDRIL, .28, k, seed);
        st.tongue(this.p.copy(strike).addScaledVector(heading, -.3), this.a.copy(heading).multiplyScalar(-1).setY(.4).normalize(), .32, .5 + .6 * k, TENDRIL, k, seed);
      }
    }
    for (const c of this.confirms) {
      if (!c.actor) continue;
      const actor = fighters.get(c.actor), victim = fighters.get(c.target), s = actor?.state;
      if (!actor || !s?.alive || !victim?.state.alive && !c.final || s.action !== 'ultimate' || s.branch || (s.actionSeq ?? -1) !== c.seq || s.whiffedAt !== undefined) { c.actor = ''; continue; }
      const elapsed = s.actionTime * s.actionDuration;
      if (elapsed > ULT.duration) { c.actor = ''; continue; }
      if (!c.final && elapsed < LAST) this.gather(actor, victim, c, elapsed, time);
    }
    for (const m of this.marks) {
      if (!m.live) continue;
      const age = time - m.born;
      if (age >= m.life) { m.live = false; continue; }
      if (age >= 0) this.drawMark(m, age, time, fighters.get(m.actor));
    }
    st.close();
  }

  /** The way he faces, and his right (`side`). */
  private face(f: Fighter) {
    const yaw = f.state.yaw ?? f.group.rotation.y;
    this.side.set(Math.cos(yaw), 0, -Math.sin(yaw));
    return this.heading.set(Math.sin(yaw), 0, Math.cos(yaw));
  }

  /** The four tails as lines of light from the small of his back, bowed out wide of his shoulders so his own body is
   *  read between them, drawn out to `k` of their length toward `to` (and `spread`: 0 held apart above him, 1 driven
   *  together into it). `face` must have been called for him. */
  private tails(f: Fighter, k: number, fade: number, time: number, seed: number, to: THREE.Vector3, spread = 0) {
    if (rakuchoRibbonsOn(f)) return;
    const st = this.stage, feet = f.group.position, heading = this.heading, side = this.side;
    for (let i = 0; i < 4; i++) {
      const out = i < 2 ? -1 : 1, high = i % 2, sway = Math.sin(time * 6 + i * 1.9 + seed) * .12 * (1 - spread);
      this.root.copy(feet).addScaledVector(side, out * .16).addScaledVector(heading, -.22).setY(feet.y + 1 + high * .12);
      // Out past the shoulder and up, then in to where it is going.
      this.via.copy(feet).addScaledVector(side, out * (1.5 + high * .5 + sway)).addScaledVector(heading, .1 + spread * 1.2).setY(feet.y + 1.9 + high * .9);
      this.tip.copy(to).addScaledVector(side, out * (1 - spread) * (.55 + high * .5)).addScaledVector(UP, (1 - spread) * (high * .5 - .25) + spread * (high * .34 - .17)).addScaledVector(side, out * spread * .16);
      limb(st, this.root, this.via, this.tip, .15, VEIN, k, fade, 9, .28, this.c);
      st.glow(this.c, .2 + .16 * spread, TENDRIL.core, .9 * fade * k);
    }
    st.light(this.p.copy(to).setY(to.y + .2), 4.5 + 2 * spread, TENDRIL, .45 * fade * k);
  }

  /** Last Chapter from the confirm to the last blow: the darkness flooding the floor and standing round him in
   *  black flames, the room lit red, and the centipede climbing out of his back and arching over him toward its victim.
   *  On the floor, round him and above him: the pair is read under it. */
  private gather(actor: Fighter, victim: Fighter | undefined, c: Confirm, elapsed: number, time: number) {
    const st = this.stage, g = clamp((elapsed - FIRST) / (LAST - FIRST)), seed = c.seq * 2.7, feet = this.ground.copy(actor.group.position).setY(c.floor), heading = this.face(actor);
    // (Never dimmed: darkness is read against a lit floor.)
    st.pool(feet, 3 + 3.4 * g, CRIMSON_SHELL, Math.min(1, .3 + g * 1.2), seed);
    st.ring(feet, 2.5 + .5 * g, 1.1 + 1.3 * g, CRIMSON_SHELL, .6 + .4 * g, seed, 8);
    st.light(this.p.copy(feet).setY(feet.y + 1.2), 6 + 2.5 * g, TENDRIL, .28 + .32 * g);
    // The centipede: out of the small of his back, up behind his left shoulder and over, its head hanging above the
    // one it is for.
    const reach = victim ? Math.min(4.5, Math.max(1.6, Math.hypot(victim.group.position.x - feet.x, victim.group.position.z - feet.z))) : 2.4;
    this.root.copy(feet).addScaledVector(heading, -.25).setY(feet.y + 1.05);
    this.via.copy(feet).addScaledVector(heading, -1.5).addScaledVector(this.side, -1.1).setY(feet.y + 3.4 + 2.6 * g);
    this.tip.copy(feet).addScaledVector(heading, reach * (.25 + .6 * g)).setY(feet.y + 2.5 + 1.6 * g + .25 * Math.sin(time * 2.3));
    if (rakuchoRibbonsOn(actor)) rakuchoTip(actor, 'Tendrils1_8', this.tip); else
    this.centipede(this.root, this.via, this.tip, clamp(.15 + g * 1.9), 1, time, seed);
    st.charge(this.tip, TENDRIL, .26 + .2 * g, Math.max(.35, g), seed);
    if (g > .8) st.speed(.5 * (g - .8) / .2, c.actor, c.target);
  }

  /** The shell's centipede from `root` through `via` to `head` (a curve), drawn out to `k` of its length: a chain of
   *  black plates edged in crimson, a red spine through them, a pair of legs raking back off every plate, a head with
   *  one red eye. It sways as it stands. */
  private centipede(root: THREE.Vector3, via: THREE.Vector3, head: THREE.Vector3, k: number, fade: number, time: number, seed: number, girth = .34) {
    if (k <= .03 || fade <= .02) return;
    const st = this.stage, a = this.a.copy(root), b = this.b, along = this.c, leg = this.d, n = st.n(16, 9);
    for (let i = 1; i <= n; i++) {
      const s = i / n, u = k * s, v = 1 - u, sway = Math.sin(u * 8 - time * 4.5 + seed) * .34 * s * (1 - s * .45);
      b.set(v * v * root.x + 2 * u * v * via.x + u * u * head.x, v * v * root.y + 2 * u * v * via.y + u * u * head.y, v * v * root.z + 2 * u * v * via.z + u * u * head.z).addScaledVector(this.side, sway);
      along.subVectors(b, a); const len = along.length(); if (len < .01) continue;
      along.divideScalar(len);
      const w = girth * (.55 + .45 * Math.sin(Math.PI * Math.min(1, s * 1.15)));
      st.tongue(this.p.copy(a).lerp(b, .5), along, w * 2.5, len * 2.2, CRIMSON_SHELL, (.5 + .45 * fade) * fade, seed + i);
      st.streak(a, b, w * .42, VEIN.main, .95 * fade); st.streak(a, b, w * .15, VEIN.core, fade);
      // Its legs: a pair to every plate, across the way it runs, raking back and walking.
      leg.copy(this.side).addScaledVector(along, -this.side.dot(along)); if (leg.lengthSq() < .01) leg.set(along.z, 0, -along.x); leg.normalize();
      const walk = .5 + .3 * Math.sin(time * 13 + i * 1.7);
      for (let j = -1; j <= 1; j += 2) st.streak(b, this.p.copy(b).addScaledVector(leg, j * w * 2.3).addScaledVector(along, -w * (1.2 + walk * j)), w * .14, VEIN.core, .95 * fade);
      a.copy(b);
    }
    // Its head: the last plate swollen, one red eye, the jaws open.
    st.glow(a, girth * 2, TENDRIL.main, .75 * fade); st.glow(a, girth * 1.1, TENDRIL.core, .9 * fade, STAR, .22, Math.floor(time * 24));
    for (let j = -1; j <= 1; j += 2) st.streak(a, this.p.copy(a).addScaledVector(along, girth * 2.2).addScaledVector(leg, j * girth * 1.3), girth * .22, VEIN.core, 1.2 * fade);
  }

  private drawMark(m: Mark, age: number, time: number, actor: Fighter | undefined) {
    const st = this.stage, u = age / m.life, fade = (1 - u) * (1 - u);
    if (m.kind === CUT) {
      // A red cross cut through the body, across the way the blow came: it snaps out, hangs, and thins away.
      const reach = m.size * clamp(age / .05), across = this.a.set(m.dir.z, 0, -m.dir.x);
      for (let j = -1; j <= 1; j += 2) {
        const tilt = j * (.62 + .2 * Math.sin(m.seed + j));
        this.b.copy(across).multiplyScalar(Math.cos(tilt)).addScaledVector(UP, Math.sin(tilt));
        this.c.copy(m.at).addScaledVector(this.b, -reach); this.d.copy(m.at).addScaledVector(this.b, reach);
        st.streak(this.c, this.d, .2 * (.4 + .6 * fade), VEIN.main, 1.2 * fade); st.streak(this.c, this.d, .07 * (.4 + .6 * fade), TENDRIL.core, 1.5 * fade);
      }
      st.light(m.at, 3 + m.size, TENDRIL, .4 * fade);
      return;
    }
    if (m.kind === PIERCE) {
      // The four lances from his back into the body (while he still stands behind them), and out of its back, fanned.
      if (actor?.state.alive && age < LANCE) { this.face(actor); this.tails(actor, 1, 1 - age / LANCE, time, m.seed, m.at, 1); }
      const through = clamp(age / .07), right = this.a.set(m.dir.z, 0, -m.dir.x);
      for (let i = 0; i < 4; i++) {
        const out = i < 2 ? -1 : 1, high = i % 2;
        this.b.copy(m.dir).addScaledVector(right, out * (.3 + high * .25)).addScaledVector(UP, .12 + high * .5).normalize();
        this.c.copy(m.at).addScaledVector(this.b, .25); this.d.copy(m.at).addScaledVector(this.b, .25 + (1.5 + high * .7) * m.size * through);
        st.streak(this.c, this.d, .13 * (.5 + .5 * fade), VEIN.main, 1.3 * fade); st.streak(this.c, this.d, .045, TENDRIL.core, 1.3 * fade);
        st.glow(this.d, .22, TENDRIL.core, .8 * fade);
      }
      return;
    }
    // STRIKE: the centipede come down through its victim, out of the air over him, and going into the floor.
    if (actor && rakuchoRibbonsOn(actor)) return;
    const fall = clamp(age / .09), right = this.side.set(m.dir.z, 0, -m.dir.x);
    this.root.copy(m.at).addScaledVector(m.dir, -3.4).addScaledVector(right, -.8).setY(m.floor + 5.4);
    this.via.copy(m.at).addScaledVector(m.dir, -.6).setY(m.floor + 6.4);
    this.tip.set(m.at.x, m.floor + .15, m.at.z);
    this.centipede(this.root, this.via, this.tip, fall, 1 - u * u, time, m.seed, .42);
  }

  /** STARVING's entrance, as it was laid out (a ring opening at his feet from the eye's reveal, and the one red
   *  eye), in the stage's parts. */
  private awakening(f: Fighter) {
    const st = this.stage, s = f.state;
    if (s.actionTime <= .43 || s.actionTime >= .94) return;
    const u = (s.actionTime - .43) / .51, alpha = Math.sin(u * Math.PI);
    st.disc(this.p.copy(f.group.position), .5 + u * 2.2, TENDRIL.main, alpha * .8, WAVE, .96);
    const head = f.drawnJoint?.('Head');
    if (head) { head.getWorldPosition(this.p); st.glow(this.p, .16, TENDRIL.core, alpha * .8, STAR, .2, 1); }
  }
  reset() {
    for (const c of this.confirms) c.actor = ''; for (const m of this.marks) m.live = false;
    this.seen.fill(-1); this.seenTime.fill(-1); this.cursor = this.confirmCursor = this.markCursor = 0; this.stage.reset();
    this.ribbons?.reset();
  }
  dispose() { if (this.disposed) return; this.reset(); this.disposed = true; this.stage.release(); this.ribbons?.dispose(); }
}
