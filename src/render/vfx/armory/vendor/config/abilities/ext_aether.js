// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*! Ported into VFX Armory (ext pack) from achrefelouafi/LinearAbilityExtThreeJS, MIT, Copyright (c) 2026 mohamedachrefelouafi. */
/* ================================================================== */
/* TIDEWROUGHT RING — the second standing cast, and the first machine  */
/* ================================================================== */
/**
 * The gate's answer to the same question, given by an engineer instead of a
 * mason — which makes the pair the sandbox's clearest statement about
 * *animation* the way `pyre` and `glacier` are its statement about material.
 * Both build something and leave it standing. Everything that tells them
 * apart is when and where the pieces move:
 *
 *   - masonry is stacked where it stands, so the gate's stones come **up out
 *     of the floor** into slots directly above them. A machine is laid out
 *     flat and then raised, so these segments swing in out of a wide orbit
 *     **in the ground plane** (`swarmRadius`, `swarmTurns`) and the finished
 *     hoop **hinges upright** afterwards (`riseTime`, and note it is one
 *     control, because the tip-up is one motion);
 *   - the ring turns while it closes and keeps turning after (`spinTurns`,
 *     `idleSpin`) — nothing about an arch rotates;
 *   - the light in the gate hugs the frame and fogs the middle; a rift is a
 *     hole, so the light lives at the rim and `eye` takes the middle away;
 *   - and it ends by being thrown off the spindle (`scatterOut`) rather than
 *     falling down.
 *
 * The segments store no metres. Each holds where it sits along the contour as
 * a signed 0..1 — which arc, and how far round toward the crown — plus its
 * course and its dice; every angle, radius and second below is resolved
 * against this block each frame, from three ages. Drag `clear radius` on a
 * ring that has been standing for a minute and it re-forges itself around the
 * new circle; drag `stand up over` while it is halfway up and it re-poses on
 * the spot, with the clock paused.
 */
