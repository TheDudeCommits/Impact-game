// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/* ================================================================== */
/* DRAGONFIRE CIRCLE — cinematic pack                                  */
/* ================================================================== */
/*!
 * A dragon circles the zone drawing a ring of fire, then the fire takes everything inside it.
 *
 * Ported 1:1 from the `dragon` block of achrefelouafi/AbilityCastingThreeJS
 * (MIT, Copyright (c) 2026 mohamedachrefelouafi), `src/config/settings.js`.
 * Nested objects (`hit`, `burn`, …) drove the source's ragdoll targets; they
 * are kept so the code reads them unchanged, and the editor skips them.
 * Ranges are inferred by the editor from the shipped values.
 */
export const cin_dragon = {
  /* --- the cast --- */
  range: 22.0, // max cast distance, metres
  minRange: 0,
  speed: 46.0, // the fuse's run to the circle, m/s
  cooldown: 9.0,
  castAnim: 'cast3',
  zoneRadius: 5.5, // the circle the dragon burns, metres
  fadeTime: 6.5, // seconds the scorched floor takes to cool and go
  fuseEmbers: 260, // embers/second the fuse sheds

  /* --- the timing --- */
  portalOpen: 0.6, // the sky tears open
  arriveTime: 1.75, // the dive, from the tear to the circle
  traceTime: 4.2, // one lap of the circle, breathing
  departTime: 2.0, // off the end of the lap and back up into the tear
  spreadDelay: 0.35, // after the ring closes, before the fire turns inward
  spreadTime: 3.2, // the fire's run from the ring to the middle

  /* --- 1 · the tear in the sky --- */
  portalHeight: 12.5, // metres over the floor
  portalBack: 8.0, // metres past the circle, along the cast
  portalRadius: 3.6, // metres, fully open
  portalTilt: 0.6, // radians it is turned down toward the circle
  portalSpin: 1.3, // radians/second the vortex turns
  portalIntensity: 2.2,
  portalVoid: 0.92, // how black the inside is
  portalShake: 0.3, // when the dragon comes through
  portalLight: 60.0,
  portalLightRadius: 20.0,
  revealWidth: 0.4, // metres of molten edge where it passes through
  revealGlow: 9.0,

  /* --- 2 · the dragon --- */
  wingspan: 8.5, // metres, tip to tip
  altitude: 3.6, // metres it flies the lap at
  orbitRadius: 1.12, // its lap, × the zone radius — just outside the fire
  lag: 0.42, // radians it trails the point it is burning
  idleWeight: 0.3, // how much of the authored idle runs under the flight
  flapRate: 1.2, // wing beats/second on the lap
  flapAmplitude: 0.42, // radians at the shoulder, on the lap
  climbRate: 1.28, // ...and pulling up into the tear, where it has to work
  climbAmplitude: 0.86,
  diveSweep: 0.75, // radians the wings fold back in the dive
  dihedral: 0.08, // radians the wings are held up
  bank: 0.7, // how hard it leans into a turn
  bob: 0.22, // metres the body lifts on each downstroke
  tailSway: 0.14, // radians
  neckCurl: 0.2, // radians the neck carries down in flight
  aimLimit: 1.5, // radians the neck will turn to point the mouth
  snarlJaw: 0.44, // radians the jaw drops, snarling out of the tear
  breathJaw: 0.5, // ...and to breathe
  inwardShake: 0.55, // when the fire turns inward
  inwardFlash: 0.06,
  underGlow: 0.9, // the fire's light on its belly and through its wings
  dragonRim: 0.45,
  dragonRimPower: 3.0,
  colorRim: '#ff6a24',

  /* --- 3 · the breath --- */
  breathWidth: 0.16, // metres at the lips
  breathSpread: 1.25, // metres where it lands
  breathCore: 0.34, // the white core, × the width
  breathSpeed: 19.0, // m/s the gas leaves at
  breathBend: 0.45, // how far the gas is left behind as the dragon flies
  breathNoiseScale: 1.4,
  breathShred: 1.5,
  breathIntensity: 2.0,
  breathPuffs: 110, // fire puffs/second along the jet
  splashRate: 70, // puffs/second thrown off where it lands
  breathSparks: 60, // sparks/second where it lands
  throatGlow: 1.6,
  breathLight: 32.0,
  breathShake: 0.15, // a rumble while it breathes

  /* --- 4 · the ring --- */
  ringHeight: 2.3, // metres of flame wall
  ringThick: 0.3, // metres between its two shells
  ringGrow: 0.45, // radians of lap it takes to come up to height
  ringFlare: 1.1, // how much taller it leaps where it has just caught
  ringNoiseScale: 1.2,
  ringRise: 1.8, // m/s the tongues climb
  ringShred: 1.35,
  ringIntensity: 1.7,
  ringBand: 0.55, // metres, the scorched band under it
  ringEmbers: 70, // embers/second off the lit ring
  closeShake: 0.4,
  closeFlash: 0.1,
  closeLight: 90.0,

  /* --- 5 · the spread --- */
  frontHeight: 1.9, // metres of flame on the advancing edge
  frontWobble: 0.65, // metres the edge is torn by
  frontWidth: 0.4, // metres of burning line on the floor
  frontGlow: 2.6,
  heatReach: 1.6, // metres behind the front that still burn hot
  blazeHeight: 1.45, // metres, the tongues standing in the burnt field
  blazeWidth: 1.05,
  blazeBurn: 2.0, // seconds a tongue roars before it settles
  blazeSustain: 0.35, // ...and the share of them that burn on after
  blazeLeap: 0.8, // how much taller it leaps when it catches
  blazeIntensity: 0.7,
  blazeNoiseScale: 1.6,
  fieldPuffs: 12, // fire puffs/second over the burning field
  fieldEmbers: 120, // embers/second over the burning field
  smokeRate: 16, // puffs/second
  smokeOpacity: 0.5,
  eruptionShake: 0.65,
  eruptionFlash: 0.16,
  eruptionLight: 140.0,
  eruptionEmbers: 260,

  /* --- 6 · the floor --- */
  charDark: 0.94,
  crackScale: 1.15, // plates per metre
  crackWidth: 0.05,
  crackGlow: 1.7,
  groundEmbers: 1.6,
  ash: 0.6, // pale ash flecks once it has cooled
  colorChar: '#050201',
  colorAsh: '#4b4541',
  colorHot: '#ff5f12',
  colorCrack: '#ff5c16',

  /* --- 7 · the bodies --- */
  burn: {
    stain: 1.4, // how fast a body chars, 1/s
    onset: 0.55, // seconds alight before it starts to go
    rate: 0.42, // how fast it burns away, 1/s
    flames: 34, // fire puffs/second off each burning body
    look: {
      color: '#0d0705', // charred
      rimColor: '#ff5a14', // the silhouette, glowing
      rimEmissive: 2.6,
      edgeColor: '#ffc266', // the line the burn runs along
      edgeEmissive: 7.0,
      edgeWidth: 0.16
    }
  },
  burnHit: {
    impulse: 1.6, // m/s it staggers in from the fire
    lift: 2.4,
    spin: 1.1
  },

  /* --- the aftermath --- */
  heatHaze: 0.1, // distortion over the field while it burns
  hazeHeight: 4.5, // metres
  lingerEmbers: 60, // embers/second off the cooling floor

  /* --- the fire's palette --- */
  tempCore: 3400, // K, the white-hot core
  tempEdge: 1400, // K, the deep red fringe
  emissionCurve: 2.4,
  palette: 0.35, // 0 pure radiator → 1 the four colours below
  colorCore: '#fff1c8',
  colorMid: '#ff8a1e',
  colorEdge: '#ff360a',
  colorEmber: '#2a0702',

  /* --- light --- */
  lightIntensity: 18.0, // on the dragon
  lightRadius: 12.0,
  lightColor: '#ff7a26',
  lightGutter: 0.3,
  lightGutterSpeed: 13.0,
  fieldLight: 14.0, // over the burning field
  fieldLightRadius: 16.0
};

