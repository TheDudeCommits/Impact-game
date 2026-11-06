/** Where the player is looking, as the client last drew the frame: the
 *  lens on the floor plan and the way it faces (toward the fighter). The
 *  arcade's director reads it to open a boss's rift in front of the camera -
 *  placed off the fighter's facing alone, a boss stepped out behind the lens
 *  one time in three and arrived off-screen or as a ghost across the frame.
 *  Only a local run has a lens; a match server never writes it, and a stale
 *  one (over a second and a half old) is no lens at all. */
export const LENS = { x: 0, z: 0, fx: 0, fz: 1, at: -1e9 };

export function seeLens(x: number, z: number, towardX: number, towardZ: number) {
  const dx = towardX - x, dz = towardZ - z, d = Math.hypot(dx, dz);
  if (d < .5) return;
  LENS.x = x; LENS.z = z; LENS.fx = dx / d; LENS.fz = dz / d; LENS.at = Date.now();
}

export function lens() { return Date.now() - LENS.at < 1500 ? LENS : undefined; }
