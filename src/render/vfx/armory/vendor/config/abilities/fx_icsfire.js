// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/* ================================================================== */
/* FX_ICSFIRE — fxlib pack                                             */
/* ================================================================== */
/**
 * A stylised fire field erupts at the point: a column of big hand-painted
 * flame billboards roars up out of the ground while burning embers are flung
 * out in bouncing arcs, each trailing its own flame tail and a lens flare.
 *
 * Port of "three-fires" (src/fire/*.ts) by ICS INC. (MIT). The original works
 * in units where the camera sits 1000 away; every distance below is the
 * original value × 1/150, so the column is ~6 m tall at its peak. The
 * original loops forever; here the field burns for `lifetime`, embers only
 * launch while there is time left for them to land, then the column dies down
 * over `fadeTime`.
 */
export const fx_icsfire = {
  /* --- the cast --- */
  range: 24.0,
  minRange: 0.0,
  zoneRadius: 4.0, // footprint the indicator draws
  speed: 900.0, // the field ignites at once
  lifetime: 5.5, // seconds the field burns
  fadeTime: 0.9, // seconds the column takes to die down
  cooldown: 1.2,
  castAnim: 'cast2',

  /* --- central column (original: numCenter, center style) --- */
  centerCount: 160, // flame billboards in the column
  centerIgnite: 0.6, // seconds over which the column's particles first appear (original 2)
  centerLifeMin: 0.1,
  centerLifeMax: 0.7,
  centerJitter: 0.067, // start position jitter, metres
  centerRiseMin: 4.67, // upward speed, m/s
  centerRiseMax: 8.67,
  centerSpread: 2.0, // horizontal speed range ±, m/s
  centerAccel: 2.0, // horizontal acceleration range ±, m/s²
  centerAccelScale: 0.45,
  centerScaleMin: 0.55,
  centerScaleMax: 1.1,
  blurWidthStart: 1.47, // soft flames: width at birth → death, metres
  blurWidthEnd: 4.8,
  blurHeightStart: 1.87,
  blurHeightEnd: 6.0,
  blurBrightness: 0.75,
  sharpWidthStart: 0.8, // crisp flames
  sharpWidthEnd: 2.27,
  sharpHeightStart: 1.2,
  sharpHeightEnd: 3.47,
  sharpBrightness: 2.6,
  sharpEvery: 4, // every Nth particle uses the crisp texture
  colorBlurStart: '#ff6622',
  colorBlurEnd: '#990000',
  colorSharpStart: '#ffc476', // linear setRGB(1, 0.55, 0.18) as sRGB hex
  colorSharpEnd: '#ff3300',

  /* --- flying embers (original: FLIGHT) --- */
  sources: 75, // embers flung out of the field
  flightTime: 3.0, // seconds each flight lasts
  launchWindow: 2.5, // embers launch at random within this many seconds
  landRadius: 10.0, // how far they land from the centre, metres
  peakMin: 3.3, // height of the first arc, metres
  peakMax: 6.7,
  bounces: 4, // arcs per flight (CustomBounce strength 0.7 ≈ 4)
  bounceDecay: 0.5, // each arc's duration × this (height × its square)
  particleFade: 0.3, // seconds before landing the tail stops emitting
  emberFade: 1.0, // seconds before landing the ember dims out
  repeat: 1, // 1 = embers relaunch from the centre while time remains

  /* --- ember tails (original: numPerSource, source style, TRAIL) --- */
  trailCount: 40, // tail particles per ember
  trailSizeStart: 0.33, // metres
  trailSizeEnd: 0.093,
  trailBlurBrightness: 1.6,
  trailSharpBrightness: 2.4,
  trailSpeedMin: 0.4, // sideways scatter, m/s
  trailSpeedMax: 1.2,
  trailBackRatio: 0.55, // tail thrown backwards at this × the ember's speed
  trailBackMin: 2.33, // ... clamped to this range, m/s
  trailBackMax: 6.0,
  trailDrag: 5.0, // 1/s
  trailLift: 8.0, // buoyancy, m/s²
  trailAccelScale: 0.25,

  /* --- lens flares --- */
  flareSize: 0.8, // metres
  flareBrightness: 20,
  flareOpacityMin: 0.8,
  flareOpacityMax: 1.0,
  streakSize: 4.8,
  streakBrightness: 2,
  streakMax: 5,
  streakHeightMin: 3.2, // streaks appear on embers above this...
  streakHeightMax: 4.1, // ...fully by this height, metres
  streakNearIn: 0.8, // camera distance where streaks fade in
  streakNearFull: 1.47,
  streakFarStart: 4.33, // ...and fade out
  streakFarEnd: 5.67,

  /* --- ground & screen --- */
  scorchRadius: 3.2,
  scorchLife: 6.0,
  scorchIntensity: 0.8,
  colorScorch: '#140a06',
  colorScorchGlow: '#ff5a14',
  igniteFlash: 0.12,
  colorFlash: '#ff7a2a',
  igniteShake: 0.25,
  holdShake: 0.03,

  /* --- dynamic light (original: LIGHT.center) --- */
  lightColor: '#ff6622',
  lightIntensity: 26,
  lightRadius: 14,
  lightHeight: 0.53,
  lightFadeIn: 6 // 1/s — how fast the light comes up
};

