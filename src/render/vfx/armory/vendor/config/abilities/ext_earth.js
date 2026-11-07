// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*! Ported into VFX Armory (ext pack) from achrefelouafi/LinearAbilityExtThreeJS, MIT, Copyright (c) 2026 mohamedachrefelouafi. */
/* ================================================================== */
/* EARTHEN SPIRE — the first line cast: stone laid, then stone torn    */
/* ================================================================== */
/**
 * Three beats, in order:
 *   1. a crust of stone plates is laid down along the aimed line, surfacing
 *      flush with the floor as the front passes over them;
 *   2. a fracture wave trails the head and breaks that crust — plates
 *      heave, tip over, drop into the seams and slide apart, with
 *      boulders punched up through the cracks;
 *   3. the cast ends with a stone tower climbing out of the floor where
 *      the arrow was pointing, shouldering a ring of boulders up around
 *      its base.
 *
 * All three are real geometry (instanced plates, instanced rocks, one
 * tower mesh) so they take the scene's shadows, and everything is
 * pooled — a cast allocates nothing. The arrow indicator is the existing
 * ground arrow the sandbox already uses for line casts.
 */
export const ext_earth = {
  /* --- the cast --- */
  range: 18.0, // maximum cast distance, metres
  minRange: 0.0, // dropping it on your own feet is a legitimate play
  speed: 26.0, // how fast the crust wave races to the point, metres/second
  crackDelay: 0.35, // seconds the fracture wave trails the head by
  crackSharpness: 0.16, // how hard a plate snaps when it lets go
  crustDensity: 1.6, // multiplier on plate spacing
  crustWidth: 1.2, // width of the paved band, metres
  paintTime: 0.18, // seconds a plate takes to surface after the head
  plateSize: 0.7, // base radius of one plate, metres
  plateThickness: 0.16, // height of one plate, metres
  plateTilt: 0.33, // how hard a plate can lever up, radians
  plateLift: 0.0, // metres a plate can be thrown on fracture
  plateSpread: 0.0, // how far a plate slides apart, metres
  crackDepth: 0.33, // how far a down-falling plate can drop, × plateLift
  towerRiseTime: 0.76, // seconds the tower takes to climb out of the floor
  towerHold: 1.3, // seconds the tower stands at full height
  towerWidth: 1.35, // base half-width of the tower, metres
  towerHeight: 5.8, // full height, metres
  towerRockRadius: 1.8, // radius of the boulder ring around the tower, metres
  towerRocks: 18, // boulders in that ring (capped at MAX_ROCKS - 8)
  lifetime: 3.65, // seconds the travelling crust and the loose rocks stand
  sinkDelay: 0.22, // extra seconds a crack-side rock lingers before sinking
  cooldown: 1.4,
  castAnim: 'cast3', // which clip in `CAST_ANIMATIONS` the body throws

  /* --- where the wave leaves the caster --- */
  handHeight: 0.25, // metres above the floor (low — earth is grounded)
  handForward: 0.7, // metres in front of the caster
  handSide: 0.18, // metres to the side (+ follows `Ability#side`)

  /* --- boulders heaved up through the crust --- */
  rockCount: 14, // rough count of travelling rocks (capped at MAX_ROCKS)
  rockSpacing: 3.3, // metres between them at full density
  rockSize: 0.43, // base size of a travelling boulder, metres
  rockRandomness: 0.0, // multiplier on per-rock jitters
  tumble: 5.9, // radians/second a boulder spins about its own up axis
  riseHeight: 1.0, // how high a boulder heaves out of the floor, metres
  riseSpeed: 4.6, // how fast it arrives, boulder's own × height
  groundDisplacement: 0.2, // how much `riseHeight` is multiplied for the tower ring

  /* --- what the rock looks like --- */
  colorRock: '#7c5634', // the warm body of every stone
  colorRockDark: '#3a2618', // the shadows and the moss under it
  colorMoss: '#5a6b3a', // moss on the upward faces
  glow: 0.76, // master emissive on the hot crack seams

  /* --- the tower's glass body --- */
  /**
   * PBR glass for the tower shaft. `transmission` is the dominant control
   * (0 = opaque stone, 1 = clear glass); `roughness` controls the blur of
   * what's seen through it; `thickness` and `ior` drive the refraction; and
   * `attenuationColor`/`attenuationDistance` tint the light as it travels
   * through the body, so a deep yellow reads as a warm crystal.
   * `emissive` is a small constant glow that keeps the surface from going
   * black on the back side, and `opacity` is the standard transparency
   * multiplier that sits on top of `transmission` for the alpha sort.
   */
  glassColor: '#ffe9a8', // base tint of the glass
  glassTransmission: 0.95, // 0 = opaque, 1 = fully transmissive
  glassRoughness: 0.08, // how much the refraction blurs
  glassIor: 1.5, // index of refraction
  glassThickness: 0.45, // metres — refraction depth through the body
  glassAttenuationColor: '#ffd54a', // tint applied to refracted light
  glassAttenuationDistance: 0.4, // metres — how quickly the tint saturates
  glassOpacity: 0.55, // 0 = invisible, 1 = solid (sits on top of transmission)
  glassEmissive: '#2a1a05', // small constant glow so the back side reads
  glassEmissiveStrength: 0.4, // multiplier on `glassEmissive`

  /* --- the tower's outline glow --- */
  /**
   * A second copy of the tower geometry is rendered as an inverted-hull
   * shell: the vertex shader pushes every vertex along its world-space
   * normal by `outlineThickness` metres, the mesh is drawn with
   * `side: BackSide` and additive blending, and depth writes are off so
   * the shell never occludes the glass body. The result is a clean,
   * smooth glow that hugs the silhouette without showing the polygonal
   * facets a wireframe would expose.
   *
   * The pulse envelope is the same shape as before: a peak on impact
   * that decays exponentially into a standing hum, with a depth-modulated
   * sine riding on top so the outline *flashes* rather than just glows.
   */
  outlineColor: '#ffd54a', // the rim colour
  outlineThickness: 0.06, // metres — how far the shell sits off the body
  outlineStrength: 1.6, // master gain on the rim
  outlinePulseSpeed: 2.4, // sine rate on top of the impact envelope, Hz
  outlinePulseDepth: 0.6, // 0 = steady glow, 1 = full off-and-on flash
  outlinePulseOnImpact: 2.4, // peak brightness the moment the tower appears
  outlinePulseSettle: 0.6, // baseline once the tower is standing
  outlinePulseRampDown: 1.5, // exponential decay rate of the on-impact boost, /s

  /* --- dust and debris --- */
  dustAmount: 1.0, // master strength of the dust trail
  dustSize: 0.85,
  dustLifetime: 2.2,
  debrisSize: 0.1,
  debrisVelocity: 5.7, // metres/second debris leaves a fracture
  debrisLifetime: 1.6,
  pebbleRate: 22, // pebbles/second shed at the head
  shakeIntensity: 1.0,

  /* --- the impact --- */
  explosionFlash: 0.59, // screen flash when the tower lands
  impactShake: 0.65,
  shakeDuration: 0.9,
  castFlash: 0.06, // screen flash on release
  colorCastFlash: '#cba37a',
  colorFlash: '#e9a56c',

  /* --- dynamic light --- */
  lightIntensity: 9, // the warm light that follows the front
  lightRadius: 12,
  lightColor: '#ff9a3c',

  /* --- ground kept clear in front of the caster --- */
  startOffset: 1.8 // metres skipped before the crust begins
};

