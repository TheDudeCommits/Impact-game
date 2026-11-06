import { MOVES } from './moves';
import type { ThreatSource } from '../render/ThreatOutline';
import type { AttackSlot, CombatEvent, PlayerState } from './types';

const ATTACKS = new Set(['light', 'heavy', 'special', 'ultimate']);
const LOCK_RANGE = 60;
/** Round 3c (LOCK): a run of Tab presses is over this long after its last
 *  press; the next press starts a new run from the fighter the lock is on. */
const RUN_GAP = 2.5;
/** How much nearer a new opponent has to be before the soft lock leaves the
 *  one it is on. A small margin let two fighters at a similar distance swap the
 *  camera back and forth between them. */
const STICKINESS = 1.6;
/** How far off an attacker may be and still take the camera from a fighter
 *  the player is already engaged with: inside melee range regardless, or not
 *  much further off than the current opponent. */
const THREAT_NEAR = 6, THREAT_RATIO = 1.6;

/** Local camera and intent selection. Damage and attack validation stay
 *  authoritative; this only decides who the player means.
 *
 *  Two modes, which the old version conflated. **Soft** is the default: the
 *  camera is the player's, and this only nominates whoever they are most
 *  likely to mean so the HUD and the auto-aim have an answer. **Hard** is Tab:
 *  the camera is pinned to one fighter until the player says otherwise.
 */
export class Targeting {
  id: string | null = null;
  /** True while Tab is holding the camera on someone. */
  locked = false;
  private lastEvent = 0;
  private threat?: { id: string; until: number };
  reset() { this.id = null; this.locked = false; this.lastEvent = 0; this.threat = undefined; this.run = undefined; }

