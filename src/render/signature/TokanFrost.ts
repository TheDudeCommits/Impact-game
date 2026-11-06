import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import { TOKAN_MOVES, TOKAN_SABER_SOCKET } from '../../game/fighters/tokan';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { STAR } from './GlowBatch';
import { BURN, MoveStage, SHEEN, stageLook, type StageLook } from './MoveStage';
import { blowFloor } from './blowFloor';

/** His frost as the stage lights it: frost white at the heart, his deep sea-ice blue round it (the tuned
 *  ice/tokan preset's body and seam). Its strokes carry the bolts' blue-white heart: ice cracks white. */
export const FROST: StageLook = stageLook(0xeefbff, 0x74c4ea, 0x2f7fc0, { heart: .5 });
const UP = new THREE.Vector3(0, 1, 0);
/** Frost in the floor under a man in a white coat: deep blue veins, never a white sheet (and what is left on the floor
 *  after a blow, in the same blue with little light: `FLOOR`). */
const DEEP = new THREE.Color(.1, .42, 1.05);
const FLOOR: StageLook = { ...FROST, main: DEEP, light: new THREE.Color(.22, .45, .85) };
const HEAVY = TOKAN_MOVES.heavy, SPECIAL = TOKAN_MOVES.special, ULT = TOKAN_MOVES.ultimate, FINAL = ULT.contacts.length - 1;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
type Age = { actor: string; target: string; seq: number; floor: number; final: boolean };

export class TokanFrost {
  private readonly stage: MoveStage;
  private ages: Age[] = Array.from({ length: 6 }, () => ({ actor: '', target: '', seq: -1, floor: 0, final: false }));
  private seen = new Float64Array(128).fill(-1); private seenTime = new Float64Array(128).fill(-1);
  private cursor = 0; private ageCursor = 0; private disposed = false;
  private p = new THREE.Vector3(); private a = new THREE.Vector3(); private b = new THREE.Vector3(); private strike = new THREE.Vector3();
  private heading = new THREE.Vector3(); private dir = new THREE.Vector3(); private ground = new THREE.Vector3();
  constructor(scene: THREE.Scene, kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) { this.stage = MoveStage.for(scene, kit); }
  private cancel(id: string, victim = false) { for (const c of this.ages) if (c.actor === id || victim && c.target === id && !c.final) c.actor = ''; }

