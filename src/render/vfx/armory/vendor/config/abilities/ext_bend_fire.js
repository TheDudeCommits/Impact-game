// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*! Ported into VFX Armory (ext pack) from achrefelouafi/AvatarCastingAbilitiesThreeJS, MIT, Copyright (c) 2026 mohamedachrefelouafi. */
/* ================================================================== */
/* FIRE                                                                */
/* ================================================================== */
export const ext_bend_fire = {
  speed: 11.5,
  lifetime: 2.6,
  // Flight: fire does not crawl along the drawn path, it flies above it
  flightHeight: 1.0, // cruise altitude above the ground
  flightArc: 0.29, // extra lob in the middle of the path
  // Flame body — this is a raymarched black-body volume, so these are volume
  // parameters, not surface ones. See VolumetricFireMaterial for how the four
  // layers (silhouette → vortex roll-up → turbulence → shred) stack up.
  flameWidth: 0.22, // tube radius in metres
  headSize: 1.89, // fireball radius at the head, × flameWidth
  flameHeight: 1.84, // upward stretch of the volume (buoyant elongation)
  wakeSpread: 0.19, // how far the spent gas behind the head has ballooned out
  // Metre-scale lobes in the silhouette. Without these the outline stays a
  // capsule no matter how much fine turbulence is piled on top of it, and the
  // flame reads as a shaded tube.
  bulge: 0.18, // how far those lobes swell and pinch the local radius
  bulgeScale: 0.34, // lobes per metre — lower = bigger, slower shapes
  // Ring vortices shed off the head and travelling back down the wake. This is
  // what folds the field into curling, mushrooming billows; fbm alone can only
  // make clouds.
  vortex: 0.16, // roll-up strength
  ringFrequency: 0.0, // vortices per metre of stream
  ringSpeed: 4.7, // how fast they travel backwards
  // Kept low on purpose: rolling the noise frame hard around the axis wraps
  // the filaments circumferentially and the flame reads as concentric contour
  // lines rather than as tongues running along the flow.
  flameCurl: 0.45, // swirl of the density field around the axis
  flameTurbulence: 3.2, // noise amplitude eating into the volume
  flameWarp: 0.2, // domain warp — folds the noise into curling sheets
  tongueStretch: 1.38, // < 1 stretches structures upward into licking tongues
  streamStretch: 1.31, // < 1 draws them out along the flow
  // Radial shear: how far the fringe is dragged up and back relative to the
  // axis. This is what makes the edge structures read as licking tongues
  // rather than as blobs of the same shape at every radius.
  lick: 3.1,
  wisps: 0.81, // ridged filaments shredding the fringe into strands
  shred: 1.57, // how violently the fringe tears compared to the core
  detailOctaves: 5, // turbulence octaves (quality ↔ cost)
  flameSpeed: 4.06, // how fast the field streams backwards along the path
  buoyancy: 3.09, // how fast it climbs inside the volume
  detachment: 0.9, // how hard the tail tears into separate puffs
  wakeRise: 0, // how far the far end of the wake has floated upward
  volumeDensity: 2.09,
  soot: 1.42, // absorption — how much the cool gas occludes
  coreClarity: 0.54, // extinction left in the hottest gas (low = white blob)
  volumeSteps: 35, // raymarch samples per pixel (quality ↔ cost)
  streamLength: 10.0, // how long the burning tail behind the head is
  flicker: 0.96,
  glow: 3.06,
  opacity: 0.96,
  fresnel: 1.1,
  noiseStrength: 1.55,
  noiseFrequency: 4.16,
  noiseSpeed: 1.5,
  softness: 0.42,
  // Temperature & radiance. The flame is shaded as a Planckian radiator: these
  // are the two ends of its temperature range in kelvin, and the exponent the
  // emitted power follows. 4 would be Stefan-Boltzmann; 3 is a little gentler,
  // which keeps the mid-tones off the floor at this exposure.
  tempCore: 1980,
  tempEdge: 1590,
  emissionCurve: 4.5,
  heatFocus: 0.57, // how quickly the gas reaches full temperature inside the surface
  heatFalloff: 1.86, // how sharply it cools toward that surface
  // How far the turbulence is allowed to drag the temperature profile around.
  // Radiated power goes as a high power of T, so this number is amplified
  // several-fold on screen — past ~0.5 the noise's own contour lines start
  // showing through as agate banding.
  heatFollow: 0.23,
  tailHeat: 0.28, // temperature of the spent gas at the far end of the wake
  // 0 = pure black-body physics, 1 = the hand-authored gradient below.
  paletteBlend: 0.0,
  scatter: 1.61, // firelight bouncing inside the sooty fringe
  scatterFalloff: 3.4, // how fast that bath dies away from the core
  // Colour gradient (core → mid → edge → smoke)
  colorCore: '#fff6d8',
  colorMid: '#ffb02e',
  colorEdge: '#ff3d10',
  colorSmoke: '#181616',
  // Embers
  emberCount: 1.24,
  emberRate: 210,
  emberSize: 0.075,
  emberSpeed: 4.55,
  emberLifetime: 2.75,
  // Smoke
  smokeDensity: 1.05,
  smokeSpeed: 1.28,
  smokeSize: 0.76,
  smokeLifetime: 4.75,
  // Sparks
  sparkRate: 200,
  sparkSpeed: 7.0,
  // Distortion
  heatDistortion: 0.0,
  distortionRadius: 1.6,
  // Light
  lightIntensity: 13,
  lightRadius: 12,
  lightColor: '#ff7a26',
  // Explosion
  explosionSize: 3.0,
  explosionBrightness: 2.2,
  explosionShake: 1.0,
  explosionFlash: 0.55,

  /* --- Armory port: fields the combined sandbox needs --- */
  range: 16, // Armory: max cast distance
  minRange: 4, // Armory: min cast distance
  cooldown: 0.8, // Armory
  castAnim: 'cast1', // Armory
  curveWaves: 2, // Armory: 1 = an arc, 2 = an S-curve, 3 = a double S
  curveBend: 0.24, // Armory: how far the path swings out, × its length
  curveAlternate: 1, // Armory: 1 flips the swing side on every cast
  curveSide: 1, // Armory: +1 / -1, which side the first swing takes
  curveStart: 0.6, // Armory: metres in front of the caster the path begins
  curveLift: 0 // Armory: metres the middle of the path rises off the floor
};

