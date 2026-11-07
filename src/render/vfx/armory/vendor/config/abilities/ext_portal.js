// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*! Ported into VFX Armory (ext pack) from achrefelouafi/LinearAbilityExtThreeJS, MIT, Copyright (c) 2026 mohamedachrefelouafi. */
/* ------------------------------------------------------------------ */
/* The gate — a built structure that stays                             */
/* ------------------------------------------------------------------ */
/**
 * VERDANT GATE — the first cast that *builds* something and leaves it there.
 *
 * Three beats: a seam races to the site, an arch of stone is constructed
 * around the opening one voussoir at a time, and the portal ignites inside
 * it and stays lit until another gate is raised.
 *
 * The stones hold no metres of their own. Each one stores where it sits along
 * the **contour** (a signed 0..1: which jamb, and how far up toward the
 * keystone), which course it is in, and its dice — every position, size and
 * angle is resolved against `gateWidth` / `gateHeight` / `stone*` below on
 * each frame. Widen the opening on a gate that is already standing and the
 * whole arch re-lays itself around the new span, keystone included, while the
 * clock is paused.
 *
 * The portal surface is one quad with the arch's exact SDF in its fragment
 * shader, so it costs one draw call whatever the opening is doing, and the
 * halo around it is the same quad drawn a second time additively.
 */
export const ext_portal = {
  /* --- the cast --- */
  range: 17.0, // maximum cast distance, metres
  minRange: 3.0, // a gate you build on your own feet is a gate in your face
  speed: 34.0, // how fast the seam races to the site, metres/second
  cooldown: 2.6,
  castAnim: 'cast2', // which clip in `CAST_ANIMATIONS` the body throws

  /* --- where the seam leaves the caster --- */
  handHeight: 0.9, // metres above the floor
  handForward: 0.75, // metres in front of the caster
  handSide: 0.2, // metres to the side (+ follows `Ability#side`)
  castFlash: 0.12, // screen flash on release
  colorCastFlash: '#9bff5a',

  /* --- the opening (metres) --- */
  gateWidth: 3.6, // clear span between the jambs
  gateHeight: 2.5, // height of the springing line — the arch starts here
  gateDepth: 0.85, // how thick the wall of stone is, front to back

  /* --- the stones --- */
  stoneSize: 0.66, // base diameter of one stone, metres
  stoneStep: 0.58, // spacing between stones along the contour, metres
  stoneCourses: 2, // how many courses are stacked outward from the opening
  stoneCourseStep: 0.52, // metres between those courses
  stoneRandomness: 1.0, // multiplier on every per-stone jitter
  stoneTilt: 0.22, // radians a stone can be knocked off its slot angle

  /* --- the construction --- */
  buildTime: 1.25, // seconds from the first stone to the keystone
  stoneFly: 0.5, // seconds one stone takes to reach its slot
  stoneStart: 1.4, // metres below the floor a stone starts from
  stoneArc: 0.9, // how far outward it bows on the way up, metres
  stoneSpin: 3.2, // radians/second it tumbles while it flies
  landShake: 0.09, // shake each stone lands with
  keystoneShake: 0.5, // extra shake when the keystone seats

  /* --- the portal --- */
  openDelay: 0.1, // seconds after the keystone before the surface lights
  openTime: 0.85, // seconds the aperture takes to flood the opening
  closeTime: 1.3, // seconds the whole gate takes to come apart
  spin: 0.22, // turns/second the wisps rotate about the focus
  twist: 1.1, // how much harder the middle turns than the edge — the shear
  focus: 0.62, // height of the vortex focus, × the springing line
  turbulence: 1.0, // how hard the wisps read against the fog
  noiseScale: 1.1, // features per metre across the surface
  flow: 0.18, // how fast they boil as they turn
  core: 0.3, // a faint glow left hanging at the focus
  coreSize: 0.5, // radius of it, as a fraction of the half-span
  column: 0.15, // the column of light standing up the middle of the doorway
  rim: 0.9, // brightness of the glow that hugs the arch
  rimWidth: 0.95, // how far into the opening it reaches, metres
  rimFalloff: 2.2, // how fast it gives way to the fog in the middle
  rimHot: 1.2, // the white lip right against the stone
  updraft: 0.6, // light streaming up the inside of the jambs
  clear: 0.85, // how far the middle opens up — 0 is a solid wall of light
  clearSize: 0.6, // radius of that clearing, as a fraction of the half-span
  clearFalloff: 0.2, // how sharply it closes back into the solid surface
  halo: 0.0, // glow spilling out past the contour onto the stones
  haloWidth: 0.7, // how far it reaches, metres
  // How far the surface reaches *under* the stones. Its own edge is the one
  // thing that gives the opening away as a quad, so it is tucked behind the
  // blocks and the edge you see is the stone's.
  overlap: 0.34,
  surfaceOpacity: 1.0, // how solid the surface reads (1 = nothing shows through)

  /* --- colour --- */
  colorCore: '#f4ffd6', // the white lip where the surface meets the stone
  colorMid: '#86e02a', // the wisps — the colour of the gate itself
  colorDeep: '#3b5138', // the fog between them: desaturated, and the middle
  colorRim: '#c9f757', // the glow hugging the arch, and the halo
  colorRock: '#6f5b41', // the stones of the arch
  colorRockDark: '#2f271c',
  colorMoss: '#4d6b30',

  /* --- motes, mist and construction dust --- */
  moteRate: 34, // glowing motes/second while the gate stands
  moteSize: 0.11,
  moteLife: 2.6,
  moteRise: 1.5, // metres/second they drift upward
  mistRate: 16, // slow haze bleeding out of the opening
  mistSize: 0.9,
  mistLife: 2.4,
  dustAmount: 1.0, // dust thrown by the construction
  dustSize: 0.8,
  dustLifetime: 1.8,
  debrisSize: 0.11,
  debrisVelocity: 4.6,
  debrisLifetime: 1.4,

  /* --- dynamic light --- */
  lightIntensity: 11, // the green light the gate throws on the floor
  lightRadius: 15,
  lightColor: '#7bff33',
  lightHeight: 1.5, // metres above the floor the light hangs
  lightFlicker: 0.12, // depth of the surface's own unrest in that light

  /* --- the impact --- */
  explosionFlash: 0.34, // screen flash when the portal lights
  shakeIntensity: 1.0,

  /* --- Armory port: fields the combined sandbox needs --- */
  zoneRadius: 1.8, // Armory: indicator radius (half the clear span)
  standTime: 8 // Armory: seconds it stands before closing itself (0 = until re-cast)
};