export const fx_icsfireSchema = {
  'The cast': [
    ['zoneRadius', 0.5, 12, 0.05, 'footprint radius'],
    ['range', 2, 50, 0.1, 'max range'],
    ['minRange', 0, 10, 0.1, 'min range'],
    ['speed', 20, 2000, 1, 'travel speed'],
    ['lifetime', 0.5, 15, 0.05, 'burn time'],
    ['fadeTime', 0.05, 4, 0.01, 'die-down time'],
    ['cooldown', 0, 8, 0.05, 'cooldown'],
    ['castAnim', 'cast animation']
  ],
  'The column': [
    ['centerCount', 0, 400, 1, 'flames'],
    ['centerIgnite', 0, 3, 0.01, 'ignite spread'],
    ['centerLifeMin', 0.02, 2, 0.01, 'life min'],
    ['centerLifeMax', 0.02, 2, 0.01, 'life max'],
    ['centerJitter', 0, 2, 0.001, 'start jitter'],
    ['centerRiseMin', 0, 20, 0.01, 'rise min'],
    ['centerRiseMax', 0, 20, 0.01, 'rise max'],
    ['centerSpread', 0, 8, 0.01, 'sideways speed'],
    ['centerAccel', 0, 8, 0.01, 'sideways accel'],
    ['centerAccelScale', 0, 2, 0.01, 'accel scale'],
    ['centerScaleMin', 0.05, 3, 0.01, 'size scale min'],
    ['centerScaleMax', 0.05, 3, 0.01, 'size scale max'],
    ['blurWidthStart', 0, 10, 0.01, 'soft width start'],
    ['blurWidthEnd', 0, 10, 0.01, 'soft width end'],
    ['blurHeightStart', 0, 12, 0.01, 'soft height start'],
    ['blurHeightEnd', 0, 12, 0.01, 'soft height end'],
    ['blurBrightness', 0, 6, 0.01, 'soft brightness'],
    ['sharpWidthStart', 0, 10, 0.01, 'crisp width start'],
    ['sharpWidthEnd', 0, 10, 0.01, 'crisp width end'],
    ['sharpHeightStart', 0, 12, 0.01, 'crisp height start'],
    ['sharpHeightEnd', 0, 12, 0.01, 'crisp height end'],
    ['sharpBrightness', 0, 8, 0.01, 'crisp brightness'],
    ['sharpEvery', 1, 8, 1, 'crisp every Nth'],
    ['colorBlurStart', 'soft start'],
    ['colorBlurEnd', 'soft end'],
    ['colorSharpStart', 'crisp start'],
    ['colorSharpEnd', 'crisp end']
  ],
  'Flying embers': [
    ['sources', 0, 150, 1, 'embers'],
    ['flightTime', 0.3, 6, 0.01, 'flight time'],
    ['launchWindow', 0, 10, 0.05, 'launch window'],
    ['landRadius', 0, 30, 0.1, 'landing radius'],
    ['peakMin', 0, 15, 0.01, 'peak min'],
    ['peakMax', 0, 15, 0.01, 'peak max'],
    ['bounces', 1, 8, 1, 'bounces'],
    ['bounceDecay', 0.1, 0.9, 0.01, 'bounce decay'],
    ['particleFade', 0, 3, 0.01, 'tail cut-off'],
    ['emberFade', 0, 3, 0.01, 'ember dim-out'],
    ['repeat', 0, 1, 1, 'relaunch']
  ],
  'Ember tails': [
    ['trailCount', 0, 80, 1, 'particles per ember'],
    ['trailSizeStart', 0, 2, 0.001, 'size start'],
    ['trailSizeEnd', 0, 2, 0.001, 'size end'],
    ['trailBlurBrightness', 0, 6, 0.01, 'soft brightness'],
    ['trailSharpBrightness', 0, 6, 0.01, 'crisp brightness'],
    ['trailSpeedMin', 0, 5, 0.01, 'scatter min'],
    ['trailSpeedMax', 0, 5, 0.01, 'scatter max'],
    ['trailBackRatio', 0, 2, 0.01, 'throw-back ratio'],
    ['trailBackMin', 0, 15, 0.01, 'throw-back min'],
    ['trailBackMax', 0, 15, 0.01, 'throw-back max'],
    ['trailDrag', 0.1, 20, 0.1, 'drag'],
    ['trailLift', 0, 30, 0.1, 'buoyancy'],
    ['trailAccelScale', 0, 2, 0.01, 'sideways accel']
  ],
  'Lens flares': [
    ['flareSize', 0, 4, 0.01, 'flare size'],
    ['flareBrightness', 0, 60, 0.1, 'flare brightness'],
    ['flareOpacityMin', 0, 1, 0.01, 'flicker min'],
    ['flareOpacityMax', 0, 1, 0.01, 'flicker max'],
    ['streakSize', 0, 15, 0.01, 'streak size'],
    ['streakBrightness', 0, 10, 0.01, 'streak brightness'],
    ['streakMax', 0, 20, 1, 'max streaks'],
    ['streakHeightMin', 0, 10, 0.01, 'streak height min'],
    ['streakHeightMax', 0, 10, 0.01, 'streak height max'],
    ['streakNearIn', 0, 20, 0.01, 'near fade-in start'],
    ['streakNearFull', 0, 20, 0.01, 'near fade-in end'],
    ['streakFarStart', 0, 40, 0.01, 'far fade-out start'],
    ['streakFarEnd', 0, 40, 0.01, 'far fade-out end']
  ],
  'Ground, flash & light': [
    ['scorchRadius', 0, 10, 0.05, 'scorch radius'],
    ['scorchLife', 0.5, 20, 0.1, 'scorch life'],
    ['scorchIntensity', 0, 2, 0.01, 'scorch intensity'],
    ['igniteFlash', 0, 1, 0.01, 'ignite flash'],
    ['igniteShake', 0, 2, 0.01, 'ignite shake'],
    ['holdShake', 0, 0.5, 0.005, 'burn rumble'],
    ['lightIntensity', 0, 120, 0.5, 'light intensity'],
    ['lightRadius', 0.5, 50, 0.1, 'light radius'],
    ['lightHeight', 0, 5, 0.01, 'light height'],
    ['lightFadeIn', 0.5, 30, 0.1, 'light fade-in rate'],
    ['colorFlash', 'flash colour'],
    ['colorScorch', 'scorch'],
    ['colorScorchGlow', 'scorch glow'],
    ['lightColor', 'light colour']
  ]
};
