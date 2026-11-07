// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*! Ported into VFX Armory (ext pack) from achrefelouafi/AvatarCastingAbilitiesThreeJS, MIT, Copyright (c) 2026 mohamedachrefelouafi. */
/* ================================================================== */
/* WATER                                                               */
/* ================================================================== */
export const ext_bend_water = {
  speed: 7.5,
  lifetime: 3.0,
  // Flight — the body surges over the drawn path rather than crawling on it
  height: 1.0, // cruise height above the ground
  surge: 0.2, // amplitude of the vertical undulation
  surgeLength: 1.82, // undulations along the body
  surgeSpeed: 4.17,
  wakeSag: 0.35, // how far the tail has dropped back toward the ground
  // Water body — this is a raymarched surface, so these are volume parameters
  // A stream, not a pipe: thin enough that the eye reads a moving body of
  // water rather than a tube, and long enough to arc across the stage.
  radius: 0.1, // tube radius in metres
  headSize: 1.9, // crest radius at the head, × radius
  crest: 1.5, // upward stretch of the cross-section
  streamLength: 12.0, // length of the body trailing the head
  waveAmplitude: 0.26, // how far the waves displace the surface
  waveFrequency: 1.8, // swells per metre along the body
  chop: 0.6, // fine noise riding on the swells
  flowSpeed: 1.9, // how fast the surface streams backwards
  noiseFrequency: 3.2,
  swirl: 0.9, // roll of the wave frame around the axis
  detail: 0.35, // fine ripple, added to the normal rather than the surface
  streamStretch: 3.4, // how far detail is drawn out along the flow
  crestSharpness: 0.1, // folded ridges — the creases between sheets
  volumeSteps: 32, // raymarch samples per pixel (quality ↔ cost)
  // Surface
  transparency: 0.68,
  depthDensity: 0.2, // how fast the tint deepens with thickness
  fresnel: 2.65,
  // The sky term carries most of the brightness; the probe fills in behind it.
  envIntensity: 1.0, // strength of the reflected HDR probe
  skyReflection: 3.0, // sky standing in where the probe is black
  specular: 1.6, // sun glint
  translucency: 2.5, // backlit glow through thin crests
  foam: 2.5,
  foamSharpness: 2.5,
  shred: 0.8, // how hard the thin rim tears into strands
  shredDepth: 0.02, // thickness below which it starts tearing, in metres
  refraction: 0.1,
  glow: 0.8,
  opacity: 1.0,
  colorDeep: '#052a45',
  colorShallow: '#2ec4d6',
  colorFoam: '#eaf9ff',
  // Spray, foam and mist. Thrown water is *mostly* droplets — many small ones
  // rather than a few large ones, which is why the rates go up as the sizes
  // come down.
  dropletRate: 320,
  dropletSize: 0.075,
  dropletSpeed: 3.1,
  dropletLifetime: 1.5,
  sprayRate: 190,
  spraySpeed: 5.4,
  foamRate: 75,
  foamSize: 0.16,
  foamLifetime: 1.3,
  mistDensity: 0.2,
  mistSize: 0.9,
  mistLifetime: 1.8,
  wakeRate: 2, // ground ripples shed under the body, per second
  // Light
  lightIntensity: 14,
  lightRadius: 10,
  lightColor: '#3aa8ff',
  // Impact
  // The splash dome is additive and feeds the bloom pass, so its intensity is
  // an exposure control, not a size control — at the old 1.5 it clipped to
  // white and swallowed the screen.
  splashSize: 2.2,
  splashIntensity: 0.6,
  crownJets: 18, // spouts thrown out of the splash ring
  rippleSize: 6.0,
  rippleSpeed: 1.0,
  foamSpread: 5.0, // radius of the foam left on the ground
  foamLingering: 3.4, // how long that foam takes to drain away
  explosionShake: 0.6,
  explosionFlash: 0.12,

  /* --- Armory port: fields the combined sandbox needs --- */
  range: 16, // Armory: max cast distance
  minRange: 4, // Armory: min cast distance
  cooldown: 0.8, // Armory
  castAnim: 'cast2', // Armory
  curveWaves: 2, // Armory: 1 = an arc, 2 = an S-curve, 3 = a double S
  curveBend: 0.26, // Armory: how far the path swings out, × its length
  curveAlternate: 1, // Armory: 1 flips the swing side on every cast
  curveSide: 1, // Armory: +1 / -1, which side the first swing takes
  curveStart: 0.6, // Armory: metres in front of the caster the path begins
  curveLift: 0 // Armory: metres the middle of the path rises off the floor
};

