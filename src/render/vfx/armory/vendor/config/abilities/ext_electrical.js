// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*! Ported into VFX Armory (ext pack) from achrefelouafi/LinearAbilityExtThreeJS, MIT, Copyright (c) 2026 mohamedachrefelouafi. */
/* ================================================================== */
/* ELECTRICAL SPHERE — ability nine, far cast                          */
/* ================================================================== */
/**
 * A charged orb dropped at the aimed point: the caster whips a line of
 * current out across the floor, the platform blooms where it lands, and a
 * **dark, polished sphere** rises out of the middle — mirroring the room,
 * ringed in Fresnel light, electricity crawling flat across its skin and
 * arcs tearing off it into the air — until it collapses inward and blinks
 * out.
 *
 * Three GPU shaders do the whole thing: the **sphere body** (a near-black
 * reflective shell, the 2D discharge net on it, the Fresnel light around
 * it, and the pulse beat), the **ground platform** (a flat disc with rings,
 * hex grain, a hot inner band and outward pulse rings), and the **radial
 * corona** (an instanced ribbon of arcs leaving random points *on the
 * sphere's surface* out into the air, re-struck on their own clocks so the
 * corona is constantly forming and dying).
 *
 * There was a fourth — a larger additive shell around the body carrying a
 * corona of flame. It is gone: additive noise drawn over a mirror washes the
 * mirror out, and it read as a smoky bubble wrapped around the ball rather
 * than as energy coming off it. `fresnelGlow` below is what replaced it.
 *
 * The pulse is an organic envelope — two sine waves multiplied plus a
 * quantised spike — multiplied into the material's `uPulse` and into the
 * particle emitter rates, so the whole effect breathes in time. It is
 * *not* a scale animation; nothing on screen actually moves on a beat, the
 * brightness and the noise just lift.
 *
 * As in every other block, a cast captures nothing but a seed. Every metre,
 * colour stop, noise scale and rate is read off this block each frame —
 * including a zero-length one, which is why the editor reshapes a standing
 * sphere with the clock stopped.
 */
