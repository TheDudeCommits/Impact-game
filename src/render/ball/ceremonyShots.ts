import type {BallArenaId} from '../../game/ball/arenas';
import {INTRO} from '../../game/ball/ceremony';
import {GOAL_RULES, type BallModeId} from '../../game/ball/model';
import {bowlGuardian, gateZ, wreckHullX, wreckShipZ} from './pitchLayout';

/** One authored camera move: the eye and the point it looks at, each eased from its first place to its second over the
 *  move's seconds, and the lens (vertical degrees). */
export interface Shot { seconds: number; eye: readonly [V, V]; look: readonly [V, V]; fov: number }
type V = readonly [number, number, number];

/** Goal Rush's places, as its arenas stand them (render/ball/pitchLayout.ts; the pitch is 26 × 38 m,
 *  and its shots are laid from it): its half-sizes, the carved gateway behind each goal, the guardian on
 *  the bowl's corner, the Wreck Yard's great hull beside the pitch and its wrecked ships beyond the ends. */
const X = GOAL_RULES.halfX, Z = GOAL_RULES.halfZ, GATE = gateZ(), [GX, GZ] = bowlGuardian(), HULL = wreckHullX(), WRECK = wreckShipZ();

/** The intro's flyover: three moves an arena, each to the place's own landmarks, played
 *  back to back through the first INTRO.splash seconds of the intro (BallCeremony). Positions are world metres, the
 *  pitch and court centred on the origin (render/ball/BallArena.ts places the pieces: Goal Rush's from the pitch's size
 *  as above; the shrine islands at (62, -14, -24) and (-70, -4, 36), the arch at (41, 20, -75), the colossus at
 *  (0, -34, -92) and 78 m tall). */
export const INTRO_SHOTS: Readonly<Record<BallArenaId, readonly Shot[]>> = {
  'ink-bowl': [
    // Down the pitch at the red goal, rising to the carved gateway behind it.
    {seconds: 1.9, eye: [[0, 3.2, -Z * .35], [0, 6.5, -Z * .58]], look: [[0, 5, -GATE + .6], [0, 9, -GATE - .4]], fov: 52},
    // Along the canopy to a guardian standing on its corner, side on (from the centre it stands against a floodlight).
    {seconds: 1.7, eye: [[GX - 20.6, 25, GZ - 5.6], [GX - 15.6, 29, GZ - 8.6]], look: [[GX, 29.5, GZ], [GX, 30.5, GZ]], fov: 40},
    // A crane over the whole bowl, the screens and the floodlights.
    {seconds: 1.7, eye: [[-X - 16, 30, -Z * .7], [-X - 12, 22, Z * .54]], look: [[0, 2, 0], [0, 1, 0]], fov: 56},
  ],
  'dust-yard': [
    // Over the red end at the wreck beached beyond it.
    {seconds: 1.9, eye: [[-8, 10, -Z * .46], [6, 13, -Z * .62]], look: [[-6, 10, -WRECK], [-4, 11, -WRECK]], fov: 50},
    // Across the sand at the great hull on its side, its masts and torn sails.
    {seconds: 1.7, eye: [[-X * .45, 11, Z * .46], [-X * .67, 14, -Z * .15]], look: [[-HULL, 14, 4], [-HULL, 15, -8]], fov: 50},
    // A crane down the yard to the second wreck.
    {seconds: 1.7, eye: [[X + 2, 26, -Z * 1.23], [X - 4, 19, -Z * .38]], look: [[4, 4, Z + 4], [6, 8, WRECK - 16]], fov: 56},
  ],
  'rain-roof': [
    // Low over the wet slate, the rain falling through the lights.
    {seconds: 1.9, eye: [[-X * .78, 1.2, -Z * .81], [-X * .33, 1.9, -Z * .5]], look: [[X * .33, 2.2, Z * .31], [X * .44, 3, Z * .46]], fov: 50},
    // Up past a floodlight tower to the city's towers.
    {seconds: 1.7, eye: [[X + 6, 10, -Z * .54], [X + 9, 19, -Z * .85]], look: [[64, 28, -64], [70, 34, -70]], fov: 52},
    // A crane over the roof.
    {seconds: 1.7, eye: [[-X - 12, 28, Z], [-X - 6, 21, 2]], look: [[0, 1, 0], [0, 1, 0]], fov: 56},
  ],
  'sky-court': [
    // Across the court to the shrine island in the clouds.
    {seconds: 1.9, eye: [[8, 6, -8], [14, 9, -14]], look: [[62, 6, -24], [62, 9, -24]], fov: 48},
    // The other way, to the second shrine.
    {seconds: 1.7, eye: [[-4, 7, 3], [-9, 9, 8]], look: [[-70, 8, 36], [-70, 10, 36]], fov: 48},
    // A crane over the court and its net.
    {seconds: 1.7, eye: [[24, 18, -2], [18, 12, 14]], look: [[0, 2, 0], [0, 2, 0]], fov: 56},
  ],
  'tide-court': [
    // Out over the beach to the sea arch.
    {seconds: 1.9, eye: [[6, 4, -6], [12, 6.5, -14]], look: [[41, 15, -75], [41, 17, -75]], fov: 46},
    // Along the shore to the sea stacks.
    {seconds: 1.7, eye: [[-14, 3, 14], [-18, 5, 4]], look: [[-62, 10, -30], [-62, 12, -26]], fov: 50},
    // A crane over the court.
    {seconds: 1.7, eye: [[-24, 16, -20], [-16, 12, -2]], look: [[0, 2, 4], [0, 2, 2]], fov: 56},
  ],
  'ember-rim': [
    // Up the colossus rising out of the crater.
    {seconds: 1.9, eye: [[0, 10, -8], [0, 15, -15]], look: [[0, 18, -92], [0, 27, -92]], fov: 50},
    // Round the crater's rim, its spires and the lava below.
    {seconds: 1.7, eye: [[16, 6, 8], [22, 10, 0]], look: [[70, -4, 30], [72, 0, 20]], fov: 50},
    // A crane over the court.
    {seconds: 1.7, eye: [[22, 18, 18], [12, 12, 24]], look: [[0, 2, 0], [0, 2, -2]], fov: 56},
  ],
};

