import {BALL_ID, GOAL_STANCE, type BallSeat, type BallView} from './model';
import {DRILLS} from './drills';
import type {PlayerState, Vec3} from '../types';

/**
 * Goal Rush's two stances on the page (the rules are the room's: model.ts GOAL_STANCE,
 * BallMatch.stance). One seat's wish - the BALL stance, or the FIGHT stance on one opponent - turned into what its
 * command says (`aim`), switched by Tab (a couch seat's TARGET, the touch layer's button) and let go when the room
 * lets it go. Kept apart from the scene so the tests and the couch's second seat drive it the same way. Nothing here
 * allocates in a frame.
 *
 * - Tab in the BALL stance locks the best opponent: the one on the ball if they are anywhere near, else the nearest in
 *   front of the view (`pickFoe`); Tab in the FIGHT stance is the ball again. One button, one meaning, on a pad and on
 *   a phone alike.
 * - In the FIGHT stance a flick of the view (the mouse swept, the right stick or a drag thrown) moves the lock to the
 *   next opponent that way: the cycle is never in the way of going back to the ball.
 * - The lock lets go by itself when its opponent is wiped out (a TAKEDOWN: a beat later, so the hit is seen), leaves the
 *   pitch or gets out of reach, when play stops (a goal, a kickoff), or when the room did not take it.
 * - And when this seat's TACKLE (BallMatch TACKLE_WON) has just won the ball off its carrier (a beat
 *   later, WON_HOLD) - the ball pops loose this way, and it is the ball's stance's to play.
 */
export type Stance = 'ball' | 'fight';
/** Whether a match has the two stances: Goal Rush outside FREE PLAY (Sky Spike never fights), and FREE PLAY's drill with
 *  a carrier to take the ball off (drills.ts TACKLE) and LEARN TO PLAY's (lesson.ts: its FIGHT & TACKLE is that drill's). */
export const hasStances = (view: BallView | undefined): view is BallView => !!view && view.mode === 'goal-rush' && (!view.practice || !!(view.drill && DRILLS[view.drill.id]?.rival) || !!view.lesson);

/** A flick: the view swept this far (radians) inside FLICK_WINDOW seconds moves the lock; then FLICK_REST before another. */
const FLICK = .32, FLICK_WINDOW = .28, FLICK_REST = .35;
/** How long the room has to take a lock before the page lets its wish go (an online round trip and then some). */
const ROOM_GRACE = .9;
/** A TAKEDOWN's beat: the lock holds this long on the body going down before the ball is the stance again. */
const TAKEDOWN_HOLD = .55;
/** A TACKLE that won the ball - the lock holds this long on the blow, then the ball popping loose this
 *  seat's way is the stance: as it comes down at the tackler's feet (LOOSE: about half a second after the blow). Sooner,
 *  and the swing that won it played the ball as it went up with what was left of it (seen on the page: a light's last
 *  contact drove the ball 15 m up the pitch). */
export const WON_HOLD = .45;
/** pickFoe: an opponent within ON_BALL metres of the ball (and the nearest of their side to it) is the one on it, and
 *  counts this many metres nearer than they are; one off the view's line counts AWAY metres a radian further. */
const ON_BALL = 4, ON_BALL_PULL = 12, AWAY = 6;
const wrapped = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

function seatOf(view: BallView, id: string): BallSeat | undefined {
  for (let i = 0; i < view.seats.length; i++) if (view.seats[i].id === id) return view.seats[i];
  return undefined;
}
/** An opponent of `me` the FIGHT stance may lock: of the other side, in play, standing, within reach. */
export function lockable(view: BallView, me: PlayerState, q: PlayerState | undefined, seatTeam?: string): q is PlayerState {
  if (!q || q.id === me.id || !q.alive) return false;
  const mine = seatOf(view, me.id), theirs = seatOf(view, q.id);
  if (!mine || !theirs || theirs.team === (seatTeam ?? mine.team) || theirs.out !== undefined || theirs.disconnected) return false;
  return Math.hypot(q.x - me.x, q.z - me.z) <= GOAL_STANCE.reach;
}

