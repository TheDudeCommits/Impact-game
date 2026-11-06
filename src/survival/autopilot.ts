/** A player for arcade survival that is not a person: it reads the arena the
 *  way the brains do and sends the commands a keyboard would. The tests play
 *  whole runs with it, and `?autopilot` lets it drive the real client for
 *  captures. It fights like a competent beginner - strings into the nearest
 *  body, specials into crowds, the ultimate on a boss or a pack, a guard when
 *  a blow is coming - which is what the balance has to survive. */
import type { AttackSlot, PlayerInput, PlayerState } from '../game/types';
import { PLAYER_ID } from './SurvivalGame';

const ATTACKS = new Set(['light', 'heavy', 'special', 'ultimate']);

/** The horde, as the autopilot reads it: the live Horde in a local run, the
 *  client's copy of it in a co-op room. */
export interface CrowdView {
  readonly capacity: number;
  readonly x: ArrayLike<number>; readonly y: ArrayLike<number>; readonly z: ArrayLike<number>;
  isAlive(slot: number): boolean;
  /** Mid-swing and close to landing (a wind-up the autopilot may guard). */
  swinging(slot: number): boolean;
  idOf(slot: number): string;
}

/** The horde `?autopilot` reads when the client's loop hands it only the
 *  fighters (main.ts passes no crowd): a local run registers its live Horde
 *  here (LocalArena), so the capture bot sees and guards the grunts as the
 *  headless runs' bot does. A co-op client has none and plays blind to them. */
let watched: CrowdView | undefined;
export function watchCrowd(crowd?: CrowdView) { watched = crowd; }

export class Autopilot {
  /** Bosses seen, and the one being given its entrance (as RiftTargeting
   *  frames it: the bot faces what the camera shows). */
  private readonly metBosses = new Set<string>();
  private introId: string | null = null;
  private introUntil = 0;
  private seq = 0;
  private string = 0;
  private nextPress = 0;
  private guardUntil = 0;
  private roll = 1;
  /** Walking into a wall: where it was a second ago, and the way round it it is taking. */
  private stuckFrom?: { x: number; z: number; at: number };
  private detour?: { x: number; z: number; until: number };
  constructor(private skill = .6, private readonly self = PLAYER_ID) {}
  private random() { this.roll = (this.roll * 16807) % 2147483647; return this.roll / 2147483647; }

  command(players: readonly PlayerState[], now: number, crowd: CrowdView | undefined = watched): PlayerInput {
    const me = players.find(p => p.id === this.self);
    const input: PlayerInput = { seq: ++this.seq, moveX: 0, moveZ: 0, yaw: me?.yaw ?? 0 };
    if (!me?.alive) return input;
    let nearest: { id: string; x: number; z: number } | undefined, gap = Infinity, around = 0, boss: PlayerState | undefined, incoming = false;
    for (const p of players) {
      if (p.id === me.id || !p.alive || !p.enemy) continue;
      const d = Math.hypot(p.x - me.x, p.z - me.z);
      if (d < 5) around++;
      if ((p.size ?? 1) > 1.4 || p.poise !== undefined && p.maxHp > 1500) boss = p;
      if (d < gap) { gap = d; nearest = p; }
      if (ATTACKS.has(p.action) && d < 3.2 && p.actionTime > .28 && p.actionTime < .52) incoming = true;
    }
    if (crowd) {
      for (let i = 0; i < crowd.capacity; i++) {
        if (!crowd.isAlive(i)) continue;
        const d = Math.hypot(crowd.x[i] - me.x, crowd.z[i] - me.z);
        if (d < 5) around++;
        if (d < gap) { gap = d; nearest = { id: crowd.idOf(i), x: crowd.x[i], z: crowd.z[i] }; }
        if (d < 2.8 && crowd.swinging(i)) incoming = true;
      }
    }
    for (const p of players) if (p.enemy && p.alive && ((p.size ?? 1) > 1.4 || p.poise !== undefined && p.maxHp > 1500) && !this.metBosses.has(p.id)) {
      this.metBosses.add(p.id); this.introId = p.id; this.introUntil = now + 3.2;
    }
    const introduced = this.introId && now < this.introUntil ? players.find(p => p.id === this.introId && p.alive) : undefined;
    const target = introduced ?? (boss && Math.hypot(boss.x - me.x, boss.z - me.z) < 12 ? boss : nearest);
    if (!target) return input;
    const dx = target.x - me.x, dz = target.z - me.z, d = Math.hypot(dx, dz) || 1;
    input.yaw = Math.atan2(dx, dz); input.targetId = target.id;
    if (incoming && me.stamina > 35 && now > this.guardUntil + .45 && this.random() < this.skill * .45) this.guardUntil = now + .32;
    if (now < this.guardUntil) { input.guard = true; return input; }
    if (d > 2.2) {
      input.moveX = dx / d; input.moveZ = dz / d;
      // A pack across the village walks it into a house (it has no paths):
      // no nearer after a second, it goes round, to one side a moment.
      if (this.detour && now < this.detour.until) { input.moveX = this.detour.x; input.moveZ = this.detour.z; }
      else if (!this.stuckFrom || now - this.stuckFrom.at > 1) {
        if (this.stuckFrom && Math.hypot(me.x - this.stuckFrom.x, me.z - this.stuckFrom.z) < .6 && d > 4) {
          const side = this.random() < .5 ? 1 : -1;
          this.detour = { x: -dz / d * side, z: dx / d * side, until: now + .9 + this.random() * .8 };
        }
        this.stuckFrom = { x: me.x, z: me.z, at: now };
      }
    }
    // Hemmed in and hurt: dash out the other way.
    if (around >= 6 && me.hp < me.maxHp * .4 && me.stamina > 40 && this.random() < .04) { input.dash = true; input.moveX = -dx / d; input.moveZ = -dz / d; return input; }
    if ((me.awakening ?? 0) >= 100 && !me.awakened && me.grounded && around >= 3) input.awaken = true;
    if (now < this.nextPress) return input;
    let press: AttackSlot | undefined;
    if (me.ultimate >= 100 && (target === boss || around >= 6) && d < 6) press = 'ultimate';
    else if (around >= 3 && now >= me.cooldowns.special && d < 8 && this.random() < .6) press = 'special';
    else if (d < 3.4) press = this.string++ % 6 === 5 && now >= me.cooldowns.heavy ? 'heavy' : 'light';
    if (press) { input.attack = press; this.nextPress = now + .1 + (1 - this.skill) * .15; }
    return input;
  }
}
