// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/* ================================================================== */
/* STORMHEART GYROSCOPE — cinematic pack                                  */
/* ================================================================== */
/*!
 * A gyroscope condenses over the circle and strikes everyone inside with lightning.
 *
 * Ported 1:1 from the `gyro` block of achrefelouafi/AbilityCastingThreeJS
 * (MIT, Copyright (c) 2026 mohamedachrefelouafi), `src/config/settings.js`.
 * Nested objects (`hit`, `burn`, …) drove the source's ragdoll targets; they
 * are kept so the code reads them unchanged, and the editor skips them.
 * Ranges are inferred by the editor from the shipped values.
 */
export const cin_gyro = {
  /* --- the cast --- */
  range: 20.0,
  minRange: 0,
  speed: 34.0, // the arc's run along the floor, m/s
  cooldown: 8.0,
  castAnim: 'cast2',
  zoneRadius: 6.0, // the circle it claims, metres
  fuseSparks: 160, // sparks/second off the running arc
  fuseArcs: 18, // arcs/second licking back along it

  /* --- the timing --- */
  summonTime: 1.6, // sigil, shaft, and the gyroscope condensing
  chargeTime: 1.1, // the rune lighting up
  stormTime: 5.0, // the strikes
  overloadTime: 0.9, // the discharge
  departTime: 1.2, // burning back into the rune

  /* --- 1 · the summoning --- */
  size: 3.4, // metres tall, stand to crown — it stands on the floor
  arriveDrop: 2.6, // metres over its stand it condenses at, before it drops
  landAt: 0.82, // fraction of the summoning at which the stand hits the floor
  departRise: 0.0, // metres it lifts as it leaves
  revealWidth: 0.22, // metres of violet fire on the condensing front
  revealGlow: 4.5,
  revealColor: '#a46bff',
  columnRadius: 2.0,
  columnIntensity: 1.1,
  moteRate: 220, // motes/second spiralling in
  moteSize: 0.09,
  moteSwirl: 3.2, // radians/second they turn as they fall in
  formShake: 0.4, // the stand hitting the floor
  formFlash: 0.06,

  /* --- 2 · the construct --- */
  spinRate: 1.0, // × the authored spin, at rest
  spinSummon: 5.0, // ...while it condenses
  spinStorm: 1.8, // ...in the storm
  spinDepart: 7.0, // ...as it leaves
  strikeKick: 2.5, // extra spin on each strike
  yawSpeed: 0.12, // radians/second the whole thing turns on its stand
  sway: 0.0, // radians — it stands, so none by default
  bobAmplitude: 0.0,
  bobRate: 0.35,
  rimColor: '#9a6bff',
  rimStrength: 0.2,
  rimPower: 3.2,
  gemGlow: 3.0, // how hard the amethyst lights with the charge

  /* --- 3 · the core --- */
  coreSize: 3.2, // metres across, fully charged
  coreIntensity: 1.6,
  coreRays: 7,
  coreFlicker: 0.35,
  starRate: 90, // stars/second born round it
  starSize: 0.16,
  starReach: 1.1, // × the ring radius
  crawlRate: 9, // arcs/second from the core out to the rings
  chargeRumble: 0.05,

  /* --- 4 · the sigil --- */
  sigilIntensity: 1.1,
  sigilSpin: 0.35,
  sigilFill: 0.14,

  /* --- 5 · the strikes --- */
  strikeInterval: 0.45, // seconds between strikes
  chainJumps: 1, // bodies a bolt jumps on to after the first
  chainRange: 4.5, // metres a jump reaches
  chainDelay: 0.12, // seconds between links
  idleStrikeRate: 2.4, // floor strikes/second with nobody left to hit
  aimHeight: 0.6, // × body height
  boltWidth: 0.15, // metres, half-width of the ribbon
  boltCore: 0.16, // the white spine, × the width
  boltJag: 0.2,
  boltArch: 0.12,
  boltForks: 3,
  boltLife: 0.38,
  boltLeader: 0.045, // seconds the leader takes to reach the mark
  boltRestrikes: 3,
  boltIntensity: 3.0,
  impactSparks: 46,
  strikeShake: 0.22,
  strikeFlash: 0.05,
  strikeLight: 60.0,
  strikeLightRadius: 9.0,
  hit: {
    impulse: 8.5,
    lift: 4.0,
    spin: 1.6
  },

  /* --- 6 · the overload --- */
  novaBolts: 10,
  novaShake: 0.6,
  novaFlash: 0.16,
  novaLight: 120.0,

  /* --- palette --- */
  colorCore: '#ffffff',
  colorBolt: '#dccbff',
  colorGlow: '#7b3dff',
  colorArc: '#62d6ff',
  colorStar: '#efe4ff',
  colorSigil: '#9b6bff',
  colorSigilGold: '#ffcf7a',

  /* --- light --- */
  lightIntensity: 11.0, // at the core
  lightRadius: 12.0,
  lightColor: '#a77bff',
  lightGutter: 0.35
};

export const cin_gyroSchema = {
  'The cast': ['range', 'minRange', 'speed', 'cooldown', 'castAnim', 'zoneRadius', 'fuseSparks', 'fuseArcs'],
  'The timing': ['summonTime', 'chargeTime', 'stormTime', 'overloadTime', 'departTime'],
  'The summoning': ['size', 'arriveDrop', 'landAt', 'departRise', 'revealWidth', 'revealGlow', 'revealColor', 'columnRadius', 'columnIntensity', 'moteRate', 'moteSize', 'moteSwirl', 'formShake', 'formFlash'],
  'The construct': ['spinRate', 'spinSummon', 'spinStorm', 'spinDepart', 'strikeKick', 'yawSpeed', 'sway', 'bobAmplitude', 'bobRate', 'rimColor', 'rimStrength', 'rimPower', 'gemGlow'],
  'The core': ['coreSize', 'coreIntensity', 'coreRays', 'coreFlicker', 'starRate', 'starSize', 'starReach', 'crawlRate', 'chargeRumble'],
  'The sigil': ['sigilIntensity', 'sigilSpin', 'sigilFill'],
  'The strikes': ['strikeInterval', 'chainJumps', 'chainRange', 'chainDelay', 'idleStrikeRate', 'aimHeight', 'boltWidth', 'boltCore', 'boltJag', 'boltArch', 'boltForks', 'boltLife', 'boltLeader', 'boltRestrikes', 'boltIntensity', 'impactSparks', 'strikeShake', 'strikeFlash', 'strikeLight', 'strikeLightRadius'],
  'The overload': ['novaBolts', 'novaShake', 'novaFlash', 'novaLight'],
  'Palette': ['colorCore', 'colorBolt', 'colorGlow', 'colorArc', 'colorStar', 'colorSigil', 'colorSigilGold'],
  'Light': ['lightIntensity', 'lightRadius', 'lightColor', 'lightGutter']
};
