/** Arcade survival's targeting.
 *
 *  A horde is not a duel: nobody wants to pick a grunt out of forty with a
 *  button. The soft target follows the rule the arena's own auto-aim follows
 *  (ArenaSimulation.assistAim) - the nearest body all the way round, a little
 *  in favour of what is in front - leaning toward the strongest (a boss, a
 *  champion, an elite), and it is sent with every command, so the mark on the
 *  floor is exactly where the next blow goes. It moves on the moment its body
 *  falls, and holds against a near tie so it does not flicker between two.
 *
 *  Tab is the hard lock, and only for what is worth locking: a boss or a
 *  champion, cycling through them across the screen, then off.
 *
 *  Roster modes keep their own Targeting; nothing here runs outside a run. */
export interface RiftCandidate { id: string; x: number; y: number; z: number; radius: number; boss: boolean; elite: boolean;
  /** How far it stands from the fighter, set by the targeting (the mark's chevron fades with it). */
  dist?: number }

/** Grunts further than this are not worth nominating; bosses are, further. */
const GRUNT_RANGE = 14, BOSS_RANGE = 30;
/** How much better a new body has to score before the mark leaves the old. */
const HOLD = .9;

/** How long a newly arrived boss holds the camera: its card, and a breath after. */
const INTRODUCTION = 3.2;

/** The boss the mark keeps framed (TargetRing reads it): the one the next
 *  blow is for, else the nearest in range. The next blow is often a grunt's
 *  with the boss three metres off, and then nothing on screen said where it
 *  stood ("Emperor Jinlin stands in the middle of the frame with no bracket"). */
export const riftBoss: { current: RiftCandidate | undefined } = { current: undefined };

export class RiftTargeting {
  id: string | null = null;
  /** Tab is holding the camera on a boss. */
  private hard = false;
  /** A boss just through the rift, held in frame for its entrance. */
  private introId: string | null = null;
  private introUntil = 0;
  private readonly met = new Set<string>();
  /** The camera is held on the target: by Tab, or while a new boss makes its entrance. */
  get locked() { return this.hard || this.introId !== null; }
  set locked(value: boolean) { this.hard = value; }
  reset() { this.id = null; this.hard = false; this.introId = null; this.met.clear(); riftBoss.current = undefined; }

  private score(c: RiftCandidate, self: { x: number; z: number }, fx: number, fz: number) {
    const dx = c.x - self.x, dz = c.z - self.z, d = Math.hypot(dx, dz);
    if (d > (c.boss ? BOSS_RANGE : GRUNT_RANGE)) return Infinity;
    const reach = Math.max(0, d - c.radius);
    const facing = (1 - (d > 1e-4 ? (dx * fx + dz * fz) / d : 1)) * .55;
    // Past a swing's reach, distance counts for more: a body five metres off
    // is not the next blow's, whoever it is.
    const far = Math.max(0, reach - 3.5) * .6;
    return reach + facing + far - (c.boss ? 1.4 : c.elite ? .5 : 0);
  }

  update(self: { x: number; z: number; yaw: number }, candidates: readonly RiftCandidate[], yaw = self.yaw): string | null {
    let boss: RiftCandidate | undefined;
    for (const c of candidates) {
      c.dist = Math.hypot(c.x - self.x, c.z - self.z);
      if (c.boss && c.dist <= BOSS_RANGE && (!boss || c.dist < boss.dist!)) boss = c;
    }
    const id = this.pick(self, candidates, yaw);
    const target = id ? candidates.find(c => c.id === id) : undefined;
    riftBoss.current = target?.boss ? target : boss;
    return id;
  }

  private pick(self: { x: number; z: number; yaw: number }, candidates: readonly RiftCandidate[], yaw: number): string | null {
    // A boss seen for the first time is framed while its card plays - the
    // payoff of an entrance is seeing who came through - unless Tab holds another.
    const now = performance.now() / 1000;
    for (const c of candidates) {
      if (!c.boss || this.met.has(c.id)) continue;
      this.met.add(c.id);
      if (!this.hard && Math.hypot(c.x - self.x, c.z - self.z) <= BOSS_RANGE) { this.introId = c.id; this.introUntil = now + INTRODUCTION; }
    }
    if (this.introId) {
      if (now < this.introUntil && candidates.some(c => c.id === this.introId)) return this.id = this.introId;
      this.introId = null;
    }
    const current = candidates.find(c => c.id === this.id);
    if (this.hard) {
      // (An elite switched onto (`shift`) holds the lock as a boss does.)
      if (current?.boss || current?.elite) return this.id;
      this.hard = false;
    }
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    let best: RiftCandidate | undefined, bestScore = Infinity;
    for (const c of candidates) {
      const s = this.score(c, self, fx, fz);
      if (s < bestScore) { bestScore = s; best = c; }
    }
    if (current && best && current !== best && this.score(current, self, fx, fz) <= bestScore + HOLD) return this.id;
    this.id = best?.id ?? null;
    return this.id;
  }

  /** Locked on (Tab), a switch left or right across the screen (`dir` -1 left, +1
   *  right): onto the nearest lockable body that way - a boss, a champion or an
   *  elite - by bearing from the view. False when there is nothing that way.
   *  (Riftcamera's turn keys while a lock is held: the camera research, 1 October -
   *  "lock-on starts on the current target and switches by screen-space flick".) */
  shift(self: { x: number; z: number }, candidates: readonly RiftCandidate[], yaw: number, dir: -1 | 1) {
    if (!this.hard) return false;
    const bearing = (c: RiftCandidate) => { const b = Math.atan2(c.x - self.x, c.z - self.z); return Math.atan2(Math.sin(b - yaw), Math.cos(b - yaw)); };
    const current = candidates.find(c => c.id === this.id), from = current ? bearing(current) : 0;
    // (The view's yaw grows to the left: a body to the screen's right has a smaller bearing.)
    let best: RiftCandidate | undefined, gap = Infinity;
    for (const c of candidates) {
      if (c.id === this.id || !(c.boss || c.elite) || Math.hypot(c.x - self.x, c.z - self.z) > BOSS_RANGE) continue;
      const turn = (from - bearing(c)) * dir;
      if (turn > .02 && turn < gap) { gap = turn; best = c; }
    }
    if (!best) return false;
    this.introId = null; this.id = best.id;
    return true;
  }

  /** Tab: onto the boss nearest the middle of the screen, then across the
   *  others, then off. False when there is nothing to lock. */
  cycle(self: { x: number; z: number; yaw: number }, candidates: readonly RiftCandidate[], yaw = self.yaw) {
    const bearing = (c: RiftCandidate) => { const b = Math.atan2(c.x - self.x, c.z - self.z); return Math.atan2(Math.sin(b - yaw), Math.cos(b - yaw)); };
    const bosses = candidates.filter(c => c.boss && Math.hypot(c.x - self.x, c.z - self.z) <= BOSS_RANGE).sort((a, b) => bearing(a) - bearing(b));
    if (!bosses.length) { this.hard = false; return false; }
    this.introId = null;
    if (!this.hard) {
      this.hard = true;
      this.id = bosses.reduce((best, c) => Math.abs(bearing(c)) < Math.abs(bearing(best)) ? c : best).id;
      return true;
    }
    const next = bosses.findIndex(c => c.id === this.id) + 1;
    if (next >= bosses.length) { this.hard = false; return true; }
    this.id = bosses[next].id;
    return true;
  }
}
