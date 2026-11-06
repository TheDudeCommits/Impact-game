import { catchUp, INPUT_HZ } from './catchUp';

/** The standing depth the server's input queue is steered to, on the scale of
 *  InputQueue.low. It is the queue's own warm buffer (BUFFER_TICKS, pinned
 *  equal by tests/inputDrain.test.ts): what the queue rebuilds after a packet
 *  gap starves it is never drained away again. */
export const QUEUE_TARGET = 3;
/** A drain starts only once the low-water mark stands this far above target,
 *  and then runs until it is back at target: the hysteresis that keeps one
 *  jittery tick from switching it on and off. */
export const DRAIN_ENGAGE = 2;
/** Dilation one command over target asks for - one command withheld in every
 *  twenty, which nobody sees. */
export const DRAIN_GENTLE = .05;
/** Extra dilation per further command over. */
export const DRAIN_STEP = .025;
/** The most the clock ever slows: one command in five, from seven over. */
export const DRAIN_MAX = .2;
/** How fast the rate may change, per real second, so the drawn speed eases
 *  into and out of a drain instead of stepping. */
export const RATE_SLEW = .5;
/** A drain needs fresh evidence: this long without a report - a stalled
 *  downlink - and the clock eases back to real time rather than withholding
 *  on what the queue looked like before the stall. */
export const REPORT_STALE = .5;

/** How much slower than real time to run for a reported low-water mark.
 *  Pure, for the tests. */
export function drainFor(low: number, draining: boolean) {
  const over = low - QUEUE_TARGET;
  if (!(over >= (draining ? 1 : DRAIN_ENGAGE))) return 0;
  return Math.min(DRAIN_MAX, DRAIN_GENTLE + DRAIN_STEP * (over - 1));
}

/** The browser's input clock: how many commands are due now, and how far the
 *  drawn body is through the tick it is heading into.
 *
 *  Commands leave in whole ticks of real time (`catchUp`) and the server
 *  consumes one per step, which keeps the server's queue exactly as deep as it
 *  happens to be. That was the problem: an upload stall starves the queue and
 *  then lands as a burst, and from then on every command waits behind the
 *  burst - nothing ever drained it. Measured with scripts/probe_input_backlog.ts
 *  against a local server, 200 ms stalls moved the backlog from 2 commands to
 *  12 for good; hosted, a backlog of 40 (0.7 s) resolved melee where the
 *  player had been.
 *
 *  So the server reports this client's low-water mark (GameSnapshot.queued,
 *  InputQueue.low: the fewest commands waiting at any tick of the last half
 *  second), and while that stands above target the clock runs slightly slow
 *  (`drainFor`): 5% one command over, up to 20% seven or more over - one
 *  command withheld every twentieth to every fifth tick. The local simulation
 *  advances one tick per command sent, so a withheld tick is one the local
 *  copy does not run either, and client and server stay identical. The drawn
 *  body does not freeze on it: `alpha` is measured in the same dilated time,
 *  so each tick is interpolated over a slightly longer stretch of real time
 *  and the body moves up to a fifth slower for the second or two a drain
 *  lasts. The clock never runs faster than real time.
 */
export class InputClock {
  /** Simulation time banked toward the next command, in seconds. */
  backlog = 0;
  /** performance.now() of the previous advance; 0 before the first. */
  last = 0;
  /** Simulation seconds per real second: 1, or less while draining. */
  rate = 1;
  /** The dilation the latest report asked for; `rate` eases to 1 - this. */
  private wanted = 0;
  /** `last` when that report arrived. */
  private heard = 0;

  reset() { this.backlog = 0; this.last = 0; this.rate = 1; this.wanted = 0; this.heard = 0; }

  /** The server's low-water mark for this client's queue, off an owner
   *  snapshot. A snapshot without one (an older server) leaves the clock at
   *  real time. */
  report(queued: number | undefined) {
    if (typeof queued !== 'number' || !Number.isFinite(queued)) return;
    this.wanted = drainFor(queued, this.wanted > 0);
    this.heard = this.last;
  }

  /** How many commands are due at `now` (performance.now()). */
  advance(now: number) {
    const elapsed = this.last ? (now - this.last) / 1000 : 1 / INPUT_HZ;
    this.last = now;
    if (this.wanted && (now - this.heard) / 1000 > REPORT_STALE) this.wanted = 0;
    const ease = RATE_SLEW * Math.max(0, Math.min(elapsed, .1)), target = 1 - this.wanted;
    this.rate = target < this.rate ? Math.max(target, this.rate - ease) : Math.min(target, this.rate + ease);
    const due = catchUp(this.backlog, elapsed, this.rate);
    this.backlog = due.backlog;
    return due.steps;
  }

  /** Render interpolation between the last two ticks sent, 0..1, in the same
   *  dilated time the commands leave on. */
  alpha(now: number) {
    if (!this.last) return 1;
    const since = Math.max(0, now - this.last) / 1000;
    return Math.max(0, Math.min(1, (this.backlog + since * this.rate) * INPUT_HZ));
  }
}
