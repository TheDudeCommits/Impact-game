// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/* ================================================================== */
/* FX_MAGICCIRCLE — the ICS save-point magic circle, summoned          */
/* ================================================================== */
/**
 * Port of ICS INC. `ics-magic-circle` (MIT). Three rotating rune layers draw
 * themselves onto the floor at the target, the ground glow and swirl spread
 * out, the pillar of light rises out of the floor, the energy pulse fires a
 * wave of rising light streaks, then everything fades.
 */
export const fx_magiccircle = {
  /* --- the cast --- */
  range: 20.0,
  minRange: 2.0,
  zoneRadius: 3.0, // circle radius, metres (original = 3 units)
  speed: 60.0, // metres/second the cast reaches the target
  lifetime: 4.2, // seconds the circle stands
  fadeTime: 1.1,
  cooldown: 2.0,
  castAnim: 'cast3',

  /* --- timeline (original gsap timings) --- */
  drawTime: 0.65, // seconds each layer takes to draw/expand
  drawStagger: 0.35, // seconds between layers (centre first)
  revealTime: 1.0, // seconds each layer's rune strokes take to sweep on
  entranceTime: 1.2, // pillar rise, circle turn-in, floor spread
  pulseDelay: 0.2,
  pulseRise: 1.2, // energy 0 -> peak (power3.inOut)
  pulseDecay: 3.0, // energy peak -> 0 (power1.out)
  waveLead: 0.5, // wave fires this long before the peak
  energyPeak: 0.8,
  idleEnergy: 0.0,

  /* --- look --- */
  spin: 1.0, // layer rotation speed multiplier
  circleGain: 1.0,
  revealEdge: 1.6, // brightness of the drawing front
  groundGain: 1.0,
  swirlGain: 1.0,
  spreadGain: 1.0,
  pillarGain: 1.0,
  pillarHeight: 1.0, // × original 10 units
  pillarWidth: 1.0,
  ambient: 1.0, // floating motes
  wave: 1.0, // rising wave streaks
  colorTint: '#ffffff',

  /* --- feedback --- */
  openShock: 1.0,
  waveShock: 1.0,
  shockRadius: 7.0,
  waveFlash: 0.22,
  waveShake: 0.12,
  colorShockA: '#bfefff',
  colorShockB: '#1f7dff',
  colorFlash: '#7fcfff',

  /* --- dynamic light --- */
  lightIntensity: 14.0,
  lightRadius: 9.0,
  lightColor: '#3fb4ff'
};

export const fx_magiccircleSchema = {
  'The cast': [
    ['range', 2, 60, 0.1, 'max range'],
    ['minRange', 0, 12, 0.1, 'min range'],
    ['zoneRadius', 0.5, 10, 0.1, 'circle radius'],
    ['speed', 2, 200, 1, 'reach speed (m/s)'],
    ['lifetime', 0.5, 12, 0.01, 'stand time'],
    ['fadeTime', 0.05, 4, 0.01, 'fade time'],
    ['cooldown', 0, 8, 0.05, 'cooldown'],
    ['castAnim', 'cast animation']
  ],
  Timeline: [
    ['drawTime', 0.05, 3, 0.01, 'layer draw time'],
    ['drawStagger', 0, 2, 0.01, 'layer stagger'],
    ['revealTime', 0.05, 4, 0.01, 'rune draw-on time'],
    ['entranceTime', 0.1, 4, 0.01, 'entrance time'],
    ['pulseDelay', 0, 3, 0.01, 'pulse delay'],
    ['pulseRise', 0.05, 4, 0.01, 'pulse rise'],
    ['pulseDecay', 0.1, 8, 0.01, 'pulse decay'],
    ['waveLead', 0, 2, 0.01, 'wave lead'],
    ['energyPeak', 0, 2, 0.01, 'energy peak'],
    ['idleEnergy', 0, 1, 0.01, 'idle energy']
  ],
  Look: [
    ['spin', -4, 4, 0.01, 'layer spin'],
    ['circleGain', 0, 4, 0.01, 'circle brightness'],
    ['revealEdge', 0, 6, 0.01, 'draw-front glow'],
    ['groundGain', 0, 4, 0.01, 'ground glow'],
    ['swirlGain', 0, 4, 0.01, 'swirl'],
    ['spreadGain', 0, 4, 0.01, 'spread light'],
    ['pillarGain', 0, 4, 0.01, 'pillar'],
    ['pillarHeight', 0.1, 3, 0.01, 'pillar height'],
    ['pillarWidth', 0.1, 3, 0.01, 'pillar width'],
    ['ambient', 0, 4, 0.01, 'floating motes'],
    ['wave', 0, 4, 0.01, 'wave streaks'],
    ['colorTint', 'tint']
  ],
  Feedback: [
    ['openShock', 0, 3, 0.01, 'open shockwave'],
    ['waveShock', 0, 3, 0.01, 'wave shockwave'],
    ['shockRadius', 0.5, 20, 0.1, 'shock radius'],
    ['waveFlash', 0, 1, 0.01, 'wave flash'],
    ['waveShake', 0, 1, 0.01, 'wave shake'],
    ['colorShockA', 'shock A'],
    ['colorShockB', 'shock B'],
    ['colorFlash', 'flash colour']
  ],
  'Dynamic light': [
    ['lightIntensity', 0, 40, 0.5, 'light intensity'],
    ['lightRadius', 0.5, 30, 0.1, 'light radius'],
    ['lightColor', 'light colour']
  ]
};
