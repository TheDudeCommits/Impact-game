export const SPRING_TIDE_TAKE = {
  /** When the form is on, unawakened: under the burst that carries him into it (seconds into the move). */
  swap: .05,
  laugh: .5,
  /** The opener: its take, and where in it the blow comes - the bottom of the crouch, early in its hold, so the
   *  crouch is still held when the confirm comes (after the opener's active frames and a round trip). */
  open: { clip: 'Spring Tide Open', at: .32 },
  /** The cinematic: the take itself from that crouch (0.11 s of its 2.46) to the fist in the floor at 0.773. */
  cine: { from: .0447, at: .773 },
} as const;

/** When the form goes again, unawakened, `elapsed` seconds into the move: 0.23 s before the move ends - or, where the
 *  opener missed, before the whiff's recovery ends (`whiffedAt`; the simulation cuts the move there, and the
 *  duration on the wire stays the full one). */
export function springTideOut(state: { actionStarted: number; actionDuration: number; whiffedAt?: number }, recovery: number) {
  const end = state.whiffedAt !== undefined ? Math.min(state.actionDuration, state.whiffedAt - state.actionStarted + recovery) : state.actionDuration;
  return end - .23;
}

/** Round 6 (GUMMY ULT): SUNRISE's grab, the opener (see the top). Seconds, radians, metres:
 *    out      how long before the opener's contact the hand leaves - the take's whip is over by then - to arrive on it;
 *    release  how long after the contact a hand that has them lets go: as he springs off the floor (0.7-0.9 s of the
 *             move), when the fist starts to be blown up over them (GummyEffects' SPRING_TIDE_FIST.from);
 *    wait     how long it hangs on the contact for a verdict that has not come (a client's copy hears it a round trip
 *             late), before it comes back anyway;
 *    aim      how far it may turn off the forearm's own line toward them (the take throws it straight ahead);
 *    grip     how far into their silhouette the open hand reaches past their skin, to close on them;
 *    min      the least it stretches, at point blank;
 *    ahead    how far it goes with nobody to go to. */
export const SPRING_TIDE_GRAB = { out: .12, release: .3, wait: .5, aim: 75 * Math.PI / 180, grip: .12, min: .35, ahead: 6 } as const;

export interface GrabPhase {
  /** How far out, 0 (the take's own hand) to 1 (on them), while it goes out and holds; undefined once it is coming back. */
  reach?: number;
  /** Seconds since it let go (the recoil's clock), once it is coming back. */
  back?: number;
  /** The open hand, not the fist (gummy/openHands.ts). */
  open: boolean;
  /** Whether it is on the body it was thrown at - following it - rather than closed on where they stood on the contact. */
  follow: boolean;
}

/** Where the grab is, `contact` being the opener's contact time (moves.ts), for a body's state now. Nothing before the
 *  hand leaves; out on an ease-out (fastest as it leaves) onto the contact; then held - shut on them once confirmed,
 *  open on the air while it waits, and on a whiff - until it lets go (SPRING_TIDE_GRAB). */
export function springTideGrab(state: { actionStarted: number; actionDuration: number; actionTime: number; confirmedAt?: number; whiffedAt?: number },
  contact: number): GrabPhase {
  const t = state.actionTime * state.actionDuration, leaves = contact - SPRING_TIDE_GRAB.out;
  if (t < leaves) return { open: false, follow: true };
  const confirmed = state.confirmedAt !== undefined;
  const letGo = confirmed ? contact + SPRING_TIDE_GRAB.release
    : state.whiffedAt !== undefined ? Math.max(contact, state.whiffedAt - state.actionStarted) : contact + SPRING_TIDE_GRAB.wait;
  if (t >= letGo) return { back: t - letGo, open: !confirmed && t - letGo < .3, follow: confirmed };
  if (t < contact) { const v = (t - leaves) / SPRING_TIDE_GRAB.out; return { reach: 1 - (1 - v) ** 3, open: true, follow: true }; }
  return { reach: 1, open: !confirmed, follow: confirmed };
}
