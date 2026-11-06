import type { CombatEvent } from '../../game/types';
import type { Fighter } from '../Fighter';

/** Round 3c: a cast's own clock, for the effects drawn along it.
 *
 *  The simulation holds a cast's clock while its thrower's commands are late
 *  (up to 0.35 s) and through an impact freeze: it moves the cast's start on,
 *  and leaves the held time out of the fighter's action clock. An effect timed
 *  off the cast event's own time runs ahead of the move by however long it was
 *  held - after a stalled charge, NIGHTFALL's cleave and burn showed up to a
 *  third of a second before its damage. So:
 *  - while the move runs, the thrower's action clock (`actionTime *
 *    actionDuration`, which leaves the holds out) says how far behind the
 *    event's clock the move is, and the hold only ever grows;
 *  - when the move's release event arrives (the tick its contact came due)
 *    that pins it exactly for everything after;
 *  - with `wait`, an effect that reaches its release before the release event
 *    has arrived holds there for it (at most a second). The local player's
 *    own fighter is predicted and its action clock never holds, so only the
 *    event can say its move was held; the presented time runs behind the
 *    snapshots, so without a hold the event is already in by then;
 *  - it never runs backwards: a pin that lands behind what was drawn holds
 *    the effect still until the clock catches up, rather than jumping it.
 *  Nothing is allocated: the hold lives on the effect's own cast record. */
export interface HeldCast { event: CombatEvent; hold?: number; releasedAt?: number; drawn?: number }

/** Seconds into the move, with the server's holds taken out. `release` is
 *  the move's first contact (seconds from the cast), for pinning. */
export function castAge(cast: HeldCast, time: number, actor: Fighter | undefined, release: number, wait = false) {
  const e = cast.event, nominal = time - e.serverTime, s = actor?.state;
  // Only this move's clock: the same slot, started with this cast, not yet
  // run out (a finished clock clamps at its duration and would read as a hold).
  if (s && s.action === e.slot && s.actionDuration > 0 && s.actionTime < .999 && Math.abs(s.actionStarted - e.serverTime) < .25) {
    const held = nominal - s.actionTime * s.actionDuration;
    // A hold is at most 0.35 s of lateness plus impact freezes; anything past
    // a second is a clock that is not this cast's.
    if (held > (cast.hold ?? 0) && held < 1) cast.hold = held;
  }
  if (cast.releasedAt !== undefined) cast.hold = Math.max(cast.hold ?? 0, cast.releasedAt - e.serverTime - release);
  let age = nominal - (cast.hold ?? 0);
  if (wait && cast.releasedAt === undefined && age > release && age < release + 1) age = release;
  if (cast.drawn !== undefined && age < cast.drawn && age > cast.drawn - 1) age = cast.drawn;
  cast.drawn = age;
  return age;
}

/** Note a `release` event on the cast it belongs to: the latest cast of the
 *  same thrower and slot at or before it, if that one has not released yet. */
export function noteRelease(casts: readonly HeldCast[], event: CombatEvent) {
  if (event.kind !== 'release') return;
  for (let i = casts.length - 1; i >= 0; i--) {
    const cast = casts[i], e = cast.event;
    if (e.actorId !== event.actorId || e.slot !== event.slot || event.serverTime < e.serverTime) continue;
    if (cast.releasedAt === undefined) cast.releasedAt = event.serverTime;
    return;
  }
}