export const ext_portalSchema = {
  'The cast': [
    ['range', 2, 60, 0.1, 'max range'],
    ['minRange', 0, 12, 0.1, 'min range'],
    ['speed', 5, 120, 1, 'seam speed'],
    ['cooldown', 0, 12, 0.05, 'cooldown'],
    ['castAnim', 'cast animation']
  ],
  'Where the seam leaves the caster': [
    ['handHeight', 0, 3, 0.01, 'hand height'],
    ['handForward', -1, 3, 0.01, 'hand forward'],
    ['handSide', -1.5, 1.5, 0.01, 'hand lateral'],
    ['castFlash', 0, 2, 0.01, 'flash on release'],
    ['colorCastFlash', 'release flash colour']
  ],
  'The opening (metres)': [
    ['gateWidth', 1, 10, 0.05, 'clear span'],
    ['gateHeight', 0.6, 8, 0.05, 'springing line'],
    ['gateDepth', 0.2, 3, 0.05, 'wall thickness']
  ],
  'The stones': [
    ['stoneSize', 0.15, 2, 0.01, 'block size'],
    ['stoneStep', 0.15, 2, 0.01, 'spacing along the arch'],
    ['stoneCourses', 1, 4, 1, 'courses'],
    ['stoneCourseStep', 0.1, 1.5, 0.01, 'course spacing'],
    ['stoneTilt', 0, 1, 0.01, 'set-angle jitter'],
    ['stoneRandomness', 0, 2, 0.01, 'randomness']
  ],
  'The construction': [
    ['buildTime', 0.1, 5, 0.05, 'first stone to keystone'],
    ['stoneFly', 0.1, 2, 0.01, 'one stone flight'],
    ['stoneStart', 0.2, 4, 0.05, 'starts below floor'],
    ['stoneArc', 0, 3, 0.05, 'bows out by'],
    ['stoneSpin', 0, 10, 0.05, 'tumble'],
    ['landShake', 0, 0.6, 0.005, 'shake per stone'],
    ['keystoneShake', 0, 2, 0.01, 'keystone shake']
  ],
  'The portal': [
    ['openDelay', 0, 2, 0.01, 'delay after keystone'],
    ['openTime', 0.1, 4, 0.01, 'aperture flood time'],
    ['closeTime', 0.2, 5, 0.05, 'collapse time'],
    ['spin', -3, 3, 0.01, 'wisp spin (turns/s)'],
    ['twist', 0, 6, 0.05, 'shear toward the middle'],
    ['focus', 0, 1.5, 0.01, 'focus height, x spring'],
    ['turbulence', 0, 2, 0.01, 'wisp strength'],
    ['noiseScale', 0.2, 8, 0.05, 'wisp scale'],
    ['flow', 0, 3, 0.01, 'boil speed'],
    ['core', 0, 4, 0.01, 'glow at the focus'],
    ['coreSize', 0.05, 1.5, 0.01, 'its radius'],
    ['column', 0, 3, 0.01, 'column up the middle'],
    ['rim', 0, 3, 0.01, 'glow hugging the arch'],
    ['rimWidth', 0.05, 3, 0.01, 'how far it reaches (m)'],
    ['rimFalloff', 0.2, 6, 0.05, 'its falloff'],
    ['rimHot', 0, 4, 0.01, 'white lip at the stone'],
    ['updraft', 0, 3, 0.01, 'light up the jambs'],
    ['clear', 0, 1, 0.01, 'see through the middle'],
    ['clearSize', 0.05, 1.5, 0.01, 'clearing radius'],
    ['clearFalloff', 0.2, 5, 0.05, 'clearing falloff'],
    ['halo', 0, 4, 0.01, 'spill onto the stones'],
    ['haloWidth', 0.05, 2, 0.01, 'spill reach (m)'],
    ['overlap', 0, 1.5, 0.01, 'tucked under the stones (m)'],
    ['surfaceOpacity', 0, 1, 0.01, 'how solid it reads']
  ],
  'Colour': [
    ['colorCore', 'vortex centre'],
    ['colorMid', 'the gate itself'],
    ['colorDeep', 'between the bands'],
    ['colorRim', 'contour & halo'],
    ['colorRock', 'stone body'],
    ['colorRockDark', 'stone shadow'],
    ['colorMoss', 'moss']
  ],
  'Motes, mist & dust': [
    ['moteRate', 0, 160, 1, 'motes / second'],
    ['moteSize', 0.01, 0.6, 0.005, 'mote size'],
    ['moteLife', 0.3, 8, 0.05, 'mote life'],
    ['moteRise', 0, 6, 0.05, 'mote rise speed'],
    ['mistRate', 0, 80, 1, 'mist / second'],
    ['mistSize', 0.1, 4, 0.05, 'mist size'],
    ['mistLife', 0.3, 8, 0.05, 'mist life'],
    ['dustAmount', 0, 3, 0.01, 'build dust'],
    ['dustSize', 0.2, 4, 0.05, 'dust size'],
    ['dustLifetime', 0.2, 5, 0.05, 'dust life'],
    ['debrisSize', 0.02, 1, 0.01, 'chip size'],
    ['debrisVelocity', 0.5, 14, 0.1, 'chip speed'],
    ['debrisLifetime', 0.2, 4, 0.05, 'chip life']
  ],
  'Light & impact': [
    ['lightIntensity', 0, 40, 0.1, 'light intensity'],
    ['lightRadius', 1, 40, 0.5, 'light radius'],
    ['lightHeight', 0, 5, 0.05, 'light height'],
    ['lightFlicker', 0, 1, 0.01, 'flicker depth'],
    ['lightColor', 'light colour'],
    ['explosionFlash', 0, 1.5, 0.01, 'screen flash on open'],
    ['shakeIntensity', 0, 3, 0.01, 'shake scale']
  ],
  'Armory': [
    ['zoneRadius', 0.5, 6, 0.05, 'indicator radius'],
    ['standTime', 0, 60, 0.5, 'stand time (0 = until re-cast)']
  ]
};
