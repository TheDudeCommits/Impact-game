// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*! Ported into VFX Armory (ext pack) from achrefelouafi/LinearAbilityExtThreeJS, MIT, Copyright (c) 2026 mohamedachrefelouafi. */
/* ================================================================== */
/* ELECTRIC BOOST — the self buff                                      */
/* ================================================================== */
/**
 * A self cast, and the only thing in the sandbox that is not a skillshot:
 * there is no line, no circle and no travelling front. Press the key and the
 * character is *charged* for `duration` seconds.
 *
 * It is made of three parts, all driven by one 0..1 envelope (`rampIn` → hold
 * → `rampOut`) so the whole effect arrives and leaves as one thing:
 *
 *   - **the fresnel** — every material on the rig is patched once at load
 *     (`materials/FresnelAura.js`), so the rim of the body lights up from the
 *     inside, with veins crawling over the skin and a band sweeping up it.
 *     The patch is inert while the envelope is zero, which is why it costs
 *     nothing when the buff is not running.
 *   - **the arcs** — filaments struck between two points on a capsule around
 *     the body (`materials/BodyArcMaterial.js`), re-rolled `arcRate` times a
 *     second. A fraction of them (`arcEscape`) leave the body instead of
 *     crawling over it, which is what reads as lightning coming *off* the
 *     character rather than being painted on it.
 *   - **the ground** — a crater of shattered, blackened floor with the charge
 *     burning in the seams (`materials/ChargeFieldMaterial.js`), rings of
 *     lightning lying flat around it and uprights struck off its rim. The
 *     crater is the only ground pass in the sandbox that blends normally
 *     rather than additively, because it has to *darken* the stone.
 *   - **the shed** — sparks, ionised motes, electric burns under the feet and
 *     a dynamic light, all at a continuous rate while the buff holds.
 *
 * As everywhere else, nothing here is captured at activation: the envelope is
 * resolved against `duration` every frame, and both shaders resolve every
 * metre and radian below on a zero-length frame — so dragging `arcs`,
 * `bodyRadius` or `fresnelPower` while paused re-strikes the character live.
 */
