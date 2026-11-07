// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import { Vector3 } from 'three';
import { SPECTRAL } from './SpectralBreakConfig';
const finite = (v: Readonly<Vector3>) => [v.x, v.y, v.z].every(Number.isFinite);
/** Ground aim or a valid forward ray; never falls back to an accidental origin strike. */
export function resolveSpectralTarget(origin: Readonly<Vector3>, ground: Readonly<Vector3> | null, direction: Readonly<Vector3>): Vector3 | null {
  if (!finite(origin)) return null;
  const offset = new Vector3();
  if (ground && finite(ground)) offset.subVectors(ground, origin);
  else if (finite(direction) && direction.lengthSq() > 1e-8) offset.copy(direction).normalize().multiplyScalar(SPECTRAL.range);
  else return null;
  if (offset.lengthSq() < .04) return null;
  return offset.clampLength(.2, SPECTRAL.range).add(origin);
}
