// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/* ================================================================== */
/* FX_MAGMAORB — the ICS Magma Flare, charged and thrown               */
/* ================================================================== */
/**
 * Port of ICS INC. `ics-magma-orb` (MIT). The textured magma sphere, its
 * scrolling aura, inner rim glow, ten crossed flare bands, 500 in-falling
 * sparks and the big outer glow sprite charge up in front of the caster, then
 * the orb is launched down the aimed line and pops at the target.
 */
export const fx_magmaorb = {
  /* --- the cast --- */
  range: 22.0,
  minRange: 3.0,
  speed: 15.0, // metres/second the orb flies
  lifetime: 0.9, // seconds of the impact beat
  fadeTime: 0.8,
  cooldown: 1.4,
  castAnim: 'cast2',

  /* --- placement --- */
  charge: 1.15, // seconds the orb winds up before launch
  handForward: 1.15, // metres in front of the caster the orb forms
  handSide: 0.0,
  handHeight: 1.55,
  endHeight: 1.0, // flight height at the target
  arc: 0.6, // metres of lob at mid-flight
  orbSize: 0.42, // orb radius, metres (original = 2 units)
  chargeStart: 0.12, // fraction of full size the orb starts at

  /* --- the orb (original layers) --- */
  flowSpeed: 1.0, // scroll speed of magma / aura / flares
  magmaGain: 1.0,
  aura: 1.0,
  inGlow: 1.0,
  flare: 1.0,
  flareScale: 1.0,
  flareSpin: 0.5,
  spark: 1.0,
  sparkRate: 1.0,
  sparkReach: 1.0,
  outGlow: 1.0,
  outGlowScale: 1.0,
  flightFlare: 0.55, // flare / spark strength while flying
  colorTint: '#ffffff',
  colorGlow: '#96ecff',

  /* --- the charge --- */
  intakeRate: 240,
  intakeRadius: 1.7,
  intakeSize: 0.16,
  chargeShake: 0.035,
  colorMoteA: '#ffffff',
  colorMoteB: '#9fe6ff',
  colorMoteC: '#5a7dff',
  colorMoteD: '#ff6fd0',

  /* --- the flight --- */
  trailRate: 280,
  trailSize: 0.16,
  trailLife: 0.5,

  /* --- the burst --- */
  popTime: 0.26, // seconds the orb takes to swell and vanish
  popScale: 1.9,
  burstSize: 2.8,
  burstIntensity: 1.6,
  shockRadius: 6.5,
  scorchRadius: 2.6,
  sparkBurst: 180,
  sparkSpeed: 14.0,
  emberCount: 90,
  impactShake: 0.5,
  shakeDuration: 0.5,
  impactFlash: 0.5,
  colorBurstA: '#d8f4ff',
  colorBurstB: '#7fd8ff',
  colorBurstC: '#5b3cff',
  colorShockA: '#bfefff',
  colorShockB: '#4f7dff',
  colorScorchA: '#120a24',
  colorScorchB: '#ff5ad0',
  colorFlash: '#bfe4ff',

  /* --- dynamic light --- */
  lightIntensity: 16.0,
  lightRadius: 9.0,
  lightColor: '#86b8ff'
};

export const fx_magmaorbSchema = {
  'The cast': [
    ['range', 3, 60, 0.1, 'max range'],
    ['minRange', 0, 12, 0.1, 'min range'],
    ['speed', 2, 60, 0.1, 'flight speed (m/s)'],
    ['lifetime', 0.1, 4, 0.01, 'impact beat'],
    ['fadeTime', 0.05, 3, 0.01, 'fade time'],
    ['cooldown', 0, 6, 0.05, 'cooldown'],
    ['castAnim', 'cast animation']
  ],
  Placement: [
    ['charge', 0, 4, 0.01, 'charge time (s)'],
    ['handForward', 0, 3, 0.01, 'forward (m)'],
    ['handSide', -2, 2, 0.01, 'side (m)'],
    ['handHeight', 0, 4, 0.01, 'hand height'],
    ['endHeight', 0, 4, 0.01, 'height at target'],
    ['arc', -2, 4, 0.01, 'lob (m)'],
    ['orbSize', 0.05, 2, 0.01, 'orb radius (m)'],
    ['chargeStart', 0, 1, 0.01, 'start size']
  ],
  'The orb': [
    ['flowSpeed', 0, 4, 0.01, 'flow speed'],
    ['magmaGain', 0, 3, 0.01, 'magma brightness'],
    ['aura', 0, 3, 0.01, 'aura'],
    ['inGlow', 0, 3, 0.01, 'inner rim glow'],
    ['flare', 0, 4, 0.01, 'flares'],
    ['flareScale', 0.2, 3, 0.01, 'flare size'],
    ['flareSpin', -4, 4, 0.01, 'flare spin'],
    ['spark', 0, 4, 0.01, 'sparks'],
    ['sparkRate', 0.1, 4, 0.01, 'spark speed'],
    ['sparkReach', 0.1, 3, 0.01, 'spark reach'],
    ['outGlow', 0, 3, 0.01, 'outer glow'],
    ['outGlowScale', 0.1, 3, 0.01, 'outer glow size'],
    ['flightFlare', 0, 2, 0.01, 'flares in flight'],
    ['colorTint', 'tint'],
    ['colorGlow', 'rim glow colour']
  ],
  'The charge': [
    ['intakeRate', 0, 800, 1, 'intake motes / s'],
    ['intakeRadius', 0.2, 5, 0.01, 'intake radius'],
    ['intakeSize', 0.02, 1, 0.01, 'mote size'],
    ['chargeShake', 0, 0.3, 0.005, 'charge rumble'],
    ['colorMoteA', 'mote A'],
    ['colorMoteB', 'mote B'],
    ['colorMoteC', 'mote C'],
    ['colorMoteD', 'mote D']
  ],
  'The flight': [
    ['trailRate', 0, 1000, 1, 'trail / s'],
    ['trailSize', 0.02, 1.5, 0.01, 'trail size'],
    ['trailLife', 0.05, 2, 0.01, 'trail life']
  ],
  'The burst': [
    ['popTime', 0.05, 1.5, 0.01, 'pop time'],
    ['popScale', 1, 6, 0.01, 'pop swell'],
    ['burstSize', 0.5, 12, 0.1, 'burst size'],
    ['burstIntensity', 0, 4, 0.01, 'burst intensity'],
    ['shockRadius', 0.5, 16, 0.1, 'shockwave radius'],
    ['scorchRadius', 0, 8, 0.1, 'scorch radius'],
    ['sparkBurst', 0, 600, 1, 'sparks'],
    ['sparkSpeed', 0, 40, 0.1, 'spark speed'],
    ['emberCount', 0, 400, 1, 'embers'],
    ['impactShake', 0, 1, 0.01, 'shake'],
    ['shakeDuration', 0.05, 2, 0.01, 'shake duration'],
    ['impactFlash', 0, 1, 0.01, 'flash'],
    ['colorBurstA', 'burst A'],
    ['colorBurstB', 'burst B'],
    ['colorBurstC', 'burst C'],
    ['colorShockA', 'shock A'],
    ['colorShockB', 'shock B'],
    ['colorScorchA', 'scorch'],
    ['colorScorchB', 'scorch glow'],
    ['colorFlash', 'flash colour']
  ],
  'Dynamic light': [
    ['lightIntensity', 0, 40, 0.5, 'light intensity'],
    ['lightRadius', 0.5, 30, 0.1, 'light radius'],
    ['lightColor', 'light colour']
  ]
};