/** The opponent a Tab locks: the one on the ball if they are anywhere near it, else the nearest in front of the view
 *  (`yaw`, the camera's heading); null with nobody to lock. `skip` leaves one out. */
export function pickFoe(view: BallView, me: PlayerState, players: readonly PlayerState[], yaw: number, ball: Vec3 | null, skip?: string | null): string | null {
  let best: string | null = null, bestScore = Infinity;
  // The one on the ball: the nearest of their side to it, within ON_BALL.
  let carrier: string | null = null, carrierD = ON_BALL;
  if (ball) for (const q of players) {
    if (!lockable(view, me, q)) continue;
    const d = Math.hypot(q.x - ball.x, q.z - ball.z);
    if (d < carrierD) { carrierD = d; carrier = q.id; }
  }
  for (const q of players) {
    if (q.id === skip || !lockable(view, me, q)) continue;
    const dx = q.x - me.x, dz = q.z - me.z, d = Math.hypot(dx, dz);
    const off = d > .5 ? Math.abs(wrapped(Math.atan2(dx, dz) - yaw)) : 0;
    const score = d + off * AWAY - (q.id === carrier ? ON_BALL_PULL : 0);
    if (score < bestScore) { bestScore = score; best = q.id; }
  }
  return best;
}
/** The next opponent round from the one locked, the way the view was flicked (`side` > 0: to the screen's left, the way
 *  the heading turns as it grows; < 0 to its right, as the mouse moved right), or null with nobody that way. */
export function nextFoe(view: BallView, me: PlayerState, players: readonly PlayerState[], from: string, side: number): string | null {
  const at = players.find(p => p.id === from);
  const base = at ? Math.atan2(at.x - me.x, at.z - me.z) : 0;
  let best: string | null = null, bestTurn = Infinity;
  for (const q of players) {
    if (q.id === from || !lockable(view, me, q)) continue;
    const turn = wrapped(Math.atan2(q.x - me.x, q.z - me.z) - base) * Math.sign(side);
    if (turn > .05 && turn < bestTurn) { bestTurn = turn; best = q.id; }
  }
  return best;
}

export class StanceControl {
  /** The FIGHT stance's opponent; null: the BALL stance. */
  lock: string | null = null;
  /** Seconds since the stance last changed (the camera's blend, the HUD's flash). */
  since = 0;
  /** What last changed it, for the page to say: a Tab, a flick to another opponent, or the lock let go by itself. */
  lastChange: 'press' | 'flick' | 'takedown' | 'won' | 'lost' | 'stop' | '' = '';
  private presses = 0;
  private flickSum = 0;
  private flickAge = 0;
  private flickRest = 0;
  private unconfirmed = 0;
  private downFor = 0;
  /** The newest event of the room's read, and how long since this seat's TACKLE won the ball (-1: none pending). */
  private eventSeen = 0;
  private wonFor = -1;

  get stance(): Stance { return this.lock ? 'fight' : 'ball'; }
  /** A new match: the BALL stance. (A couch seat's press count is kept: its next count says whether it is new.) */
  reset() { this.lock = null; this.since = 0; this.lastChange = ''; this.flickSum = this.flickAge = this.flickRest = 0; this.unconfirmed = 0; this.downFor = 0; this.eventSeen = 0; this.wonFor = -1; }

