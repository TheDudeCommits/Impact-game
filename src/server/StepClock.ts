/** Real time a fixed-step server owes its simulation, in steps.
 *
 *  Every command a client sends is one simulation step, and the server
 *  consumes one queued command per step, so the server has to step exactly as
 *  often as real time says - sixty times a second - or the difference stands
 *  in the input queue as delay. Colyseus' own `setFixedTimestep` banks real
 *  time too, but when one callback owes five steps it runs five and forgets
 *  the rest: a server whose event loop stalls (a collection, a throttled
 *  container) steps fewer than sixty times a second while its clients keep
 *  sending sixty. Measured locally with a 120 ms stall every second
 *  (scripts/serve_with_hitches.ts): 56.7 steps a second and a backlog that
 *  climbed 3.3 commands a second toward the queue's cap. Hosted, the probe
 *  read 58.8 and 52.2 acknowledgements a second off two servers.
 *
 *  This clock keeps what it owes - up to half a second of it - and ArenaRoom
 *  pays it back a few steps per timer callback, each on its own turn of the
 *  event loop so the commands that arrived during the stall are read before
 *  the steps that consume them.
 */
export class StepClock {
  /** Steps one timer callback may run, its own included: a stall is repaid
   *  at up to four times real time without letting one callback run long. */
  static readonly PER_CALLBACK = 4;
  /** Past this much owed time the server was not slow, it was away (a
   *  suspended container, a debugger), and replaying all of it would only
   *  fast-forward the world. The client's catch-up draws the same line. */
  static readonly MAX_OWED_SECONDS = .5;
  private last: number | undefined;
  private banked = 0;
  /** Steps written off because more than MAX_OWED_SECONDS was owed. */
  dropped = 0;
  constructor(readonly hz: number) {}

  /** Bank the real time since the previous call; `now` in milliseconds from
   *  a monotonic clock. */
  advance(now: number) {
    if (this.last !== undefined && now > this.last) this.banked += (now - this.last) * this.hz / 1000;
    this.last = now;
    const cap = StepClock.MAX_OWED_SECONDS * this.hz;
    if (this.banked > cap) { this.dropped += this.banked - cap; this.banked = cap; }
  }

  /** Whole steps owed now. The tolerance absorbs the rounding of sixty
   *  sixtieths that should have made one. */
  get owed() { return Math.floor(this.banked + 1e-6); }

  /** Spend one owed step, if there is one. */
  take() {
    if (this.banked + 1e-6 < 1) return false;
    this.banked -= 1;
    return true;
  }
}