export const ext_aether = {
  /* --- the cast --- */
  range: 18.0, // maximum cast distance, metres
  minRange: 3.5, // a ring you raise on your own feet is a ring in your face
  speed: 40.0, // how fast the tide races to the site, metres/second
  cooldown: 2.8,
  castAnim: 'cast3', // which clip in `CAST_ANIMATIONS` the body throws

  /* --- where the tide leaves the caster --- */
  handHeight: 1.0, // metres above the floor
  handForward: 0.8, // metres in front of the caster
  handSide: 0.15, // metres to the side (+ follows `Ability#side`)
  castFlash: 0.14, // screen flash on release
  colorCastFlash: '#7ff0ff',

  /* --- the ring (metres) --- */
  ringRadius: 2.15, // the clear radius the horizon hangs in
  ringDepth: 0.2, // how thick the hoop is, front to back
  ringHover: 0.28, // how far the foot of the ring clears the floor
  layHeight: 0.06, // how high it lies while it is being forged
  lobes: 6, // shallow lobes around the rim — see `settings.ring`
  lobeDepth: 0.035,

  /* --- the segments --- */
  segmentSize: 0.5, // base diameter of one segment, metres
  segmentStep: 0.42, // spacing between them along the contour, metres
  courses: 1, // how many courses are stacked outward from the opening
  courseStep: 0.42, // metres between those courses
  spurs: 0, // loose blocks braced under the foot — off: the ring floats clean
  segmentRandomness: 1.0, // multiplier on every per-segment jitter
  segmentTilt: 0.13, // radians a segment can be knocked off its slot angle

  /* --- the forging --- */
  assembleTime: 1.15, // seconds from the first segment to the crown
  segmentFly: 0.55, // seconds one segment takes to swing into its slot
  swarmRadius: 3.4, // how far out it comes from, × its own slot radius
  swarmTurns: 0.42, // turns it swings through on the way in
  swarmDepth: 1.1, // how far out of the ring's plane it starts, metres
  segmentSpin: 5.0, // radians/second it tumbles while it flies
  spinTurns: 0.85, // turns the whole ring makes while it closes
  idleSpin: 0.015, // turns/second it keeps making afterwards
  lockShake: 0.05, // shake each segment locks with
  crownShake: 0.45, // extra shake when the crown seats

  /* --- standing up --- */
  riseDelay: 0.15, // seconds after the crown before the hoop lifts
  riseTime: 0.95, // seconds the tip-up takes, overshoot and settle included

  /* --- the rift --- */
  openDelay: 0.14, // seconds after it is upright before the horizon lights
  openTime: 0.55, // seconds the pool takes to fill — short, it is a surge
  closeTime: 1.4, // seconds the whole ring takes to come apart
  churn: 0.22, // how hard the filling edge boils
  spin: 0.09, // turns/second the pool shears about the eye
  twist: 1.3, // how much harder the middle turns than the rim
  turbulence: 1.6, // how hard the water reads against the deep
  noiseScale: 1.25, // features per metre across the surface
  flow: 0.61, // how fast they boil as they turn
  ripples: 3.5, // rings across the radius
  rippleSpeed: 0.5, // how fast they run *inward*
  rippleDepth: 0.45, // how much they modulate the water
  rim: 1.0, // brightness of the light hugging the segments
  rimWidth: 0.85, // how far into the pool it reaches, metres
  rimFalloff: 2.0, // how fast it gives way toward the eye
  rimHot: 1.1, // the white lip right against the stone
  eye: 0.95, // the dark at the middle — the way through
  eyeSize: 0.46, // its radius, as a fraction of the clear radius
  eyeClear: 0.55, // how much of the scene behind shows through it
  sparkle: 0.9, // motes hanging in the pool
  sparkleScale: 3.1, // how many, per metre
  halo: 2.17, // glow spilling out past the contour onto the segments
  haloWidth: 0.31, // how far it reaches, metres
  runes: 1.18, // the band of marks that lights as the ring locks
  runeCount: 14, // marks per half of the contour
  runeRadius: 0, // how far outside the contour the band sits, metres
  runeWidth: 0.01, // half-thickness of the band, metres
  runeGap: 0.21, // duty cycle of one mark, 0..1
  runeGlow: 0.14, // the same marks, burned into the stone itself
  // How far the pool reaches *under* the segments. Tuned to zero: the gate
  // needs its surface tucked behind the stones because the arch leaves gaps
  // for a bright arc to show through, and a closed hoop does not — the pool
  // stops on the contour and the churn at its edge is what hides the seam.
  overlap: 0,
  surfaceOpacity: 1.0, // how solid the pool reads (1 = nothing shows through)

  /* --- coming apart --- */
  scatterOut: 2.6, // metres the segments are flung outward
  scatterSpin: 1.2, // and tangentially, off the spindle

  /* --- colour --- */
  colorCore: '#e6ffff', // the white lip where the pool meets the stone
  colorMid: '#31d9ff', // the water — the colour of the rift itself
  colorDeep: '#03142c', // the deep between the ripples, and the eye
  colorRim: '#8ef4ff', // the light hugging the ring, the halo and the runes
  colorMetal: '#3d5468', // the segments
  colorMetalDark: '#101a26',

  /* --- motes, spray and mist --- */
  moteRate: 40, // motes/second drawn into the eye while the rift stands
  moteSize: 0.09,
  moteLife: 1.5,
  moteDraw: 2.4, // metres/second they are pulled inward at
  moteCurl: 0.55, // how much they lean into the turn on the way
  sprayRate: 26, // sparks/second breathed back out of the pool
  spraySize: 0.14,
  sprayLife: 1.1,
  sprayRise: 2.6, // metres/second they leave the surface at
  surgeSpeed: 11.0, // and how hard the surge throws them when it opens
  mistRate: 14, // cold falling out of the underside of the ring
  mistSize: 1.0,
  mistLife: 2.2,
  debrisSize: 0.09,
  debrisVelocity: 4.2,
  debrisLifetime: 1.3,

  /* --- dynamic light --- */
  lightIntensity: 13, // the cyan light the rift throws on the floor
  lightRadius: 16,
  lightColor: '#3fd8ff',
  lightFlicker: 0.14, // depth of the pool's own swell in that light

  /* --- the impact --- */
  explosionFlash: 0.38, // screen flash when the horizon lights
  shakeIntensity: 1.0,

  /* --- Armory port: fields the combined sandbox needs --- */
  zoneRadius: 2.15, // Armory: indicator radius (the ring radius)
  standTime: 8 // Armory: seconds it stands before closing itself (0 = until re-cast)
};

