// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/* ================================================================== */
/* CHAINS OF PENANCE — cinematic pack                                  */
/* ================================================================== */
/*!
 * Golden portals open all round the target and chains lash out of them to hold it in the air.
 *
 * Ported 1:1 from the `chains` block of achrefelouafi/AbilityCastingThreeJS
 * (MIT, Copyright (c) 2026 mohamedachrefelouafi), `src/config/settings.js`.
 * Nested objects (`hit`, `burn`, …) drove the source's ragdoll targets; they
 * are kept so the code reads them unchanged, and the editor skips them.
 * Ranges are inferred by the editor from the shipped values.
 */
export const cin_chains = {
  /* --- the cast --- */
  range: 18.0, // max cast distance, metres
  minRange: 0,
  speed: 60.0, // the cast's run to the target, m/s
  cooldown: 7.0,
  castAnim: 'cast3',
  zoneRadius: 1.1, // the circle drawn round the target, metres
  snapRadius: 2.4, // how far from the cursor a body is snapped onto, metres
  showTime: 4.2, // seconds from landing the rite takes at least
  fadeTime: 2.4, // seconds the seal and the blood take to fade

  /* --- the timing --- */
  portalStagger: 0.045, // seconds between one portal opening and the next
  portalOpen: 0.32, // seconds a portal takes to inscribe itself and open
  fireDelay: 0.3, // the first chain is thrown
  fireStagger: 0.06, // seconds between chains
  flightTime: 0.17, // seconds a chain takes to reach its limb
  wrapTime: 0.16, // seconds it takes to wind round it
  liftTime: 0.5, // seconds to haul the body up to the hang
  strainStart: 1.1, // the hauling begins
  ratchets: 3, // how many hauls before the limbs give
  ratchetPeriod: 0.36, // seconds between hauls
  ratchetSnap: 0.07, // seconds one haul takes
  tearStagger: 0.11, // seconds between one limb coming away and the next
  recoilTime: 0.34, // seconds a torn limb takes to be dragged through its portal
  dragDelay: 0.3, // seconds after the last limb before the trunk is taken
  dragTime: 0.75, // seconds the trunk takes to go down through the floor
  closeDelay: 0.12, // seconds after its chain is home before a portal shuts
  closeTime: 0.32, // seconds it takes to shut

  /* --- 1 · the portals --- */
  portalRadius: 0.4, // metres, the aperture
  floorPortalRadius: 0.62, // the one in the floor the trunk goes through
  portalDistance: 2.9, // metres from the body
  portalSpread: 0.7, // random extra distance, metres
  portalJitter: 0.22, // random swing off each chain's line
  portalMinHeight: 0.6, // metres, the lowest a portal in the air may sit
  groundSpan: 1.3, // metres out to the two in the floor the legs are chained to
  blades: 7, // the iris
  irisOpen: 1.0, // how far it opens
  portalSpin: 0.7, // radians/second the filigree turns
  tunnelDepth: 2.4, // how deep the tunnel through it reads, in radii
  tunnelSpeed: 0.5, // rings/second streaming out of it
  runeGlow: 1.3, // the tunnel's rings
  lineGlow: 2.6, // the gold
  halo: 0.6,
  voidOpacity: 0.97,
  igniteFlash: 1.0, // the spark each one is lit with
  warpStrength: 0.6, // the lens round it
  warpSwirl: 0.45,
  portalLight: 9.0, // the light thrown off whichever portal is busiest
  portalLightRadius: 5.0,

  /* --- 2 · the chains --- */
  linkLength: 0.13, // metres, one link
  linkThickness: 1.0, // × the forged wire
  hookSize: 0.32, // metres, the barbed head
  curl: 0.9, // metres a chain arcs off the straight on its way out
  whip: 0.3, // metres of wave thrown down it as it flies
  whipWaves: 2.2, // waves along it
  sag: 0.18, // × its length, how far a slack chain hangs
  vibration: 0.022, // metres a taut chain thrums
  vibrationFreq: 23.0, // Hz
  jerkWave: 0.16, // metres of wave a haul sends down it
  wrapTurns: 2.6, // turns round the limb
  wrapReach: 1.0, // × how much of each limb its coil covers
  wrapRadius: 1.0, // × each limb's own girth
  runeScale: 3.5, // runes down each link
  chainRuneGlow: 1.1,
  heatGlow: 2.2, // how bright hot iron gets
  crackScale: 26.0, // the crust that breaks open as it heats
  metalness: 0.85,
  roughness: 0.42,
  ironEnv: 1.2, // the probe in the iron
  colorIron: '#2b2521',

  /* --- 3 · the hold --- */
  hangHeight: 1.75, // metres, the body's centre while it hangs
  reach: 1.0, // × how far each limb is held out from it
  grip: 0.12, // how hard each limb is held, 0..1 per pass
  waistGrip: 0.22, // how hard the trunk is held
  catchTime: 0.12, // seconds a chain takes to take its full grip
  kick: {
    impulse: 0.6, // m/s the first chain to land jolts it
    lift: 2.4,
    spin: 0.4
  },

  /* --- 4 · the strain --- */
  stretch: 0.16, // metres a limb is out of its socket on the last haul
  reachGain: 0.28, // × the hold, how much further each haul drags a limb
  seamStrain: 1.0, // how hot the seams run before they give
  jerkShake: 0.14,
  strainRumble: 0.035,
  ratchetLight: 25.0,

  /* --- 5 · the tear --- */
  tearShake: 0.24,
  tearLight: 30.0,
  tearFlash: 0.04,
  bloodCount: 130, // droplets per limb
  bloodSpeed: 5.5, // m/s
  goreCount: 9, // chunks per limb
  emberCount: 55, // embers per limb
  mistCount: 8, // puffs per limb
  recoilDepth: 1.4, // metres past its portal a limb is dragged
  tear: {
    tearNoise: 0.26, // how ragged the seam is
    tearNoiseScale: 15.0, // features up the body
    tearEdge: 0.07, // the hot band at the seam
    colorMeat: '#4a0709',
    meatGlow: 0.35,
    colorSeam: '#ffa53a',
    seamGlow: 6.5,
    veins: 1.0, // heat cracking out into a limb before it gives
    portalRimGlow: 6.0, // the line a portal burns across what goes through it
    portalRimWidth: 0.05
  },

  /* --- 6 · the seal --- */
  sealRadius: 1.9, // metres
  sealGlow: 1.3,
  sealDraw: 0.55, // seconds to inscribe it
  bloodPool: 1.15, // metres the pool spreads to
  bloodGrow: 1.6, // seconds it takes

  /* --- the air round it --- */
  sparkRate: 40, // per second off a chain grinding through its portal
  emberRate: 26, // per second drifting off the portals
  smokeRate: 7, // per second curling out of them

  /* --- the palette --- */
  colorGold: '#ffb547',
  colorCore: '#fff0d2',
  colorHeat: '#ff6a1c',
  colorDeep: '#b3121c',
  colorVoid: '#030102',
  colorLacquer: '#0e0a08',
  colorBlood: '#5c040a',
  colorBloodDark: '#160003',
  colorEmber: '#ffa040',
  colorSmoke: '#1c0b0b',
  colorReticle: '#ffb547', // the lock on the target while aiming
  colorLocked: '#fff0d2',

  /* --- light --- */
  lightIntensity: 14.0,
  lightRadius: 9.0,
  lightColor: '#ffa947'
};

