// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*! Ported into VFX Armory (ext pack) from achrefelouafi/LinearAbilityExtThreeJS, MIT, Copyright (c) 2026 mohamedachrefelouafi. */
/* ================================================================== */
/* MAGIC BOOST — the second self buff                                  */
/* ================================================================== */
/**
 * The other thing in the sandbox that is not a skillshot, and the opposite
 * reading of the same idea: where Electric Boost is a charge — hard, fast,
 * struck in filaments — this is a **channelling**. Slow, wide and dark. Press
 * the key and the character is lit from the inside in violet, wrapped in
 * turning ribbons, and standing in smoke.
 *
 * Built out of the same four parts, driven by the same single 0..1 envelope
 * (`rampIn` → hold → `rampOut`):
 *
 *   - **the fresnel** — the *same* patch on the character's own materials
 *     that the electric buff uses (`materials/FresnelAura.js`), shaded from
 *     this block instead. The two file claims against one uniform block and
 *     the stronger claim wins, so holding both does not fight.
 *   - **the ribbons** — wide sheets wound around the body on helices
 *     (`materials/ArcaneRibbonMaterial.js`), turning about it, climbing
 *     through themselves and dissolving at both tips. The signature of the
 *     buff, and the one thing in the project drawn as a *sheet* rather than
 *     as a filament, a shell or a quad.
 *   - **the ground** — smoke lying on the floor, sheared into a spiral by a
 *     frame that rotates with radius, with the light of the buff pooled under
 *     it (`materials/DarkFieldMaterial.js`). The second ground pass in the
 *     sandbox that blends normally rather than additively, and for the same
 *     reason as the crater: it has to *darken* the stone.
 *   - **the shed** — dark smoke rolling off the body, motes orbiting it, soft
 *     burns on the floor and a dynamic light that swells rather than gutters.
 *
 * As everywhere else, nothing is captured at activation: the envelope is
 * resolved against `duration` every frame and both shaders resolve every
 * metre and radian below on a zero-length frame — so dragging `ribbonRadius`
 * or `fieldDark` while paused re-winds the vortex live.
 */
