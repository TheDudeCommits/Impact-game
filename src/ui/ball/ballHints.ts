import { SPIKE_RULES, type BallEvent, type BallModeId, type BallSeat, type BallState, type BallTeam, type BallView } from '../../game/ball/model';
import { goalZ, landing, sideOf } from '../../game/ball/physics';
import { hasStances } from '../../game/ball/stance';
import type { PlayerState } from '../../game/types';
import type { PadFamily } from '../../input/gamepad';
import { prompt, promptKey, type PromptDevice, type PromptOptions } from '../prompts';
import { ballHintsShown, coachOn, markBallHint } from '../modes/prefs';

/**
 * The ball modes' first-time hints. The how-to-play says what the skills are; these say it once, in the HUD's prompt
 * lane (BallHud's), at the moment the skill
 * is the play: an opponent on the ball near you is when Tab's FIGHT stance and its TACKLE matter, a set floating up to
 * you is when the spike's timing does. Each is shown once per device (prefs.ts rift-ball-hints), for a few seconds or
 * until it is done, never two at once, never over the coach's tip, at most a few a match with a long breath between, and
 * not at all once Settings → Coach tips is off. Keys are the device's own (prompts.ts): a keyboard's binding, the pad's
 * glyph, the touch set's button (PASS, SHOOT, BOOST, FIGHT ...).
 *
 *  - Goal Rush: TO TACKLE (Tab's FIGHT, an opponent on the ball near you), KNOCK THEM DOWN (in the FIGHT stance a moment,
 *    and the way back to the ball), BOOST (a long run to the ball on a full bar), JUMP TWICE (a high ball dropping near
 *    you), SAVE (a shot at your goal with you on the line; not on touch, whose set has no guard).
 *  - Sky Spike: AS IT PEAKS · AT THE TOP (a team-mate's set coming down to you: the PERFECT SPIKE's timing), DIVE (their
 *    set with you in the back court: a dash into a hard ball reaches it - the DIVING DIG), BLOCK (their set with you at the
 *    net).
 *  - Both: SCUFFED (your own strike just came out of a flurry of presses and was mis-hit: BallMatch MASHED) -
 *    one press, on time.
 *  - Goal Rush: TAP TO SHOOT · HOLD TO CHARGE (the ball at your feet with the goal ahead and nobody on
 *    you: the moment SHOOT's two ways matter - model.ts SHOOT).
 */
export type BallHintId = 'gr-tackle' | 'gr-knock' | 'gr-boost' | 'gr-aerial' | 'gr-save' | 'gr-scuff' | 'gr-shoot' | 'ss-spike' | 'ss-dig' | 'ss-block' | 'ss-scuff';
/** How long a hint stays up (ms) unless it is done sooner; the breath after one before another may come; the most a
 *  match shows; the quiet start of a match (the coach's own opening line). */
export const HINT_MS = 4500, HINT_GAP_MS = 12000, HINTS_A_MATCH = 3, HINT_QUIET_S = 6;

/** What a hint reads off the frame. */
export interface HintFrame {
  view: BallView; self: PlayerState; players: readonly PlayerState[];
  /** Goal Rush's FIGHT stance, the page's own (hudView.ballLock). */
  fight: boolean;
  device: PromptDevice; family: PadFamily;
  /** The room's clock (the snapshot's server time). */
  serverTime: number;
}
interface Ctx extends HintFrame {
  seat: BallSeat; team: BallTeam; ball: BallState; me: PlayerState; at: (id: string) => PlayerState | undefined;
  /** Seconds in the FIGHT stance so far (0 out of it). */
  since: number;
  /** Whether the page's own fighter has made a moment of this kind since the hint went up. */
  mine: (kind: BallEvent['kind']) => boolean;
  /** The page's own fighter scuffed the ball a moment ago (a strike out of a flurry of presses: BallMatch MASHED). */
  scuffed?: boolean;
}
interface Hint {
  id: BallHintId; mode: BallModeId;
  /** False: not on a touch screen (the touch set has no button for it). */
  touch?: false;
  fire(c: Ctx): boolean;
  done?(c: Ctx): boolean;
  draw(c: Ctx): string;
}

const flat = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
/** The device's keys: the touch set's own buttons in this mode and stance (input/sportTouch.ts). */
const keys = (c: Ctx, more: Omit<PromptOptions, 'device' | 'family' | 'sport'> = {}): PromptOptions => ({ device: c.device, family: c.family, sport: { mode: c.view.mode, fight: c.fight }, ...more });
const key = (c: Ctx, action: Parameters<typeof promptKey>[0]) => promptKey(action, keys(c));
/** The opponent on the ball: the nearest of the other side to it, within a few metres of it and with it near the floor. */
function carrier(c: Ctx): PlayerState | undefined {
  if (c.ball.y > 2.6) return undefined;
  let best: PlayerState | undefined, d = 3.2;
  for (const s of c.view.seats) {
    if (s.team === c.team || s.out !== undefined) continue;
    const q = c.at(s.id); if (!q?.alive) continue;
    const e = flat(q, c.ball); if (e < d) { d = e; best = q; }
  }
  return best;
}
/** Whether `me` is the nearest of their side to a spot. */
function nearestTo(c: Ctx, spot: { x: number; z: number }) {
  const mine = flat(c.me, spot);
  for (const s of c.view.seats) { if (s.team !== c.team || s.id === c.me.id || s.out !== undefined) continue; const q = c.at(s.id); if (q && flat(q, spot) < mine) return false; }
  return true;
}

