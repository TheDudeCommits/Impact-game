/** Places that fight back (the overhaul's Phase 2 table, "one thing the place
 *  does to the fight"; the first ten, item 6: three places first).
 *
 *  A place's rule is sky and ground that pick no side: what it throws lands on
 *  the horde as it lands on the fighters (SurvivalGame's strikes), so a
 *  fighter who knows the place can use it.
 *
 *  THE ASHEN WASTES: the ash cracks open into vents where the fight goes, and
 *  the vents erupt one after another, on a count.
 *  THE HILL OF SWORDS: lightning takes the blade nearest a fighter.
 *  THE BURNING VILLAGE: burning beams come down where the rings warn.
 *
 *  Server-authoritative like the signatures: this module decides where and
 *  when; the run (through PlaceHost) strikes, and the renderer draws the feed
 *  and the vents the view carries. */
import type { Vec3 } from '../game/types';

export interface PlaceRule {
  /** Its name, on the place's chapter card. */
  name: string;
  /** What it does, in a line under it. */
  line: string;
}

export const PLACE_RULES: Readonly<Record<string, PlaceRule>> = {
  'ashen-wastes': { name: 'THE VENTS', line: 'The ash breathes fire, vent after vent. Lead them over it.' },
  'hill-of-swords': { name: 'THE STORM', line: 'Lightning takes the blade nearest you, and whatever stands by it.' },
  'burning-village': { name: 'THE FIRE', line: 'Burning beams come down where the rings warn.' },
};

/** What the run lends a place to act with. */
export interface PlaceHost {
  now(): number;
  random(): number;
  bounds(): { halfX: number; halfZ: number };
  /** Where the fighters standing are. */
  fighters(): readonly Vec3[];
  /** The swords still standing in the scenery. */
  swords(): readonly Vec3[];
  /** `at`, if it is floor clear of the scenery. */
  clear(at: Vec3): Vec3 | undefined;
  /** A warned strike from the place itself, on everyone (fighter or horde) within `radius` of `at` as it lands. */
  strike(at: Vec3, lands: number, radius: number, damage: number, name: string, element: string, look?: string): void;
}

/** Seconds a place holds its hand after the round begins there (its chapter card, the first breath). */
const SETTLE = 7;
/** The most vents open at once, how far apart they lie, how often the ash
 *  cracks open another near a fighter, and how near a fighter one must be to go off. */
const VENTS = 7, VENT_GAP = 5, VENT_EVERY = 9, VENT_REACH = 18;

export class PlaceRules {
  private place = '';
  private next = 0;
  /** The Wastes' vents, oldest first, and when the next opens. */
  vents: Vec3[] = [];
  private opens = 0;
  /** Which vent went off last (they go round in the order they opened). */
  private turn = -1;

  constructor(private readonly host: PlaceHost) {}

  /** A round begun at `place` (a location id): its rule set out afresh. */
  begin(place: string) {
    this.place = PLACE_RULES[place] ? place : '';
    this.next = this.host.now() + SETTLE;
    this.vents = []; this.turn = -1; this.opens = this.next;
  }
  /** The place's rule, while it has one. */
  get rule() { return this.place ? PLACE_RULES[this.place] : undefined; }

  /** Every tick (`fighting`: the round's fight is on, no card or breath holding it).
   *  `round` sets how hard and how often. */
  step(fighting: boolean, round: number) {
    if (!this.place) return;
    const now = this.host.now();
    if (!fighting) { this.next = Math.max(this.next, now + 1.2); return; }
    if (now < this.next) return;
    const harder = 1 + Math.max(0, round - 1) * .05;
    if (this.place === 'ashen-wastes') this.vent(now, round, harder);
    else if (this.place === 'hill-of-swords') this.bolt(now, harder);
    else if (this.place === 'burning-village') this.beam(now, harder);
  }

  /** The ash cracks open near a fighter: a vent where the fight is going (the oldest closes past seven). */
  private openVent() {
    const near = this.target();
    for (let tries = 0; near && tries < 10; tries++) {
      const at = this.around(near, 5, 11);
      if (!at || !this.vents.every(vent => Math.hypot(vent.x - at.x, vent.z - at.z) >= VENT_GAP)) continue;
      this.vents.push(at);
      if (this.vents.length > VENTS) { this.vents.shift(); this.turn--; }
      return;
    }
  }
  /** Every so often the ash opens another vent; and the vents near a fighter go off one after
   *  another, round in the order they opened - faster, and two at once, deeper into the road. */
  private vent(now: number, round: number, harder: number) {
    if (now >= this.opens) { this.opens = now + VENT_EVERY; this.openVent(); }
    this.next = now + Math.max(1.5, 2.5 - round * .07);
    const fighters = this.host.fighters();
    const near = (vent: Vec3) => fighters.some(f => Math.hypot(f.x - vent.x, f.z - vent.z) < VENT_REACH);
    for (let n = round >= 9 ? 2 : 1; n > 0; n--) {
      for (let step = 1; step <= this.vents.length; step++) {
        const i = (this.turn + step) % this.vents.length;
        if (!near(this.vents[i])) continue;
        this.turn = i;
        this.host.strike(this.vents[i], now + 1.6, 2.7, Math.round(58 * harder), 'Vent', 'fire', 'vent');
        break;
      }
    }
  }
  /** Lightning at the blade nearest a fighter (or, the blades all broken, out of the open sky near them). */
  private bolt(now: number, harder: number) {
    this.next = now + 3.8 + this.host.random() * 1.8;
    const near = this.target();
    if (!near) return;
    let at: Vec3 | undefined, best = 11;
    for (const sword of this.host.swords()) {
      const d = Math.hypot(sword.x - near.x, sword.z - near.z);
      if (d < best && d > 1.2) { best = d; at = sword; }
    }
    at ??= this.around(near, 3.5, 8);
    if (at) this.host.strike({ x: at.x, y: 0, z: at.z }, now + 1.25, 3.1, Math.round(66 * harder), 'Lightning', 'lightning', 'zeus');
  }
  /** A burning beam come down near a fighter. */
  private beam(now: number, harder: number) {
    this.next = now + 2.9 + this.host.random() * 1.4;
    const near = this.target();
    const at = near ? this.around(near, 2.5, 8) : undefined;
    if (at) this.host.strike(at, now + 1.35, 2.2, Math.round(60 * harder), 'Falling Beam', 'fire', 'lance');
  }

  private target() {
    const fighters = this.host.fighters();
    return fighters.length ? fighters[Math.floor(this.host.random() * fighters.length)] : undefined;
  }
  /** A clear spot between `near` and `far` metres from `from`, inside the floor. */
  private around(from: Vec3, near: number, far: number): Vec3 | undefined {
    const { halfX, halfZ } = this.host.bounds();
    for (let tries = 0; tries < 8; tries++) {
      const a = this.host.random() * Math.PI * 2, r = near + this.host.random() * (far - near);
      const at = this.host.clear({ x: Math.max(-halfX + 1.5, Math.min(halfX - 1.5, from.x + Math.sin(a) * r)), y: 0, z: Math.max(-halfZ + 1.5, Math.min(halfZ - 1.5, from.z + Math.cos(a) * r)) });
      if (at) return at;
    }
    return undefined;
  }
}