export const ext_earthSchema = {
  'The cast': [
    ['range', 2, 60, 0.1, 'max range'],
    ['minRange', 0, 10, 0.1, 'min range'],
    ['speed', 5, 120, 1, 'front speed'],
    ['cooldown', 0, 8, 0.05, 'cooldown'],
    ['castAnim', 'cast animation']
  ],
  'Where the wave leaves the caster': [
    ['handHeight', 0, 3, 0.01, 'hand height'],
    ['handForward', -1, 3, 0.01, 'hand forward'],
    ['handSide', -1.5, 1.5, 0.01, 'hand lateral'],
    ['castFlash', 0, 2, 0.01, 'flash on release'],
    ['colorCastFlash', 'release flash colour']
  ],
  'The travelling wave': [
    ['startOffset', 0, 6, 0.05, 'start offset'],
    ['crustWidth', 0.4, 8, 0.05, 'crust width'],
    ['crustDensity', 0.2, 4, 0.01, 'plate density'],
    ['paintTime', 0.02, 1, 0.005, 'plate paint time'],
    ['crackDelay', 0, 1.5, 0.01, 'fracture delay'],
    ['crackSharpness', 0.02, 1, 0.01, 'fracture snap']
  ],
  'The plates': [
    ['plateSize', 0.1, 2, 0.01, 'plate radius'],
    ['plateThickness', 0.02, 0.8, 0.005, 'plate thickness'],
    ['plateTilt', 0, 2.5, 0.01, 'max tilt'],
    ['plateLift', 0, 2, 0.01, 'lift on fracture'],
    ['plateSpread', 0, 1.5, 0.01, 'slide apart'],
    ['crackDepth', 0, 2, 0.01, 'drop into crack']
  ],
  'Travelling boulders': [
    ['rockCount', 1, 60, 1, 'count'],
    ['rockSpacing', 0.4, 6, 0.05, 'spacing'],
    ['rockSize', 0.1, 1.6, 0.01, 'base size'],
    ['rockRandomness', 0, 2, 0.01, 'randomness'],
    ['riseHeight', 0, 2, 0.01, 'rise height'],
    ['riseSpeed', 1, 12, 0.05, 'rise speed'],
    ['tumble', 0, 12, 0.05, 'tumble rate'],
    ['lifetime', 0.2, 8, 0.05, 'stand time'],
    ['sinkDelay', 0, 2, 0.01, 'sink delay']
  ],
  'The tower': [
    ['towerRiseTime', 0.1, 3, 0.01, 'rise time'],
    ['towerHold', 0, 6, 0.05, 'hold time'],
    ['towerWidth', 0.4, 4, 0.05, 'base half-width'],
    ['towerHeight', 1, 12, 0.05, 'height'],
    ['towerRockRadius', 0.5, 5, 0.05, 'boulder ring radius'],
    ['towerRocks', 4, 60, 1, 'boulder ring count'],
    ['groundDisplacement', 0.2, 3, 0.01, 'ring rock lift']
  ],
  'The rock': [
    ['glow', 0, 4, 0.01, 'hot-seam glow'],
    ['colorRock', 'rock body'],
    ['colorRockDark', 'rock shadow'],
    ['colorMoss', 'moss']
  ],
  'Tower glass body': [
    ['glassColor', 'tint'],
    ['glassTransmission', 0, 1, 0.01, 'transmission (0 = opaque)'],
    ['glassRoughness', 0, 1, 0.005, 'roughness'],
    ['glassIor', 1, 2.5, 0.005, 'index of refraction'],
    ['glassThickness', 0, 2, 0.01, 'refraction depth (m)'],
    ['glassAttenuationColor', 'refraction tint'],
    ['glassAttenuationDistance', 0.05, 4, 0.01, 'refraction tint depth (m)'],
    ['glassOpacity', 0, 1, 0.01, 'opacity (on top of transmission)'],
    ['glassEmissive', 'emissive'],
    ['glassEmissiveStrength', 0, 3, 0.01, 'emissive gain']
  ],
  'Outline glow': [
    ['outlineColor', 'rim colour'],
    ['outlineThickness', 0, 0.4, 0.005, 'shell offset (m)'],
    ['outlineStrength', 0, 5, 0.01, 'master gain'],
    ['outlinePulseSpeed', 0, 10, 0.05, 'pulse rate (Hz)'],
    ['outlinePulseDepth', 0, 1, 0.01, 'pulse depth (0 = steady)'],
    ['outlinePulseOnImpact', 0, 6, 0.05, 'impact spike peak'],
    ['outlinePulseSettle', 0, 3, 0.01, 'standing baseline'],
    ['outlinePulseRampDown', 0.05, 6, 0.05, 'spike decay rate (/s)']
  ],
  'Dust & debris': [
    ['dustAmount', 0, 3, 0.01, 'dust amount'],
    ['dustSize', 0.2, 6, 0.05, 'dust size'],
    ['dustLifetime', 0.4, 6, 0.05, 'dust life'],
    ['debrisSize', 0.1, 2, 0.01, 'debris size'],
    ['debrisVelocity', 1, 16, 0.1, 'debris speed'],
    ['debrisLifetime', 0.2, 4, 0.05, 'debris life'],
    ['pebbleRate', 0, 80, 1, 'pebble rate']
  ],
  'The impact': [
    ['explosionFlash', 0, 1.5, 0.01, 'screen flash'],
    ['impactShake', 0, 3, 0.01, 'shake amount'],
    ['shakeDuration', 0.1, 4, 0.05, 'shake duration'],
    ['shakeIntensity', 0, 3, 0.01, 'global shake scale'],
    ['colorFlash', 'flash colour']
  ]
};
