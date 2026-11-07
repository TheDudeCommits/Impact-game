// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/* ================================================================== */
/* SAND REAPER — p27 pack (blade, LINE)                               */
/* ================================================================== */
/*!
 * A crescent cleaver of carved stone assembles in the hand, spins downrange and bursts into sand and shards.
 *
 * Ported from itzmitto/Ability-ThreeJS-Project (MIT License, Copyright (c) 2026 itzmitto),
 * https://github.com/itzmitto/Ability-ThreeJS-Project — upstream source kept under
 * `src/abilities/p27/lib/src/`, licence in `src/abilities/p27/lib/LICENSE-ability-project-27.txt`.
 *
 * The upstream effect is choreographed in code; what is exposed here is what
 * upstream reads at run time, plus the adapter's shared-system knobs
 * (see `abilities/p27/lib/P27Ability.js`).
 */
export const p27_sandreaper = {
  range: 30, // maximum cast distance, metres
  minRange: 2.0, // minimum cast distance, metres
  cooldown: 2.0, // seconds
  castAnim: 'cast1', // which clip in `CAST_ANIMATIONS` the body throws
  detail: 2, // upstream quality tier: 0 LOW, 1 MEDIUM, 2 MAX
  timeScale: 1.0, // playback speed of the whole effect
  handHeight: 1.25, // where the cast leaves the caster: metres above the floor
  handForward: 0.45, // ... metres in front
  handSide: 0.3, // ... metres to the side
  lightIntensity: 26, // pooled light at the effect's brightest moment
  lightRadius: 22, // metres
  lightColor: '#ffd98a', // tints the mirrored light, flash and shockwave
  shake: 1.0, // camera shake on upstream impact beats
  flash: 0.3, // screen flash on the big beats
  shockwave: 0.3, // shared shockwave decal on the big beats
  shockwaveRadius: 8.5, // metres
  rippleIntensity: 0.6, // ground ripples from the upstream water hits

  /* --- the crescent --- */
  bladeLength: 3.8, // blade length
  bladeWidth: 0.84, // blade width
  bladeThickness: 0.48, // spine thickness
  crescentCurvature: 2.13, // crescent curvature
  facetRoughness: 0.055, // chipped facets
  bladeSpinSpeed: 2.4, // spin speed
  flightSpeed: 40, // flight speed
  noiseFrequency: 3.3, // stone grain scale
  sandDensity: 1, // sand density
  sandTurbulence: 0.7, // sand turbulence
  fragmentCount: 88, // impact rocks
  fragmentSpeed: 12, // rock speed
  mineralGlow: 0.65, // mineral seam glow
  dustOpacity: 0.12, // dust opacity
  impactRadius: 8.5, // impact radius
};

export const p27_sandreaperSchema = {
  'The cast': [
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
  'The crescent': [
    ['bladeLength', 2, 7, 0.01, 'blade length'],
    ['bladeWidth', 0.25, 1.4, 0.01, 'blade width'],
    ['bladeThickness', 0.15, 0.9, 0.01, 'spine thickness'],
    ['crescentCurvature', 1.55, 2.4, 0.01, 'crescent curvature'],
    ['facetRoughness', 0, 0.1, 0.001, 'chipped facets'],
    ['bladeSpinSpeed', 0, 5, 0.01, 'spin speed'],
    ['flightSpeed', 25, 65, 0.5, 'flight speed'],
    ['noiseFrequency', 0.5, 9, 0.05, 'stone grain scale'],
    ['sandDensity', 0.2, 1.5, 0.01, 'sand density'],
    ['sandTurbulence', 0, 1.5, 0.01, 'sand turbulence'],
    ['fragmentCount', 12, 90, 1, 'impact rocks'],
    ['fragmentSpeed', 4, 20, 0.1, 'rock speed'],
    ['mineralGlow', 0, 1.5, 0.01, 'mineral seam glow'],
    ['dustOpacity', 0, 0.25, 0.005, 'dust opacity'],
    ['impactRadius', 3, 12, 0.05, 'impact radius']
  ]
};