  handle(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    if (event.kind === 'eliminated' || event.kind === 'respawn') { this.cancel(event.actorId, true); return; }
    if (event.fighter !== 'tokan') return;
    if (event.kind === 'whiff' || event.kind === 'rejected') { this.cancel(event.actorId); return; }
    if (event.kind !== 'hit' && event.kind !== 'confirm') return;
    // (A confirm and the hit it confirms are two events, whatever ids they carry.)
    const key = event.kind === 'confirm' ? -2 - event.id : event.id;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === key && this.seenTime[i] === event.serverTime) return;
    const index = this.cursor++ % this.seen.length; this.seen[index] = key; this.seenTime[index] = event.serverTime;
    const actor = fighters?.get(event.actorId), victim = event.targetId ? fighters?.get(event.targetId) : undefined, seq = event.actionSeq ?? actor?.state.actionSeq ?? -1;
    let floor = blowFloor(actor, victim, 0);
    if (event.kind === 'confirm') {
      if (event.slot === 'ultimate' && !event.branch && event.targetId) Object.assign(this.ages[this.ageCursor++ % this.ages.length], { actor: event.actorId, target: event.targetId, seq, floor, final: false });
      return;
    }
    if (!victim && !event.endpoint) return;
    const point = this.p, st = this.stage, t = event.serverTime, big = actor?.state.awakened ? 1.15 : 1;
    if (victim) bodyCentre(victim, point); else point.set(event.endpoint!.x, event.endpoint!.y, event.endpoint!.z);
    const dir = this.dir;
    if (actor) { dir.subVectors(point, actor.group.position).setY(0); if (dir.lengthSq() < .01) dir.set(Math.sin(actor.group.rotation.y), 0, Math.cos(actor.group.rotation.y)); dir.normalize(); } else dir.set(0, 0, 1);
    const ground = this.ground.set(point.x, floor, point.z);
    if (event.slot === 'light') { st.burst(point, FROST, .42, t, { dir, floor, clean: true }); return; }
    if (event.slot === 'heavy') {
      // Sleet Heel landing: the air broken like ice across the body, a ring of frost over the floor.
      const k = (event.branch ? .8 : 1) * big;
      st.shatter(point, dir, FROST, 2.5 * k, t, .42);
      st.burst(point, FROST, .8 * k, t, { dir, floor });
      st.shock(ground, FROST, 4.4 * k, t, .42);
      return;
    }
    if (event.slot === 'special') {
      if (event.branch === 'airSpecial') { st.burst(point, FROST, 2, t, { floor }); st.shock(ground, FROST, 4.5, t, .45); st.scar(ground, FLOOR, 2.6, t + .05, 2); return; }
      // Frostplume Flight landing: a blast, the air broken like ice round it, and frost left glowing in the floor (the
      // ring of crystals that snaps up round the body is his casting's).
      const k = (event.branch ? .7 : 1) * big;
      st.burst(point, FROST, 1.9 * k, t, { dir, floor });
      st.shatter(point, dir, FROST, 3.2 * k, t, .6);
      st.shock(ground, FROST, 5 * k, t, .45);
      st.scar(ground, FLOOR, 2.6 * k, t + .05, 2.2);
      return;
    }
    if (event.slot !== 'ultimate' || event.branch) return;
    if ((event.contactIndex ?? 0) < FINAL) {
      // (The opener is a blow, small over the pair; the kick that follows breaks the air.)
      st.burst(point, FROST, event.contactIndex ? 1.25 : .9, t, { dir, floor });
      st.shatter(point, dir, FROST, event.contactIndex ? 2.6 : 1.5, t, event.contactIndex ? .45 : .3);
      if (event.contactIndex) st.shock(ground, FROST, 5, t, .5);
      return;
    }
    // The last blow needs its confirm still standing (a whiff, an interruption or a new action has cancelled it).
    let confirmed = false;
    for (const c of this.ages) if (c.actor === event.actorId && c.seq === seq) { c.final = true; floor = c.floor; confirmed = true; }
    if (!confirmed) return;
    ground.y = floor;
    // WINTER SLEEP: the air broken across the whole frame, the cold thrown out as a shell, and the
    // floor left frozen under the crystals his casting raises in it.
    // (Brief over the pair: the crystals stand round both of them for a second after it, and he is read among them.)
    st.shatter(point, dir, FROST, 7, t, .7);
    st.dome(point, FROST, 4.6, t, .45);
    st.burst(point, FROST, 2.1, t, { dir, floor });
    st.shock(ground, FROST, 10, t, .6);
    st.scar(ground, FLOOR, 3, t + .1, 1.9);
  }

  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) {
    if (this.disposed) return;
    const st = this.stage.open(time);
    for (const f of fighters.values()) {
      const s = f.state; if (s.fighter !== 'tokan' || !s.alive) continue;
      if (!['light', 'heavy', 'special', 'ultimate'].includes(s.action) || s.whiffedAt !== undefined) continue;
      const elapsed = s.actionTime * s.actionDuration, seed = (s.actionSeq ?? 0) * 5.9, yaw = s.yaw ?? f.group.rotation.y, big = s.awakened ? 1.15 : 1;
      const heading = this.heading.set(Math.sin(yaw), 0, Math.cos(yaw)), feet = f.group.position;
      const strike = typeof f.strikePoint === 'function' ? f.strikePoint(this.strike) : this.strike.copy(f.handR);
      if (s.action === 'light') {
        // Frostbite Cut: the saber's own edge lit cold through the cut (its animated joint; else the blow's point).
        const k = Math.sin(clamp(s.actionTime) * Math.PI), joint = f.joints?.get('TokanSaber');
        if (joint) {
          this.a.fromArray(TOKAN_SABER_SOCKET.base).applyMatrix4(joint.matrixWorld); this.b.fromArray(TOKAN_SABER_SOCKET.tip).applyMatrix4(joint.matrixWorld);
          st.streak(this.a, this.b, .11, FROST.main, .45 * k); st.streak(this.a, this.b, .035, FROST.core, 1.3 * k, .5);
        }
        st.glow(strike, .3, FROST.main, .5 * k); st.light(strike, 2.2, FROST, .22 * k);
      } else if (s.action === 'heavy') {
        // Sleet Heel: cold gathered on the heel to the contact; at the blow the air cracks like ice at the heel's own
        // reach whether or not it lands (what it does to a body is the hit's: `handle`).
        const contact = s.branch ? s.actionDuration * .5 : HEAVY.contacts[0];
        if (elapsed < contact) st.charge(strike, FROST, .22 * big, clamp(elapsed / contact), seed);
        else if (elapsed < contact + .2) st.cracks(strike, heading, 1.15 * big, FROST, 1, seed, 1 - (elapsed - contact) / .2);
      } else if (s.action === 'special' && !s.branch) {
        // Frostplume Flight's wind-up: the cold gathered in his palm, frost creeping over the floor round him.
        const release = SPECIAL.contacts[0];
        if (elapsed < release) {
          const k = clamp(elapsed / release);
          st.charge(f.handR, FROST, .36 * big, k, seed);
          st.pool(this.p.copy(feet), 1.6 + 1.6 * k, FROST, .7 * k, seed);
          st.disc(this.p.copy(feet), 2 + 1.6 * k, FROST.main, .5 * k, SHEEN, 1, seed);
        }
      } else if (s.action === 'ultimate' && !s.branch && s.confirmedAt === undefined && elapsed < ULT.contacts[0] + .1) st.charge(strike, FROST, .28, clamp(elapsed / ULT.contacts[0]), seed);
    }
    // Frostplume Flight in flight: the lance in its own cold light, a lane of frost under it.
    for (const flight of flights.values()) {
      if (flight.fighter !== 'tokan' || flight.slot !== 'special' || flight.branch || !flight.released) continue;
      const floor = (flight.actorId ? fighters.get(flight.actorId)?.group.position.y : undefined) ?? flight.position.y - 1.2;
      st.glow(flight.position, 1.25, FROST.main, .42); st.glow(this.p.copy(flight.position).addScaledVector(flight.heading, 1.3), .45, FROST.core, .8, STAR, .2, Math.floor(time * 24));
      for (let i = 1; i <= 3; i++) st.glow(this.p.copy(flight.position).addScaledVector(flight.heading, -i * 1.1), 1 - i * .2, FROST.main, .3 - i * .07);
      st.light(this.p.copy(flight.position).setY(flight.position.y + .2), 6.2, FROST, .9);
      st.light(this.p.copy(flight.position).addScaledVector(flight.heading, -3.2).setY(floor + .6), 4.5, FROST, .5);
      st.disc(this.p.set(flight.position.x, floor, flight.position.z), 2.4, FROST.main, .7, SHEEN, 1, flight.since);
    }
    for (const c of this.ages) {
      if (!c.actor) continue;
      const actor = fighters.get(c.actor), victim = fighters.get(c.target), s = actor?.state;
      if (!actor || !s?.alive || !victim?.state.alive && !c.final || s.action !== 'ultimate' || s.branch || (s.actionSeq ?? -1) !== c.seq || s.whiffedAt !== undefined) { c.actor = ''; continue; }
      const elapsed = s.actionTime * s.actionDuration;
      if (elapsed > ULT.duration) { c.actor = ''; continue; }
      if (!c.final && elapsed < ULT.contacts[FINAL]) this.gather(actor, c, elapsed, time);
    }
    st.close();
  }

  /** Winter Sleep from the confirm to the last blow: the room to a blue night, frost spreading over the floor and cracking
   *  outward from him, diamond dust hanging in the air round him, the cold filling his palm. On the floor and round
   *  him, never over the pair. */
  private gather(actor: Fighter, c: Age, elapsed: number, time: number) {
    const st = this.stage, g = clamp((elapsed - ULT.contacts[0]) / (ULT.contacts[FINAL] - ULT.contacts[0])), seed = c.seq * 3.7;
    const feet = this.ground.copy(actor.group.position).setY(c.floor);
    st.dim(.3 + .4 * g, c.actor, c.target);
    // The frost is deep blue veins in the floor, and no light on him: he stands in it in a white coat. (A sheet of
    // frost in the look's own colours burnt the floor white under him, and a light volume the size of it washed him
    // out: unreadable 0.9 to 1.9 s against a ceiling of 0.85. Cracks drawn as strokes lay across both bodies.)
    st.disc(feet, (3 + 5 * g) * (.6 + .4 * g), DEEP, .7, BURN, .3 + .7 * g, seed);
    st.disc(feet, 3.6 + 4.4 * g, DEEP, .16 + .12 * g, SHEEN, 1, seed);
    // Diamond dust: points of ice turning in the air round him, each catching the light for a moment.
    for (let i = 0, n = st.n(12, 6); i < n; i++) {
      const clock = time * (.9 + .5 * g) + i * .618, cycle = Math.floor(clock), phase = clock - cycle, h = cycle * 5.31 + i * 2.7 + seed;
      const ang = i * 2.399963 + h, r = 1.6 + 2.6 * Math.abs(Math.sin(h * 1.7));
      this.a.set(feet.x + Math.cos(ang) * r, c.floor + .4 + 2.4 * Math.abs(Math.sin(h * .9)) + phase * .5, feet.z + Math.sin(ang) * r);
      st.glow(this.a, .16 + .08 * g, FROST.core, Math.sin(Math.PI * phase) * (.5 + .5 * g), STAR, .22, i + cycle);
    }
    st.charge(actor.handR, FROST, .2 + .1 * g, Math.max(.4, g) * .7, seed);
    if (g > .8) st.speed(.5 * (g - .8) / .2, c.actor, c.target);
  }

  reset() { for (const c of this.ages) c.actor = ''; this.seen.fill(-1); this.seenTime.fill(-1); this.cursor = this.ageCursor = 0; this.stage.reset(); }
  dispose() { if (this.disposed) return; this.reset(); this.disposed = true; this.stage.release(); }
}
