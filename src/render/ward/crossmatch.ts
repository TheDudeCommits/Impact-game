import { MOVES, PLAYER_RADIUS } from '../../game/moves';

const MOVE = MOVES.ward.ultimate, SWAP = MOVE.teleport!;
export const CROSSMATCH = {
  /** The swap, seconds into the move: the teleport's return, on the opener's contact (moves.ts). */
  at: SWAP.appear,
  /** The ROOM as drawn, the move's: Crossmatch goes to any body whose centre is inside it (simulation teleportTarget). */
  room: SWAP.reach + PLAYER_RADIUS,
  /** How long the ROOM takes to open off his hand. */
  open: .28,
  /** How long the body is hidden from the swap (a remote copy's timeline may still be crossing the jump). */
  hold: .05,
  /** How far the drawn body must have moved from where it stood, after the swap, for it to have been one. */
  jump: .9,
  /** How long, from the swap, the ROOM takes to close in on the two of them, and the radius it closes to. */
  close: .32, ward: 2.6,
  /** The cube he swapped with: its edge, how long it takes to fall from his chest to the floor, how long it lies. */
  cube: .46, fall: .34, life: 1.1,
} as const;

/** Whether a Ward `elapsed` seconds into his ultimate is hidden: through the swap. */
export function crossmatchHidden(elapsed: number) {
  return elapsed >= CROSSMATCH.at && elapsed < CROSSMATCH.at + CROSSMATCH.hold;
}

/** Where the cube is, `age` seconds after the swap: its height off the floor (m, its centre), its scale (0-1) and its
 *  opacity (0-1). It pops in at chest height, falls tumbling onto the floor with one small bounce, lies there and fades.
 *  Undefined once it is gone. */
export function cubeAt(age: number): { height: number; scale: number; opacity: number } | undefined {
  if (age < 0 || age > CROSSMATCH.life) return undefined;
  const rest = CROSSMATCH.cube / 2, from = 1.05;
  let height: number;
  if (age < CROSSMATCH.fall) { const u = age / CROSSMATCH.fall; height = from + (rest - from) * u * u; }
  else { const u = Math.min(1, (age - CROSSMATCH.fall) / .16); height = rest + .09 * Math.sin(Math.PI * u); }
  const scale = Math.min(1, age / .06);
  const opacity = age < CROSSMATCH.life - .4 ? 1 : Math.max(0, (CROSSMATCH.life - age) / .4);
  return { height, scale, opacity };
}

/** The opener's take (see the top): its clip, and where in it the blow comes - the palm out on them, at the swap. The
 *  cinematic is his own 'Flatline Shock', as it was (Fighter.ts ULTIMATE_CLIPS). */
export const CROSSMATCH_TAKE = {
  open: { clip: 'Crossmatch', at: .4091 },
  cine: { from: .3, at: .7912 },
} as const;
