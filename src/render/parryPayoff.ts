import { PARRY_FREEZE } from '../game/moves';
import type { CombatEvent } from '../game/types';

/** A parry's payoff: a parry already teleports you behind the attacker; this adds a 0.1 s slowdown, a distinct sound and
 *  a rumble pulse, with no camera move. Presentation only: the simulation, the room and the page's prediction never hear
 *  of it, so it cannot delay or eat an input.
 *
 *  The slowdown is of the drawn fight - the bodies and the effects, which main.ts draws from this clock - and of nothing
 *  else: the HUD reads the newest state and the input is read and sent on the frame's own time. As the parry's freeze
 *  lets go (PARRY_FREEZE after the parry, as drawn: the moment the parried body starts to reel and the parrier stands
 *  behind it) the drawn clock eases down to `rate` of real time for `slow` seconds, then runs at `pace` until it is back
 *  where it would have been - every body on the simulation's own positions again - its every edge eased over `ease`.
 *  Here: 0.1 s at 0.3, 52 ms behind at the most, caught up 0.13 s later at 1.5 (eight frames at sixty); 0.23 s in all,
 *  over before the quickest punish can land (the parry's 0.22 s freeze, then a light's 0.13 s blow). The camera moves as
 *  it always does, with the body it follows, and is asked for nothing (the camera's rule: it never re-aims by itself).
 *
 *  Only a parry the player is in - theirs, or their own blow parried (either seat's, on a couch) - slows the fight: a
 *  royale's bots parrying each other across the arena do not. `?ab=parrypay` turns it off, with its sting and its pulse. */
export const PARRY_PAY = { slow: .1, rate: .3, pace: 1.5, ease: .025 } as const;

/** The warp's shape, as the drawn clock's rate against real time over `t` seconds from its start: 1 eased down to `rate`,
 *  held, eased back up through 1 to `pace`, held for `hold`, eased back to 1. */
function rateAt(t: number, hold: number): number {
  const { slow, rate, pace, ease } = PARRY_PAY;
  const lerp = (a: number, b: number, u: number) => a + (b - a) * Math.min(1, Math.max(0, u));
  if (t < 0) return 1;
  if (t < ease) return lerp(1, rate, t / ease);
  if (t < slow - ease) return rate;
  if (t < slow) return lerp(rate, 1, (t - slow + ease) / ease);
  const c = t - slow;
  if (c < ease) return lerp(1, pace, c / ease);
  if (c < ease + hold) return pace;
  if (c < 2 * ease + hold) return lerp(pace, 1, (c - ease - hold) / ease);
  return 1;
}
/** How long the catch-up holds `pace` so the lag the slowdown built is given back whole: the slowdown builds
 *  (1 - rate) x (slow - ease) seconds of lag (its eased edges count half), the catch-up gives back (pace - 1) x (hold + ease). */
export const PARRY_HOLD = (1 - PARRY_PAY.rate) * (PARRY_PAY.slow - PARRY_PAY.ease) / (PARRY_PAY.pace - 1) - PARRY_PAY.ease;
/** The whole warp, seconds of real time. */
export const PARRY_SPAN = PARRY_PAY.slow + 2 * PARRY_PAY.ease + PARRY_HOLD;
/** The lag (drawn seconds behind) `t` real seconds into the warp: the integral of 1 - rate, exact on its linear pieces. */
export function parryLagAt(t: number): number {
  if (t <= 0) return 0;
  if (t >= PARRY_SPAN) return 0;
  // Simpson over 1/240 s steps: every piece is linear, so this is exact to rounding.
  const n = Math.max(2, Math.ceil(t * 240) * 2), h = t / n;
  let sum = (1 - rateAt(0, PARRY_HOLD)) + (1 - rateAt(t, PARRY_HOLD));
  for (let i = 1; i < n; i++) sum += (i % 2 ? 4 : 2) * (1 - rateAt(i * h, PARRY_HOLD));
  return Math.max(0, sum * h / 3);
}

/** Whether `event` is a parry the page's own player is in: theirs (the target of the 'just-guard'), or their blow parried. */
export const parryOf = (event: CombatEvent, mine: (id: string) => boolean) => event.kind === 'just-guard' && (mine(event.targetId ?? '') || mine(event.actorId));

export class ParryPayoff {
  /** When the warp began (page ms), and the drawn time it is waiting for to begin (the parry's freeze over), if any. */
  private began = -Infinity;
  private due: number | null = null;
  /** `?ab=parrypay`: off, it never begins. */
  constructor(private readonly on: () => boolean = () => true) {}
  /** A frame's drawn events: a parry the player is in is due to pay off as its freeze lets go (its server time and
   *  PARRY_FREEZE, as drawn). Answers the parries it took. */
  observe(events: readonly CombatEvent[], mine: (id: string) => boolean): CombatEvent[] {
    if (!this.on()) return [];
    const taken = events.filter(e => parryOf(e, mine));
    for (const e of taken) this.due = e.serverTime + PARRY_FREEZE;
    return taken;
  }
  /** Once a frame, before it is drawn: the lag to draw the fight behind (seconds) and the drawn clock's rate against real
   *  time now (for what steps by the frame's time: the bodies' springs, the effects). `drawn`: the time the last frame was
   *  drawn at (CombatTimeline.drawnAt), which says when the freeze has let go. */
  frame(nowMs: number, drawn: number | null): { lag: number; rate: number } {
    if (this.due !== null && drawn !== null && drawn >= this.due) {
      this.due = null;
      // A parry inside another's warp starts it again only once that one is over: the clock never jumps.
      if ((nowMs - this.began) / 1000 >= PARRY_SPAN) this.began = nowMs;
    }
    const t = (nowMs - this.began) / 1000;
    if (!(t >= 0 && t < PARRY_SPAN)) return { lag: 0, rate: 1 };
    return { lag: parryLagAt(t), rate: rateAt(t, PARRY_HOLD) };
  }
  /** Leaving a match, or a timeline reset: nothing owed. */
  reset() { this.began = -Infinity; this.due = null; }
}