export const ext_bend_fireSchema = {
  'Flight': [
    ['flightHeight', 0, 8, 0.01, 'cruise height'],
    ['flightArc', 0, 5, 0.01, 'arc']
  ],
  'Flame shape': [
    ['flameWidth', 0.05, 3, 0.01, 'tube radius'],
    ['headSize', 1, 5, 0.01, 'fireball size'],
    ['flameHeight', 1, 6, 0.01, 'updraft stretch'],
    ['streamLength', 0.5, 20, 0.1, 'stream length'],
    ['wakeSpread', 0, 3, 0.01, 'wake spread'],
    ['wakeRise', 0, 3, 0.01, 'wake rise'],
    ['bulge', 0, 0.8, 0.01, 'silhouette lobes'],
    ['bulgeScale', 0.1, 2, 0.01, 'lobe frequency'],
    ['detachment', 0, 1.5, 0.01, 'tail break-up'],
    ['softness', 0.05, 1, 0.01, 'softness']
  ],
  'Turbulence': [
    ['vortex', 0, 3, 0.01, 'vortex roll-up'],
    ['ringFrequency', 0, 3, 0.01, 'vortices per metre'],
    ['ringSpeed', 0, 6, 0.01, 'vortex speed'],
    ['flameCurl', 0, 5, 0.01, 'swirl'],
    ['flameTurbulence', 0, 6, 0.01, 'turbulence'],
    ['flameWarp', 0, 2, 0.01, 'domain warp'],
    ['tongueStretch', 0.15, 2, 0.01, 'tongue stretch'],
    ['streamStretch', 0.15, 2, 0.01, 'streamwise stretch'],
    ['lick', 0, 5, 0.01, 'fringe shear'],
    ['wisps', 0, 2, 0.01, 'wisps'],
    ['shred', 0, 3, 0.01, 'fringe shred'],
    ['flameSpeed', 0, 8, 0.01, 'flow speed'],
    ['buoyancy', 0, 6, 0.01, 'buoyancy'],
    ['flicker', 0, 2, 0.01, 'flicker'],
    ['noiseStrength', 0, 3, 0.01, 'noise strength'],
    ['noiseFrequency', 0.1, 6, 0.01, 'noise frequency'],
    ['detailOctaves', 2, 5, 1, 'detail octaves']
  ],
  'Temperature & radiance': [
    ['tempCore', 1500, 6000, 10, 'core temp (K)'],
    ['tempEdge', 800, 3000, 10, 'edge temp (K)'],
    ['emissionCurve', 1, 8, 0.05, 'radiance curve'],
    ['heatFocus', 0.4, 4, 0.01, 'heat focus'],
    ['heatFalloff', 0.2, 4, 0.01, 'heat falloff'],
    ['heatFollow', 0, 1, 0.01, 'heat follows noise'],
    ['tailHeat', 0, 1.5, 0.01, 'wake temperature'],
    ['scatter', 0, 4, 0.01, 'firelight scatter'],
    ['scatterFalloff', 0.2, 8, 0.05, 'scatter falloff'],
    ['glow', 0, 10, 0.01, 'glow']
  ],
  'Volume rendering': [
    ['volumeDensity', 0, 4, 0.01, 'density'],
    ['soot', 0, 6, 0.01, 'soot absorption'],
    ['coreClarity', 0.02, 1, 0.01, 'core clarity'],
    ['opacity', 0, 2, 0.01, 'opacity'],
    ['volumeSteps', 6, 72, 1, 'raymarch steps']
  ],
  'Fire gradient': [
    ['paletteBlend', 0, 1, 0.01, 'palette vs physics'],
    ['colorCore', 'core'],
    ['colorMid', 'mid'],
    ['colorEdge', 'edge'],
    ['colorSmoke', 'smoke']
  ],
  'Embers & smoke': [
    ['emberRate', 0, 400, 1, 'ember rate'],
    ['emberCount', 0, 3, 0.01, 'ember count'],
    ['emberSize', 0.01, 0.6, 0.005, 'ember size'],
    ['emberSpeed', 0, 10, 0.05, 'ember speed'],
    ['emberLifetime', 0.1, 5, 0.05, 'ember lifetime'],
    ['sparkRate', 0, 200, 1, 'spark rate'],
    ['sparkSpeed', 0, 20, 0.1, 'spark speed'],
    ['smokeDensity', 0, 2, 0.01, 'smoke density'],
    ['smokeSpeed', 0, 5, 0.01, 'smoke speed'],
    ['smokeSize', 0.1, 5, 0.01, 'smoke size'],
    ['smokeLifetime', 0.2, 8, 0.05, 'smoke lifetime']
  ],
  'Heat & explosion': [
    ['heatDistortion', 0, 4, 0.01, 'heat distortion'],
    ['distortionRadius', 0.2, 6, 0.05, 'distortion radius'],
    ['explosionSize', 0.2, 10, 0.05, 'explosion size'],
    ['explosionBrightness', 0, 8, 0.05, 'explosion brightness'],
    ['explosionShake', 0, 3, 0.01, 'explosion shake'],
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
