// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/* ================================================================== */
/* STARBREAKER LANCE — cinematic pack                                  */
/* ================================================================== */
/*!
 * Light gathers between the hands and a beam with spiralling streamers blasts into the target.
 *
 * Ported 1:1 from the `lance` block of achrefelouafi/AbilityCastingThreeJS
 * (MIT, Copyright (c) 2026 mohamedachrefelouafi), `src/config/settings.js`.
 * Nested objects (`hit`, `burn`, …) drove the source's ragdoll targets; they
 * are kept so the code reads them unchanged, and the editor skips them.
 * Ranges are inferred by the editor from the shipped values.
 */
export const cin_lance = {
  /* --- the cast --- */
  range: 22.0,
  minRange: 0,
  speed: 120.0, // the beam's head down the line, m/s
  cooldown: 5.0,
  castAnim: 'cast1',
  zoneRadius: 1.2, // the circle round the target, metres
  snapRadius: 2.4, // how far from the cursor a body is snapped onto, metres

  /* --- the timing --- */
  chargeTime: 0.42, // light drawn into the hands before the shot
  beamTime: 1.0, // seconds the beam stays on the body
  collapseTime: 0.35, // seconds it takes to be pulled into the mark
  fadeTime: 0.9, // seconds the circles take to go

  /* --- 1 · the hands --- */
  handHeight: 1.3, // metres, where the shot leaves if the rig will not say
  handForward: 0.5, // metres in front of the caster, the same
  handFollow: 0.65, // how much the beam follows the real hands, 0..1
  muzzle: 0.2, // metres it starts out in front of them
  handSize: 0.6, // radius of the star between the palms
  handIntensity: 0.7,
  handLight: 8.0,
  gatherRate: 60, // motes per second drawn in while charging
  handSigilSize: 0.7, // radius of the circle standing before the hands
  handSigilOffset: 0.35,
  handSigilIntensity: 0.6,

  /* --- 2 · the beam --- */
  coreRadius: 0.16,
  beamRadius: 0.42,
  glowRadius: 0.9,
  coreIntensity: 1.6,
  beamIntensity: 0.9,
  glowIntensity: 0.28,
  startTaper: 0.35, // its radius at the hands, × the full radius
  taperLength: 1.8, // metres it takes to open to full width
  impactBulge: 0.5, // how much it swells into the mark
  wobble: 0.03, // how much its skin boils
  streakFrequency: 0.55, // striations per metre
  streakSpeed: 34.0, // metres/second they race downrange
  pulse: 0.05,
  pulseSpeed: 22.0,
  aimHeight: 1.0, // metres, where on a standing body it lands
  trailRate: 30, // motes per second peeling off it
  arcRate: 5, // arcs per second crawling over it
  arcIntensity: 1.1,

  /* --- 3 · the streamers --- */
  ribbons: 4,
  ribbonRadius: 0.5,
  ribbonRadiusVariance: 0.45,
  ribbonTwist: 0.14, // turns per metre down the shot
  ribbonSpin: 5.0, // radians/second they wind
  ribbonWidth: 0.045,
  ribbonFlare: 1.0, // how wide they swirl round the caster, × radius
  ribbonFlareLength: 3.0, // metres it takes them to close in on the beam
  ribbonBehind: 1.6, // metres they reach back past the caster
  ribbonBulge: 0.8, // how wide they open into the blast
  ribbonIntensity: 0.75,

  /* --- 4 · the blast --- */
  novaSize: 2.4,
  novaIntensity: 1.0,
  burstSize: 2.4,
  impactSparks: 160,
  impactEmbers: 40,
  sprayRate: 120, // sparks per second off the mark while it holds
  emberRate: 30,
  impactShake: 0.3,
  impactFlash: 0.04,
  impactLight: 30.0,
  fireShake: 0.08,
  fireLight: 10.0,
  beamRumble: 0.035,
  hit: {
    impulse: 7.0,
    lift: 3.2,
    spin: 1.2
  },
  push: 9.0, // m/s² the beam drives the body along the line
  pushLift: 2.0,
  disintegrate: true, // the body burns away under the beam
  burnStart: 0.35, // fraction of the beam time before it starts to go
  burn: {
    color: '#0d1a33',
    rimColor: '#7fe6ff',
    rimEmissive: 4.0,
    edgeColor: '#e6f6ff',
    edgeEmissive: 9.0
  },

  /* --- 5 · the circle --- */
  sigilRadius: 2.6,
  sigilIntensity: 0.55,
  sigilSpin: 0.25,

  /* --- palette --- */
  colorCore: '#ffffff',
  colorBeam: '#7fe6ff',
  colorSheath: '#3d7dff',
  colorGlow: '#5a34ff',
  colorRibbonA: '#c46bff',
  colorRibbonB: '#5fd0ff',
  colorRibbonC: '#ff74d4',
  colorSparkA: '#ff9a4a',
  colorSparkB: '#ff6fd0',
  colorSparkC: '#7fd8ff',
  colorSigil: '#8fd4ff',
  colorSigilGold: '#e8c27a',

  /* --- light --- */
  lightIntensity: 7.0,
  lightRadius: 12.0,
  lightColor: '#8fc8ff'
};

export const cin_lanceSchema = {
  'The cast': ['range', 'minRange', 'speed', 'cooldown', 'castAnim', 'zoneRadius', 'snapRadius'],
  'The timing': ['chargeTime', 'beamTime', 'collapseTime', 'fadeTime'],
  'The hands': ['handHeight', 'handForward', 'handFollow', 'muzzle', 'handSize', 'handIntensity', 'handLight', 'gatherRate', 'handSigilSize', 'handSigilOffset', 'handSigilIntensity'],
  'The beam': ['coreRadius', 'beamRadius', 'glowRadius', 'coreIntensity', 'beamIntensity', 'glowIntensity', 'startTaper', 'taperLength', 'impactBulge', 'wobble', 'streakFrequency', 'streakSpeed', 'pulse', 'pulseSpeed', 'aimHeight', 'trailRate', 'arcRate', 'arcIntensity'],
  'The streamers': ['ribbons', 'ribbonRadius', 'ribbonRadiusVariance', 'ribbonTwist', 'ribbonSpin', 'ribbonWidth', 'ribbonFlare', 'ribbonFlareLength', 'ribbonBehind', 'ribbonBulge', 'ribbonIntensity'],
  'The blast': ['novaSize', 'novaIntensity', 'burstSize', 'impactSparks', 'impactEmbers', 'sprayRate', 'emberRate', 'impactShake', 'impactFlash', 'impactLight', 'fireShake', 'fireLight', 'beamRumble', 'push', 'pushLift', 'disintegrate', 'burnStart'],
  'The circle': ['sigilRadius', 'sigilIntensity', 'sigilSpin'],
  'Palette': ['colorCore', 'colorBeam', 'colorSheath', 'colorGlow', 'colorRibbonA', 'colorRibbonB', 'colorRibbonC', 'colorSparkA', 'colorSparkB', 'colorSparkC', 'colorSigil', 'colorSigilGold'],
  'Light': ['lightIntensity', 'lightRadius', 'lightColor']
};