export const ext_aura_magic = {
  /* --- the buff --- */
  duration: 14.0, // seconds it holds, from the moment it is triggered
  rampIn: 0.7, // seconds the envelope takes to arrive — a channel, not a snap
  rampOut: 1.4, // seconds it takes to let go at the end
  cooldown: 1.0, // seconds before it can be triggered again
  playAnimation: true, // throw a cast clip on activation
  castAnim: 'cast2', // which clip in `CAST_ANIMATIONS` that is

  /* --- the fresnel on every material of the character --- */
  // Same uniform names as the electric buff, because it is the same patch —
  // see `materials/FresnelAura.js`. `fresnel` is the master: at 0 the rig is
  // shaded exactly as it is when nothing is running.
  fresnel: 0.8, // master strength of the rim light
  fresnelPower: 1.35, // how tightly it hugs the silhouette (higher = thinner)
  fresnelBias: 0.05, // glow added to the lit body, not just the rim
  fresnelGlow: 2.6, // emissive gain — this is what blooms
  fresnelPulse: 0.35, // depth of the slow breathing
  fresnelPulseSpeed: 1.9, // slower than the charge: this one breathes
  fresnelFlicker: 0.06, // barely any stutter — magic does not gutter
  fresnelFlickerSpeed: 9,
  veins: 0.85, // filaments crawling over the skin
  veinScale: 1.35, // features per metre, world space
  veinSpeed: 0.9, // how fast they crawl
  veinSharp: 0.88, // 0 = soft blotches, 1 = thin filaments
  scan: 0.5, // brightness of the band sweeping up the body
  scanSpeed: 0.32, // sweeps/second
  scanWidth: 0.22, // height of the band, fraction of the body
  colorRim: '#c46bff',
  colorCore: '#ffffff', // the hottest part of the rim
  colorVein: '#8b3cff',

  /* --- the ribbons wound around the body --- */
  /**
   * One instance is one helix. `ribbonTurns` is how far round the body a
   * single ribbon travels over its own length, `ribbonSpin` is how fast the
   * whole vortex turns, and `ribbonClimb` is how fast a ribbon rises through
   * it — those three together are the motion, and they are deliberately
   * separate so the vortex can turn without the ribbons sliding, or the other
   * way round.
   */
  ribbons: 12, // sheets alive at once (capped at 24)
  ribbonRate: 0.96, // times/second each one re-rolls its shape
  ribbonLife: 0.81, // fraction of that cycle it is visible
  ribbonRadius: 0.7, // radius of the vortex, metres
  ribbonRadiusVary: 0.28, // per-ribbon variation on it
  ribbonDepth: 1.0, // front-to-back radius as a fraction of that
  ribbonFlare: 0.5, // 0 = a cylinder, 1 = a barrel widest at the waist
  ribbonLow: -0.08, // where a ribbon starts, fraction of body height
  ribbonHigh: 1.86, // ... and where it ends
  ribbonScatter: 2.6, // radians of jitter on the even fan around the body
  ribbonTurns: 1.05, // turns about the body over one ribbon's length
  ribbonTurnVary: 0.25,
  ribbonSpin: 0.26, // revolutions/second the vortex turns
  ribbonSpinVary: 0.3,
  ribbonCounter: 0.22, // fraction of ribbons turning the other way
  ribbonClimb: 0.32, // metres/second a ribbon rises over its life

  /* --- how far a ribbon wanders off its helix --- */
  ribbonWobble: 0.2, // metres its radius is pushed in and out
  ribbonWobbleScale: 2.4, // lobes along its length
  ribbonWave: 0.22, // metres it lifts and dips as it runs
  ribbonWaveScale: 1.9,
  ribbonCrawl: 0.3, // how fast that wander crawls

  /* --- the sheet --- */
  ribbonWidth: 0.17, // half-width of a sheet, metres
  ribbonWidthVary: 0.55, // how much narrower the thinnest ones are
  ribbonTaper: 2.12, // how hard it tapers to nothing at both ends
  ribbonBank: 1.0, // 0 = flat to the camera, 1 = banked into the helix
  ribbonFill: 0.22, // opacity of the interior wash
  ribbonFillFalloff: 1.7, // how fast that wash dies toward the edges
  ribbonEdge: 0.6, // brightness of the lit band at each lip
  ribbonEdgeWidth: 0.36, // how much of the sheet that band covers
  ribbonGlowWidth: 2.2, // the halo, × the sheet width
  ribbonGlowFalloff: 2.2,
  ribbonGlowOpacity: 0.22,
  ribbonWisp: 0.8, // how hard the strands eat into the sheet
  ribbonWispScale: 3.2, // strands along its length
  ribbonWispCross: 0.9, // ... and how much they vary across it
  ribbonWispSpeed: 0.55, // how fast they scroll backward
  ribbonWispSharp: 1.5, // 0 = a soft wash, high = separated strands
  ribbonEndFade: 0.24, // fraction of the length that dissolves at each tip
  ribbonSoftFade: 0.6, // metres of soft fade where a sheet meets geometry
  ribbonFlicker: 0.1, // whole-vortex brightness stutter
  ribbonFlickerSpeed: 8,
  ribbonStrandFade: 0.5, // how far the dimmest ribbons drop back
  ribbonGlow: 1.7, // emissive gain
  ribbonOpacity: 1.0,
  colorRibbonCore: '#ffdcff', // the lit lip
  colorRibbonInner: '#e05cff',
  colorRibbonOuter: '#8a1fd6',
  colorRibbonHalo: '#2b0455',

  /* --- the smoke on the floor --- */
  /**
   * `materials/DarkFieldMaterial.js`. `fieldDark` is how far the stone under
   * the character is pushed toward `colorFieldSmoke`, and `fieldPool` is the
   * light it is dark against. `fieldCurl` is the one that matters most: it is
   * how much further round the *outside* of the disc is dragged than the
   * middle, which is what winds the cloud into arms.
   */
  fieldRadius: 1.8, // radius of the cloud, metres
  fieldHeight: 0.012, // metres above the floor the quad is seated
  fieldFeather: 0.33, // fraction of the radius the edge fades over
  fieldTear: 0.015, // how far out of round the boundary is dragged
  fieldDark: 1.0, // how black it goes, 0 = the floor is untouched
  fieldSmokeScale: 0.6, // billows per metre
  fieldSmokeContrast: 1.5,
  fieldSwirl: 0.22, // radians/second the whole cloud turns
  fieldCurl: 0.4, // extra turn per metre of radius — the shear
  fieldBillow: 0.65, // domain warp on the smoke
  fieldCrawl: 0.28, // how fast it boils
  fieldPool: 0.7, // the light gathered under the feet
  fieldPoolFalloff: 2.8, // how fast it dies outward
  fieldRing: 0.25, // a soft ring seated inside the boundary
  fieldRingWidth: 0.14,
  fieldRingSeat: 0.7, // where it sits, fraction of the radius
  fieldGlints: 2.03, // single hot points glittering in the smoke
  fieldGlintScale: 8.8,
  fieldPulse: 0.18,
  fieldPulseSpeed: 1.5,
  fieldOpacity: 1.0,
  fieldGlow: 2.0,
  colorFieldSmoke: '#171032', // the deepest part of the cloud
  colorFieldSmokeLit: '#160828',
  colorFieldPool: '#8a2be2',
  colorFieldGlint: '#e3b6ff',

  /* --- the smoke shed off the body --- */
  smokeRate: 33, // puffs/second
  smokeSize: 0.28, // ≈ a metre across at birth, two and a half by the end
  smokeSpeed: 0.35,
  smokeLifetime: 1.85,
  smokeRise: 0.0, // upward drift, metres/second²
  smokeSpread: 0.25, // radius it is released on, metres
  smokeSeat: 0.32, // how high off the floor it is released, metres
  smokeTurbulence: 0.16,
  smokeGlow: 0.46, // held low: this is shadow, not light
  colorSmokeA: '#2a1240',
  colorSmokeB: '#1f0835',
  colorSmokeC: '#1f0042',
  colorSmokeD: '#1b0d30',

  /* --- the motes orbiting it --- */
  moteRate: 138, // particles/second
  moteSize: 0.055,
  moteSpeed: 0.5,
  moteLifetime: 2.4,
  moteRise: 0.75, // upward drift, metres/second²
  moteRadius: 1.05, // radius of the ring they are released on, metres
  moteLow: 0.0, // lowest point they are released from, fraction of height
  moteHigh: 1.15, // ... and the highest
  moteSwirl: 1.15, // radians/second they turn about the body
  moteExpand: -0.29, // negative = the orbit closes in as they climb
  moteTurbulence: 0.0,
  moteGlow: 1.4,
  colorMoteA: '#ffe4ff',
  colorMoteB: '#d07bff',
  colorMoteC: '#8a2be2',
  colorMoteD: '#1e0538',

  /* --- what the floor under the caster does --- */
  groundRate: 1.6, // soft smoke rings laid per second
  groundRadius: 1.4, // radius of one, metres
  groundSpread: 1.1, // how far off the feet they are scattered, metres
  groundLife: 1.6,
  groundIntensity: 0.55,
  colorGround: '#7b3cff',
  colorGroundEmber: '#d9a6ff',

  /* --- dynamic light --- */
  lightIntensity: 9,
  lightRadius: 10,
  lightHeight: 1.0, // metres above the floor the light sits
  lightColor: '#a44bff',
  lightPulse: 0.3, // depth of its swell, 0 = steady
  lightPulseSpeed: 0.55, // ... and how slowly it breathes

  /* --- the moment it is triggered, and the moment it lets go --- */
  burstMotes: 220,
  ringRadius: 4.2, // shockwave ring across the floor, metres
  activateFlash: 0.14, // screen flash on activation
  activateShake: 0.42,
  shakeDuration: 0.7,
  endFlash: 0.09, // ... and when it expires
  rumble: 0.012, // continuous shake while it holds
  colorFlash: '#c98bff',

  /* --- Armory port: fields the combined sandbox needs --- */
  range: 0.4, // Armory: the circle sits on the caster
  minRange: 0, // Armory: self cast
  zoneRadius: 4.2, // Armory: indicator radius (matches the ground ring)
  speed: 1 // Armory: unused (self cast)
};