/** Your strike came out SCUFFED - the presses that made it were a flurry. Said once, the moment it happens. */
const scuffed = () => '<span class="ux-prompt"><b>SCUFFED</b><small>MASHING MIS-HITS THE BALL · ONE PRESS, ON TIME</small></span>';

export const HINTS: readonly Hint[] = [
  // ─── Goal Rush ───
  { id: 'gr-scuff', mode: 'goal-rush', fire: c => !!c.scuffed && !c.fight, draw: scuffed },
  // (SHOOT's two ways, said once with the ball at your feet, the other side's goal ahead and room to wind up.)
  { id: 'gr-shoot', mode: 'goal-rush',
    fire: c => {
      const b = c.ball, gz = goalZ(c.team === 'red' ? 'blue' : 'red');
      if (c.fight || !c.me.grounded || b.y > 1.6 || Math.hypot(b.vx, b.vz) > 6 || flat(c.me, b) > 3.2 || Math.abs(gz - b.z) > 22) return false;
      return !c.view.seats.some(s => { const q = s.team !== c.team && s.out === undefined ? c.at(s.id) : undefined; return !!q?.alive && flat(q, c.me) < 6; });
    },
    done: c => c.mine('strike'),
    draw: c => prompt('heavy', 'TAP TO SHOOT', keys(c, { detail: 'HOLD TO CHARGE' })) },
  { id: 'gr-tackle', mode: 'goal-rush',
    fire: c => { if (c.fight || !hasStances(c.view)) return false; const q = carrier(c); return !!q && flat(q, c.me) > 2.2 && flat(q, c.me) < 10; },
    done: c => c.fight,
    draw: c => prompt('target', c.device === 'touch' ? 'TO TACKLE' : 'FIGHT TO TACKLE', keys(c, { detail: 'KNOCK THE ONE ON THE BALL DOWN' })) },
  { id: 'gr-knock', mode: 'goal-rush',
    fire: c => c.fight && c.since >= 1,
    done: c => !c.fight || c.mine('tackle'),
    draw: c => `<span class="ux-prompt"><b>KNOCK THEM DOWN</b><small>A TACKLE WINS THE BALL · THEN</small>${key(c, 'target')}<b>BALL</b></span>` },
  { id: 'gr-boost', mode: 'goal-rush',
    fire: c => !c.fight && !c.me.boost && c.me.grounded && (c.me.stamina ?? 0) >= .8 * (c.me.maxStamina ?? 100) && flat(c.me, c.ball) > 14,
    done: c => !!c.me.boost,
    draw: c => c.device === 'touch' ? prompt('dash', 'AND PUSH THE STICK', keys(c, { hold: true, detail: 'LIFT TO STOP' }))
      : prompt('dash', 'BOOST', keys(c, { detail: 'ON THE RUN · THE GOLD BAR' })) },
  { id: 'gr-aerial', mode: 'goal-rush',
    fire: c => !c.fight && c.me.grounded && c.ball.y > 3.4 && c.ball.vy < 4 && flat(c.me, c.ball) < 6,
    done: c => !c.me.grounded,
    draw: c => prompt('jump', c.device === 'touch' ? 'TWICE' : 'JUMP TWICE', keys(c, { detail: 'AND STRIKE IT IN THE AIR' })) },
  { id: 'gr-save', mode: 'goal-rush', touch: false,
    fire: c => {
      const gz = goalZ(c.team), b = c.ball;
      return !c.fight && b.lastTeam !== c.team && Math.abs(b.z - gz) < 14 && Math.sign(b.vz) === Math.sign(gz) && Math.hypot(b.vx, b.vz) > 11
        && Math.abs(c.me.z - gz) < 6 && nearestTo(c, { x: 0, z: gz });
    },
    done: c => c.mine('save') || c.mine('perfect'),
    draw: c => prompt('guard', 'SAVE', keys(c, { detail: 'ON TIME, IT KILLS THE HEAT' })) },
  // ─── Sky Spike ───
  { id: 'ss-scuff', mode: 'sky-spike', fire: c => !!c.scuffed, draw: scuffed },
  { id: 'ss-spike', mode: 'sky-spike',
    fire: c => {
      const b = c.ball;
      if (b.shot !== 'set' || b.lastTeam !== c.team || b.lastId === c.me.id || b.vy < 0) return false;
      return nearestTo(c, landing('sky-spike', b, 4));
    },
    // (Gone once anyone has played the set: the moment has passed.)
    done: c => c.mine('strike') || c.ball.shot !== 'set',
    draw: c => `<span class="ux-prompt">${key(c, 'jump')}<b>AS IT PEAKS</b>${key(c, 'heavy')}<b>AT THE TOP</b><small>FROM A STEP BACK</small></span>` },
  { id: 'ss-block', mode: 'sky-spike',
    fire: c => c.ball.shot === 'set' && c.ball.lastTeam !== c.team && sideOf(c.me.z) === c.team && Math.abs(c.me.z) < 3.2,
    done: c => c.mine('block') || c.mine('perfect') || c.ball.shot !== 'set' && c.ball.lastTeam === c.team,
    draw: c => `<span class="ux-prompt">${key(c, 'jump')}<b>+</b>${key(c, 'guard')}<b>BLOCK</b><small>IN THE AIR AT THE NET</small></span>` },
  { id: 'ss-dig', mode: 'sky-spike',
    fire: c => c.ball.shot === 'set' && c.ball.lastTeam !== c.team && sideOf(c.me.z) === c.team && Math.abs(c.me.z) > 4.5 && Math.abs(c.me.z) < SPIKE_RULES.courtHalfZ + 2,
    done: c => c.mine('dig') || c.ball.lastTeam === c.team,
    draw: c => prompt('dash', 'DIVE', keys(c, { detail: 'AT A HARD BALL TO DIG IT UP' })) },
];