  private choices(players: PlayerState[], self: PlayerState) {
    // Never a teammate: in co-op survival the party shares a side. A royale's
    // fighters have none, so every other one stays a candidate there.
    return players.filter(p => p.id !== self.id && p.alive && (self.team === undefined || p.team !== self.team) && this.distance(p, self) <= LOCK_RANGE)
      .sort((a, b) => this.distance(a, self) - this.distance(b, self) || a.id.localeCompare(b.id));
  }
  private distance(a: PlayerState, b: PlayerState) { return Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z); }
  /** Signed angle from `yaw` to the bearing of `p`, in radians. */
  private offAxis(p: PlayerState, self: PlayerState, yaw: number) {
    const bearing = Math.atan2(p.x - self.x, p.z - self.z);
    return Math.atan2(Math.sin(bearing - yaw), Math.cos(bearing - yaw));
  }

  /** Round 3c (LOCK): one run of Tab presses. `members` is everybody it may
   *  visit (whoever has been in view at one of its presses, and the lock it
   *  began on), `visited` whom it has locked, `origin` the lock it began on
   *  (if any) and `last` when it was last pressed. */
  private run?: { members: Set<string>; visited: Set<string>; origin: string | null; last: number };

  /** Round 4b (TARGETING), the blind critic: Tab could not lock a lone enemy
   *  more than about 115 degrees off the view, nor one 45 m away, and "the 3rd
   *  Tab press releases instead of switching". So every live opponent within
   *  LOCK_RANGE is a candidate, whichever way it is (the dynamic camera turns
   *  to it the short way); the presses go centre first and outward, and once
   *  everyone has been visited they go round again instead of letting go.
   *  The lock is released deliberately: holding Tab (main.ts, viewKeys
   *  lockHeld), or Tab on the only opponent there is - with nobody else to go
   *  to, the press can only mean "off" - or by the fighter in it falling.
   *
   *  Round 3c: Tab. Onto whoever is nearest the middle of the view, then each press
   *  onto the nearest the middle it has not been on yet - centre first, then
   *  outward, both sides - and once everyone has had a turn, off again: there
   *  is always a way out of a lock without waiting for the fighter in it to
   *  die. Round 3b: the presses used to step through the fighters in their
   *  left-to-right order from the first pick, so anybody left of it could
   *  never be reached - and as the lock-on camera turns to each new lock the
   *  order across the screen changes under the list anyway, which is why this
   *  remembers who it has visited rather than a position.
   *
   *  Round 3c: every candidate, then release - and a release never in the
   *  middle of that. The second critic got a release on the first press of a
   *  run, and a fighter it could not reach at all. Who had been visited lived
   *  as long as the lock did, so a lock picked up long before (and everybody
   *  passed on the way to it) made the next press a release; and whoever was
   *  a candidate was decided afresh on every press, off a view the lock-on
   *  camera had just turned to the new lock - a fighter off to one side of
   *  the view at the first press was behind it at the second, and was never
   *  offered. A run now keeps its candidates: everybody in view at any of its
   *  presses, and the lock it began on, which it comes back to last - from a
   *  lock on A over B and C the presses go B, C, A, release. It begins with a
   *  press from no lock, or a press RUN_GAP after the one before. */
  cycle(players: PlayerState[], self: PlayerState, yaw = self.yaw, now = performance.now() / 1000) {
    // Onto whoever is nearest the middle of the screen, not whoever happens
    // to be nearest in metres: the player is looking at one of them.
    const off = (p: PlayerState) => Math.abs(this.offAxis(p, self, yaw));
    const near = this.choices(players, self);
    const lock = this.locked ? this.id : null;
    // The only opponent there is, already locked: the press can only mean off.
    if (lock && near.length === 1 && near[0].id === lock) { this.locked = false; this.run = undefined; return this.id; }
    let run = this.run;
    if (!lock || !run || !run.members.has(lock)) {
      run = this.run = { members: new Set(), visited: new Set(), origin: lock, last: now };
      if (lock) run.members.add(lock);
    }
    // A press after a pause orders the rest from the lock it is on now, but
    // who has been visited is kept while the lock is: slow presses still go
    // round everybody instead of between the two nearest the middle.
    else if (now - run.last > RUN_GAP) run.origin = lock;
    // Everybody in reach is in the run, whichever way they are.
    for (const p of near) run.members.add(p.id);
    run.last = now;
    const live = new Set(near.map(p => p.id));
    for (const id of run.members) if (!live.has(id)) { run.members.delete(id); run.visited.delete(id); }
    const members = run.members, visited = run.visited, origin = run.origin;
    const pick = () => near.filter(p => members.has(p.id) && !visited.has(p.id) && p.id !== lock)
      .sort((a, b) => Number(a.id === origin) - Number(b.id === origin) || off(a) - off(b) || a.id.localeCompare(b.id))[0];
    let next = pick();
    // Everyone visited: round again (never a release in the middle of Tabbing).
    if (!next && lock) { visited.clear(); next = pick(); }
    if (!next) { if (!lock) this.locked = false; return this.id; }
    this.locked = true;
    visited.add(next.id);
    this.id = next.id;
    return this.id;
  }

  /** Release a hard lock without choosing anybody else. */
  release() { this.locked = false; }
  /** A hard lock on `id`, as Tab would make it (a Duel's and Training's default: game/autoLock.ts). */
  lockOn(id: string) { this.id = id; this.locked = true; this.run = undefined; }

  update(players: PlayerState[], self: PlayerState, events: CombatEvent[], now: number, yaw = self.yaw) {
    const choices = this.choices(players, self);
    const current = choices.find(p => p.id === this.id);
    for (const e of events) {
      if (e.id <= this.lastEvent) continue;
      this.lastEvent = e.id;
      if (e.targetId !== self.id || !['hit', 'blocked', 'guard-break'].includes(e.kind)) continue;
      const attacker = choices.find(p => p.id === e.actorId);
      if (!attacker) continue;
      const engaged = current && current.id !== attacker.id
        && this.distance(attacker, self) > Math.max(THREAT_NEAR, this.distance(current, self) * THREAT_RATIO);
      if (engaged) continue;
      // A repeat hit from the attacker already recorded extends nothing: the
      // window belongs to the first blow, or a poke a second keeps the camera
      // forever.
      if (this.threat?.id === attacker.id && this.threat.until > e.serverTime) continue;
      this.threat = { id: attacker.id, until: e.serverTime + 3 };
    }
    // A hard lock survives everything except the fighter in it leaving.
    if (this.locked) {
      if (current) return this.id;
      this.locked = false;
    }
    const recent = this.threat && this.threat.until > now ? choices.find(p => p.id === this.threat!.id) : undefined;
    // Keep a committed string on the fighter it began against. New threats
    // can become the next engagement after recovery, without steering the
    // camera and the next buffered hit away halfway through this one.
    const committed=ATTACKS.has(self.action)&&choices.find(p=>p.id===self.target);
    if(committed){this.id=committed.id;return this.id;}
    const attacking = choices.find(p => p.target === self.id && ATTACKS.has(p.action)
      && this.distance(p, self) < ((p as PlayerState & ThreatSource).viewMove?.range ?? MOVES[p.fighter][p.action as AttackSlot].range) + 3
      && (!current||this.distance(p,self)<=Math.max(THREAT_NEAR,this.distance(current,self)*THREAT_RATIO)));
    // Somebody shooting you in the back is worth knowing about, but it is not
    // worth spinning the camera round for on its own.
    const priority = [recent, attacking].find(p => p && Math.abs(this.offAxis(p, self, yaw)) < 1.9);
    if (priority) { this.id = priority.id; return this.id; }
    // Selection follows the view as well as proximity. A fighter one metre
    // nearer behind the player must not quietly become the camera's subject.
    const score=(p:PlayerState)=>this.distance(p,self)+Math.max(0,Math.abs(this.offAxis(p,self,yaw))-.65)*4;
    const nearest = choices.reduce<PlayerState|undefined>((best,p)=>!best||score(p)<score(best)?p:best,undefined);
    this.id = current && nearest && score(current) <= score(nearest) + STICKINESS
      ? current.id : nearest?.id ?? null;
    return this.id;
  }
}
