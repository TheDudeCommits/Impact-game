import { VfxKit } from '../vfx/VfxKit';

/** Hear every splash the game throws on a liquid floor (VfxKit.splash: a step,
 *  a dash's heels, a landing, a body falling, a blow into the floor - the same
 *  events its spray and its sound answer), as (x, z, size, dx, dz). Returns the
 *  unsubscribe. */
export function subscribeSplashes(listener: (x: number, z: number, size: number, dx: number, dz: number) => void) {
  const heard: Parameters<typeof VfxKit.splashed.add>[0] = (_scene, x, z, size, dx, dz) => listener(x, z, size, dx, dz);
  VfxKit.splashed.add(heard);
  return () => { VfxKit.splashed.delete(heard); };
}

/** A splash (VfxKit.splash: a footfall ~.3 up to a smash ~1.6) as a push on
 *  the water: wider and deeper the bigger it is, thrown a little along its
 *  heading (a dash's heels, a blow's far side). */
export function splashImpulse(x: number, z: number, size: number, dx = 0, dz = 0) {
  const lean = Math.hypot(dx, dz) > .1 ? .35 * size / Math.hypot(dx, dz) : 0;
  return { x: x + dx * lean, z: z + dz * lean, radius: .3 + size * .55, depth: Math.min(.09, .006 + size * size * .035) };
}
