// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * Ported into VFX Armory (ext pack) from achrefelouafi/LinearAbilityExtThreeJS (effects/RingIndicator.js, effects/GateIndicator.js)
 * by mohamedachrefelouafi. MIT License, Copyright (c) 2026 mohamedachrefelouafi.
 * Imports rewired to the Armory sandbox; settings re-keyed to the ext_* ids.
 */
/** The two SDF chunks the ring and gate abilities share with their (unported) aim templates. */
export const RING_SDF = /* glsl */ `
  float ringRadiusAt(float angle, float radius, float lobes, float lobeDepth) {
    return radius * (1.0 + lobeDepth * cos(angle * lobes));
  }

  float ringDistance(vec2 p, float radius, float lobes, float lobeDepth) {
    return ringRadiusAt(atan(p.y, p.x), radius, lobes, lobeDepth) - length(p);
  }

  /**
   * Where a point sits along the contour, signed, measured **from the bottom**.
   *
   * 0 is the foot of the ring, ±1 the crown, and the sign is which way round
   * you got there — the exact parameter the segments are laid and ordered by,
   * so the runes light in step with the stone that carries them.
   */
  float ringContour(vec2 p) {
    float t = (atan(p.y, p.x) + 1.5707963) / 3.14159265;
    return t > 1.0 ? -(2.0 - t) : t;
  }
`;

export const ARCH_SDF = /* glsl */ `
  float archDistance(vec2 p, float hw, float spring) {
    return p.y <= spring
      ? hw - abs(p.x)
      : hw - length(vec2(p.x, p.y - spring));
  }
`;