/** One page's hints through a match. `frame` hands back the markup to show in the prompt lane now, or '' for none; `busy`
 *  says the coach's tip is up (its turn). `shown`, `mark` and `on` are the device's memory (prefs.ts), the tests' own. */
export class BallHints {
  private showing?: { hint: Hint; until: number; since: number };
  private lastAt = -Infinity;
  private count = 0;
  private match = '';
  private fightSince = -1;
  /** This page's own fighter's recent ball moments (kind, server time), for the hints' "done". */
  private readonly moments: { kind: BallEvent['kind']; at: number }[] = [];
  constructor(private readonly busy: () => boolean = () => false, private readonly shown = ballHintsShown, private readonly mark = markBallHint, private readonly on = coachOn) {}

  /** A ball moment: the ones the page's own fighter made count toward a hint's "done". */
  event(e: BallEvent, selfId: string) {
    if (e.actorId !== selfId) return;
    this.moments.push({ kind: e.kind, at: e.at }); if (this.moments.length > 12) this.moments.shift();
    if (e.kind === 'strike' && e.text === 'SCUFFED') this.scuffAt = e.at;
  }
  /** When the page's own fighter last scuffed the ball (server time). */
  private scuffAt = -Infinity;

  /** Every frame (`now`: the page's clock, ms): the hint to show in the prompt lane, or ''. */
  frame(f: HintFrame, now: number): string {
    const v = f.view, seat = v.seats.find(s => s.id === f.self.id);
    const match = `${v.mode}:${v.startedAt}`;
    if (match !== this.match) { this.match = match; this.count = 0; this.lastAt = -Infinity; this.showing = undefined; this.moments.length = 0; this.scuffAt = -Infinity; }
    if (f.fight) { if (this.fightSince < 0) this.fightSince = now; } else this.fightSince = -1;
    if (!seat || v.practice || v.phase !== 'live' || v.replay || seat.out !== undefined || !f.self.alive) { this.showing = undefined; return ''; }
    const since = this.showing?.since ?? f.serverTime;
    const c: Ctx = { ...f, seat, team: seat.team, ball: v.ball, me: f.self, at: id => f.players.find(p => p.id === id),
      since: this.fightSince < 0 ? 0 : (now - this.fightSince) / 1000, mine: kind => this.moments.some(m => m.kind === kind && m.at >= since),
      scuffed: f.serverTime - this.scuffAt < 1.5 };
    if (this.showing) {
      const { hint, until } = this.showing;
      if (now < until && !hint.done?.(c)) return hint.draw(c);
      this.showing = undefined; this.lastAt = now;
    }
    if (this.count >= HINTS_A_MATCH || now - this.lastAt < HINT_GAP_MS || f.serverTime - v.startedAt < HINT_QUIET_S || !this.on()) return '';
    const shown = this.shown();
    const hint = HINTS.find(h => h.mode === v.mode && !shown.includes(h.id) && (h.touch !== false || f.device !== 'touch') && h.fire(c));
    if (!hint || this.busy()) return '';
    this.mark(hint.id); this.count++;
    this.showing = { hint, until: now + HINT_MS, since: f.serverTime };
    return hint.draw(c);
  }
  clear() { this.showing = undefined; this.match = ''; this.moments.length = 0; this.fightSince = -1; }
}