export const ext_aura_electric = {
  /* --- the buff --- */
  duration: 13.7, // seconds it holds, from the moment it is triggered
  rampIn: 0.35, // seconds the envelope takes to arrive
  rampOut: 0.9, // seconds it takes to let go at the end
  cooldown: 1.0, // seconds before it can be triggered again
  playAnimation: true, // throw a cast clip on activation
  castAnim: 'cast3', // which clip in `CAST_ANIMATIONS` that is

  /* --- the fresnel on every material of the character --- */
  // `fresnel` is the master: at 0 the rig is shaded exactly as it is when the
  // buff is not running, whatever the rest of this group says.
  fresnel: 0.2, // master strength of the rim light
  fresnelPower: 1.55, // how tightly it hugs the silhouette (higher = thinner)
  fresnelBias: 0.0, // glow added to the lit body, not just the rim
  fresnelGlow: 2.35, // emissive gain — this is what blooms
  fresnelPulse: 0.5, // depth of the slow breathing
  fresnelPulseSpeed: 4.2,
  fresnelFlicker: 0.2, // depth of the electric stutter on top of it
  fresnelFlickerSpeed: 20,
  veins: 0.72, // filaments crawling over the skin
  veinScale: 1.1, // features per metre, world space
  veinSpeed: 2.05, // how fast they crawl
  veinSharp: 1.0, // 0 = soft blotches, 1 = thin filaments
  scan: 0.45, // brightness of the band sweeping up the body
  scanSpeed: 0.5, // sweeps/second
  scanWidth: 0.18, // height of the band, fraction of the body
  colorRim: '#7fc9ff',
  colorCore: '#009dff', // the hottest part of the rim
  colorVein: '#4a92ff',

  /* --- the arcs struck over and off the body --- */
  arcs: 25, // filaments alive at once (capped at 32)
  arcRate: 5.4, // times/second each one re-rolls its shape
  arcLife: 0.74, // fraction of that cycle it stays lit
  arcSpan: 0.47, // how far up or down the body one arc travels
  arcSweep: 3.2, // radians around the body it travels
  arcEscape: 0.09, // fraction of arcs that leave the body
  arcReach: 0.9, // metres an escaping arc reaches out
  arcBow: 0.035, // metres an arc bows off the skin at mid-span

  /* --- the capsule the arcs are struck on --- */
  bodyRadius: 0.39, // half-width of the body at its widest, metres
  bodyDepth: 0.1, // front-to-back radius as a fraction of that
  bodyLow: -0.2, // lowest point arcs are struck from, fraction of height
  bodyHigh: 1.01, // ... and the highest
  bodyProfile: 1.0, // 0 = a cylinder, 1 = the shoulders/ankles silhouette

  /* --- the shape of one arc (as `thunder`, per metre) --- */
  arcJitter: 0.16, // metres of kink at the coarsest octave
  arcJitterScale: 3.3, // kinks per metre
  arcOctaves: 4, // 1–5
  arcJitterFalloff: 0.53,
  arcCrawl: 4.2, // how fast the kinks slide along the arc
  arcPinch: 0.225, // fraction of the span the ends are pulled straight over

  /* --- the ribbon --- */
  arcWidth: 0.017, // half-width of a filament, metres
  arcTaper: 1.02, // how hard it tapers to nothing at both ends
  arcCoreWidth: 1.39, // multiplier on the hot spine
  arcCoreSharp: 3.4, // how hard the core falls off across the ribbon
  arcGlowWidth: 6.0, // the halo, × the core width
  arcGlowFalloff: 2.4,
  arcGlowOpacity: 0.4,
  arcSoftFade: 0.35, // metres of soft fade where an arc meets geometry
  arcFlicker: 0.33, // whole-bundle brightness stutter
  arcFlickerSpeed: 30,
  arcStrandFlash: 0.45, // how much individual arcs blink out
  arcGlow: 3.24, // emissive gain
  arcOpacity: 1.0,
  colorArcCore: '#ffffff',
  colorArcInner: '#c9ecff',
  colorArcOuter: '#3aa0ff',
  colorArcHalo: '#0b3fc8',

  /* --- sparks & motes shed while it holds --- */
  sparkRate: 800, // particles/second
  sparkSize: 0.045,
  sparkSpeed: 16.5,
  sparkLifetime: 1.12,
  sparkGravity: -11.0,
  sparkStretch: 0.16,
  colorSparkA: '#73ccf2',
  colorSparkB: '#4d9aff',
  colorSparkC: '#c9ecff',
  colorSparkD: '#1e5b95',
  moteRate: 70,
  moteSize: 0.05,
  moteSpeed: 1.1,
  moteLifetime: 1.5,
  moteRise: 2.0, // upward drift, metres/second
  moteTurbulence: 0.8,
  colorMoteA: '#53c7ee',
  colorMoteB: '#c9ecff',
  colorMoteC: '#3aa0ff',
  colorMoteD: '#02195f',

  /* --- what the floor under the caster does --- */
  groundRate: 3.5, // electric burns laid per second
  groundRadius: 1.0, // radius of one, metres
  groundSpread: 0.9, // how far off the feet they are scattered, metres
  groundLife: 0.55,
  groundIntensity: 0.9,
  groundBranches: 0.6, // how finely a burn splits into filaments
  colorGround: '#9fdcff',
  colorGroundEmber: '#4aa8ff',

  /* --- the crater the charge stands in --- */
  /**
   * The floor, shattered and gone dark under the character
   * (`materials/ChargeFieldMaterial.js`). The one ground pass in the sandbox
   * that blends *normally* rather than additively, because the read is a hole
   * in the room: `fieldDark` is how far the stone inside the circle is pushed
   * toward `colorFieldCrust`, and the light in the seams is what it is bright
   * against. Turn `fieldOpacity` to 0 and the whole crater — plates, seams and
   * lip — costs one discarded quad.
   */
  fieldRadius: 1.0, // radius of the broken circle, metres
  fieldHeight: 0.01, // metres above the floor the quad is seated
  fieldEdge: 0.02, // width of the torn lip, metres
  fieldEdgeGlow: 6.0, // how hot the lip burns
  fieldTear: 0.055, // how far out of round the boundary is dragged
  fieldDark: 1.0, // how black the crust goes, 0 = the floor is untouched
  fieldDarkScale: 1.7, // grain over the plates, features per metre
  fieldDarkContrast: 1.6,
  fieldPlateScale: 5.65, // shards per metre
  fieldPlateTone: 0.68, // how differently one shard is toned from the next
  fieldSeamWidth: 0.04, // width of a lit seam, in cell units
  fieldSeams: 1.31, // how brightly the seams burn
  fieldVeins: 0.75, // filaments crawling over the shards
  fieldVeinScale: 2.4,
  fieldWarp: 0.55, // domain warp on them, so they wander
  fieldCrawl: 0.45,
  fieldEmbers: 0.85, // single hot points glittering in the crust
  fieldEmberScale: 5.0,
  fieldFalloff: 3.5, // how the light dies back toward the lip
  fieldPulse: 0.21,
  fieldPulseSpeed: 1.8,
  fieldOpacity: 1.0,
  fieldGlow: 2.6,
  colorFieldCrust: '#03060c', // the bottom of the hole
  colorFieldPlate: '#0b1622', // the face of a shard
  colorFieldSeam: '#3aa0ff',
  colorFieldEmber: '#c9ecff',

  /* --- the rings running around the crater --- */
  /**
   * Filaments lying flat on the ground, each a partial loop with its radius
   * pushed in and out by noise sampled **on the bearing** — so a lobe belongs
   * to a patch of floor and every ring in the stack agrees about where the
   * ground bulges, instead of reading as unrelated hoops.
   */
  ringCount: 6, // rings alive at once (capped at 16)
  ringRate: 3.2, // times/second each one re-rolls
  ringLife: 0.8, // fraction of that cycle it stays lit
  ringInner: 1.43, // innermost ring, × fieldRadius
  ringOuter: 1.02, // ... and the outermost
  ringLift: 0.55, // metres above the floor the stack reaches
  ringSweep: 0.78, // fraction of the full turn one ring covers
  ringWobble: 0.22, // metres its radius is pushed in and out
  ringWobbleScale: 2.1, // lobes around the circle
  ringRipple: 0.1, // metres it lifts and dips as it runs
  ringWrithe: 0.4, // how fast the lobes crawl around the floor
  ringWidth: 0.016, // half-width of a ring filament, metres

  /* --- the uprights struck off the rim --- */
  /**
   * `spireCross` of them arch clear over the middle and earth on the far side
   * — that is the roof of the cage; the rest climb to `spireHeight` and end in
   * the air, leaning outward by `spireLean` — that is the crown standing
   * around the edge.
   */
  spireCount: 30, // uprights alive at once (capped at 32)
  spireRate: 9.4, // strikes/second
  spireLife: 0.64, // fraction of the cycle one stays lit
  spireHeight: 0.7, // metres a climbing upright reaches
  spireCross: 0.28, // fraction that arch across the circle instead
  spireSpan: 1.9, // radians of rim a crossing arch spans
  spireSpread: 0.3, // ... and how far a climbing one drifts around
  spireLean: 0.3, // metres a climbing one bows outward
  spireWidth: 0.02, // half-width of an upright filament, metres

  /* --- the ribbon both of them are drawn on --- */
  coilJitter: 0.035, // metres of kink at the coarsest octave
  coilJitterScale: 4.2, // kinks per metre
  coilOctaves: 4, // 1–5
  coilJitterFalloff: 0.62,
  coilCrawl: 3.0, // how fast the kinks slide along a filament
  coilPinch: 0.16, // fraction of the span the ends are pulled straight over
  coilTaper: 0.6, // how hard a filament tapers to nothing at both ends
  coilCoreWidth: 1.4, // multiplier on the hot spine
  coilCoreSharp: 3.4,
  coilGlowWidth: 6.0, // the halo, × the core width
  coilGlowFalloff: 4.05,
  coilGlowOpacity: 0.37,
  coilSoftFade: 0.8, // metres of soft fade where a filament meets geometry
  coilFlicker: 0.28, // whole-coil brightness stutter
  coilFlickerSpeed: 62,
  coilStrandFlash: 0.4, // how much individual filaments blink out
  coilGlow: 3.0, // emissive gain
  coilOpacity: 1.0,
  colorCoilCore: '#ffffff',
  colorCoilInner: '#c9ecff',
  colorCoilOuter: '#3aa0ff',
  colorCoilHalo: '#0b3fc8',

  /* --- dynamic light --- */
  lightIntensity: 11,
  lightRadius: 9,
  lightHeight: 1.1, // metres above the floor the light sits
  lightColor: '#63b8ff',
  lightFlicker: 0.35, // depth of its gutter, 0 = steady
  lightFlickerSpeed: 22,

  /* --- the moment it is triggered, and the moment it lets go --- */
  burstSparks: 140,
  ringRadius: 4.5, // shockwave ring across the floor, metres
  activateFlash: 0.16, // screen flash on activation
  activateShake: 0.5,
  shakeDuration: 0.5,
  endFlash: 0.1, // ... and when it expires
  rumble: 0.018, // continuous shake while it holds
  colorFlash: '#c9ecff',

  /* --- Armory port: fields the combined sandbox needs --- */
  range: 0.4, // Armory: the circle sits on the caster
  minRange: 0, // Armory: self cast
  zoneRadius: 4.5, // Armory: indicator radius (matches the ground ring)
  speed: 1 // Armory: unused (self cast)
};