export const ext_electrical = {
  /* --- the cast --- */
  range: 18.0, // maximum cast distance, metres
  minRange: 0.0, // can drop on your own feet
  zoneRadius: 4.5, // the platform footprint, what the indicator measures out
  speed: 60.0, // how fast the front races to the point, metres/second
  snapTime: 0.35, // seconds the platform takes to bloom open
  lifetime: 3.6, // seconds the sphere stands
  collapseTime: 0.55, // seconds it takes to collapse inward
  fadeTime: 0.45, // seconds after the collapse until the meshes blink out
  cooldown: 2.0,
  castAnim: 'cast3',

  /* --- where the front leaves the caster --- */
  handHeight: 1.28, // metres above the floor
  handForward: 0.55, // metres in front of the caster
  handSide: 0.16, // metres to the side

  /* --- the sphere itself --- */
  sphereRadius: 1.4, // radius once it is up to power, metres
  hoverHeight: 2.0, // high enough that the arcs clear the floor
  hoverAmplitude: 0.06, // tiny floating motion
  hoverSpeed: 0.5, // oscillations per second
  opacity: 1.0, // the ball is a solid object, not a volume
  distortion: 0.12, // how hard the skin bends the reflection
  glow: 1.2, // overall emissive gain

  /* --- the reflective shell --- */
  // The ball is a *dark mirror*. Its albedo is near black on purpose: every
  // bright thing on it is the room reflected in it, the discharge burnt onto
  // it, or the Fresnel wrapped around it. `reflectivity` is what it returns
  // head-on and `fresnelPower` decides how fast that climbs to a full mirror
  // at the silhouette; `envRoughness` blurs the reflection and `distortion`
  // above ripples it.
  envIntensity: 0.0, // how bright the room reads in the ball
  envRoughness: 0.08, // blur on the reflection, 0 = a perfect mirror
  reflectivity: 0.55, // reflection strength facing the camera
  fresnelPower: 2.6, // how fast reflection climbs toward the limb
  specular: 3.4, // the hard key glint
  specSharp: 220, // how tight that glint is
  shellDiffuse: 0.3, // how much plain lighting the black skin takes
  shellRipple: 3.0, // scale of the skin ripple bending the reflection
  colorShell: '#0d0b0c', // the lit side of the black skin
  colorDeep: '#030203', // the unlit side of it

  /* --- the faint charge under the skin --- */
  // Deliberately weak. Turned up, this is the layer that stops the ball
  // reading as a solid object and turns it back into a lantern.
  plasmaScale: 2.4, // features over the sphere
  plasmaSpeed: 0.45, // how fast the noise scrolls
  plasmaIntensity: 0.5, // strength of the glow bleeding through the skin
  plasmaCore: 2.2, // how concentrated it is
  plasmaWarp: 0.5, // domain warp — folds it into turbulent sheets
  colorCore: '#fff7d6', // tint on the key glint
  colorInner: '#ffd166', // yellow lift where the discharge runs to the limb
  colorMid: '#ff7a20', // the charge under the skin
  colorOuter: '#ff3a0a', // the wide Fresnel halo
  colorEdge: '#ff1503', // the tight Fresnel rim

  /* --- the hex panelling (off by default: the sci-fi read) --- */
  hexScale: 6.0, // panels per sphere radius
  hexWidth: 0.18, // edge thickness
  hexIntensity: 0.0, // how much the panels lift
  hexPulse: 0.0, // extra brightness on a pulse beat
  colorHex: '#ffa040',
  // What the whole ball is pushed toward on a pulse beat. The body shader
  // has always read this; the block never actually defined it.
  colorPulse: '#fff8e6',

  /* --- the discharge crawling over the skin (the flat, 2D electricity) --- */
  // A ridged-noise filament net, not a thresholded fbm: ridged noise has
  // sharp *spines*, and slicing a narrow band off the top of it gives forked
  // hairlines rather than the soft blobs that used to read as lava. Both
  // widths are fractions of the normalised field, so `surfaceArcWidth` is
  // literally how much of the ball a filament covers.
  surfaceArcScale: 3.2, // filaments per sphere radius
  surfaceArcSpeed: 0.6, // how fast the net evolves
  surfaceArcCrawl: 0.5, // how fast it slides across the skin
  surfaceArcWidth: 0.07, // white-hot filament thickness
  surfaceArcGlowWidth: 0.16, // extra width of the coloured bleed around it
  surfaceArcIntensity: 1.6, // overall discharge brightness
  surfaceArcFlicker: 0.35, // depth of the per-patch stutter
  surfaceArcRestrike: 5.0, // re-strikes per second — the net re-rolls on a beat
  surfaceArcWarp: 0.0, // domain warp — how hard the filaments buckle and fork
  surfaceArcCharge: 0.7, // 0 = the whole ball conducts, 1 = only live patches do
  colorSurfaceArcCore: '#fffbf0',
  colorSurfaceArcGlow: '#ff8614',

  /* --- the Fresnel light --- */
  // With the corona shell gone this is the whole silhouette read, so it does
  // real work. Two terms: `fresnelGlow` is the wide halo that stands in for
  // the atmosphere around the ball, `rim*` is the hard edge on the outline.
  rimPower: 2.5, // how tight the rim is
  rimIntensity: 3.56, // how bright
  rimWidth: 0.86, // how wide the band is
  fresnelGlowPower: 5.25, // falloff of the wide halo — higher hugs the limb
  fresnelGlow: 4.36, // brightness of the wide halo

  /* --- the ground platform --- */
  platformRadius: 4.5, // metres from centre to edge
  platformRings: 8, // concentric rings (capped at 16)
  platformRingWidth: 0.08, // half-width of one ring
  platformRingGlow: 0.5, // brightness of the rings
  platformInnerGlow: 0.55, // brightness of the hot band under the sphere
  platformInnerPad: 0.4, // how far past the sphere the inner band reaches
  platformHexScale: 4.0, // hex grain scale
  platformHexIntensity: 0.3, // hex grain strength
  platformOpacity: 0.85,
  platformGlow: 0.9,
  colorPlatformRing: '#ff8c25',
  colorPlatformInner: '#ff661a',
  colorPlatformHex: '#ff8024',
  colorPlatformDeep: '#150503',

  /* --- the radial corona arcs --- */
  arcCount: 35, // strands in the corona (capped at 80)
  arcLength: 2.7, // metres the average arc reaches
  arcVariance: 0.7, // 0 = uniform, 1 = some are short, some dramatic
  arcJitter: 0.35, // lateral wander of the far end
  arcEscape: 1.01, // origin offset from sphere surface, × sphere radius
  arcCurl: 0.45, // in-flight bend
  arcReach: 1.0,
  arcUpBias: 0.05, // how much the arcs lean upward
  arcBranchFraction: 0.45, // fraction demoted to short secondary arcs
  arcBow: 0.25, // mid-span bow

  /* --- the shape of a single arc --- */
  arcJitterAmp: 0.16, // kink amplitude, metres
  arcJitterFreq: 2.2, // kinks per metre
  arcOctaves: 4,
  arcJitterFalloff: 0.56,
  arcCrawl: -3.7, // how fast the kinks slide
  arcPinch: 0.285, // fraction of the span the ends are pulled straight over
  arcConverge: 0.5,

  /* --- the ribbon --- */
  arcWidth: 0.03, // half-width where the arc leaves the sphere, metres
  arcWidthTip: 0.3, // that width at the far tip, as a fraction of the base
  arcCoreWidth: 1.5, // spine multiplier
  arcCoreSharp: 3.0, // how hard the hot core falls off across the ribbon
  arcGlowFalloff: 2.0, // halo falloff
  arcHaloWidth: 3.0, // halo multiplier on the core
  arcHaloOpacity: 0.6, // halo pass opacity
  arcOpacity: 1.0,
  arcGlow: 2.0, // emissive gain
  arcSoftFade: 0.4, // soft intersection with geometry
  arcFlicker: 0.45, // depth of the bolt's stutter
  arcFlickerSpeed: 32, // stutters/second
  arcStrandFlash: 0.5, // how much individual strands blink
  arcRate: 16, // cycles per second
  arcLife: 0.62, // fraction of the cycle each arc is lit
  colorArcCore: '#fff4d6',
  colorArcInner: '#ffb24a',
  colorArcOuter: '#ff6a18',
  colorArcHalo: '#ff3a0c',

  /* --- the pulse --- */
  pulseFrequency: 8.0, // pulses per second
  pulseStrength: 0.51, // peak envelope of each beat
  pulseParticleBoost: 3.15, // how much harder particles fire on a beat

  /* --- sparks, motes, embers and smoke --- */
  sparkRate: 240, // sparks shed off the front, particles/second
  sparkSize: 0.16,
  sparkSpeed: 9.0,
  sparkLifetime: 0.5,
  sparkGravity: -8.0,
  sparkStretch: 0.18,
  sparkGlow: 2.0,
  colorSparkA: '#fff4d6',
  colorSparkB: '#ffd07a',
  colorSparkC: '#ff6a14',
  colorSparkD: '#7a1d04',
  moteRate: 120,
  moteSize: 0.06,
  moteSpeed: 1.8,
  moteLifetime: 1.5,
  moteRise: 0.8,
  moteTurbulence: 0.7,
  colorMoteA: '#ffd07a',
  colorMoteB: '#ff8a30',
  colorMoteC: '#ff3a0a',
  colorMoteD: '#1c0500',
  emberRate: 90,
  emberSize: 0.05,
  emberSpeed: 1.5,
  emberLifetime: 1.2,
  emberRise: 1.2,
  emberTurbulence: 0.4,
  emberGlow: 1.4,
  emberStretch: 0.16,
  colorEmberA: '#ffe8a0',
  colorEmberB: '#ff7a1a',
  colorEmberC: '#ff2a08',
  colorEmberD: '#220a02',
  smokeRate: 35,
  smokeSize: 1.1,
  smokeSpeed: 1.2,
  smokeLifetime: 2.4,
  smokeOpacity: 0.06,
  smokeRise: 0.5,
  colorSmokeA: '#3a2a1c',
  colorSmokeB: '#2a1c14',
  colorSmokeC: '#1a0e0a',
  colorSmokeD: '#0a0604',

  /* --- sparks, motes and embers shed by the standing sphere --- */
  fieldSparkRate: 380, // particles/second off the surface
  fieldSparkSpeed: 6.0,
  fieldSparkLifetime: 0.5,
  fieldMoteRate: 180,
  fieldMoteSpeed: 2.0,
  fieldMoteLifetime: 1.4,
  fieldEmberRate: 140,
  fieldEmberSpeed: 2.5,
  fieldEmberLifetime: 1.3,
  fieldSmokeRate: 30,
  fieldSmokeSpeed: 1.0,
  fieldSmokeLifetime: 2.0,

  /* --- the front burns on the floor --- */
  platformScorchRate: 1.4, // burns per metre of front travel
  platformScorchRadius: 0.7,
  platformScorchLife: 4.5,
  platformScorchIntensity: 0.3,
  platformInnerScorchRadius: 3.0,
  platformInnerScorchLife: 7.0,
  platformInnerScorchIntensity: 0.3,
  colorScorch: '#0a0302',
  colorEmber: '#ff3a0a',

  /* --- the impact --- */
  burstSparks: 200,
  burstEmbers: 80,
  shockRadius: 6.5,
  colorShockA: '#ff8a30',
  colorShockB: '#fff7d6',
  scorchRadius: 3.6,
  scorchLife: 6.0,
  scorchIntensity: 0.35,
  muzzleSize: 0.6,
  muzzleIntensity: 1.8,
  colorMuzzleA: '#ff4a0a',
  colorMuzzleB: '#ffb04a',
  colorMuzzleC: '#fff4d6',
  castFlash: 0.1,
  colorCastFlash: '#ffd07a',
  impactShake: 0.8,
  impactFlash: 0.22,
  shakeDuration: 0.6,
  colorFlash: '#ffd07a',

  /* --- dynamic light --- */
  lightIntensity: 18,
  lightRadius: 14,
  // No lightHeight: the light sits in the sphere, so `hoverHeight` above is
  // already the answer to where it goes.
  lightColor: '#ff7a30',
  lightFlicker: 0.35, // depth of the light's gutter
  lightFlickerSpeed: 28,
  holdShake: 0.05, // continuous shake while the sphere is standing
  rumble: 0.025 // continuous shake while the front travels
};