export const ext_bend_waterSchema = {
  'Flight': [
    ['height', 0, 4, 0.01, 'cruise height'],
    ['surge', 0, 2, 0.01, 'surge amplitude'],
    ['surgeLength', 0, 6, 0.01, 'surges along body'],
    ['surgeSpeed', 0, 10, 0.01, 'surge speed'],
    ['wakeSag', 0, 3, 0.01, 'wake sag']
  ],
  'Water body': [
    ['radius', 0.05, 3, 0.01, 'tube radius'],
    ['headSize', 1, 5, 0.01, 'crest size'],
    ['crest', 1, 4, 0.01, 'crest stretch'],
    ['streamLength', 0.5, 24, 0.1, 'body length'],
    ['waveAmplitude', 0, 1.5, 0.01, 'wave amplitude'],
    ['waveFrequency', 0.1, 8, 0.01, 'wave frequency'],
    ['chop', 0, 3, 0.01, 'chop'],
    ['flowSpeed', 0, 6, 0.01, 'flow speed'],
    ['noiseFrequency', 0.1, 6, 0.01, 'noise frequency'],
    ['swirl', 0, 4, 0.01, 'swirl'],
    ['detail', 0, 2, 0.01, 'ripple detail'],
    ['streamStretch', 0.2, 10, 0.05, 'streamwise stretch'],
    ['crestSharpness', 0, 2, 0.01, 'crest creases'],
    ['volumeSteps', 8, 64, 1, 'raymarch steps']
  ],
  'Surface': [
    ['transparency', 0, 1.5, 0.01, 'transparency'],
    ['depthDensity', 0, 4, 0.01, 'depth density'],
    ['refraction', 0, 4, 0.01, 'refraction strength'],
    ['fresnel', 0, 5, 0.01, 'fresnel'],
    ['envIntensity', 0, 4, 0.01, 'reflection'],
    ['skyReflection', 0, 3, 0.01, 'sky reflection'],
    ['specular', 0, 6, 0.01, 'sun glint'],
    ['translucency', 0, 4, 0.01, 'translucency'],
    ['foam', 0, 5, 0.01, 'foam amount'],
    ['foamSharpness', 0.2, 6, 0.01, 'foam sharpness'],
    ['shred', 0, 1.5, 0.01, 'edge break-up'],
    ['shredDepth', 0.02, 2, 0.01, 'break-up depth'],
    ['glow', 0, 6, 0.01, 'glow'],
    ['opacity', 0, 2, 0.01, 'opacity'],
    ['colorDeep', 'deep'],
    ['colorShallow', 'shallow'],
    ['colorFoam', 'foam']
  ],
  'Spray, foam & mist': [
    ['dropletRate', 0, 800, 1, 'droplet count/s'],
    ['dropletSize', 0.005, 0.5, 0.005, 'droplet size'],
    ['dropletSpeed', 0, 10, 0.05, 'droplet speed'],
    ['dropletLifetime', 0.1, 5, 0.05, 'droplet lifetime'],
    ['sprayRate', 0, 600, 1, 'spray count/s'],
    ['spraySpeed', 0, 20, 0.1, 'spray speed'],
    ['foamRate', 0, 200, 1, 'foam count/s'],
    ['foamSize', 0.05, 3, 0.01, 'foam size'],
    ['foamLifetime', 0.1, 6, 0.05, 'foam lifetime'],
    ['mistDensity', 0, 2, 0.01, 'mist density'],
    ['mistSize', 0.1, 5, 0.01, 'mist size'],
    ['mistLifetime', 0.2, 6, 0.05, 'mist lifetime'],
    ['wakeRate', 0, 30, 0.5, 'wake ripples/s']
  ],
  'Splash': [
    ['splashSize', 0.2, 12, 0.05, 'splash size'],
    ['splashIntensity', 0, 5, 0.01, 'splash intensity'],
    ['crownJets', 0, 40, 1, 'crown jets'],
    ['foamSpread', 0, 20, 0.1, 'foam spread'],
    ['foamLingering', 0.5, 12, 0.1, 'foam lifetime'],
    ['rippleSize', 0.5, 20, 0.1, 'ripple size'],
    ['rippleSpeed', 0.1, 4, 0.01, 'ripple speed'],
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
