// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/* ================================================================== */
/* ASTRAL CHAINSTORM — p27 pack (arcane, LINE)                        */
/* ================================================================== */
/*!
 * Rune-forged chains whip out of the hand, coil around the target, constrict, and slam it into the floor.
 *
 * Ported from itzmitto/Ability-ThreeJS-Project (MIT License, Copyright (c) 2026 itzmitto),
 * https://github.com/itzmitto/Ability-ThreeJS-Project — upstream source kept under
 * `src/abilities/p27/lib/src/`, licence in `src/abilities/p27/lib/LICENSE-ability-project-27.txt`.
 *
 * The upstream effect is choreographed in code; what is exposed here is what
 * upstream reads at run time, plus the adapter's shared-system knobs
 * (see `abilities/p27/lib/P27Ability.js`).
 */
export const p27_chainstorm = {
  range: 30, // maximum cast distance, metres
  minRange: 2.0, // minimum cast distance, metres
  cooldown: 2.5, // seconds
  castAnim: 'cast2', // which clip in `CAST_ANIMATIONS` the body throws
  detail: 2, // upstream quality tier: 0 LOW, 1 MEDIUM, 2 MAX
  timeScale: 1.0, // playback speed of the whole effect
  handHeight: 1.25, // where the cast leaves the caster: metres above the floor
  handForward: 0.45, // ... metres in front
  handSide: 0.3, // ... metres to the side
  lightIntensity: 30, // pooled light at the effect's brightest moment
  lightRadius: 22, // metres
  lightColor: '#91f2ff', // tints the mirrored light, flash and shockwave
  shake: 1.0, // camera shake on upstream impact beats
  flash: 0.3, // screen flash on the big beats
  shockwave: 0.3, // shared shockwave decal on the big beats
  shockwaveRadius: 8.0, // metres
  rippleIntensity: 0.6, // ground ripples from the upstream water hits

  /* --- the chains --- */
  chainCount: 5, // chains
  linksPerChain: 40, // links per chain
  linkLength: 1.12, // link length
  linkThickness: 0.105, // link thickness
  chainSpacing: 0.78, // link spacing
  launchSpeed: 34, // launch speed
  whipAmplitude: 0.55, // whip amplitude
  whipFrequency: 3, // whip frequency
  wrapRadius: 2.9, // wrap radius
  wrapSpeed: 1.4, // wrap speed
  constrictTime: 0.4, // constrict time
  runeBrightness: 0.75, // rune glow
  runePulseSpeed: 0.7, // rune pulse speed
  metalRoughness: 0.29, // steel roughness
  scratchScale: 28, // scratch scale
  sparkDensity: 1, // sparks
  fragmentCount: 80, // steel debris
  impactIntensity: 1, // impact intensity
  waterRippleStrength: 0.34, // ripple strength
};

export const p27_chainstormSchema = {
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
  'The chains': [
    ['chainCount', 3, 5, 1, 'chains'],
    ['linksPerChain', 20, 42, 1, 'links per chain'],
    ['linkLength', 0.9, 1.5, 0.01, 'link length'],
    ['linkThickness', 0.07, 0.14, 0.001, 'link thickness'],
    ['chainSpacing', 0.65, 0.9, 0.01, 'link spacing'],
    ['launchSpeed', 20, 45, 0.5, 'launch speed'],
    ['whipAmplitude', 0, 1, 0.01, 'whip amplitude'],
    ['whipFrequency', 1, 5, 0.05, 'whip frequency'],
    ['wrapRadius', 2, 4, 0.01, 'wrap radius'],
    ['wrapSpeed', 0.5, 2, 0.01, 'wrap speed'],
    ['constrictTime', 0.25, 0.65, 0.01, 'constrict time'],
    ['runeBrightness', 0, 1.5, 0.01, 'rune glow'],
    ['runePulseSpeed', 0.3, 1.5, 0.01, 'rune pulse speed'],
    ['metalRoughness', 0.18, 0.5, 0.01, 'steel roughness'],
    ['scratchScale', 12, 50, 0.5, 'scratch scale'],
    ['sparkDensity', 0.2, 1.5, 0.01, 'sparks'],
    ['fragmentCount', 20, 84, 1, 'steel debris'],
    ['impactIntensity', 0.3, 1.5, 0.01, 'impact intensity'],
    ['waterRippleStrength', 0.15, 0.4, 0.005, 'ripple strength']
  ]
};
