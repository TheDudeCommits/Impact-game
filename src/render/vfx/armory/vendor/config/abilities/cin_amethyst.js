// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/* ================================================================== */
/* AMETHYST VERDICT — cinematic pack                                  */
/* ================================================================== */
/*!
 * Amethyst points rise round the target, close on it and shatter.
 *
 * Ported 1:1 from the `amethyst` block of achrefelouafi/AbilityCastingThreeJS
 * (MIT, Copyright (c) 2026 mohamedachrefelouafi), `src/config/settings.js`.
 * Nested objects (`hit`, `burn`, …) drove the source's ragdoll targets; they
 * are kept so the code reads them unchanged, and the editor skips them.
 * Ranges are inferred by the editor from the shipped values.
 */
export const cin_amethyst = {
  /* --- the cast --- */
  range: 18.0,
  minRange: 0,
  speed: 48.0, // the cast's run to the target, m/s
  cooldown: 7.0,
  castAnim: 'cast2',
  zoneRadius: 3.2, // the circle round the target, metres
  snapRadius: 2.4, // how far from the cursor a body is snapped onto, metres
  fadeTime: 1.6, // seconds the circle and the dust take to go

  /* --- the timing --- */
  drawTime: 0.45, // the circle writing itself
  socketStagger: 0.07, // seconds between one socket opening and the next
  socketOpen: 0.3, // seconds a socket takes to inscribe itself
  riseTime: 0.55, // seconds a stone takes to come up out of its socket
  riseStagger: 0.08, // seconds between stones rising
  hoverTime: 0.55, // seconds they hang, charging, before they turn
  aimTime: 0.4, // seconds they take to turn their points on the body
  launchStagger: 0.09, // seconds between one stone coming and the next
  flightTime: 0.2, // seconds a stone takes to cross to the body
  finaleDelay: 0.08, // seconds after the last stone before the circle goes off
  afterTime: 0.9, // seconds the rite holds after the finale

  /* --- 1 · the circle --- */
  stones: 6, // sockets on the edge, one stone each (3–8)
  socketRadius: 0.55, // metres
  circleIntensity: 1.1,
  circleSpin: 0.5,

  /* --- 2 · the stones --- */
  stoneSize: 1.35, // metres tall
  stoneSizeVariance: 0.18,
  hoverHeight: 2.1, // metres, the middle of a hanging stone
  hoverVariance: 0.45,
  hoverBob: 0.08, // metres
  hoverSpin: 0.9, // radians/second about its own axis
  riseOvershoot: 0.25, // metres it overshoots before settling
  windup: 0.55, // metres it draws back before it comes
  tremble: 0.025, // metres, while it is drawn back
  flightSpin: 9.0, // radians/second it drills on the way in
  stopShort: 0.18, // metres short of the body's middle it breaks
  aimHeight: 0.95, // metres, where on a standing body they aim

  /* --- 3 · the crystal --- */
  stoneCloud: 1.0,
  stoneVeins: 1.0,
  stoneInner: 0.35, // light held inside, at rest
  stoneRim: 0.55,
  stoneEnv: 1.4,
  chargeGlow: 1.0, // how lit the stones get before they come

  /* --- 4 · the shattering --- */
  shards: 14, // real pieces per stone
  shardSize: 0.2, // metres
  shardSpeed: 6.5, // m/s
  shardLife: 2.4, // seconds before they melt away
  chipCount: 40, // fine chips per stone
  sparkCount: 34,
  dustCount: 6,
  impactShake: 0.14,
  impactLight: 26.0,
  hit: {
    impulse: 2.5, // the first stone takes it off its feet
    lift: 3.0,
    spin: 0.9
  },
  shove: 3.2, // m/s each later stone drives the body along its line
  shoveLift: 1.2, // m/s up with each

  /* --- 5 · the finale --- */
  finaleLift: 6.5, // m/s the body is thrown up
  finaleShards: 22,
  finaleShake: 0.5,
  finaleFlash: 0.12,
  finaleLight: 90.0,

  /* --- palette --- */
  colorDeep: '#2a0b45',
  colorStone: '#7a3aa8',
  colorPale: '#e2c6f5',
  colorGlow: '#b56bff',
  colorVein: '#fff1ff',
  colorCircle: '#9a5cff',
  colorSocket: '#e0b3ff',
  colorCharge: '#ff7af0',
  colorSpark: '#f6d9ff',
  colorDust: '#6b4a85',

  /* --- light --- */
  lightIntensity: 10.0,
  lightRadius: 9.0,
  lightColor: '#b06bff'
};

export const cin_amethystSchema = {
  'The cast': ['range', 'minRange', 'speed', 'cooldown', 'castAnim', 'zoneRadius', 'snapRadius', 'fadeTime'],
  'The timing': ['drawTime', 'socketStagger', 'socketOpen', 'riseTime', 'riseStagger', 'hoverTime', 'aimTime', 'launchStagger', 'flightTime', 'finaleDelay', 'afterTime'],
  'The circle': ['stones', 'socketRadius', 'circleIntensity', 'circleSpin'],
  'The stones': ['stoneSize', 'stoneSizeVariance', 'hoverHeight', 'hoverVariance', 'hoverBob', 'hoverSpin', 'riseOvershoot', 'windup', 'tremble', 'flightSpin', 'stopShort', 'aimHeight'],
  'The crystal': ['stoneCloud', 'stoneVeins', 'stoneInner', 'stoneRim', 'stoneEnv', 'chargeGlow'],
  'The shattering': ['shards', 'shardSize', 'shardSpeed', 'shardLife', 'chipCount', 'sparkCount', 'dustCount', 'impactShake', 'impactLight', 'shove', 'shoveLift'],
  'The finale': ['finaleLift', 'finaleShards', 'finaleShake', 'finaleFlash', 'finaleLight'],
  'Palette': ['colorDeep', 'colorStone', 'colorPale', 'colorGlow', 'colorVein', 'colorCircle', 'colorSocket', 'colorCharge', 'colorSpark', 'colorDust'],
  'Light': ['lightIntensity', 'lightRadius', 'lightColor']
};
