// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*! Ported into VFX Armory (ext pack) from achrefelouafi/AvatarCastingAbilitiesThreeJS, MIT, Copyright (c) 2026 mohamedachrefelouafi. */
/* ================================================================== */
/* EARTH                                                               */
/* ================================================================== */
export const ext_bend_earth = {
  speed: 6.0,
  lifetime: 3.2,
  // The crust laid down along the path, before anything breaks
  crustWidth: 0.5, // metres of ground paved either side of the path
  crustDensity: 1.12, // plates per square metre multiplier
  plateSize: 1.38, // metres across, before per-plate variation
  plateThickness: 0.49,
  paintTime: 0.03, // seconds a single plate takes to surface
  // Fracturing — a crack wave trailing the head by `crackDelay`
  crackDelay: 0.84,
  crackSharpness: 0.61, // seconds the fracture snap takes
  plateTilt: 0.97, // radians a plate can heave over
  plateLift: 0.44, // metres a plate rides up on the fracture
  plateSpread: 0.19, // metres plates slide apart, opening the seams
  // Emerging rocks
  rockCount: 1.15, // density multiplier
  rockSpacing: 1.74, // metres between eruption points
  rockSize: 0.45,
  rockRandomness: 0.74,
  riseHeight: 1.68,
  riseSpeed: 4.95,
  sinkDelay: 0.48,
  tumble: 1.0,
  colorRock: '#6b5744',
  colorRockDark: '#3a2e24',
  colorMoss: '#4f6b33',
  // Ground damage
  crackWidth: 0.78,
  crackDepth: 0.85,
  groundDisplacement: 0.31,
  // Debris
  dustAmount: 0.49,
  dustLifetime: 1.3,
  dustSize: 1.58,
  debrisRate: 111,
  debrisVelocity: 9,
  debrisSize: 0.03,
  debrisLifetime: 1.6,
  pebbleRate: 40,
  // Light (earth glows faintly from the cracks)
  lightIntensity: 8,
  lightRadius: 7,
  lightColor: '#ffa855',
  glow: 1.38,
  // Impact — the tower that climbs out of the ground
  towerHeight: 6.2,
  towerWidth: 0.73,
  towerRiseTime: 1.21,
  towerHold: 2.4, // seconds standing before it sinks back
  towerRocks: 16,
  towerRockRadius: 2.0,
  shakeIntensity: 1.5,
  shakeDuration: 1.38,
  explosionFlash: 0.15,

  /* --- Armory port: fields the combined sandbox needs --- */
  range: 16, // Armory: max cast distance
  minRange: 4, // Armory: min cast distance
  cooldown: 1, // Armory
  castAnim: 'cast3', // Armory
  curveWaves: 1, // Armory: 1 = an arc, 2 = an S-curve, 3 = a double S
  curveBend: 0.22, // Armory: how far the path swings out, × its length
  curveAlternate: 1, // Armory: 1 flips the swing side on every cast
  curveSide: 1, // Armory: +1 / -1, which side the first swing takes
  curveStart: 0.6, // Armory: metres in front of the caster the path begins
  curveLift: 0 // Armory: metres the middle of the path rises off the floor
};

export const ext_bend_earthSchema = {
  'Crust': [
    ['crustWidth', 0.5, 10, 0.05, 'crust width'],
    ['crustDensity', 0.2, 3, 0.01, 'plate density'],
    ['plateSize', 0.2, 3, 0.01, 'plate size'],
    ['plateThickness', 0.02, 1, 0.01, 'plate thickness'],
    ['paintTime', 0.03, 1.5, 0.01, 'paint time']
  ],
  'Fracture': [
    ['crackDelay', 0.02, 3, 0.01, 'crack delay'],
    ['crackSharpness', 0.05, 1.5, 0.01, 'crack snap'],
    ['plateTilt', 0, 1.6, 0.01, 'plate tilt'],
    ['plateLift', 0, 1.5, 0.01, 'plate lift'],
    ['plateSpread', 0, 1.5, 0.01, 'plate spread']
  ],
  'Rocks': [
    ['rockCount', 0.1, 3, 0.01, 'rock count'],
    ['rockSpacing', 0.2, 4, 0.01, 'rock spacing'],
    ['rockSize', 0.1, 3, 0.01, 'rock size'],
    ['rockRandomness', 0, 2, 0.01, 'boulder randomness'],
    ['riseHeight', 0.1, 4, 0.01, 'rise height'],
    ['riseSpeed', 0.5, 14, 0.05, 'rise speed'],
    ['sinkDelay', 0, 4, 0.01, 'sink delay'],
    ['tumble', 0, 4, 0.01, 'tumble'],
    ['colorRock', 'rock'],
    ['colorRockDark', 'rock dark'],
    ['colorMoss', 'moss']
  ],
  'Ground damage': [
    ['crackWidth', 0, 2, 0.01, 'crack width'],
    ['crackDepth', 0, 3, 0.01, 'crack depth'],
    ['groundDisplacement', 0, 2, 0.01, 'ground displacement'],
    ['glow', 0, 4, 0.01, 'crack glow']
  ],
  'Dust & debris': [
    ['dustAmount', 0, 3, 0.01, 'dust amount'],
    ['dustLifetime', 0.2, 6, 0.05, 'dust lifetime'],
    ['dustSize', 0.1, 5, 0.01, 'dust size'],
    ['debrisRate', 0, 300, 1, 'debris rate'],
    ['debrisVelocity', 0, 20, 0.1, 'debris velocity'],
    ['debrisSize', 0.01, 0.6, 0.005, 'debris size'],
    ['debrisLifetime', 0.1, 5, 0.05, 'debris lifetime'],
    ['pebbleRate', 0, 200, 1, 'pebble rate']
  ],
  'Tower': [
    ['towerHeight', 0.5, 20, 0.05, 'tower height'],
    ['towerWidth', 0.1, 5, 0.01, 'tower width'],
    ['towerRiseTime', 0.1, 4, 0.01, 'rise time'],
    ['towerHold', 0, 8, 0.05, 'hold time'],
    ['towerRocks', 0, 60, 1, 'base rocks'],
    ['towerRockRadius', 0.2, 8, 0.05, 'base rock radius'],
    ['shakeIntensity', 0, 4, 0.01, 'shake intensity'],
    ['shakeDuration', 0.1, 4, 0.01, 'shake duration'],
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
