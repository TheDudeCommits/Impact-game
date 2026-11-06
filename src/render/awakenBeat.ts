import { AWAKENING_ENTRY } from '../game/awakening';

/** Round 3e (MODELS2): the awakening shot's beat, for CameraDirector's
 *  'awaken' case (a documented one-call hook in CAM4's file: the shot's
 *  constants, pivot and hand-back are its own and unchanged).
 *
 *  The shot used to ease its orbit and push evenly over the whole 0.9 s entry,
 *  so nothing in it marked the moment of transformation - and pushing the
 *  lens in at its gameplay height ended the push looking down on the top of
 *  the fighter's head. It now moves with the beat (src/game/awakening.ts
 *  AWAKENING_SWAP):
 *
 *  - the gather: the lens zooms in on the fighter, drifting a little round
 *    toward their front and down toward their eye line - the power building,
 *    the fighter filling the frame;
 *  - the burst: thrown back past where it started and widened for an instant
 *    (the aura exploding out at it), then easing in again to a settled
 *    framing for the rest of the entry, before the shot's own hand-back.
 *
 *  Returned as fractions the case applies to its own constants: `orbit` of
 *  AWAKEN_ORBIT, `push` of the lens's distance (negative is further), `drop`
 *  of its height over the pivot, `fov` of AWAKEN_FOV (1 = narrowed by it) and
 *  `widen` in degrees, and `in`, how fast (s) the shot takes over. `t` is the
 *  shot's clock, `swap` the fighter's. */
export function awakenBeat(t: number, swap: number) {
  const ease = (u: number) => { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u); };
  const out = (u: number) => { u = Math.min(1, Math.max(0, u)); return 1 - (1 - u) * (1 - u); };
  const settle = ease((t - swap) / Math.max(.05, AWAKENING_ENTRY - swap));
  // Round 3f (CAM5): the kick rises over AWAKEN_KICK_RISE, eased, where it
  // took 25 ms - twelve degrees of field and half a metre of lens in a frame
  // and a half, which the fourth blind critic measured as the fighter's head
  // jumping 0.3 of the screen in one frame. It still peaks within the burst.
  const kick = t < swap ? 0 : Math.exp(-Math.max(0, t - swap - AWAKEN_KICK_RISE * .5) / AWAKEN_KICK_DECAY) * ease((t - swap) / AWAKEN_KICK_RISE);
  if (t < swap) {
    const u = out(t / swap);
    return { orbit: AWAKEN_ORBIT_SHARE * .8 * u, push: AWAKEN_GATHER_PUSH * u, drop: AWAKEN_GATHER_DROP * u, fov: AWAKEN_ZOOM * u, widen: 0, in: AWAKEN_BLEND_IN };
  }
  return {
    in: AWAKEN_BLEND_IN,
    orbit: AWAKEN_ORBIT_SHARE * (.8 + .2 * settle),
    push: AWAKEN_SETTLE_PUSH * settle + AWAKEN_GATHER_PUSH * (1 - ease((t - swap) / .08)) * (1 - settle) - AWAKEN_KICK_BACK * kick,
    drop: AWAKEN_GATHER_DROP * (1 - .4 * settle),
    fov: AWAKEN_ZOOM * (1 - kick) * (1 - .5 * settle) + .5 * settle,
    widen: AWAKEN_KICK_FOV * kick,
  };
}
/** How fast the shot takes over from the gameplay lens (s): the shot's own
 *  0.35 s was the whole gather. Not much faster than this: a shot that starts
 *  over another must still carry the lens, not cut it (cameraDirector.test). */
export const AWAKEN_BLEND_IN = .18;
/** Through the gather: the lens comes in by this fraction of its distance and
 *  down by this fraction of its height over the pivot, and the lens narrows by
 *  AWAKEN_ZOOM times the shot's own AWAKEN_FOV. The zoom does most of the
 *  pressing in: the lens barely moves, because the shot's full orbit and push
 *  can carry it behind a wall - measured in the training hall, the occluder
 *  logic then hauled it to its 1 m minimum, over the fighter's head. */
export const AWAKEN_GATHER_PUSH = .14, AWAKEN_GATHER_DROP = .3, AWAKEN_ZOOM = 2.4;
/** How much of the shot's own orbit (AWAKEN_ORBIT) the beat uses. */
export const AWAKEN_ORBIT_SHARE = .4;
/** Where it settles after the burst (fraction of the distance, in). */
export const AWAKEN_SETTLE_PUSH = .06;
/** On the burst: thrown back by this fraction of the distance, widened by
 *  this many degrees, both decaying with this time constant (s) once they
 *  have risen, over AWAKEN_KICK_RISE (s). */
export const AWAKEN_KICK_BACK = .16, AWAKEN_KICK_FOV = 9, AWAKEN_KICK_DECAY = .13, AWAKEN_KICK_RISE = .1;