export const ext_aetherSchema = {
  'The cast': [
    ['range', 2, 60, 0.1, 'max range'],
    ['minRange', 0, 12, 0.1, 'min range'],
    ['speed', 5, 120, 1, 'tide speed'],
    ['cooldown', 0, 12, 0.05, 'cooldown'],
    ['castAnim', 'cast animation']
  ],
  'Where the tide leaves the caster': [
    ['handHeight', 0, 3, 0.01, 'hand height'],
    ['handForward', -1, 3, 0.01, 'hand forward'],
    ['handSide', -1.5, 1.5, 0.01, 'hand lateral'],
    ['castFlash', 0, 2, 0.01, 'flash on release'],
    ['colorCastFlash', 'release flash colour']
  ],
  'The ring (metres)': [
    ['ringRadius', 0.6, 6, 0.05, 'clear radius'],
    ['ringDepth', 0.2, 3, 0.05, 'hoop thickness'],
    ['ringHover', 0, 2, 0.01, 'clears the floor by'],
    ['layHeight', 0, 1, 0.01, 'lies at'],
    ['lobes', 0, 16, 1, 'lobes'],
    ['lobeDepth', 0, 0.3, 0.005, 'lobe depth']
  ],
  'The segments': [
    ['segmentSize', 0.1, 2, 0.01, 'segment size'],
    ['segmentStep', 0.1, 2, 0.01, 'spacing along the ring'],
    ['courses', 1, 4, 1, 'courses'],
    ['courseStep', 0.1, 1.5, 0.01, 'course spacing'],
    ['spurs', 0, 24, 1, 'spurs under the foot'],
    ['segmentTilt', 0, 1, 0.01, 'set-angle jitter'],
    ['segmentRandomness', 0, 2, 0.01, 'randomness']
  ],
  'The forging': [
    ['assembleTime', 0.1, 5, 0.05, 'first segment to crown'],
    ['segmentFly', 0.05, 2, 0.01, 'one segment swing'],
    ['swarmRadius', 1, 8, 0.05, 'comes from, x its radius'],
    ['swarmTurns', 0, 2, 0.01, 'turns on the way in'],
    ['swarmDepth', 0, 4, 0.05, 'out of plane by (m)'],
    ['segmentSpin', 0, 12, 0.05, 'tumble'],
    ['spinTurns', -4, 4, 0.01, 'closing turns'],
    ['idleSpin', -0.5, 0.5, 0.005, 'idle spin (turns/s)'],
    ['lockShake', 0, 0.6, 0.005, 'shake per segment'],
    ['crownShake', 0, 2, 0.01, 'crown shake']
  ],
  'Standing up': [
    ['riseDelay', 0, 2, 0.01, 'delay after the crown'],
    ['riseTime', 0.1, 4, 0.01, 'stand up over']
  ],
  'The rift': [
    ['openDelay', 0, 2, 0.01, 'delay after standing'],
    ['openTime', 0.05, 4, 0.01, 'surge time'],
    ['closeTime', 0.2, 5, 0.05, 'break-up time'],
    ['churn', 0, 1, 0.01, 'boil on the filling edge'],
    ['spin', -3, 3, 0.01, 'pool shear (turns/s)'],
    ['twist', 0, 6, 0.05, 'shear toward the eye'],
    ['turbulence', 0, 2, 0.01, 'water strength'],
    ['noiseScale', 0.2, 8, 0.05, 'water scale'],
    ['flow', 0, 3, 0.01, 'boil speed'],
    ['ripples', 0, 12, 0.1, 'rings across the radius'],
    ['rippleSpeed', -4, 4, 0.05, 'how fast they run in'],
    ['rippleDepth', 0, 1, 0.01, 'how deep they cut'],
    ['rim', 0, 3, 0.01, 'light at the segments'],
    ['rimWidth', 0.05, 3, 0.01, 'how far it reaches (m)'],
    ['rimFalloff', 0.2, 6, 0.05, 'its falloff'],
    ['rimHot', 0, 4, 0.01, 'white lip at the stone'],
    ['eye', 0, 2, 0.01, 'the dark at the middle'],
    ['eyeSize', 0.05, 1.2, 0.01, 'eye radius'],
    ['eyeClear', 0, 1, 0.01, 'see through the eye'],
    ['sparkle', 0, 3, 0.01, 'motes in the pool'],
    ['sparkleScale', 0.5, 10, 0.1, 'how many'],
    ['halo', 0, 4, 0.01, 'spill onto the segments'],
    ['haloWidth', 0.05, 2, 0.01, 'spill reach (m)'],
    ['overlap', 0, 1.5, 0.01, 'tucked under the stone (m)'],
    ['surfaceOpacity', 0, 1, 0.01, 'how solid it reads']
  ],
  'The runes': [
    ['runes', 0, 3, 0.01, 'band strength'],
    ['runeCount', 1, 40, 1, 'marks per half'],
    ['runeRadius', 0, 1.5, 0.01, 'band offset (m)'],
    ['runeWidth', 0.01, 0.5, 0.005, 'band thickness (m)'],
    ['runeGap', 0.02, 0.5, 0.01, 'mark duty'],
    ['runeGlow', 0, 4, 0.01, 'burned into the stone']
  ],
  'Coming apart': [
    ['scatterOut', 0, 10, 0.05, 'flung outward (m)'],
    ['scatterSpin', 0, 6, 0.05, 'and off the spindle (m)']
  ],
  'Colour': [
    ['colorCore', 'lip at the stone'],
    ['colorMid', 'the water'],
    ['colorDeep', 'the deep & the eye'],
    ['colorRim', 'rim, halo & runes'],
    ['colorMetal', 'segment body'],
    ['colorMetalDark', 'segment shadow']
  ],
  'Motes, spray & mist': [
    ['moteRate', 0, 160, 1, 'motes / second'],
    ['moteSize', 0.01, 0.6, 0.005, 'mote size'],
    ['moteLife', 0.2, 8, 0.05, 'mote life'],
    ['moteDraw', 0, 8, 0.05, 'drawn inward at'],
    ['moteCurl', 0, 2, 0.01, 'lean into the turn'],
    ['sprayRate', 0, 160, 1, 'spray / second'],
    ['spraySize', 0.01, 0.8, 0.005, 'spray size'],
    ['sprayLife', 0.2, 6, 0.05, 'spray life'],
    ['sprayRise', 0, 10, 0.05, 'leaves the pool at'],
    ['surgeSpeed', 1, 30, 0.5, 'surge speed'],
    ['mistRate', 0, 80, 1, 'mist / second'],
    ['mistSize', 0.1, 4, 0.05, 'mist size'],
    ['mistLife', 0.3, 8, 0.05, 'mist life'],
    ['debrisSize', 0.02, 1, 0.01, 'chip size'],
    ['debrisVelocity', 0.5, 14, 0.1, 'chip speed'],
    ['debrisLifetime', 0.2, 4, 0.05, 'chip life']
  ],
  'Light & impact': [
    ['lightIntensity', 0, 40, 0.1, 'light intensity'],
    ['lightRadius', 1, 40, 0.5, 'light radius'],
    ['lightFlicker', 0, 1, 0.01, 'swell depth'],
    ['lightColor', 'light colour'],
    ['explosionFlash', 0, 1.5, 0.01, 'screen flash on open'],
    ['shakeIntensity', 0, 3, 0.01, 'shake scale']
  ],
  'Armory': [
    ['zoneRadius', 0.5, 6, 0.05, 'indicator radius'],
    ['standTime', 0, 60, 0.5, 'stand time (0 = until re-cast)']
  ]
};
