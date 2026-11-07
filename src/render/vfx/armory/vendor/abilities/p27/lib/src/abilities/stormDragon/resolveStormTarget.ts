// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Vector3 } from "three";
import { CATACLYSM } from "./StormDragonConfig";
export function resolveStormTarget(
  origin: Vector3,
  target: Vector3 | null,
): Vector3 | null {
  if (
    !target ||
    ![origin.x, origin.y, origin.z, target.x, target.y, target.z].every(
      Number.isFinite,
    )
  )
    return null;
  const p = target.clone();
  p.y = 0;
  const dx = p.x - origin.x,
    dz = p.z - origin.z,
    d = Math.hypot(dx, dz);
  if (d > CATACLYSM.range) {
    p.x = origin.x + (dx / d) * CATACLYSM.range;
    p.z = origin.z + (dz / d) * CATACLYSM.range;
  }
  return p;
}
