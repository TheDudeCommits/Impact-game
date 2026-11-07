// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/* ================================================================== */
/* FX_LIGHTNINGSTRIKE — fxlib pack                                     */
/* ================================================================== */
/**
 * A sky strike dropped on a point: a fractal bolt with branches slams down,
 * the ground flashes, glowing cracks race out across the floor, sparks and
 * debris kick up, a shockwave ring snaps out and the camera jolts.
 *
 * Port of "lightning-vfx" by Sahil K (MIT) — the defaults below are the
 * original demo's `getDefaultParams()` values, so a fresh cast matches it 1:1.
 * Additions for the sandbox: `strikes` / `strikeInterval` / `strikeScatter`
 * (a volley of strikes inside the zone; 1 = the original single strike) and
 * the dynamic light.
 */
export const fx_lightningstrike = {
  /* --- the cast --- */
  range: 26.0, // maximum cast distance, metres
  minRange: 0.0,
  zoneRadius: 3.9, // footprint (matches the longest crack)
  speed: 900.0, // the strike is effectively instant
  lifetime: 3.7, // seconds the strike set lives (cracks fade inside this)
  fadeTime: 0.25, // seconds of light fade after that
  cooldown: 0.8,
  castAnim: 'cast2',

  /* --- volley (sandbox addition) --- */
  strikes: 1, // strikes per cast (1 = original single strike)
  strikeInterval: 0.18, // seconds between strikes
  strikeScatter: 0.6, // how far extra strikes land from the centre, × zoneRadius

  /* --- spawn / shape --- */
  spawnHeightMin: 15,
  spawnHeightMax: 24,
  spawnTopXZJitter: 1.5,
  roughnessMin: 0.42,
  roughnessMax: 0.58,
  mainFractalDepth: 6,
  altFractalDepth: 4,
  altRoughnessMult: 0.85,
  branchCountMin: 1,
  branchCountMax: 3,
  branchFFMin: 0.12,
  branchFFMax: 0.67,
  branchLengthFactorMin: 0.22,
  branchLengthFactorMax: 0.54,
  branchDropFactorMin: 0.55,
  branchDropFactorMax: 0.9,
  branchEndYJitter: 3,
  branchMinYClampOffset: 0.5,
  branchXZScaleX: 0.65,
  branchXZScaleZ: 0.45,

  /* --- bolt --- */
  mainStrandThickMult: 1.5,
  mainStrandAlphaMult: 1.0,
  altStrandThickMult: 0.55,
  altStrandAlphaMult: 0.75,
  strikeDur: 0.15, // seconds the bolt takes to reveal top → ground
  fadeDur: 1.0, // seconds it takes to fade after landing
  boltSpread: 0.01, // outward drift while it fades
  // The demo frames the strike from ~28 m; the sandbox camera sits ~12 m away,
  // so the ribbons are thinned to keep the same on-screen weight (1 = raw).
  boltWidthScale: 0.45,
  layer1Color: '#4764e1',
  layer1Thick: 0.34,
  layer1Alpha: 0.18,
  layer2Color: '#1072bd',
  layer2Thick: 0.13,
  layer2Alpha: 0.55,
  layer3Color: '#aceeff',
  layer3Thick: 0.038,
  layer3Alpha: 1.0,

  /* --- ground cracks --- */
  crackReveal: 0.22,
  crackFade: 2.8,
  crackCoreColor: '#1086c1',
  crackMidColor: '#1088bc',
  crackEdgeColor: '#4791e1',
  crackCountMin: 4,
  crackCountMax: 7,
  crackBranchDepth: 2,
  crackBranchChance: 0.72,
  crackRoughness: 0.725,
  crackOriginYOffset: 0.025,
  crackAngleJitter: 0.8,
  crackLengthMin: 0.4,
  crackLengthMax: 3.9,
  crackBranchAngleOffsetMin: 0.55,
  crackBranchAngleOffsetMax: 1.45,
  crackBranchLengthScaleMin: 0.3,
  crackBranchLengthScaleMax: 0.7,
  crackBranchStepsMin: 5,
  crackBranchStepsMax: 9,
  crackThinHW: 0.025,
  crackThinAlpha: 0.55,
  crackThickHW: 0.08,
  crackThickAlpha: 1.0,
  crackThickFadeMult: 0.6,

  /* --- sparks --- */
  sparkCountMin: 30,
  sparkCountMax: 40,
  sparkSize: 2.5,
  sparkGravity: 9.5,
  sparkDepthScale: 160,
  sparkPosJitter: 0.3,
  sparkPosYOffset: 0.1,
  sparkVelocitySpdMin: 1,
  sparkVelocitySpdMax: 6,
  sparkVelocityUpMin: 1,
  sparkVelocityUpMax: 7,
  sparkLifeMin: 0.3,
  sparkLifeMax: 1.3,
  sparkHotColor: '#ffeb8c', // vec3(1.00, 0.92, 0.55)
  sparkMidColor: '#ff6b0d', // vec3(1.00, 0.42, 0.05)
  sparkCoolColor: '#b31a00', // vec3(0.70, 0.10, 0.00)

  /* --- shockwave --- */
  shockwaveDur: 0.55,
  shockwaveAlphaMult: 0.4,
  shockwaveSize: 10, // diameter of the ring plane, metres
  shockwaveColorA: '#ffb060',
  shockwaveColorB: '#66b3ff',

  /* --- debris --- */
  debrisCountMin: 3,
  debrisCountMax: 8,
  debrisBaseYOffset: 0.15,
  debrisLifetimeMin: 1,
  debrisLifetimeMax: 2.2,
  debrisGravity: 18,
  debrisFadePower: 2,
  debrisFadeMult: 0.85,
  debrisVelocitySpdMin: 1,
  debrisVelocitySpdMax: 3.5,
  debrisVelocityUpMin: 1,
  debrisVelocityUpMax: 4,
  debrisRotationScale: 8,
  debrisWMin: 0.08,
  debrisWMax: 0.33,
  debrisHMin: 0.04,
  debrisHMax: 0.16,
  debrisBlueChance: 0.65,
  debrisBlueHueMin: 0.6,
  debrisBlueHueMax: 0.68,
  debrisBlueSat: 0.6,
  debrisBlueLightMin: 0.55,
  debrisBlueLightMax: 0.8,

  /* --- ground flash --- */
  groundFlashDur: 0.45,
  groundFlashIntensity: 0.35,
  groundFlashRadialPow: 1.2,
  groundFlashFadePow: 1.5,
  groundFlashSize: 5,
  groundFlashColor: '#4db2ff',

  /* --- screen flash + shake --- */
  overlayTint: '#6496ff',
  overlayMaxAlpha: 0.6,
  overlayDecay: 8, // 1/s — exp(-t·decay)
  shakeOnStrike: 0.55, // trauma added when the bolt lands
  shakeDecay: 2.2, // trauma lost per second

  /* --- dynamic light --- */
  lightColor: '#7fa8ff',
  lightIntensity: 6,
  lightRadius: 22,
  lightStrikeBoost: 70, // extra punch the frame the bolt lands
  lightHeight: 2.5
};

