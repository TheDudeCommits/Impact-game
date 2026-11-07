// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
/** Inverse-transpose normal for the rotation/scale matrices used by spell instances.
 * Column-length compensation avoids a per-vertex matrix inverse. Shear is not supported.
 */
export const NORMAL_TRANSFORM_GLSL = /* glsl */ `
vec3 normalForTransform(mat4 transform, vec3 n) {
  mat3 m = mat3(transform);
  vec3 scaleSquared = vec3(dot(m[0], m[0]), dot(m[1], m[1]), dot(m[2], m[2]));
  return m * (n / max(scaleSquared, vec3(0.00000001)));
}
`;
