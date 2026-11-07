// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*! Ported into VFX Armory (ext pack) from achrefelouafi/AvatarCastingAbilitiesThreeJS, MIT, Copyright (c) 2026 mohamedachrefelouafi. */
/* ================================================================== */
/* WIND                                                                */
/* ================================================================== */
export const ext_bend_air = {
  speed: 14.0,
  lifetime: 2.4,
  // Silk sheets — each strip is combed into `filamentCount` hairlines, so it
  // is far wider and fainter than a single-strand ribbon would be. The bundle
  // is carried by sheet width, not by winding the strips tightly, hence the
  // low vortex strength and the small spiral radius.
  ribbonCount: 3,
  ribbonWidth: 2.1,
  ribbonOpacity: 0.91,
  ribbonLength: 24.0,
  spiralRadius: 1.05,
  sheetTwist: 1.5,
  rotationSpeed: 5.5,
  vortexStrength: 1.6,
  swirlSpeed: 2.2,
  filamentCount: 28,
  // Hairlines thinner than roughly a lane-eighth cannot be resolved at the
  // sizes this effect is seen at; past that the shader melts them into a
  // sheet anyway, so pushing this higher only costs contrast.
  filamentSharpness: 0.56,
  turbulence: 0.8,
  haze: 0.22,
  noiseStrength: 0.71,
  noiseFrequency: 0.9,
  distortion: 0.08,
  fresnel: 1.36,
  opacity: 0.6,
  glow: 0.95,
  colorInner: '#f4fcff',
  colorOuter: '#b6d8ea',
  // Debris carried by the vortex
  leafCount: 52,
  leafSize: 0.07,
  leafSpin: 4.7,
  leafLifetime: 2.5,
  dustAmount: 2.14,
  dustSize: 0.06,
  dustRate: 190,
  // Light
  lightIntensity: 6,
  lightRadius: 8,
  lightColor: '#bfe8ff',
  // Impact
  tornadoHeight: 8.3,
  tornadoRadius: 2.2,
  tornadoDuration: 1.6,
  // Funnel shape. `tornadoRadius` is the radius at the *top*; the neck is the
  // fraction of that the column pinches to at the ground, which is what makes
  // the silhouette concave instead of a cone.
  tornadoNeck: 0.2,
  tornadoShells: 3,
  tornadoRoughness: 0.17,
  tornadoLean: 0.55,
  burstIntensity: 1.5,
  explosionShake: 0.42,
  explosionFlash: 0.2,

  /* --- Armory port: fields the combined sandbox needs --- */
  range: 16, // Armory: max cast distance
  minRange: 4, // Armory: min cast distance
  cooldown: 0.8, // Armory
  castAnim: 'cast1', // Armory
  curveWaves: 2, // Armory: 1 = an arc, 2 = an S-curve, 3 = a double S
  curveBend: 0.22, // Armory: how far the path swings out, × its length
  curveAlternate: 1, // Armory: 1 flips the swing side on every cast
  curveSide: 1, // Armory: +1 / -1, which side the first swing takes
  curveStart: 0.6, // Armory: metres in front of the caster the path begins
  curveLift: 0 // Armory: metres the middle of the path rises off the floor
};

export const ext_bend_airSchema = {
  'Spiral': [
    ['ribbonCount', 1, 8, 1, 'sheet count'],
    ['ribbonWidth', 0.05, 6, 0.01, 'sheet width'],
    ['ribbonOpacity', 0, 2, 0.01, 'ribbon opacity'],
    ['ribbonLength', 1, 24, 0.1, 'ribbon length'],
    ['spiralRadius', 0.05, 4, 0.01, 'spiral radius'],
    ['sheetTwist', 0, 3.14, 0.01, 'sheet roll'],
    ['rotationSpeed', 0, 20, 0.05, 'rotation speed'],
    ['vortexStrength', 0, 5, 0.01, 'vortex strength'],
    ['swirlSpeed', 0, 8, 0.01, 'swirl speed'],
    ['filamentCount', 1, 64, 1, 'hairlines/sheet'],
    ['filamentSharpness', 0, 1, 0.01, 'hairline sharpness'],
    ['turbulence', 0, 3, 0.01, 'turbulence'],
    ['haze', 0, 2, 0.01, 'vapour haze'],
    ['opacity', 0, 2, 0.01, 'opacity'],
    ['glow', 0, 5, 0.01, 'glow'],
    ['fresnel', 0, 5, 0.01, 'fresnel'],
    ['distortion', 0, 4, 0.01, 'distortion'],
    ['noiseStrength', 0, 3, 0.01, 'noise strength'],
    ['noiseFrequency', 0.1, 6, 0.01, 'noise frequency'],
    ['colorInner', 'inner colour'],
    ['colorOuter', 'outer colour']
  ],
  'Leaves & dust': [
    ['leafCount', 0, 200, 1, 'leaf count/s'],
    ['leafSize', 0.02, 0.8, 0.005, 'leaf size'],
    ['leafSpin', 0, 12, 0.05, 'leaf spin'],
    ['leafLifetime', 0.2, 6, 0.05, 'leaf lifetime'],
    ['dustAmount', 0, 3, 0.01, 'dust amount'],
    ['dustSize', 0.05, 3, 0.01, 'dust size'],
    ['dustRate', 0, 400, 1, 'dust rate']
  ],
  'Tornado': [
    ['tornadoHeight', 1, 20, 0.1, 'tornado height'],
    ['tornadoRadius', 0.2, 8, 0.05, 'tornado radius'],
    ['tornadoDuration', 0.2, 6, 0.05, 'tornado duration'],
    ['tornadoNeck', 0.04, 0.8, 0.01, 'funnel neck'],
    ['tornadoShells', 1, 4, 1, 'funnel shells'],
    ['tornadoRoughness', 0, 0.5, 0.01, 'funnel roughness'],
    ['tornadoLean', 0, 1.5, 0.01, 'funnel lean'],
    ['burstIntensity', 0, 5, 0.01, 'burst intensity'],
    ['explosionShake', 0, 3, 0.01, 'shake'],
    ['explosionFlash', 0, 2, 0.01, 'screen flash']
  ],
  'The cast': [
    ['speed', 0.5, 40, 0.1, 'speed'],
    ['lifetime', 0.2, 10, 0.1, 'lifetime'],
    ['range', 2, 40, 0.1, 'max range'],
    ['minRange', 0, 10, 0.1, 'min range'],
    ['cooldown', 0, 8, 0.05, 'cooldown'],
    ['castAnim', 'cast animation']
  ],
  'The path': [
    ['curveWaves', 0, 4, 0.5, 'waves (1 arc, 2 S)'],
    ['curveBend', 0, 0.6, 0.01, 'swing, × length'],
    ['curveAlternate', 0, 1, 1, 'alternate side'],
    ['curveSide', -1, 1, 2, 'first side'],
    ['curveStart', 0, 3, 0.05, 'start offset'],
    ['curveLift', 0, 4, 0.05, 'mid lift']
  ]
};
