// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/* ================================================================== */
/* ASTRAL TOME — cinematic pack                                  */
/* ================================================================== */
/*!
 * A tome flies to the circle, opens an orrery over it, and its planets fall on everyone inside.
 *
 * Ported 1:1 from the `tome` block of achrefelouafi/AbilityCastingThreeJS
 * (MIT, Copyright (c) 2026 mohamedachrefelouafi), `src/config/settings.js`.
 * Nested objects (`hit`, `burn`, …) drove the source's ragdoll targets; they
 * are kept so the code reads them unchanged, and the editor skips them.
 * Ranges are inferred by the editor from the shipped values.
 */
export const cin_tome = {
  /* --- the cast --- */
  range: 20.0,
  minRange: 0,
  speed: 30.0, // unused — the tome flies on its own clock; see flySpeed
  cooldown: 8.0,
  castAnim: 'cast1',
  zoneRadius: 6.0, // the circle it claims, metres

  /* --- the timing --- */
  conjureTime: 0.85, // materialising at the shoulder
  flySpeed: 11.0, // m/s along the arc to the circle...
  flyMin: 0.6, // ...but never quicker than this, seconds
  flyMax: 1.5, // ...nor slower
  growTime: 0.65, // swelling to full size
  openTime: 1.1, // the fan, the star, the orrery drawing itself
  judgeTime: 3.2, // the lights falling
  closeTime: 1.3, // the last light, and folding away

  /* --- 1 · the conjuring --- */
  conjureSize: 0.55, // metres across, at the shoulder and in flight
  conjureHeight: 1.55, // metres over the floor
  conjureReach: 0.8, // metres ahead of the caster
  conjureSide: 0.45, // metres to the side
  conjureMotes: 180, // motes/second spiralling in
  moteSize: 0.06,
  moteSwirl: 3.0,
  edgeWidth: 0.08, // of the materialising front, × the book
  edgeGlow: 6.0,
  colorEdge: '#5fb6ff',

  /* --- 2 · the flight --- */
  flyArc: 2.2, // metres it rises over the higher end
  flySpin: 1.0, // turns it makes on the way
  flyTilt: 0.35, // radians it banks
  flyTrail: 160, // particles/second shed behind it

  /* --- 3 · the book --- */
  size: 2.3, // metres across, full size
  hoverHeight: 1.15, // metres, the middle of the book
  hoverBob: 0.06,
  bobRate: 0.4,
  yawSpeed: 0.22, // radians/second it turns as it hangs there
  glyphGlow: 4.0, // how hard the dial, glyphs and gems light with the charge
  rimStrength: 0.25,

  /* --- 4 · the orrery --- */
  holoHeight: 1.7, // metres the star rises over the dial
  holoRadius: 2.3, // metres, the widest orbit
  planets: 4, // 0–6
  orbitSpeed: 0.9, // radians/second round the widest orbit
  orbitWidth: 0.014, // metres, the line
  orbitIntensity: 1.4,
  planetSize: 0.6,
  planetIntensity: 1.3,
  planetRegrow: 0.8, // seconds a thrown planet takes to gather again
  coreSize: 1.7,
  coreIntensity: 1.6,
  fanRadius: 1.25, // metres across the top of the fan
  fanIntensity: 1.2,
  fanMotes: 90,
  starRate: 80, // stars/second about the orrery
  starSize: 0.09,
  starReach: 1.2, // × holoRadius
  openFlash: 0.05,

  /* --- 5 · the judgement --- */
  strikeInterval: 0.3, // seconds between throws
  idleStrikeRate: 1.5, // floor throws/second with nobody left
  cometFlight: 0.42, // seconds a light takes to land
  cometArc: 0.18, // how far it bows up, × the distance
  cometSize: 0.7,
  cometIntensity: 1.6,
  trailDensity: 18, // trail particles per metre
  beamWidth: 0.07,
  beamIntensity: 2.4,
  aimHeight: 0.6, // × body height
  impactSparks: 40,
  strikeShake: 0.18,
  strikeFlash: 0.04,
  strikeLight: 50.0,
  strikeLightRadius: 8.0,
  hit: {
    impulse: 7.0,
    lift: 5.0,
    spin: 1.4
  },

  /* --- 6 · the finale --- */
  finaleShake: 0.45,
  finaleFlash: 0.12,
  finaleLight: 90.0,

  /* --- 7 · the zodiac --- */
  sigilIntensity: 1.1,
  sigilSpin: 0.4,

  /* --- palette --- */
  colorCore: '#ffffff',
  colorGlow: '#2a7dff',
  colorLine: '#5ab6ff',
  colorSpark: '#e4f5ff',
  colorStar: '#cfe9ff',
  colorSigil: '#3a86ff',
  colorDeep: '#0a2470',

  /* --- light --- */
  lightIntensity: 10.0,
  lightRadius: 11.0,
  lightColor: '#4f9dff'
};

export const cin_tomeSchema = {
  'The cast': ['range', 'minRange', 'speed', 'cooldown', 'castAnim', 'zoneRadius'],
  'The timing': ['conjureTime', 'flySpeed', 'flyMin', 'flyMax', 'growTime', 'openTime', 'judgeTime', 'closeTime'],
  'The conjuring': ['conjureSize', 'conjureHeight', 'conjureReach', 'conjureSide', 'conjureMotes', 'moteSize', 'moteSwirl', 'edgeWidth', 'edgeGlow', 'colorEdge'],
  'The flight': ['flyArc', 'flySpin', 'flyTilt', 'flyTrail'],
  'The book': ['size', 'hoverHeight', 'hoverBob', 'bobRate', 'yawSpeed', 'glyphGlow', 'rimStrength'],
  'The orrery': ['holoHeight', 'holoRadius', 'planets', 'orbitSpeed', 'orbitWidth', 'orbitIntensity', 'planetSize', 'planetIntensity', 'planetRegrow', 'coreSize', 'coreIntensity', 'fanRadius', 'fanIntensity', 'fanMotes', 'starRate', 'starSize', 'starReach', 'openFlash'],
  'The judgement': ['strikeInterval', 'idleStrikeRate', 'cometFlight', 'cometArc', 'cometSize', 'cometIntensity', 'trailDensity', 'beamWidth', 'beamIntensity', 'aimHeight', 'impactSparks', 'strikeShake', 'strikeFlash', 'strikeLight', 'strikeLightRadius'],
  'The finale': ['finaleShake', 'finaleFlash', 'finaleLight'],
  'The zodiac': ['sigilIntensity', 'sigilSpin'],
  'Palette': ['colorCore', 'colorGlow', 'colorLine', 'colorSpark', 'colorStar', 'colorSigil', 'colorDeep'],
  'Light': ['lightIntensity', 'lightRadius', 'lightColor']
};