export const ext_aura_electricSchema = {
  'The buff': [
    ['duration', 1, 60, 0.1, 'duration'],
    ['rampIn', 0.05, 3, 0.01, 'ramp in'],
    ['rampOut', 0.05, 4, 0.01, 'ramp out'],
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
  'The arcs': [
    ['arcs', 1, 32, 1, 'arcs at once'],
    ['arcRate', 0.2, 20, 0.1, 'strikes / sec'],
    ['arcLife', 0.05, 1, 0.01, 'lit fraction'],
    ['arcSpan', 0.02, 1, 0.01, 'travel up the body'],
    ['arcSweep', 0.05, 3.2, 0.01, 'travel around it'],
    ['arcEscape', 0, 1, 0.01, 'fraction leaving'],
    ['arcReach', 0, 4, 0.01, 'reach off the body'],
    ['arcBow', 0, 1, 0.005, 'bow off the skin']
  ],
  'The body they are struck on': [
    ['bodyRadius', 0.05, 1.5, 0.01, 'radius'],
    ['bodyDepth', 0.1, 2, 0.01, 'front-to-back'],
    ['bodyLow', -0.2, 1, 0.01, 'lowest point'],
    ['bodyHigh', 0, 1.6, 0.01, 'highest point'],
    ['bodyProfile', 0, 1, 0.01, 'silhouette']
  ],
  'The shape of one arc': [
    ['arcJitter', 0, 1, 0.005, 'kink amplitude'],
    ['arcJitterScale', 0.2, 30, 0.1, 'kinks / metre'],
    ['arcOctaves', 1, 5, 1, 'octaves'],
    ['arcJitterFalloff', 0.1, 0.95, 0.01, 'octave falloff'],
    ['arcCrawl', -20, 20, 0.1, 'kink crawl'],
    ['arcPinch', 0.01, 0.5, 0.005, 'end pinch']
  ],
  'The ribbon': [
    ['arcWidth', 0.002, 0.3, 0.001, 'width'],
    ['arcTaper', 0.05, 3, 0.01, 'end taper'],
    ['arcCoreWidth', 1, 6, 0.01, 'spine thickness'],
    ['arcCoreSharp', 0.5, 12, 0.05, 'core sharpness'],
    ['arcGlowWidth', 1, 30, 0.1, 'halo width'],
    ['arcGlowFalloff', 0.2, 8, 0.05, 'halo falloff'],
    ['arcGlowOpacity', 0, 2, 0.01, 'halo opacity'],
    ['arcSoftFade', 0.02, 3, 0.01, 'soft intersection'],
    ['arcFlicker', 0, 1, 0.01, 'brightness stutter'],
    ['arcFlickerSpeed', 1, 120, 1, 'stutter rate'],
    ['arcStrandFlash', 0, 1, 0.01, 'arc blink'],
    ['arcGlow', 0, 8, 0.01, 'glow'],
    ['arcOpacity', 0, 2, 0.01, 'opacity'],
    ['colorArcCore', 'core'],
    ['colorArcInner', 'inner'],
    ['colorArcOuter', 'outer'],
    ['colorArcHalo', 'halo']
  ],
  'Sparks & motes': [
    ['sparkRate', 0, 800, 1, 'spark rate'],
    ['sparkSize', 0.005, 0.8, 0.005, 'spark size'],
    ['sparkSpeed', 0, 30, 0.1, 'spark speed'],
    ['sparkLifetime', 0.05, 4, 0.01, 'spark lifetime'],
    ['sparkGravity', -50, 5, 0.1, 'spark gravity'],
    ['sparkStretch', 0, 3, 0.01, 'spark stretch'],
    ['moteRate', 0, 500, 1, 'mote rate'],
    ['moteSize', 0.005, 0.4, 0.005, 'mote size'],
    ['moteSpeed', 0, 12, 0.05, 'mote speed'],
    ['moteLifetime', 0.1, 8, 0.05, 'mote lifetime'],
    ['moteRise', -3, 8, 0.05, 'mote rise'],
    ['moteTurbulence', 0, 3, 0.01, 'mote turbulence'],
    ['colorSpark*', 'Spark colour'],
    ['colorMote*', 'Mote colour']
  ],
  'The crater under the feet': [
    ['fieldRadius', 0.2, 12, 0.05, 'radius'],
    ['fieldHeight', 0, 0.5, 0.005, 'height off the floor'],
    ['fieldEdge', 0.02, 2, 0.01, 'lip width'],
    ['fieldEdgeGlow', 0, 6, 0.01, 'lip glow'],
    ['fieldTear', 0, 0.6, 0.005, 'out of round'],
    ['fieldDark', 0, 1, 0.01, 'darkness'],
    ['fieldDarkScale', 0.1, 12, 0.05, 'grain / metre'],
    ['fieldDarkContrast', 0.2, 6, 0.05, 'grain contrast'],
    ['fieldPlateScale', 0.1, 8, 0.05, 'shards / metre'],
    ['fieldPlateTone', 0, 1, 0.01, 'shard variation'],
    ['fieldSeamWidth', 0.005, 0.4, 0.005, 'seam width'],
    ['fieldSeams', 0, 4, 0.01, 'seam glow'],
    ['fieldVeins', 0, 3, 0.01, 'filaments'],
    ['fieldVeinScale', 0.1, 12, 0.05, 'filaments / metre'],
    ['fieldWarp', 0, 3, 0.01, 'warp'],
    ['fieldCrawl', -4, 4, 0.01, 'crawl'],
    ['fieldEmbers', 0, 3, 0.01, 'embers'],
    ['fieldEmberScale', 0.5, 20, 0.1, 'embers / metre'],
    ['fieldFalloff', 0.05, 5, 0.05, 'light falloff'],
    ['fieldPulse', 0, 1, 0.01, 'breathing'],
    ['fieldPulseSpeed', 0.05, 8, 0.05, 'breathing rate'],
    ['fieldOpacity', 0, 2, 0.01, 'opacity'],
    ['fieldGlow', 0, 8, 0.01, 'glow'],
    ['colorFieldCrust', 'crust'],
    ['colorFieldPlate', 'shards'],
    ['colorFieldSeam', 'seams'],
    ['colorFieldEmber', 'embers & lip']
  ],
  'Rings around the crater': [
    ['ringCount', 0, 16, 1, 'rings at once'],
    ['ringRate', 0.05, 10, 0.05, 'strikes / sec'],
    ['ringLife', 0.05, 1, 0.01, 'lit fraction'],
    ['ringInner', 0, 1.5, 0.01, 'innermost × radius'],
    ['ringOuter', 0, 1.5, 0.01, 'outermost × radius'],
    ['ringLift', 0, 4, 0.01, 'stack height'],
    ['ringSweep', 0.05, 1, 0.01, 'turn covered'],
    ['ringWobble', 0, 2, 0.01, 'radial distortion'],
    ['ringWobbleScale', 0.2, 10, 0.05, 'lobes around'],
    ['ringRipple', 0, 1, 0.005, 'vertical ripple'],
    ['ringWrithe', -4, 4, 0.01, 'lobe crawl'],
    ['ringWidth', 0.002, 0.2, 0.001, 'width']
  ],
  'Uprights across the circle': [
    ['spireCount', 0, 32, 1, 'uprights at once'],
    ['spireRate', 0.05, 20, 0.05, 'strikes / sec'],
    ['spireLife', 0.05, 1, 0.01, 'lit fraction'],
    ['spireHeight', 0.1, 8, 0.05, 'height reached'],
    ['spireCross', 0, 1, 0.01, 'fraction crossing'],
    ['spireSpan', 0.05, 3.14, 0.01, 'arch span'],
    ['spireSpread', 0, 1.5, 0.01, 'climber drift'],
    ['spireLean', 0, 2, 0.01, 'outward lean'],
    ['spireWidth', 0.002, 0.2, 0.001, 'width']
  ],
  'The coil ribbon': [
    ['coilJitter', 0, 1, 0.005, 'kink amplitude'],
    ['coilJitterScale', 0.2, 30, 0.1, 'kinks / metre'],
    ['coilOctaves', 1, 5, 1, 'octaves'],
    ['coilJitterFalloff', 0.1, 0.95, 0.01, 'octave falloff'],
    ['coilCrawl', -20, 20, 0.1, 'kink crawl'],
    ['coilPinch', 0.01, 0.5, 0.005, 'end pinch'],
    ['coilTaper', 0.05, 3, 0.01, 'end taper'],
    ['coilCoreWidth', 1, 6, 0.01, 'spine thickness'],
    ['coilCoreSharp', 0.5, 12, 0.05, 'core sharpness'],
    ['coilGlowWidth', 1, 30, 0.1, 'halo width'],
    ['coilGlowFalloff', 0.2, 8, 0.05, 'halo falloff'],
    ['coilGlowOpacity', 0, 2, 0.01, 'halo opacity'],
    ['coilSoftFade', 0.02, 3, 0.01, 'soft intersection'],
    ['coilFlicker', 0, 1, 0.01, 'brightness stutter'],
    ['coilFlickerSpeed', 1, 120, 1, 'stutter rate'],
    ['coilStrandFlash', 0, 1, 0.01, 'filament blink'],
    ['coilGlow', 0, 8, 0.01, 'glow'],
    ['coilOpacity', 0, 2, 0.01, 'opacity'],
    ['colorCoilCore', 'core'],
    ['colorCoilInner', 'inner'],
    ['colorCoilOuter', 'outer'],
    ['colorCoilHalo', 'halo']
  ],
  'Burns under the feet': [
    ['groundRate', 0, 30, 0.1, 'burns / sec'],
    ['groundRadius', 0.05, 5, 0.05, 'burn radius'],
    ['groundSpread', 0, 5, 0.05, 'scatter'],
    ['groundLife', 0.05, 5, 0.05, 'burn lifetime'],
    ['groundIntensity', 0, 3, 0.01, 'burn intensity'],
    ['groundBranches', 0, 3, 0.01, 'branch detail'],
    ['colorGround', 'burn'],
    ['colorGroundEmber', 'ember']
  ],
  'Dynamic light': [
    ['lightIntensity', 0, 60, 0.5, 'intensity'],
    ['lightRadius', 1, 40, 0.5, 'radius'],
    ['lightHeight', 0, 3, 0.01, 'height'],
    ['lightFlicker', 0, 1, 0.01, 'gutter'],
    ['lightFlickerSpeed', 1, 90, 1, 'gutter rate'],
    ['lightColor', 'colour']
  ],
  'Charge & release': [
    ['burstSparks', 0, 600, 1, 'sparks on charge'],
    ['ringRadius', 0.5, 20, 0.1, 'shockwave radius'],
    ['activateFlash', 0, 2, 0.01, 'flash on charge'],
    ['endFlash', 0, 2, 0.01, 'flash on release'],
    ['activateShake', 0, 4, 0.01, 'shake on charge'],
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
