// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/* ================================================================== */
/* WILDROOT RELIQUARY — cinematic pack                                  */
/* ================================================================== */
/*!
 * Roots arch over the target, hang it in a ring of runestones and drag it into the earth.
 *
 * Ported 1:1 from the `reliquary` block of achrefelouafi/AbilityCastingThreeJS
 * (MIT, Copyright (c) 2026 mohamedachrefelouafi), `src/config/settings.js`.
 * Nested objects (`hit`, `burn`, …) drove the source's ragdoll targets; they
 * are kept so the code reads them unchanged, and the editor skips them.
 * Ranges are inferred by the editor from the shipped values.
 */
export const cin_reliquary = {
  /* --- the cast --- */
  range: 18.0,
  minRange: 0,
  speed: 30.0, // the seed's run to the target, m/s
  cooldown: 9.0,
  castAnim: 'cast3',
  zoneRadius: 3.0, // the sigil round the target, metres
  snapRadius: 2.4, // how far from the cursor a body is snapped onto, metres
  fadeTime: 2.4, // seconds the sapling and the sigil take to go

  /* --- the timing --- */
  drawTime: 0.6, // the sigil writing itself
  archAt: 0.2, // the great roots break the floor
  archGrow: 1.15, // seconds they take to climb over
  haloAt: 0.85, // the first slab comes up
  haloRise: 0.75, // seconds a slab takes to rise into place
  haloStagger: 0.1, // seconds between slabs
  cubeStagger: 0.035, // seconds between cubes
  bindAt: 1.55, // the tendrils come up for the body
  whipTime: 0.42, // seconds they take to reach it
  wrapTime: 0.3, // seconds to wind round the limb
  hoistTime: 0.95, // seconds to haul it up into the ring
  igniteAt: 2.75, // the runes start to light
  igniteTime: 1.5, // seconds to light the whole ring
  finaleDelay: 0.25, // after the last rune, before the cubes dive
  diveTime: 0.38, // seconds the cubes take to dive into it
  dragTime: 0.7, // seconds to drag it under
  witherDelay: 0.45,
  witherTime: 1.9, // seconds the roots take to draw back into the floor
  saplingGrow: 1.3,

  /* --- 1 · the sigil --- */
  sigilIntensity: 1.0,
  sigilSpin: 0.5,

  /* --- 2 · the arch --- */
  archSpan: 2.7, // metres from the body to each foot
  archHeight: 4.7, // metres to the apex
  archBehind: 0.35, // metres the arch stands behind the body
  archRadius: 0.3, // metres, at the foot
  archTipRadius: 0.07,
  archFlare: 0.9, // how much the foot swells
  archTwist: 0.55, // turns per metre the strands braid at
  archTwine: 0.3, // metres each leans off the plane, crossing over the top
  archSway: 0.05, // metres
  vines: 1, // wound round each great root (0–2)
  vineRadius: 0.06,
  vineTurns: 0.45, // turns per metre
  curls: 8, // tendrils curling off the arch (0–8)
  curlLength: 1.25, // metres
  curlRadius: 0.06,
  groundRoots: 4, // crawling out of the feet (0–4)
  groundLength: 1.9,
  eruptShake: 0.22,

  /* --- 3 · the bark and the leaves --- */
  barkBump: 0.1,
  moss: 0.22,
  lichen: 0.35,
  veinGlow: 1.0, // light in the crevices
  sapGlow: 1.0, // the sap pulses, once the runes are lit
  sapSpeed: 1.0,
  tipGlow: 5.0, // the growing tip
  barkRim: 0.35,
  barkEnv: 0.15, // how much of the hall the bark reflects
  taper: 0.55, // metres the tip tapers over
  leafSize: 0.3, // metres
  leafTranslucency: 1.0,

  /* --- 4 · the reliquary --- */
  haloHeight: 2.35, // metres, the middle of the ring
  haloRadius: 1.8, // metres, the outside of the slabs
  haloSpan: 296, // degrees the slabs are spread over, open at the bottom
  haloSway: 0.08, // radians it rocks
  slabs: 4, // (2–5)
  slabThickness: 1.0, // × the cut thickness
  slabDropStagger: 0.08, // seconds between slabs falling
  sinkSpeed: 0.25, // × the radius per second, once fallen
  cubes: 13, // (0–16)
  cubeRadius: 1.12, // metres
  cubeSize: 0.21, // metres
  cubeSpan: 240, // degrees the cubes are spread over
  cubeTumble: 0.55, // radians/second
  converge: 0.22, // how far they close in as the runes light

  /* --- 5 · the stone --- */
  patina: 0.4,
  glyphGlow: 1.0,
  carveDepth: 1.0,
  stoneRim: 0.45,
  stoneEnv: 1.1,
  auraIntensity: 1.0,

  /* --- 6 · the binding --- */
  sproutRadius: 1.25, // metres from the body the tendrils come up
  tendrilRadius: 0.055,
  wrapTurns: 2.6,
  wrapRadius: 0.07, // metres off the bone
  spreadArms: 0.82, // metres out from the middle
  armsUp: 0.6, // metres above the middle of the ring
  spreadLegs: 0.3,
  legsDown: 0.95, // metres below it
  bindShake: 0.12,
  overgrow: 1.0, // how far the bark takes the body
  hit: {
    impulse: 0.6, // the first bite takes it off its feet
    lift: 2.4,
    spin: 0.3
  },
  look: {
    color: '#1d1810', // bark
    rimColor: '#3fffd0', // the silhouette, lit by the sap
    rimEmissive: 2.2,
    edgeColor: '#b8fff0', // the line it goes under along
    edgeEmissive: 6.0,
    edgeWidth: 0.08
  },

  /* --- 7 · the reclamation --- */
  dragDepth: 2.6, // metres it is dragged under
  finaleLeaves: 110,
  finaleSpores: 150,
  finaleDirt: 14,
  finaleShake: 0.55,
  finaleFlash: 0.12,
  finaleLight: 80.0,

  /* --- 8 · the sapling --- */
  saplingHeight: 1.1, // metres (0 for none)
  saplingRadius: 0.05,
  saplingGlow: 1.0,

  /* --- 9 · the air --- */
  sporeRate: 70,
  leafFall: 14,

  /* --- palette --- */
  colorBarkDark: '#2a2119',
  colorBark: '#7d6c5b',
  colorMoss: '#5c8a2c',
  colorLichen: '#2fb8a8',
  colorVine: '#4f7a2a',
  colorVein: '#3fffd0',
  colorTip: '#e6fff8',
  colorDry: '#5b5248',
  colorLeaf: '#7fd23c',
  colorLeafDark: '#24561a',
  colorStoneDark: '#151c1c',
  colorStone: '#3d4a48',
  colorPatina: '#2a9e94',
  colorGlyph: '#cfe9e4',
  colorGlyphHot: '#bffff4',
  colorSigil: '#2fe6c4',
  colorAura: '#1fbfa5',
  colorDirt: '#3a3026',

  /* --- light --- */
  lightIntensity: 12.0,
  lightRadius: 11.0,
  lightColor: '#3fffd0'
};