/** The splash page's shot behind it: both sides on their marks, from the broadcast side line, a slow push in. */
export const SPLASH_SHOT: Readonly<Record<BallModeId, Shot>> = {
  'goal-rush': {seconds: INTRO.seconds - INTRO.splash, eye: [[-X - 13, 10, 0], [-X - 8, 8, 0]], look: [[0, 1.2, 0], [0, 1.2, 0]], fov: 54},
  'sky-spike': {seconds: INTRO.seconds - INTRO.splash, eye: [[-25, 8, 0], [-21, 6.5, 0]], look: [[0, 1.6, 0], [0, 1.6, 0]], fov: 54},
};

const ease = (t: number) => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
/** Where a shot's lens stands `t` seconds into it (0..seconds), into `out` (eye, look, fov); `still` holds it on its
 *  middle (reduced motion: no camera moves, only cuts). */
export function shotAt(shot: Shot, t: number, out: {eye: [number, number, number]; look: [number, number, number]; fov: number}, still = false) {
  const k = still ? .5 : ease(Math.min(1, Math.max(0, t / shot.seconds)));
  for (let i = 0; i < 3; i++) {
    out.eye[i] = shot.eye[0][i] + (shot.eye[1][i] - shot.eye[0][i]) * k;
    out.look[i] = shot.look[0][i] + (shot.look[1][i] - shot.look[0][i]) * k;
  }
  out.fov = shot.fov;
  return out;
}

/** The intro's lens at `elapsed` seconds into it: which flyover move (its index, -1 for the splash's shot) and where. */
export function introLens(arena: BallArenaId, mode: BallModeId, elapsed: number, out: {eye: [number, number, number]; look: [number, number, number]; fov: number}, still = false): number {
  const shots = INTRO_SHOTS[arena];
  if (elapsed < INTRO.splash) {
    // The moves share the flyover's seconds in proportion to their own.
    const total = shots.reduce((sum, s) => sum + s.seconds, 0), scale = INTRO.splash / total;
    let t = Math.max(0, elapsed);
    for (let i = 0; i < shots.length; i++) {
      const length = shots[i].seconds * scale;
      if (t < length || i === shots.length - 1) { shotAt(shots[i], Math.min(length, t) / scale, out, still); return i; }
      t -= length;
    }
  }
  shotAt(SPLASH_SHOT[mode], elapsed - INTRO.splash, out, still);
  return -1;
}