export const ext_aura_magicSchema = {
  'The buff': [
    ['duration', 1, 60, 0.1, 'duration'],
    ['rampIn', 0.05, 4, 0.01, 'ramp in'],
    ['rampOut', 0.05, 6, 0.01, 'ramp out'],
    ['cooldown', 0, 20, 0.05, 'cooldown'],
    ['playAnimation', 'throw a clip'],
    ['castAnim', 'cast animation']
  ],
  'Fresnel on the character': [
    ['fresnel', 0, 3, 0.01, 'rim strength'],
    ['fresnelPower', 0.2, 8, 0.05, 'rim tightness'],
    ['fresnelBias', 0, 1, 0.005, 'body glow'],
    ['fresnelGlow', 0, 8, 0.05, 'glow'],
    ['fresnelPulse', 0, 1, 0.01, 'breathing'],
    ['fresnelPulseSpeed', 0.1, 12, 0.05, 'breathing rate'],
    ['fresnelFlicker', 0, 1, 0.01, 'stutter'],
    ['fresnelFlickerSpeed', 1, 90, 1, 'stutter rate'],
    ['colorRim', 'rim'],
    ['colorCore', 'rim core'],
    ['colorVein', 'veins']
  ],
  'Veins & sweep': [
    ['veins', 0, 3, 0.01, 'vein strength'],
    ['veinScale', 0.5, 30, 0.1, 'veins / metre'],
    ['veinSpeed', -6, 6, 0.05, 'vein crawl'],
    ['veinSharp', 0, 1, 0.01, 'vein sharpness'],
    ['scan', 0, 3, 0.01, 'sweep strength'],
    ['scanSpeed', 0, 4, 0.01, 'sweeps / sec'],
    ['scanWidth', 0.02, 1, 0.005, 'sweep width']
  ],
  'The ribbons': [
    ['ribbons', 1, 24, 1, 'ribbons at once'],
    ['ribbonRate', 0.02, 4, 0.01, 're-rolls / sec'],
    ['ribbonLife', 0.05, 1, 0.01, 'visible fraction'],
    ['ribbonRadius', 0.1, 6, 0.01, 'vortex radius'],
    ['ribbonRadiusVary', 0, 1, 0.01, 'radius variation'],
    ['ribbonDepth', 0.1, 2, 0.01, 'front-to-back'],
    ['ribbonFlare', 0, 1, 0.01, 'barrel'],
    ['ribbonLow', -1, 1, 0.01, 'lowest point'],
    ['ribbonHigh', 0, 2.5, 0.01, 'highest point'],
    ['ribbonScatter', 0, 3.2, 0.01, 'bearing scatter'],
    ['ribbonTurns', 0.05, 5, 0.01, 'turns per ribbon'],
    ['ribbonTurnVary', 0, 1, 0.01, 'turn variation'],
    ['ribbonSpin', -3, 3, 0.01, 'vortex spin'],
    ['ribbonSpinVary', 0, 1, 0.01, 'spin variation'],
    ['ribbonCounter', 0, 1, 0.01, 'fraction reversed'],
    ['ribbonClimb', -3, 3, 0.01, 'climb / sec']
  ],
  'How far a ribbon wanders': [
    ['ribbonWobble', 0, 2, 0.01, 'radial wander'],
    ['ribbonWobbleScale', 0.1, 12, 0.05, 'lobes along it'],
    ['ribbonWave', 0, 2, 0.01, 'vertical wander'],
    ['ribbonWaveScale', 0.1, 12, 0.05, 'waves along it'],
    ['ribbonCrawl', -4, 4, 0.01, 'wander crawl']
  ],
  'The sheet': [
    ['ribbonWidth', 0.01, 2, 0.005, 'width'],
    ['ribbonWidthVary', 0, 0.95, 0.01, 'width variation'],
    ['ribbonTaper', 0.05, 3, 0.01, 'end taper'],
    ['ribbonBank', 0, 1, 0.01, 'bank into the helix'],
    ['ribbonFill', 0, 2, 0.01, 'interior wash'],
    ['ribbonFillFalloff', 0.1, 8, 0.05, 'wash falloff'],
    ['ribbonEdge', 0, 3, 0.01, 'lit edges'],
    ['ribbonEdgeWidth', 0.01, 1, 0.01, 'edge width'],
    ['ribbonGlowWidth', 1, 12, 0.05, 'halo width'],
    ['ribbonGlowFalloff', 0.2, 8, 0.05, 'halo falloff'],
    ['ribbonGlowOpacity', 0, 2, 0.01, 'halo opacity'],
    ['ribbonWisp', 0, 1, 0.01, 'strands'],
    ['ribbonWispScale', 0.1, 20, 0.1, 'strands along it'],
    ['ribbonWispCross', 0, 4, 0.01, 'strands across it'],
    ['ribbonWispSpeed', -4, 4, 0.01, 'strand scroll'],
    ['ribbonWispSharp', 0.1, 6, 0.05, 'strand sharpness'],
    ['ribbonEndFade', 0.01, 0.5, 0.005, 'tip dissolve'],
    ['ribbonSoftFade', 0.02, 3, 0.01, 'soft intersection'],
    ['ribbonFlicker', 0, 1, 0.01, 'brightness stutter'],
    ['ribbonFlickerSpeed', 1, 120, 1, 'stutter rate'],
    ['ribbonStrandFade', 0, 1, 0.01, 'ribbon dimming'],
    ['ribbonGlow', 0, 8, 0.01, 'glow'],
    ['ribbonOpacity', 0, 2, 0.01, 'opacity'],
    ['colorRibbonCore', 'lit lip'],
    ['colorRibbonInner', 'inner'],
    ['colorRibbonOuter', 'outer'],
    ['colorRibbonHalo', 'halo']
  ],
  'The smoke on the floor': [
    ['fieldRadius', 0.2, 12, 0.05, 'radius'],
    ['fieldHeight', 0, 0.5, 0.005, 'height off the floor'],
    ['fieldFeather', 0.02, 1, 0.01, 'edge fade'],
    ['fieldTear', 0, 0.6, 0.005, 'out of round'],
    ['fieldDark', 0, 1, 0.01, 'darkness'],
    ['fieldSmokeScale', 0.05, 6, 0.05, 'billows / metre'],
    ['fieldSmokeContrast', 0.2, 6, 0.05, 'billow contrast'],
    ['fieldSwirl', -3, 3, 0.01, 'turn / sec'],
    ['fieldCurl', -3, 3, 0.01, 'shear with radius'],
    ['fieldBillow', 0, 3, 0.01, 'warp'],
    ['fieldCrawl', -3, 3, 0.01, 'boil'],
    ['fieldPool', 0, 3, 0.01, 'pooled light'],
    ['fieldPoolFalloff', 0.1, 8, 0.05, 'pool falloff'],
    ['fieldRing', 0, 3, 0.01, 'ring'],
    ['fieldRingWidth', 0.01, 1, 0.01, 'ring width'],
    ['fieldRingSeat', 0, 1, 0.01, 'ring seat'],
    ['fieldGlints', 0, 3, 0.01, 'glints'],
    ['fieldGlintScale', 0.5, 20, 0.1, 'glints / metre'],
    ['fieldPulse', 0, 1, 0.01, 'breathing'],
    ['fieldPulseSpeed', 0.05, 8, 0.05, 'breathing rate'],
    ['fieldOpacity', 0, 2, 0.01, 'opacity'],
    ['fieldGlow', 0, 8, 0.01, 'glow'],
    ['colorFieldSmoke', 'deep smoke'],
    ['colorFieldSmokeLit', 'lit smoke'],
    ['colorFieldPool', 'pool'],
    ['colorFieldGlint', 'glints']
  ],
  'Smoke & motes': [
    ['smokeRate', 0, 300, 1, 'smoke rate'],
    ['smokeSize', 0.05, 3, 0.01, 'smoke size'],
    ['smokeSpeed', 0, 8, 0.05, 'smoke speed'],
    ['smokeLifetime', 0.1, 8, 0.05, 'smoke lifetime'],
    ['smokeRise', -3, 5, 0.05, 'smoke rise'],
    ['smokeSpread', 0, 4, 0.05, 'release radius'],
    ['smokeSeat', 0, 2, 0.01, 'release height'],
    ['smokeTurbulence', 0, 3, 0.01, 'smoke turbulence'],
    ['smokeGlow', 0, 3, 0.01, 'smoke glow'],
    ['moteRate', 0, 500, 1, 'mote rate'],
    ['moteSize', 0.005, 0.4, 0.005, 'mote size'],
    ['moteSpeed', 0, 12, 0.05, 'mote speed'],
    ['moteLifetime', 0.1, 8, 0.05, 'mote lifetime'],
    ['moteRise', -3, 8, 0.05, 'mote rise'],
    ['moteRadius', 0.05, 5, 0.05, 'orbit radius'],
    ['moteLow', -0.5, 1.5, 0.01, 'lowest release'],
    ['moteHigh', 0, 2, 0.01, 'highest release'],
    ['moteSwirl', -6, 6, 0.05, 'orbit rate'],
    ['moteExpand', -1, 3, 0.01, 'orbit opening'],
    ['moteTurbulence', 0, 3, 0.01, 'mote turbulence'],
    ['moteGlow', 0, 4, 0.01, 'mote glow'],
    ['colorSmoke*', 'Smoke colour'],
    ['colorMote*', 'Mote colour']
  ],
  'Rings under the feet': [
    ['groundRate', 0, 20, 0.1, 'rings / sec'],
    ['groundRadius', 0.05, 5, 0.05, 'ring radius'],
    ['groundSpread', 0, 5, 0.05, 'scatter'],
    ['groundLife', 0.05, 6, 0.05, 'ring lifetime'],
    ['groundIntensity', 0, 3, 0.01, 'ring intensity'],
    ['colorGround', 'ring'],
    ['colorGroundEmber', 'highlight']
  ],
  'Dynamic light': [
    ['lightIntensity', 0, 60, 0.5, 'intensity'],
    ['lightRadius', 1, 40, 0.5, 'radius'],
    ['lightHeight', 0, 3, 0.01, 'height'],
    ['lightPulse', 0, 1, 0.01, 'swell'],
    ['lightPulseSpeed', 0.05, 6, 0.05, 'swell rate'],
    ['lightColor', 'colour']
  ],
  'Open & close': [
    ['burstMotes', 0, 800, 1, 'motes on opening'],
    ['ringRadius', 0.5, 20, 0.1, 'shockwave radius'],
    ['activateFlash', 0, 2, 0.01, 'flash on opening'],
    ['endFlash', 0, 2, 0.01, 'flash on closing'],
    ['activateShake', 0, 4, 0.01, 'shake on opening'],
    ['shakeDuration', 0.05, 3, 0.01, 'shake duration'],
    ['rumble', 0, 0.4, 0.001, 'rumble while held'],
    ['colorFlash', 'flash colour']
  ],
  'Armory': [
    ['zoneRadius', 0.5, 10, 0.05, 'indicator radius'],
    ['range', 0.4, 10, 0.1, 'max range'],
    ['minRange', 0, 5, 0.1, 'min range']
  ]
};