  /** Tab: the BALL stance locks the best opponent (pickFoe), the FIGHT stance is the ball again. Whether it changed. */
  toggle(view: BallView | undefined, me: PlayerState | undefined, players: readonly PlayerState[], yaw: number, ball: Vec3 | null): boolean {
    if (this.lock) { this.set(null, 'press'); return true; }
    if (!hasStances(view) || !me || view.phase !== 'live') return false;
    const foe = pickFoe(view, me, players, yaw, ball);
    if (!foe) return false;
    this.set(foe, 'press');
    return true;
  }
  /** A couch seat's TARGET presses, as a running count: each new press toggles. */
  pressed(count: number, view: BallView | undefined, me: PlayerState | undefined, players: readonly PlayerState[], yaw: number, ball: Vec3 | null) {
    if (count < this.presses) { this.presses = count; return false; }
    let changed = false;
    while (this.presses < count) { this.presses++; changed = this.toggle(view, me, players, yaw, ball) || changed; }
    return changed;
  }

  /** Every frame: `turn` is the player's own turning of the view this frame (radians; the mouse, the right stick, a
   *  drag), for the flick. Lets the lock go when it should (see the class). */
  update(dt: number, view: BallView | undefined, me: PlayerState | undefined, players: readonly PlayerState[], turn: number) {
    this.since += dt;
    // (This seat's TACKLE won the ball off the one locked - WON_HOLD, then the ball.)
    if (view) for (const e of view.events) if (e.id > this.eventSeen) { this.eventSeen = e.id; if (e.kind === 'tackle' && e.won && me && e.actorId === me.id && e.targetId === this.lock) this.wonFor = 0; }
    if (!this.lock) { this.flickSum = 0; this.unconfirmed = 0; this.downFor = 0; this.wonFor = -1; return; }
    if (this.wonFor >= 0 && (this.wonFor += dt) >= WON_HOLD) { this.set(null, 'won'); return; }
    if (!hasStances(view) || !me || view.phase !== 'live' || !me.alive || seatOf(view, me.id)?.out !== undefined) { this.set(null, 'stop'); return; }
    const seat = seatOf(view, this.lock), q = players.find(p => p.id === this.lock);
    // Wiped out: a TAKEDOWN - held a beat on the body going down, then the ball.
    if (seat?.out !== undefined) { this.downFor += dt; if (this.downFor >= TAKEDOWN_HOLD) this.set(null, 'takedown'); return; }
    this.downFor = 0;
    if (!lockable(view, me, q)) { this.set(null, 'lost'); return; }
    // The room's word: a lock it has not taken (out of its reach, a stance it does not allow) is let go.
    if (seatOf(view, me.id)?.lock === this.lock) this.unconfirmed = 0;
    else if ((this.unconfirmed += dt) > ROOM_GRACE) { this.set(null, 'lost'); return; }
    // The flick: the view swept one way, quickly.
    this.flickRest = Math.max(0, this.flickRest - dt);
    if (Math.abs(turn) > 1e-5 && Math.sign(turn) === Math.sign(this.flickSum || turn)) { this.flickSum += turn; this.flickAge += dt; }
    else { this.flickSum = turn; this.flickAge = 0; }
    if (this.flickAge > FLICK_WINDOW) { this.flickSum = turn; this.flickAge = 0; }
    if (this.flickRest <= 0 && Math.abs(this.flickSum) >= FLICK) {
      const next = nextFoe(view, me, players, this.lock, this.flickSum);
      this.flickSum = 0; this.flickAge = 0; this.flickRest = FLICK_REST;
      if (next) this.set(next, 'flick');
    }
  }

  /** A seat the room's bot plays (`?ballpilot` on this machine, for the captures): the page shows the bot's stance. */
  mirror(view: BallView | undefined, id: string) {
    const lock = view ? seatOf(view, id)?.lock ?? null : null;
    if (lock !== this.lock) this.set(lock, 'press');
  }
  /** What this seat's command says: the opponent with the lock on, or the ball. */
  targetId() { return this.lock ?? BALL_ID; }

  private set(lock: string | null, why: StanceControl['lastChange']) {
    if (lock === this.lock) return;
    this.lock = lock; this.since = 0; this.lastChange = why; this.unconfirmed = 0; this.downFor = 0; this.flickSum = 0; this.flickAge = 0; this.wonFor = -1;
  }
}