export const cin_dragonSchema = {
  'The cast': ['range', 'minRange', 'speed', 'cooldown', 'castAnim', 'zoneRadius', 'fadeTime', 'fuseEmbers'],
  'The timing': ['portalOpen', 'arriveTime', 'traceTime', 'departTime', 'spreadDelay', 'spreadTime'],
  'The tear in the sky': ['portalHeight', 'portalBack', 'portalRadius', 'portalTilt', 'portalSpin', 'portalIntensity', 'portalVoid', 'portalShake', 'portalLight', 'portalLightRadius', 'revealWidth', 'revealGlow'],
  'The dragon': ['wingspan', 'altitude', 'orbitRadius', 'lag', 'idleWeight', 'flapRate', 'flapAmplitude', 'climbRate', 'climbAmplitude', 'diveSweep', 'dihedral', 'bank', 'bob', 'tailSway', 'neckCurl', 'aimLimit', 'snarlJaw', 'breathJaw', 'inwardShake', 'inwardFlash', 'underGlow', 'dragonRim', 'dragonRimPower', 'colorRim'],
  'The breath': ['breathWidth', 'breathSpread', 'breathCore', 'breathSpeed', 'breathBend', 'breathNoiseScale', 'breathShred', 'breathIntensity', 'breathPuffs', 'splashRate', 'breathSparks', 'throatGlow', 'breathLight', 'breathShake'],
  'The ring': ['ringHeight', 'ringThick', 'ringGrow', 'ringFlare', 'ringNoiseScale', 'ringRise', 'ringShred', 'ringIntensity', 'ringBand', 'ringEmbers', 'closeShake', 'closeFlash', 'closeLight'],
  'The spread': ['frontHeight', 'frontWobble', 'frontWidth', 'frontGlow', 'heatReach', 'blazeHeight', 'blazeWidth', 'blazeBurn', 'blazeSustain', 'blazeLeap', 'blazeIntensity', 'blazeNoiseScale', 'fieldPuffs', 'fieldEmbers', 'smokeRate', 'smokeOpacity', 'eruptionShake', 'eruptionFlash', 'eruptionLight', 'eruptionEmbers'],
  'The floor': ['charDark', 'crackScale', 'crackWidth', 'crackGlow', 'groundEmbers', 'ash', 'colorChar', 'colorAsh', 'colorHot', 'colorCrack'],
  'The aftermath': ['heatHaze', 'hazeHeight', 'lingerEmbers'],
  "The fire's palette": ['tempCore', 'tempEdge', 'emissionCurve', 'palette', 'colorCore', 'colorMid', 'colorEdge', 'colorEmber'],
  'Light': ['lightIntensity', 'lightRadius', 'lightColor', 'lightGutter', 'lightGutterSpeed', 'fieldLight', 'fieldLightRadius']
};