export const ext_electricalSchema = {
  'The cast': [
    ['range', 2, 60, 0.1, 'max range'],
    ['minRange', 0, 10, 0.1, 'min range'],
    ['zoneRadius', 1.5, 12, 0.1, 'platform radius'],
    ['speed', 5, 200, 1, 'travel speed'],
    ['snapTime', 0.05, 2, 0.01, 'bloom time'],
    ['lifetime', 0.5, 12, 0.1, 'hold time'],
    ['collapseTime', 0.05, 3, 0.05, 'collapse time'],
    ['fadeTime', 0.05, 3, 0.05, 'fade out time'],
    ['cooldown', 0, 8, 0.05, 'cooldown'],
    ['castAnim', 'cast animation']
  ],
  'Where it leaves the hand': [
    ['handHeight', 0, 3, 0.01, 'hand height'],
    ['handForward', -1, 3, 0.01, 'hand forward'],
    ['handSide', -1.5, 1.5, 0.01, 'hand lateral']
  ],
  'The sphere': [
    ['sphereRadius', 0.3, 5, 0.05, 'radius'],
    ['hoverHeight', 0.4, 5, 0.05, 'hover height'],
    ['hoverAmplitude', 0, 0.3, 0.005, 'hover amplitude'],
    ['hoverSpeed', 0, 4, 0.05, 'hover speed'],
    ['distortion', 0, 1, 0.01, 'reflection ripple'],
    ['opacity', 0, 1, 0.01, 'body opacity'],
    ['glow', 0, 8, 0.05, 'emissive gain']
  ],
  'Reflective shell': [
    ['envIntensity', 0, 4, 0.01, 'room brightness'],
    ['envRoughness', 0, 1, 0.005, 'reflection blur'],
    ['reflectivity', 0, 1, 0.01, 'head-on mirror'],
    ['fresnelPower', 0.5, 8, 0.05, 'limb falloff'],
    ['specular', 0, 10, 0.05, 'key glint'],
    ['specSharp', 8, 600, 1, 'glint tightness'],
    ['shellDiffuse', 0, 2, 0.01, 'skin lighting'],
    ['shellRipple', 0.2, 12, 0.05, 'ripple scale'],
    ['colorShell', 'lit skin'],
    ['colorDeep', 'unlit skin']
  ],
  'Charge under the skin': [
    ['plasmaScale', 0.5, 12, 0.05, 'charge scale'],
    ['plasmaSpeed', 0, 4, 0.01, 'charge speed'],
    ['plasmaIntensity', 0, 4, 0.01, 'charge brightness'],
    ['plasmaCore', 0.2, 6, 0.05, 'core concentration'],
    ['plasmaWarp', 0, 2, 0.01, 'domain warp']
  ],
  'Hex panelling (off by default)': [
    ['hexScale', 0.5, 20, 0.1, 'panels / radius'],
    ['hexWidth', 0.02, 0.6, 0.005, 'panel edge width'],
    ['hexIntensity', 0, 3, 0.01, 'panel brightness'],
    ['hexPulse', 0, 2, 0.01, 'pulse-on-beat lift']
  ],
  'Surface discharge': [
    ['surfaceArcScale', 0.5, 16, 0.1, 'filaments / radius'],
    ['surfaceArcSpeed', 0, 4, 0.01, 'net evolution'],
    ['surfaceArcCrawl', -4, 4, 0.05, 'net crawl'],
    ['surfaceArcWidth', 0.01, 0.4, 0.005, 'filament width'],
    ['surfaceArcGlowWidth', 0, 0.6, 0.005, 'glow width'],
    ['surfaceArcIntensity', 0, 5, 0.01, 'discharge brightness'],
    ['surfaceArcFlicker', 0, 1, 0.01, 'stutter depth'],
    ['surfaceArcRestrike', 0.5, 30, 0.5, 'restrikes / sec'],
    ['surfaceArcWarp', 0, 2, 0.01, 'fork / buckle'],
    ['surfaceArcCharge', 0, 1, 0.01, 'live-patch mask'],
    ['colorSurfaceArcCore', 'filament core'],
    ['colorSurfaceArcGlow', 'filament glow']
  ],
  'Fresnel light': [
    ['fresnelGlow', 0, 6, 0.01, 'halo brightness'],
    ['fresnelGlowPower', 0.5, 10, 0.05, 'halo falloff'],
    ['rimPower', 0.5, 8, 0.05, 'rim sharpness'],
    ['rimIntensity', 0, 6, 0.01, 'rim brightness'],
    ['rimWidth', 0.1, 1.5, 0.01, 'rim band width']
  ],
  'Ground platform': [
    ['platformRadius', 1.5, 16, 0.1, 'platform radius'],
    ['platformRings', 0, 16, 1, 'concentric rings'],
    ['platformRingWidth', 0.01, 0.5, 0.005, 'ring width'],
    ['platformRingGlow', 0, 4, 0.01, 'ring glow'],
    ['platformInnerGlow', 0, 4, 0.01, 'inner band glow'],
    ['platformInnerPad', 0, 4, 0.05, 'inner band reach'],
    ['platformHexScale', 0.5, 16, 0.1, 'hex grain'],
    ['platformHexIntensity', 0, 2, 0.01, 'hex intensity'],
    ['platformOpacity', 0, 2, 0.01, 'platform opacity'],
    ['platformGlow', 0, 4, 0.01, 'platform glow']
  ],
  'Radial corona': [
    ['arcCount', 0, 80, 1, 'strands'],
    ['arcLength', 0.4, 8, 0.05, 'arc length'],
    ['arcVariance', 0, 1, 0.01, 'length variance'],
    ['arcJitter', 0, 1, 0.01, 'lateral wander'],
    ['arcEscape', 0.95, 1.4, 0.005, 'surface offset'],
    ['arcCurl', 0, 1.5, 0.01, 'in-flight bend'],
    ['arcUpBias', -0.5, 1, 0.01, 'vertical bias'],
    ['arcBranchFraction', 0, 0.9, 0.01, 'short arc share']
  ],
  'Corona: per-arc shape': [
    ['arcJitterAmp', 0, 1, 0.01, 'kink amplitude'],
    ['arcJitterFreq', 0.2, 16, 0.1, 'kinks / metre'],
    ['arcOctaves', 1, 5, 1, 'octaves'],
    ['arcJitterFalloff', 0.1, 0.95, 0.01, 'octave falloff'],
    ['arcCrawl', -20, 20, 0.1, 'kink crawl'],
    ['arcPinch', 0.01, 0.5, 0.005, 'end pinch'],
    ['arcBow', 0, 1, 0.01, 'mid-span bow']
  ],
  'Corona: the ribbon': [
    ['arcWidth', 0.005, 0.6, 0.005, 'width at the surface'],
    ['arcWidthTip', 0, 2, 0.01, 'width at tip'],
    ['arcCoreWidth', 0.5, 5, 0.05, 'spine multiplier'],
    ['arcCoreSharp', 0.5, 12, 0.05, 'core sharpness'],
    ['arcGlowFalloff', 0.2, 8, 0.05, 'halo falloff'],
    ['arcHaloWidth', 1, 30, 0.1, 'halo width'],
    ['arcHaloOpacity', 0, 2, 0.01, 'halo opacity'],
    ['arcOpacity', 0, 2, 0.01, 'core opacity'],
    ['arcGlow', 0, 6, 0.01, 'arc glow'],
    ['arcSoftFade', 0.02, 3, 0.01, 'soft intersection'],
    ['arcFlicker', 0, 1, 0.01, 'arc stutter'],
    ['arcFlickerSpeed', 1, 120, 1, 'stutter rate'],
    ['arcStrandFlash', 0, 1, 0.01, 'strand blink'],
    ['arcRate', 0.5, 60, 0.5, 'cycles / sec'],
    ['arcLife', 0.05, 1, 0.01, 'lit fraction of cycle']
  ],
  'The pulse': [
    ['pulseFrequency', 0.1, 8, 0.05, 'pulses / sec'],
    ['pulseStrength', 0, 1, 0.01, 'pulse strength'],
    ['pulseParticleBoost', 1, 4, 0.05, 'particle boost']
  ],
  'Sphere colours': [
    ['colorCore', 'glint tint'],
    ['colorInner', 'limb lift'],
    ['colorMid', 'charge under skin'],
    ['colorOuter', 'Fresnel halo'],
    ['colorEdge', 'Fresnel rim'],
    ['colorHex', 'hex panels'],
    ['colorPulse', 'pulse flash']
  ],
  'Corona colours': [
    ['colorArcCore', 'hot core'],
    ['colorArcInner', 'inner'],
    ['colorArcOuter', 'outer'],
    ['colorArcHalo', 'halo']
  ],
  'Platform colours': [
    ['colorPlatformRing', 'rings'],
    ['colorPlatformInner', 'inner band'],
    ['colorPlatformHex', 'hex grain'],
    ['colorPlatformDeep', 'dark fill']
  ],
  'Ground burns': [
    ['platformScorchRate', 0.05, 8, 0.05, 'burns / metre'],
    ['platformScorchRadius', 0.05, 4, 0.05, 'burn radius'],
    ['platformScorchLife', 0.5, 20, 0.1, 'burn lifetime'],
    ['platformScorchIntensity', 0, 2, 0.01, 'burn intensity'],
    ['colorScorch', 'scorch'],
    ['colorEmber', 'ember']
  ],
  'Sparks & motes': [
    ['sparkRate', 0, 1500, 1, 'front spark rate'],
    ['sparkSize', 0.005, 0.8, 0.005, 'spark size'],
    ['sparkSpeed', 0, 40, 0.1, 'spark speed'],
    ['sparkLifetime', 0.05, 4, 0.01, 'spark lifetime'],
    ['sparkGravity', -50, 5, 0.1, 'spark gravity'],
    ['sparkStretch', 0, 3, 0.01, 'spark stretch'],
    ['sparkGlow', 0, 5, 0.01, 'spark glow'],
    ['colorSpark*', 'Spark colour'],
    ['moteRate', 0, 800, 1, 'front mote rate'],
    ['moteSize', 0.005, 0.4, 0.005, 'mote size'],
    ['moteSpeed', 0, 12, 0.05, 'mote speed'],
    ['moteLifetime', 0.1, 8, 0.05, 'mote lifetime'],
    ['moteRise', -3, 8, 0.05, 'mote rise'],
    ['moteTurbulence', 0, 3, 0.01, 'mote turbulence'],
    ['colorMote*', 'Mote colour'],
    ['emberRate', 0, 600, 1, 'ember rate'],
    ['emberSize', 0.005, 0.4, 0.005, 'ember size'],
    ['emberSpeed', 0, 12, 0.05, 'ember speed'],
    ['emberLifetime', 0.1, 8, 0.05, 'ember lifetime'],
    ['emberRise', -3, 8, 0.05, 'ember rise'],
    ['emberTurbulence', 0, 3, 0.01, 'ember turbulence'],
    ['emberGlow', 0, 5, 0.01, 'ember glow'],
    ['emberStretch', 0, 3, 0.01, 'ember stretch'],
    ['colorEmber*', 'Ember colour']
  ],
  'Sphere-shed particles': [
    ['fieldSparkRate', 0, 1500, 1, 'surface spark rate'],
    ['fieldSparkSpeed', 0, 20, 0.1, 'surface spark speed'],
    ['fieldSparkLifetime', 0.05, 4, 0.01, 'surface spark life'],
    ['fieldMoteRate', 0, 1000, 1, 'surface mote rate'],
    ['fieldMoteSpeed', 0, 12, 0.05, 'surface mote speed'],
    ['fieldMoteLifetime', 0.1, 8, 0.05, 'surface mote life'],
    ['fieldEmberRate', 0, 800, 1, 'surface ember rate'],
    ['fieldEmberSpeed', 0, 12, 0.05, 'surface ember speed'],
    ['fieldEmberLifetime', 0.1, 8, 0.05, 'surface ember life'],
    ['fieldSmokeRate', 0, 200, 1, 'platform smoke rate'],
    ['fieldSmokeSpeed', 0, 8, 0.05, 'smoke speed'],
    ['fieldSmokeLifetime', 0.2, 8, 0.05, 'smoke life'],
    ['smokeSize', 0.05, 4, 0.01, 'smoke size'],
    ['smokeSpeed', 0, 8, 0.05, 'smoke speed (global)'],
    ['smokeLifetime', 0.2, 8, 0.05, 'smoke life (global)'],
    ['smokeOpacity', 0, 1, 0.005, 'smoke opacity'],
    ['smokeRise', -2, 4, 0.01, 'smoke rise'],
    ['colorSmoke*', 'Smoke colour']
  ],
  'Muzzle & impact': [
    ['muzzleSize', 0.05, 6, 0.05, 'muzzle size'],
    ['muzzleIntensity', 0, 5, 0.01, 'muzzle intensity'],
    ['colorMuzzleA', 'muzzle shell'],
    ['colorMuzzleB', 'muzzle body'],
    ['colorMuzzleC', 'muzzle arcs'],
    ['castFlash', 0, 2, 0.01, 'flash on release'],
    ['colorCastFlash', 'release flash colour'],
    ['burstSparks', 0, 600, 1, 'burst sparks'],
    ['burstEmbers', 0, 300, 1, 'burst embers'],
    ['impactShake', 0, 3, 0.01, 'shake'],
    ['impactFlash', 0, 2, 0.01, 'screen flash'],
    ['shakeDuration', 0.1, 4, 0.01, 'shake duration'],
    ['rumble', 0, 0.5, 0.005, 'travel rumble'],
    ['holdShake', 0, 0.5, 0.005, 'hold rumble'],
    ['shockRadius', 0.5, 25, 0.1, 'shockwave radius'],
    ['colorShockA', 'shockwave ring'],
    ['colorShockB', 'shockwave crest'],
    ['colorFlash', 'screen flash colour']
  ],
  'Dynamic light': [
    ['lightIntensity', 0, 120, 0.5, 'light intensity'],
    ['lightRadius', 0.5, 50, 0.1, 'light radius'],
    ['lightFlicker', 0, 1, 0.01, 'light gutter'],
    ['lightFlickerSpeed', 1, 90, 1, 'gutter rate'],
    ['lightColor', 'light colour']
  ]
};
