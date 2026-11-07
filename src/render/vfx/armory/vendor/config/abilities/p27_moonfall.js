// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/* ================================================================== */
/* ABYSSAL MOONFALL — p27 pack (void, ZONE)                           */
/* ================================================================== */
/*!
 * A fractured moon assembles in the far sky, storms and splits, then falls onto the circle in a crater of light.
 *
 * Ported from itzmitto/Ability-ThreeJS-Project (MIT License, Copyright (c) 2026 itzmitto),
 * https://github.com/itzmitto/Ability-ThreeJS-Project — upstream source kept under
 * `src/abilities/p27/lib/src/`, licence in `src/abilities/p27/lib/LICENSE-ability-project-27.txt`.
 *
 * The upstream effect is choreographed in code; what is exposed here is what
 * upstream reads at run time, plus the adapter's shared-system knobs
 * (see `abilities/p27/lib/P27Ability.js`).
 */
export const p27_moonfall = {
  range: 45, // maximum cast distance, metres
  minRange: 2.0, // minimum cast distance, metres
  zoneRadius: 20.0, // footprint shown by the circle indicator
  cooldown: 8.0, // seconds
  castAnim: 'cast3', // which clip in `CAST_ANIMATIONS` the body throws
  detail: 2, // upstream quality tier: 0 LOW, 1 MEDIUM, 2 MAX
  timeScale: 1.0, // playback speed of the whole effect
  handHeight: 1.25, // where the cast leaves the caster: metres above the floor
  handForward: 0.45, // ... metres in front
  handSide: 0.3, // ... metres to the side
  lightIntensity: 60, // pooled light at the effect's brightest moment
  lightRadius: 60, // metres
  lightColor: '#b2a0fa', // tints the mirrored light, flash and shockwave
  shake: 1.0, // camera shake on upstream impact beats
  flash: 0.6, // screen flash on the big beats
  shockwave: 0.3, // shared shockwave decal on the big beats
  shockwaveRadius: 30, // metres
  rippleIntensity: 0.6, // ground ripples from the upstream water hits

  /* --- the moon --- */
  moonRadius: 35, // moon radius
  moonHeight: 62, // moon height
  moonRotationSpeed: 0.055, // moon spin
  craterDepth: 0.15, // crater depth
  displacementScale: 0.05, // surface relief
  rockRoughness: 0.79, // rock roughness
  fractureDensity: 1, // fracture density
  fractureBrightness: 1.8, // fracture glow
  ringRotationSpeed: 0.12, // ring spin
  satelliteCount: 60, // satellites
  debrisCount: 130, // debris
  stormDensity: 1, // storm density
  stormRadius: 48, // storm radius
  lightningFrequency: 1.4, // lightning frequency
  lightningIntensity: 0.7, // lightning intensity
  descentDuration: 2.5, // descent time
  impactFlash: 1, // impact flash
  moonShockwaveRadius: 85, // crater shockwave radius
  waterDisplacement: 0.36, // surface displacement
  sprayIntensity: 1, // spray
  aftermathDuration: 4, // aftermath time
};

export const p27_moonfallSchema = {
  'The cast': [
    ['zoneRadius', 0.5, 60.0, 0.05, 'footprint radius'],
    ['range', 2, 120, 0.5, 'max range'],
    ['minRange', 0, 20, 0.1, 'min range'],
    ['cooldown', 0, 30, 0.05, 'cooldown'],
    ['castAnim', 'cast animation']
  ],
  'Playback': [
    ['detail', 0, 2, 1, 'quality tier (0-2)'],
    ['timeScale', 0.05, 3, 0.01, 'playback speed'],
    ['handHeight', 0, 3, 0.01, 'hand height'],
    ['handForward', -1, 3, 0.01, 'hand forward'],
    ['handSide', -1.5, 1.5, 0.01, 'hand lateral']
  ],
  'Shared systems': [
    ['lightIntensity', 0, 150, 0.5, 'light intensity'],
    ['lightRadius', 0.5, 80, 0.1, 'light radius'],
    ['lightColor', 'light colour'],
    ['shake', 0, 3, 0.01, 'camera shake'],
    ['flash', 0, 2, 0.01, 'screen flash'],
    ['shockwave', 0, 3, 0.01, 'shockwave decal'],
    ['shockwaveRadius', 0.5, 40, 0.1, 'shockwave radius'],
    ['rippleIntensity', 0, 3, 0.01, 'ground ripples']
  ],
  'The moon': [
    ['moonRadius', 28, 40, 0.1, 'moon radius'],
    ['moonHeight', 48, 110, 0.5, 'moon height'],
    ['moonRotationSpeed', 0, 0.15, 0.001, 'moon spin'],
    ['craterDepth', 0.08, 0.22, 0.005, 'crater depth'],
    ['displacementScale', 0.015, 0.1, 0.001, 'surface relief'],
    ['rockRoughness', 0.4, 0.95, 0.01, 'rock roughness'],
    ['fractureDensity', 0.5, 2, 0.01, 'fracture density'],
    ['fractureBrightness', 0.2, 3, 0.01, 'fracture glow'],
    ['ringRotationSpeed', 0.04, 0.3, 0.005, 'ring spin'],
    ['satelliteCount', 12, 70, 1, 'satellites'],
    ['debrisCount', 25, 150, 1, 'debris'],
    ['stormDensity', 0.3, 1.5, 0.01, 'storm density'],
    ['stormRadius', 30, 65, 0.5, 'storm radius'],
    ['lightningFrequency', 0.4, 3, 0.01, 'lightning frequency'],
    ['lightningIntensity', 0.1, 1.3, 0.01, 'lightning intensity'],
    ['descentDuration', 2, 3.5, 0.01, 'descent time'],
    ['impactFlash', 0.2, 1.5, 0.01, 'impact flash'],
    ['moonShockwaveRadius', 55, 100, 0.5, 'crater shockwave radius'],
    ['waterDisplacement', 0.15, 0.4, 0.005, 'surface displacement'],
    ['sprayIntensity', 0.3, 1.5, 0.01, 'spray'],
    ['aftermathDuration', 3, 5, 0.05, 'aftermath time']
  ]
};
