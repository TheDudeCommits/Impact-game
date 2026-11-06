import type { Vec3 } from './types';

export const BOMB_LEAD = 4.5, BOMB_LEAD_SHARE = .5, BOMB_DRIFT = 6;
/** How fast a bomb aimed as it is let go follows the body it was thrown at, along the floor (m/s): faster than any run
 *  (7.5), so a body that turns back is still under it; measured, 10 left Kagari's strafing partner (a run, turning back
 *  every 0.7 s) half the time from 12 m. */
export const BOMB_HOME = 12;
/** How long before it comes down a homing bomb stops following (it has committed, and its ring on the floor stops with
 *  it): a dash started inside this is out from under it by the time it lands - a sidestep's 3.6 m in 0.18 s, a dash's
 *  5.3 in 0.22, a backdash's 3.2 in 0.16 (past a 3 m blast, not the Drowned Sun's 3.2) - or, in the last tenth of a
 *  second, through it on the dash's evade. Measured from 6, 9 and 12 m against a body standing (tests/bombAim.test.ts):
 *  a sidestep gets out started 0.15-0.35 s before it lands; a backdash 0-0.3 (the Drowned Sun's only on its evade, 0-0.1);
 *  a dash in under it, at the thrower, 0-0.5. Any sooner and it is followed; a sidestep any later is still under it.
 *  Longer, and a body circling at a run and turning back every 0.7 s got out from 9 m and more (Kagari's was caught half
 *  the time from 12 m at 0.35; every time at 0.3). */
export const BOMB_COMMIT = .3;

/** Where a bomb thrown from `from` at `speed` (m/s) meets a body whose blast point is `at`, moving along the floor at
 *  (vx, vz): that point carried over the flight, `share` of the run and `most` metres at the most. `out` gets the point
 *  (at `at`'s height); the flight's length in seconds is returned. */
export function bombLead(from: Vec3, at: Vec3, vx: number, vz: number, speed: number, out: Vec3, share = BOMB_LEAD_SHARE, most = BOMB_LEAD) {
  let lx = 0, lz = 0, t = 0;
  for (let pass = 0; pass < 3; pass++) {
    t = Math.hypot(at.x + lx - from.x, at.y - from.y, at.z + lz - from.z) / Math.max(1, speed);
    lx = vx * t * share; lz = vz * t * share;
    const lead = Math.hypot(lx, lz);
    if (lead > most) { lx *= most / lead; lz *= most / lead; }
  }
  out.x = at.x + lx; out.y = at.y; out.z = at.z + lz;
  return t;
}

/** Where a following bomb wants its blast point `left` seconds before it lands: the body's own blast point `at`
 *  carried along its run (vx, vz) over that time, BOMB_LEAD_SHARE of it and BOMB_LEAD metres at the most. */
export function homeWant(at: { x: number; z: number }, vx: number, vz: number, left: number, out: { x: number; z: number }) {
  let lx = vx * left * BOMB_LEAD_SHARE, lz = vz * left * BOMB_LEAD_SHARE;
  const lead = Math.hypot(lx, lz);
  if (lead > BOMB_LEAD) { lx *= BOMB_LEAD / lead; lz *= BOMB_LEAD / lead; }
  out.x = at.x + lx; out.z = at.z + lz;
  return out;
}

/** `point` brought in along the floor to within `range` of `centre` - where its thrower let it go: a bomb is never set
 *  down past its range, aimed or following. */
export function inRange(point: { x: number; z: number }, centre: { x: number; z: number }, range: number) {
  const dx = point.x - centre.x, dz = point.z - centre.z, flat = Math.hypot(dx, dz);
  if (flat > range) { point.x = centre.x + dx * range / flat; point.z = centre.z + dz * range / flat; }
}

/** One step of a bomb following its body in flight: `end` moved along the floor toward `want` by `rate * dt` at the
 *  most, and never further than `most` from `aimed` (where it was thrown). Its height is left alone. */
export function homeStep(end: Vec3, want: { x: number; z: number }, rate: number, dt: number, aimed: { x: number; z: number }, most = BOMB_DRIFT) {
  let dx = want.x - end.x, dz = want.z - end.z;
  const gap = Math.hypot(dx, dz), step = rate * dt;
  if (gap > step) { dx *= step / gap; dz *= step / gap; }
  let x = end.x + dx, z = end.z + dz;
  const ox = x - aimed.x, oz = z - aimed.z, off = Math.hypot(ox, oz);
  if (off > most) { x = aimed.x + ox * most / off; z = aimed.z + oz * most / off; }
  end.x = x; end.z = z;
}
