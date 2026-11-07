// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/* ================================================================== */
/* SHADOW COLOSSUS — p27 pack (beast, ZONE)                           */
/* ================================================================== */
/*!
 * Two colossal shadow arms claw up out of the floor around the circle and crush it between them.
 *
 * Ported from itzmitto/Ability-ThreeJS-Project (MIT License, Copyright (c) 2026 itzmitto),
 * https://github.com/itzmitto/Ability-ThreeJS-Project — upstream source kept under
 * `src/abilities/p27/lib/src/`, licence in `src/abilities/p27/lib/LICENSE-ability-project-27.txt`.
 *
 * The upstream effect is choreographed in code; what is exposed here is what
 * upstream reads at run time, plus the adapter's shared-system knobs
 * (see `abilities/p27/lib/P27Ability.js`).
 */
export const p27_colossus = {
  range: 24, // maximum cast distance, metres
  minRange: 2.0, // minimum cast distance, metres
  zoneRadius: 7.0, // footprint; rescales the effect around its centre
  cooldown: 3.0, // seconds
  castAnim: 'cast3', // which clip in `CAST_ANIMATIONS` the body throws
  detail: 2, // upstream quality tier: 0 LOW, 1 MEDIUM, 2 MAX
  timeScale: 1.0, // playback speed of the whole effect
  handHeight: 1.25, // where the cast leaves the caster: metres above the floor
  handForward: 0.45, // ... metres in front
  handSide: 0.3, // ... metres to the side
  lightIntensity: 26, // pooled light at the effect's brightest moment
  lightRadius: 22, // metres
  lightColor: '#a477df', // tints the mirrored light, flash and shockwave
  shake: 1.0, // camera shake on upstream impact beats
  flash: 0.3, // screen flash on the big beats
  shockwave: 0.3, // shared shockwave decal on the big beats
  shockwaveRadius: 8.0, // metres
  rippleIntensity: 0.6, // ground ripples from the upstream water hits

  /* --- the colossus (max tier) --- */
  motes: 420, // motes
  mist: 70, // mist
  fragments: 70, // fragments
  filaments: 10, // filaments
  shells: 3, // shells
};

export const p27_colossusSchema = {
  'The cast': [
    ['zoneRadius', 0.5, 40, 0.05, 'footprint radius (scales effect)'],
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
  'The colossus (MAX tier)': [
    ['motes', 0, 420, 1, 'motes'],
    ['mist', 0, 70, 1, 'mist'],
    ['fragments', 0, 70, 1, 'fragments'],
    ['filaments', 0, 10, 1, 'filaments'],
    ['shells', 1, 3, 1, 'shells']
  ]
};