export const cin_chainsSchema = {
  'The cast': ['range', 'minRange', 'speed', 'cooldown', 'castAnim', 'zoneRadius', 'snapRadius', 'showTime', 'fadeTime'],
  'The timing': ['portalStagger', 'portalOpen', 'fireDelay', 'fireStagger', 'flightTime', 'wrapTime', 'liftTime', 'strainStart', 'ratchets', 'ratchetPeriod', 'ratchetSnap', 'tearStagger', 'recoilTime', 'dragDelay', 'dragTime', 'closeDelay', 'closeTime'],
  'The portals': ['portalRadius', 'floorPortalRadius', 'portalDistance', 'portalSpread', 'portalJitter', 'portalMinHeight', 'groundSpan', 'blades', 'irisOpen', 'portalSpin', 'tunnelDepth', 'tunnelSpeed', 'runeGlow', 'lineGlow', 'halo', 'voidOpacity', 'igniteFlash', 'warpStrength', 'warpSwirl', 'portalLight', 'portalLightRadius'],
  'The chains': ['linkLength', 'linkThickness', 'hookSize', 'curl', 'whip', 'whipWaves', 'sag', 'vibration', 'vibrationFreq', 'jerkWave', 'wrapTurns', 'wrapReach', 'wrapRadius', 'runeScale', 'chainRuneGlow', 'heatGlow', 'crackScale', 'metalness', 'roughness', 'ironEnv', 'colorIron'],
  'The hold': ['hangHeight', 'reach', 'grip', 'waistGrip', 'catchTime'],
  'The strain': ['stretch', 'reachGain', 'seamStrain', 'jerkShake', 'strainRumble', 'ratchetLight'],
  'The tear': ['tearShake', 'tearLight', 'tearFlash', 'bloodCount', 'bloodSpeed', 'goreCount', 'emberCount', 'mistCount', 'recoilDepth'],
  'The seal': ['sealRadius', 'sealGlow', 'sealDraw', 'bloodPool', 'bloodGrow'],
  'The air round it': ['sparkRate', 'emberRate', 'smokeRate'],
  'The palette': ['colorGold', 'colorCore', 'colorHeat', 'colorDeep', 'colorVoid', 'colorLacquer', 'colorBlood', 'colorBloodDark', 'colorEmber', 'colorSmoke', 'colorReticle', 'colorLocked'],
  'Light': ['lightIntensity', 'lightRadius', 'lightColor']
};