export const cin_reliquarySchema = {
  'The cast': ['range', 'minRange', 'speed', 'cooldown', 'castAnim', 'zoneRadius', 'snapRadius', 'fadeTime'],
  'The timing': ['drawTime', 'archAt', 'archGrow', 'haloAt', 'haloRise', 'haloStagger', 'cubeStagger', 'bindAt', 'whipTime', 'wrapTime', 'hoistTime', 'igniteAt', 'igniteTime', 'finaleDelay', 'diveTime', 'dragTime', 'witherDelay', 'witherTime', 'saplingGrow'],
  'The sigil': ['sigilIntensity', 'sigilSpin'],
  'The arch': ['archSpan', 'archHeight', 'archBehind', 'archRadius', 'archTipRadius', 'archFlare', 'archTwist', 'archTwine', 'archSway', 'vines', 'vineRadius', 'vineTurns', 'curls', 'curlLength', 'curlRadius', 'groundRoots', 'groundLength', 'eruptShake'],
  'The bark and the leaves': ['barkBump', 'moss', 'lichen', 'veinGlow', 'sapGlow', 'sapSpeed', 'tipGlow', 'barkRim', 'barkEnv', 'taper', 'leafSize', 'leafTranslucency'],
  'The reliquary': ['haloHeight', 'haloRadius', 'haloSpan', 'haloSway', 'slabs', 'slabThickness', 'slabDropStagger', 'sinkSpeed', 'cubes', 'cubeRadius', 'cubeSize', 'cubeSpan', 'cubeTumble', 'converge'],
  'The stone': ['patina', 'glyphGlow', 'carveDepth', 'stoneRim', 'stoneEnv', 'auraIntensity'],
  'The binding': ['sproutRadius', 'tendrilRadius', 'wrapTurns', 'wrapRadius', 'spreadArms', 'armsUp', 'spreadLegs', 'legsDown', 'bindShake', 'overgrow'],
  'The reclamation': ['dragDepth', 'finaleLeaves', 'finaleSpores', 'finaleDirt', 'finaleShake', 'finaleFlash', 'finaleLight'],
  'The sapling': ['saplingHeight', 'saplingRadius', 'saplingGlow'],
  'The air': ['sporeRate', 'leafFall'],
  'Palette': ['colorBarkDark', 'colorBark', 'colorMoss', 'colorLichen', 'colorVine', 'colorVein', 'colorTip', 'colorDry', 'colorLeaf', 'colorLeafDark', 'colorStoneDark', 'colorStone', 'colorPatina', 'colorGlyph', 'colorGlyphHot', 'colorSigil', 'colorAura', 'colorDirt'],
  'Light': ['lightIntensity', 'lightRadius', 'lightColor']
};