export const fx_lightningstrikeSchema = {
  'The cast': [
    ['zoneRadius', 0.5, 12, 0.05, 'footprint radius'],
    ['range', 2, 50, 0.1, 'max range'],
    ['minRange', 0, 10, 0.1, 'min range'],
    ['speed', 20, 2000, 1, 'travel speed'],
    ['lifetime', 0.5, 10, 0.05, 'strike life'],
    ['fadeTime', 0.05, 3, 0.01, 'light fade'],
    ['cooldown', 0, 8, 0.05, 'cooldown'],
    ['castAnim', 'cast animation'],
    ['strikes', 1, 5, 1, 'strikes per cast'],
    ['strikeInterval', 0, 1, 0.01, 'strike interval'],
    ['strikeScatter', 0, 1.5, 0.01, 'scatter, × footprint']
  ],
  'Bolt shape': [
    ['spawnHeightMin', 3, 30, 0.1, 'height min'],
    ['spawnHeightMax', 3, 40, 0.1, 'height max'],
    ['spawnTopXZJitter', 0, 4, 0.01, 'top jitter'],
    ['roughnessMin', 0.1, 1, 0.001, 'roughness min'],
    ['roughnessMax', 0.1, 1, 0.001, 'roughness max'],
    ['mainFractalDepth', 1, 8, 1, 'main fractal depth'],
    ['altFractalDepth', 1, 6, 1, 'branch fractal depth'],
    ['altRoughnessMult', 0.3, 1.5, 0.001, 'branch roughness'],
    ['branchCountMin', 0, 6, 1, 'branches min'],
    ['branchCountMax', 0, 6, 1, 'branches max'],
    ['branchFFMin', 0, 0.9, 0.001, 'branch start min'],
    ['branchFFMax', 0, 0.9, 0.001, 'branch start max'],
    ['branchLengthFactorMin', 0.05, 1.5, 0.001, 'branch len min'],
    ['branchLengthFactorMax', 0.05, 1.8, 0.001, 'branch len max'],
    ['branchDropFactorMin', 0.1, 1.8, 0.001, 'drop min'],
    ['branchDropFactorMax', 0.1, 2, 0.001, 'drop max'],
    ['branchEndYJitter', 0, 10, 0.1, 'end Y jitter'],
    ['branchMinYClampOffset', 0, 3, 0.01, 'min Y clamp'],
    ['branchXZScaleX', 0, 2, 0.01, 'branch X scale'],
    ['branchXZScaleZ', 0, 2, 0.01, 'branch Z scale']
  ],
  'Bolt look': [
    ['strikeDur', 0.03, 0.3, 0.001, 'strike duration'],
    ['fadeDur', 0.1, 2.5, 0.01, 'fade duration'],
    ['boltSpread', 0, 0.05, 0.0005, 'fade spread'],
    ['boltWidthScale', 0.05, 3, 0.01, 'width scale'],
    ['mainStrandThickMult', 0, 2, 0.01, 'main thickness'],
    ['mainStrandAlphaMult', 0, 2, 0.01, 'main alpha'],
    ['altStrandThickMult', 0, 2, 0.01, 'branch thickness'],
    ['altStrandAlphaMult', 0, 2, 0.01, 'branch alpha'],
    ['layer1Thick', 0.001, 1, 0.001, 'outer layer thickness'],
    ['layer1Alpha', 0, 2, 0.001, 'outer layer alpha'],
    ['layer2Thick', 0.001, 1, 0.001, 'mid layer thickness'],
    ['layer2Alpha', 0, 2, 0.001, 'mid layer alpha'],
    ['layer3Thick', 0.001, 1, 0.001, 'core thickness'],
    ['layer3Alpha', 0, 2, 0.001, 'core alpha'],
    ['layer1Color', 'outer layer'],
    ['layer2Color', 'mid layer'],
    ['layer3Color', 'core']
  ],
  'Ground cracks': [
    ['crackReveal', 0.05, 0.5, 0.001, 'reveal'],
    ['crackFade', 0.1, 6, 0.01, 'fade'],
    ['crackCountMin', 0, 16, 1, 'count min'],
    ['crackCountMax', 0, 16, 1, 'count max'],
    ['crackBranchDepth', 0, 3, 1, 'branch depth'],
    ['crackBranchChance', 0, 1, 0.01, 'branch chance'],
    ['crackRoughness', 0.05, 2, 0.001, 'roughness'],
    ['crackAngleJitter', 0, 3, 0.01, 'angle jitter'],
    ['crackLengthMin', 0.05, 8, 0.01, 'length min'],
    ['crackLengthMax', 0.05, 10, 0.01, 'length max'],
    ['crackBranchAngleOffsetMin', 0, 3, 0.01, 'branch angle min'],
    ['crackBranchAngleOffsetMax', 0, 3, 0.01, 'branch angle max'],
    ['crackBranchLengthScaleMin', 0.05, 1.5, 0.01, 'branch length min'],
    ['crackBranchLengthScaleMax', 0.05, 1.5, 0.01, 'branch length max'],
    ['crackBranchStepsMin', 1, 12, 1, 'steps min'],
    ['crackBranchStepsMax', 1, 12, 1, 'steps max'],
    ['crackThinHW', 0.002, 0.3, 0.001, 'thin half-width'],
    ['crackThinAlpha', 0, 2, 0.01, 'thin alpha'],
    ['crackThickHW', 0.002, 0.5, 0.001, 'thick half-width'],
    ['crackThickAlpha', 0, 2, 0.01, 'thick alpha'],
    ['crackThickFadeMult', 0.05, 2, 0.01, 'thick fade ×'],
    ['crackOriginYOffset', 0, 0.2, 0.001, 'hover height'],
    ['crackCoreColor', 'core'],
    ['crackMidColor', 'mid'],
    ['crackEdgeColor', 'edge']
  ],
  Sparks: [
    ['sparkCountMin', 0, 200, 1, 'count min'],
    ['sparkCountMax', 0, 200, 1, 'count max'],
    ['sparkSize', 0.2, 10, 0.01, 'size'],
    ['sparkGravity', 0, 30, 0.1, 'gravity'],
    ['sparkDepthScale', 20, 400, 1, 'depth scale'],
    ['sparkPosJitter', 0, 3, 0.01, 'position jitter'],
    ['sparkPosYOffset', 0, 2, 0.01, 'start height'],
    ['sparkVelocitySpdMin', 0, 20, 0.1, 'speed min'],
    ['sparkVelocitySpdMax', 0, 20, 0.1, 'speed max'],
    ['sparkVelocityUpMin', 0, 20, 0.1, 'up min'],
    ['sparkVelocityUpMax', 0, 20, 0.1, 'up max'],
    ['sparkLifeMin', 0.05, 3, 0.01, 'life min'],
    ['sparkLifeMax', 0.05, 3, 0.01, 'life max'],
    ['sparkHotColor', 'hot'],
    ['sparkMidColor', 'mid'],
    ['sparkCoolColor', 'cool']
  ],
  'Shockwave & ground flash': [
    ['shockwaveDur', 0.05, 2, 0.01, 'shockwave duration'],
    ['shockwaveAlphaMult', 0, 2, 0.01, 'shockwave alpha'],
    ['shockwaveSize', 1, 30, 0.1, 'shockwave size'],
    ['groundFlashDur', 0.05, 2, 0.01, 'flash duration'],
    ['groundFlashIntensity', 0, 2, 0.01, 'flash intensity'],
    ['groundFlashRadialPow', 0.1, 5, 0.01, 'flash radial falloff'],
    ['groundFlashFadePow', 0.1, 5, 0.01, 'flash fade power'],
    ['groundFlashSize', 0.5, 20, 0.1, 'flash size'],
    ['shockwaveColorA', 'shockwave start'],
    ['shockwaveColorB', 'shockwave end'],
    ['groundFlashColor', 'ground flash']
  ],
  Debris: [
    ['debrisCountMin', 0, 30, 1, 'count min'],
    ['debrisCountMax', 0, 30, 1, 'count max'],
    ['debrisLifetimeMin', 0.1, 4, 0.01, 'life min'],
    ['debrisLifetimeMax', 0.1, 4, 0.01, 'life max'],
    ['debrisGravity', 0, 40, 0.1, 'gravity'],
    ['debrisFadePower', 0.2, 6, 0.01, 'fade power'],
    ['debrisFadeMult', 0, 2, 0.01, 'brightness'],
    ['debrisVelocitySpdMin', 0, 10, 0.1, 'speed min'],
    ['debrisVelocitySpdMax', 0, 10, 0.1, 'speed max'],
    ['debrisVelocityUpMin', 0, 10, 0.1, 'up min'],
    ['debrisVelocityUpMax', 0, 10, 0.1, 'up max'],
    ['debrisRotationScale', 0, 20, 0.1, 'spin'],
    ['debrisWMin', 0.01, 1, 0.01, 'width min'],
    ['debrisWMax', 0.01, 1, 0.01, 'width max'],
    ['debrisHMin', 0.01, 1, 0.01, 'height min'],
    ['debrisHMax', 0.01, 1, 0.01, 'height max'],
    ['debrisBlueChance', 0, 1, 0.01, 'blue chance'],
    ['debrisBlueHueMin', 0, 1, 0.001, 'blue hue min'],
    ['debrisBlueHueMax', 0, 1, 0.001, 'blue hue max'],
    ['debrisBlueSat', 0, 1, 0.01, 'blue saturation'],
    ['debrisBlueLightMin', 0, 1, 0.01, 'blue light min'],
    ['debrisBlueLightMax', 0, 1, 0.01, 'blue light max']
  ],
  'Screen flash, shake & light': [
    ['overlayMaxAlpha', 0, 1, 0.01, 'screen flash'],
    ['overlayDecay', 1, 30, 0.1, 'flash decay'],
    ['shakeOnStrike', 0, 2, 0.01, 'shake'],
    ['shakeDecay', 0.2, 8, 0.05, 'shake decay'],
    ['lightIntensity', 0, 60, 0.5, 'light intensity'],
    ['lightStrikeBoost', 0, 200, 1, 'strike light punch'],
    ['lightRadius', 0.5, 60, 0.1, 'light radius'],
    ['lightHeight', 0, 10, 0.05, 'light height'],
    ['overlayTint', 'screen flash colour'],
    ['lightColor', 'light colour']
  ]
};
