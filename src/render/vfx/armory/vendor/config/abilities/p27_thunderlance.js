// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/* ================================================================== */
/* THUNDERLANCE — p27 pack (storm, LINE)                              */
/* ================================================================== */
/*!
 * A spear of lightning is forged in a crackling cage, hurled downrange, and overloads into a storm of branches where it lands.
 *
 * Ported from itzmitto/Ability-ThreeJS-Project (MIT License, Copyright (c) 2026 itzmitto),
 * https://github.com/itzmitto/Ability-ThreeJS-Project — upstream source kept under
 * `src/abilities/p27/lib/src/`, licence in `src/abilities/p27/lib/LICENSE-ability-project-27.txt`.
 *
 * The upstream effect is choreographed in code; what is exposed here is what
 * upstream reads at run time, plus the adapter's shared-system knobs
 * (see `abilities/p27/lib/P27Ability.js`).
 */
export const p27_thunderlance = {
  range: 30, // maximum cast distance, metres
  minRange: 2.0, // minimum cast distance, metres
  cooldown: 2.0, // seconds
  castAnim: 'cast1', // which clip in `CAST_ANIMATIONS` the body throws
  detail: 2, // upstream quality tier: 0 LOW, 1 MEDIUM, 2 MAX
  timeScale: 1.0, // playback speed of the whole effect
  scale: 1.0, // uniform size, about the impact point
  handHeight: 1.25, // where the cast leaves the caster: metres above the floor
  handForward: 0.45, // ... metres in front
  handSide: 0.3, // ... metres to the side
  lightIntensity: 40, // pooled light at the effect's brightest moment
  lightRadius: 22, // metres
  lightColor: '#8be9ff', // tints the mirrored light, flash and shockwave
  shake: 1.0, // camera shake on upstream impact beats
  flash: 0.45, // screen flash on the big beats
  shockwave: 0.3, // shared shockwave decal on the big beats
  shockwaveRadius: 8.0, // metres
  rippleIntensity: 0.6, // ground ripples from the upstream water hits

  /* --- the lance (max tier) --- */
  branches: 24, // overload branches
  cage: 16, // cage arcs
  sparks: 500, // sparks
};

export const p27_thunderlanceSchema = {
  'The cast': [
    ['range', 2, 120, 0.5, 'max range'],
    ['minRange', 0, 20, 0.1, 'min range'],
    ['cooldown', 0, 30, 0.05, 'cooldown'],
    ['castAnim', 'cast animation']
  ],
  'Playback': [
    ['detail', 0, 2, 1, 'quality tier (0-2)'],
    ['timeScale', 0.05, 3, 0.01, 'playback speed'],
    ['scale', 0.1, 4, 0.01, 'size'],
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
  'The lance (MAX tier)': [
    ['branches', 0, 24, 1, 'overload branches'],
    ['cage', 0, 16, 1, 'cage arcs'],
    ['sparks', 0, 500, 1, 'sparks']
  ]
};
