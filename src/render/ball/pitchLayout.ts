import {GOAL_RULES} from '../../game/ball/model';

/** Where Goal Rush's arenas stand their pieces round the pitch (26 × 38 m, from 36 × 52 m before; everything built or
 *  filmed round it is laid from GOAL_RULES so it follows).
 *  Shared by the builder (BallArena.ts) and the intro's lenses (ceremonyShots.ts), with no three.js in it. */

/** The Ink Bowl's stands: the first row this far out from the pitch's walls, each tread this deep, so many of them. */
export const BOWL = {front: 6.5, tread: 1.55, tiers: 14} as const;

/** Where the Ink Bowl's guardians stand (+x, +z; the others mirror it): on the canopy over each corner, out from the
 *  middle of the corner's chamfer along its normal by the canopy's lip (the stands' depth less ten metres). Their feet
 *  are at the canopy's height, 24.1 m, whatever the pitch's size. (On the 36 × 52 m pitch: 28.6, 36.6.) */
export function bowlGuardian(): readonly [number, number] {
  const {halfX: X, halfZ: Z, corner: C} = GOAL_RULES, lip = (BOWL.front + BOWL.tiers * BOWL.tread - 10) / Math.SQRT2;
  return [X - C / 2 + lip, Z - C / 2 + lip];
}

/** The carved gateway behind each Ink Bowl goal stands this far from the middle (z, either end). */
export const gateZ = () => GOAL_RULES.halfZ + GOAL_RULES.goalDepth + 1.2;

/** A spot out beyond the pitch, placed round the 36 × 52 m pitch it was first laid for, pulled in by how much smaller the
 *  pitch is now on each axis it stands beyond, so it keeps its distance from the stands (which come in with the walls). */
export function pulled(x: number, z: number): [number, number] {
  return [Math.abs(x) > 18 ? x - Math.sign(x) * (18 - GOAL_RULES.halfX) : x, Math.abs(z) > 26 ? z - Math.sign(z) * (26 - GOAL_RULES.halfZ) : z];
}

/** The Wreck Yard's two great hulls lie this far out to the sides, and its wrecked ships this far beyond the ends. */
export const wreckHullX = () => GOAL_RULES.halfX + 34;
export const wreckShipZ = () => GOAL_RULES.halfZ + 40;
