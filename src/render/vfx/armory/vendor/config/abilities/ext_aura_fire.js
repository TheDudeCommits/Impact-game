// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*! Ported into VFX Armory (ext pack) from achrefelouafi/LinearAbilityExtThreeJS, MIT, Copyright (c) 2026 mohamedachrefelouafi. */
/* ================================================================== */
/* FIRE BOOST — the third self buff                                    */
/* ================================================================== */
/**
 * The third thing in the sandbox that is not a skillshot, and the third
 * reading of the same idea. Electric Boost is a **charge** — hard, fast,
 * struck in filaments. Magic Boost is a **channel** — slow, wide and dark.
 * This one **burns**: press the key and the character catches fire, is masked
 * in heat, and is orbited by embers dragging fire behind them.
 *
 * Built out of the same parts as the other two, driven by the same single
 * 0..1 envelope (`rampIn` → hold → `rampOut`):
 *
 *   - **the fresnel** — the *same* patch on the character's own materials the
 *     other two buffs use (`materials/FresnelAura.js`), shaded as heat from
 *     this block. This is the mask: the rim, the veins crawling up the skin
 *     and the band sweeping the body are what put the fire *on the character*
 *     rather than in front of them, and every one of them is a control below.
 *   - **the tongues** — flame rooted on the body's own capsule and climbing
 *     off it (`materials/FireBodyMaterial.js`). The signature of the buff, and
 *     the third thing in the project drawn on that capsule after the charge's
 *     arcs and the channel's ribbons.
 *   - **the orbs** — burning spheres turning about the body on leaning rings,
 *     each dragging a wake of fire (`materials/EmberOrbMaterial.js`). The one
 *     effect in the sandbox whose trail is not recorded but *derived*: it is
 *     the orb's own orbit sampled backward in time, which is why dragging
 *     `orbTilt` below re-sweeps a second of wake instantly, paused or not.
 *   - **the ground** — the floor burnt black under the caster with the fire
 *     still working in the cracks (`materials/CinderFieldMaterial.js`). The
 *     third ground pass that blends normally rather than additively, and for
 *     the same reason as the other two: it has to *darken* the stone.
 *   - **the shed** — embers off the body and off the orbs, smoke rolling over
 *     them, scorches on the floor and a light that gutters like a fire does.
 *
 * As everywhere else, nothing is captured at activation: every metre, radian
 * and rate below is re-resolved on a zero-length frame.
 */
export const ext_aura_fire = {
  /* --- the buff --- */
  duration: 13.5, // seconds it holds, from the moment it is triggered
  rampIn: 0.5, // seconds the envelope takes to arrive
  rampOut: 1.4, // seconds it takes to burn down at the end
  cooldown: 1.0, // seconds before it can be triggered again
  playAnimation: true, // throw a cast clip on activation
  castAnim: 'cast2', // which clip in `CAST_ANIMATIONS` that is

  /* --- the fresnel mask on every material of the character --- */
  // `fresnel` is the master: at 0 the rig is shaded exactly as it is when the
  // buff is not running, whatever the rest of this group says.
  fresnel: 0.42, // master strength of the rim light
  fresnelPower: 1.5, // how tightly it hugs the silhouette (higher = thinner)
  fresnelBias: 0.02, // heat added to the lit body, not just the rim
  fresnelGlow: 2.4, // emissive gain — this is what blooms
  fresnelPulse: 0.35, // depth of the slow breathing
  fresnelPulseSpeed: 3.0,
  fresnelFlicker: 0.28, // depth of the guttering on top of it
  fresnelFlickerSpeed: 16,
  veins: 0.85, // filaments of fire crawling over the skin
  veinScale: 1.6, // features per metre, world space
  veinSpeed: 2.6, // how fast they crawl (positive = up the body)
  veinSharp: 0.85, // 0 = soft blotches, 1 = thin filaments
  scan: 0.3, // brightness of the band sweeping up the body
  scanSpeed: 0.7, // sweeps/second
  scanWidth: 0.22, // height of the band, fraction of the body
  colorRim: '#ff6a1e',
  colorCore: '#ffd27a', // the hottest part of the rim
  colorVein: '#ff9a2e',

  /* --- the skeleton the fire is rooted on --- */
  /**
   * There is no capsule here. The tongues are rooted on the rig's *own* limb
   * segments, resolved out of the skeleton by `CharacterController` and handed
   * to the shader as world-space joints every frame — which is why fire on a
   * forearm swings with the arm. The only control the shape needs is how
   * thick the limbs are taken to be, since the rig carries no such number.
   */
  boneThickness: 1.0, // multiplier on every limb's half-width

  /* --- the tongues climbing off it --- */
  flames: 80, // tongues alive at once (capped at 96)
  flameRate: 1.15, // times/second each one re-rolls
  flameLife: 0.59, // fraction of that cycle it is burning
  flameSprout: 0.56, // how long it starts out, fraction of full length
  flameLength: 0.5, // metres a tongue reaches at full size, on a chest
  flameLengthVary: 0.5, // how differently one is sized from the next
  // The three controls that hold the fire *on* the rig. `bend` is the one
  // that matters: at 1 a tongue leaves the skin on a straight diagonal, and
  // the higher it goes the longer the tongue lies along the limb before it
  // turns upward. `limbTaper` sizes each tongue to the bone under it, so a
  // toe carries a lick and a ribcage carries a sheet.
  flameBend: 2.1, // how late the climb turns from the limb to the vertical
  flameLimbTaper: 0.85, // how far length and width follow the limb's own girth
  flameWrap: 1.2, // radians a tongue winds about the limb as it climbs
  flameLean: 0.06, // metres its tip peels away from the body
  flameClimb: 0, // metres/second the whole tongue drifts upward
  flameOffset: 0, // metres its root sits off the skin
  flameSway: 0.16, // metres its tip wanders, x its length
  flameSwayPower: 2.9, // how hard the wander is held to the root
  flameSwayScale: 2.2, // waves along one tongue
  flameSwaySpeed: 1.8, // how fast the wander travels up it

  /* --- the sheet one tongue is drawn on --- */
  flameWidth: 0.1, // half-width at the root, metres
  flameWidthVary: 0.45,
  flameTaper: 1.2, // how hard it tapers to a point at the tip
  flameRootPinch: 0.1, // fraction of its length the root is pinched over
  flameBank: 0.35, // 0 = camera-facing, 1 = standing off the skin
  flameGlowWidth: 2.8, // the heat around it, × the sheet width
  flameGlowFalloff: 2.4,
  flameGlowOpacity: 0.28,
  flameSharp: 1.3, // how hard the sheet falls off across itself
  flameTear: 0.9, // how far the tip breaks into separate licks
  flameTearScale: 3.0, // licks along one tongue
  flameTearCross: 0.9, // ... and across it
  flameTearSpeed: 1.2, // how fast they travel
  flameTearBias: 0.6, // where the tearing starts, up the tongue
  flameHeat: 1.55, // how hard the temperature ramp is driven
  flameCoreSize: 0.85, // <1 opens the white core out, >1 closes it down
  flameSmoke: 0.5, // how far what is going out goes to smoke
  flameFlicker: 0.2, // brightness gutter
  flameFlickerSpeed: 18,
  flameStrandFade: 0.5, // how much individual tongues dim
  flameSoftFade: 0.3, // metres of soft fade where a tongue meets geometry
  flameGlow: 2.5, // emissive gain
  flameOpacity: 1.0,
  colorFlameCore: '#fff3d0',
  colorFlameBody: '#ff8a20',
  colorFlameEmber: '#e0430a',
  colorFlameSmoke: '#160705',

  /* --- the orbs turning about the body --- */
  /**
   * By default each orb is bound to **one bone of the rig** and corkscrews
   * along it, dragging its wake around the limb — which is what keeps the
   * brightest thing in the buff on the character rather than a metre out in
   * the air beside them.
   *
   * The armillary the six `orbRadius`…`orbBob` sliders describe is still
   * here, underneath: each orb runs its own ring, the ring is leaned over by
   * `orbTilt` and turned about the body by the golden angle times the orb's
   * index, and `orbPrecess` drifts the whole thing. `orbCling` lerps between
   * the two, so winding it to 0 gives back the sphere of rings.
   */
  orbs: 8, // orbs alive at once (capped at 16)
  // At 1 the orbs abandon the ring entirely and ride the rig's own limbs —
  // a tight helix about one bone each, dragging their wakes around it. Wind
  // it down toward 0 to lerp back out to the armillary the six sliders below
  // describe; anywhere in between is a usable shape.
  orbCling: 1.0, // 0 = the ring, 1 = wound about a bone
  orbCloud: 0.075, // metres its helix stands off the limb's surface
  orbSpiral: 0.26, // slides/second it runs up and down the bone
  orbWhip: 2.8, // x orbRate — how fast it whips around the limb
  orbRadius: 1.09, // radius of a ring, metres
  orbRadiusVary: 0.16, // how differently one ring is sized from the next
  orbSeat: 0.55, // height of the centre, fraction of the body
  orbTilt: 0.95, // radians the rings lean over
  orbPrecess: 0.385, // turns/second the whole armillary drifts
  orbRate: 0.38, // turns/second one orb runs its ring
  orbRateVary: 0.25,
  orbBob: 0.12, // metres it rises and falls as it goes
  orbBobRate: 0.3,
  orbSize: 0.025, // radius of one orb, metres
  orbSizeVary: 0.04,
  orbStretch: 0.43, // how far it is drawn out along its own travel
  orbFalloff: 0.78, // how the ball fades toward its silhouette
  orbRim: 0.81, // hot ring at that silhouette
  orbRimPower: 2.4,
  orbCells: 0.78, // convection churning over the surface
  orbCellScale: 2.8, // cells per orb
  orbCellWarp: 0.6, // domain warp on them, so they are not a lattice
  orbBoil: 1.0, // how fast the surface boils upward
  orbHeat: 1.4, // how hard the temperature ramp is driven
  orbCoreSize: 0.8, // <1 opens the white core out, >1 closes it down
  orbCoronaSize: 2.8, // the light it sits inside, × the ball
  orbCoronaFalloff: 1.5,
  orbCoronaOpacity: 0.3,
  orbFlicker: 0.15,
  orbFlickerSpeed: 16,
  orbGlow: 2.8,
  orbOpacity: 1.0,
  orbEmberRate: 160, // embers/second dribbling off the orbs
  orbEmberSpeed: 1.6,
  colorOrbCore: '#fff7e0',
  colorOrbFlame: '#ff9524',
  colorOrbEmber: '#e6440a',
  colorOrbSmoke: '#180806',

  /* --- the fire each orb drags behind it --- */
  /**
   * Not a recorded trail: `trailSpan` seconds of the orb's *own* orbit,
   * sampled backward in time in the vertex shader. It is exact, it is full
   * length on the first frame, and it re-sweeps the instant any orbit control
   * above is moved — which is the whole reason it is built this way.
   */
  trailSpan: 0.95, // seconds of the orbit's past the wake covers
  trailRise: 0.12, // metres/second the wake lifts off the path
  trailWander: 0.035, // metres it frays as it ages
  trailWanderScale: 2.9,
  trailWanderSpeed: 0.7,
  trailWidth: 1.15, // half-width at the head, × the orb's own radius
  trailTaper: 0.9, // how hard it narrows toward the far end
  trailHeadSwell: 0.4, // extra width where it leaves the ball
  trailGlowWidth: 2.8, // the halo, × the wake
  trailGlowFalloff: 2.2,
  trailGlowOpacity: 0.3,
  trailSharp: 1.35, // how hard the wake falls off across itself
  trailTear: 0.75, // how far it breaks into separate puffs
  trailTearScale: 3.4,
  trailTearSpeed: 1.0,
  trailTearBias: 0.55,
  trailHeat: 1.5,
  trailCoreSize: 0.75,
  trailCool: 1.4, // how fast it cools with age — high keeps a white collar
  trailEndFade: 0.28, // fraction of the tail dissolved away
  trailFlicker: 0.12,
  trailFlickerSpeed: 14,
  trailSoftFade: 0.35, // metres of soft fade where a wake meets geometry
  trailGlow: 1.88,
  trailOpacity: 0.95,
  colorTrailCore: '#fff2cc',
  colorTrailFlame: '#ff7a14',
  colorTrailEmber: '#cc2c06',
  colorTrailSmoke: '#140705',

  /* --- the floor burnt out under the caster --- */
  /**
   * The char *subtracts* from the room and the cracks in it burn — one pass,
   * blended normally, alpha `max(char, light)`. Turn `fieldOpacity` to 0 and
   * the whole burn — char, cracks, embers and lip — costs one discarded quad.
   */
  fieldRadius: 1.5, // radius of the burn, metres
  fieldHeight: 0.065, // metres above the floor the quad is seated
  fieldFeather: 0.17, // metres the edge fades over
  fieldTear: 0.075, // how far out of round the boundary is dragged
  fieldChar: 0.57, // how black the stone goes, 0 = the floor is untouched
  fieldCharScale: 3.1, // grain over it, features per metre
  fieldCharContrast: 1.6,
  fieldCrackScale: 1.8, // splits per metre
  fieldCrackWidth: 0.15, // how wide a split is
  fieldCracks: 1.3, // how brightly they burn
  fieldWarp: 0.6, // domain warp on them, so they wander
  fieldCrawl: 0.22, // how fast the crust works
  fieldEmbers: 1.0, // single hot points glittering in the char
  fieldEmberScale: 5.5,
  fieldRing: 1.1, // the lip, still burning
  fieldRingWidth: 0.14, // metres
  fieldSweep: 0.4, // one bright arc turning around the lip
  fieldSweepSpeed: 0.15, // turns/second
  fieldFalloff: 1.3, // how the light dies back toward the lip
  fieldPulse: 0.18,
  fieldPulseSpeed: 0.55,
  fieldOpacity: 2,
  fieldGlow: 5.94,
  colorFieldChar: '#0a0503', // the burnt stone
  colorFieldCrack: '#ff5a10',
  colorFieldEmber: '#ffc46a',
  colorFieldRing: '#ff7a1e',

  /* --- embers & smoke shed while it holds --- */
  emberRate: 220, // particles/second off the body
  emberSize: 0.03,
  emberSpeed: 2.2,
  emberLifetime: 1.25,
  emberRise: 1.6, // upward drift, metres/second
  emberTurbulence: 0.9,
  emberGlow: 1.6,
  colorEmberA: '#fff0c0',
  colorEmberB: '#ffa32e',
  colorEmberC: '#e0430a',
  colorEmberD: '#3a0a02',
  smokeRate: 8, // puffs/second
  smokeSize: 0.28,
  smokeSpeed: 0.9,
  smokeLifetime: 2.6,
  smokeRise: 1.1,
  smokeTurbulence: 0,
  smokeGlow: 2.1, // held under 1: this is the shadow in the effect
  colorSmokeA: '#3a2118',
  colorSmokeB: '#241611',
  colorSmokeC: '#150d0a',
  colorSmokeD: '#080505',

  /* --- what the floor around the caster does --- */
  groundRate: 3.0, // scorches laid per second
  groundRadius: 0.9, // radius of one, metres
  groundSpread: 1.0, // how far off the feet they are scattered, metres
  groundLife: 2.6,
  groundIntensity: 0.9,
  colorGround: '#120806',
  colorGroundEmber: '#ff6a1e',

  /* --- dynamic light --- */
  lightIntensity: 13,
  lightRadius: 9.5,
  lightHeight: 1.0, // metres above the floor the light sits
  lightColor: '#ff8a3c',
  lightFlicker: 0.3, // depth of its gutter, 0 = steady
  lightFlickerSpeed: 9,

  /* --- the moment it catches, and the moment it goes out --- */
  burstEmbers: 260,
  burstSpread: 0.55, // radius embers are thrown from on the beats, metres
  ringRadius: 4.8, // shockwave ring across the floor, metres
  activateFlash: 0.18, // screen flash on ignition
  activateShake: 0.55,
  shakeDuration: 0.55,
  endFlash: 0.1, // ... and when it burns out
  endSmoke: 70, // puffs thrown as it goes
  rumble: 0.016, // continuous shake while it holds
  colorFlash: '#ffb066',

  /* --- Armory port: fields the combined sandbox needs --- */
  range: 0.4, // Armory: the circle sits on the caster
  minRange: 0, // Armory: self cast
  zoneRadius: 4.8, // Armory: indicator radius (matches the ground ring)
  speed: 1 // Armory: unused (self cast)
};

export const ext_aura_fireSchema = {
  'The buff': [
    ['duration', 1, 60, 0.1, 'duration'],
    ['rampIn', 0.05, 4, 0.01, 'ramp in'],
    ['rampOut', 0.05, 6, 0.01, 'burn down'],
    ['cooldown', 0, 20, 0.05, 'cooldown'],
    ['playAnimation', 'throw a clip'],
    ['castAnim', 'cast animation']
  ],
  'Fresnel mask on the character': [
    ['fresnel', 0, 3, 0.01, 'rim strength'],
    ['fresnelPower', 0.2, 8, 0.05, 'rim tightness'],
    ['fresnelBias', 0, 1, 0.005, 'body heat'],
    ['fresnelGlow', 0, 8, 0.05, 'glow'],
    ['fresnelPulse', 0, 1, 0.01, 'breathing'],
    ['fresnelPulseSpeed', 0.1, 12, 0.05, 'breathing rate'],
    ['fresnelFlicker', 0, 1, 0.01, 'gutter'],
    ['fresnelFlickerSpeed', 1, 90, 1, 'gutter rate'],
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
  'The skeleton the fire is rooted on': [
    ['boneThickness', 0, 4, 0.01, 'limb thickness']
  ],
  'The tongues': [
    ['flames', 1, 96, 1, 'tongues at once'],
    ['flameRate', 0.05, 6, 0.01, 're-rolls / sec'],
    ['flameLife', 0.05, 1, 0.01, 'burning fraction'],
    ['flameSprout', 0, 1, 0.01, 'length when it catches'],
    ['flameLength', 0.05, 3, 0.01, 'length'],
    ['flameLengthVary', 0, 0.95, 0.01, 'length variation'],
    ['flameBend', 0.2, 6, 0.05, 'cling to the limb'],
    ['flameLimbTaper', 0, 1, 0.01, 'size follows the limb'],
    ['flameWrap', -6, 6, 0.05, 'wind about the limb'],
    ['flameLean', 0, 1.5, 0.01, 'lean off the body'],
    ['flameClimb', -2, 3, 0.01, 'climb / sec'],
    ['flameOffset', 0, 0.4, 0.005, 'root off the skin'],
    ['flameSway', 0, 1, 0.005, 'tip wander'],
    ['flameSwayPower', 0.1, 5, 0.05, 'wander held to root'],
    ['flameSwayScale', 0.1, 12, 0.05, 'waves along it'],
    ['flameSwaySpeed', -6, 6, 0.05, 'wander travel']
  ],
  'The sheet a tongue is drawn on': [
    ['flameWidth', 0.005, 1, 0.005, 'width at the root'],
    ['flameWidthVary', 0, 0.95, 0.01, 'width variation'],
    ['flameTaper', 0.05, 4, 0.01, 'tip taper'],
    ['flameRootPinch', 0.01, 0.6, 0.005, 'root pinch'],
    ['flameBank', 0, 1, 0.01, 'stand off the skin'],
    ['flameSharp', 0.1, 6, 0.05, 'cross falloff'],
    ['flameGlowWidth', 1, 12, 0.05, 'heat width'],
    ['flameGlowFalloff', 0.2, 8, 0.05, 'heat falloff'],
    ['flameGlowOpacity', 0, 2, 0.01, 'heat opacity'],
    ['flameTear', 0, 1, 0.01, 'tearing'],
    ['flameTearScale', 0.1, 20, 0.1, 'licks along it'],
    ['flameTearCross', 0, 4, 0.01, 'licks across it'],
    ['flameTearSpeed', -4, 4, 0.01, 'lick travel'],
    ['flameTearBias', 0, 1.5, 0.01, 'where tearing starts'],
    ['flameHeat', 0, 4, 0.01, 'heat'],
    ['flameCoreSize', 0.05, 4, 0.01, 'white core'],
    ['flameSmoke', 0, 2, 0.01, 'smoke in the voids'],
    ['flameFlicker', 0, 1, 0.01, 'gutter'],
    ['flameFlickerSpeed', 1, 120, 1, 'gutter rate'],
    ['flameStrandFade', 0, 1, 0.01, 'tongue dimming'],
    ['flameSoftFade', 0.02, 3, 0.01, 'soft intersection'],
    ['flameGlow', 0, 8, 0.01, 'glow'],
    ['flameOpacity', 0, 2, 0.01, 'opacity'],
    ['colorFlameCore', 'core'],
    ['colorFlameBody', 'flame'],
    ['colorFlameEmber', 'ember'],
    ['colorFlameSmoke', 'voids']
  ],
  'The orbs': [
    ['orbs', 0, 16, 1, 'orbs at once'],
    ['orbCling', 0, 1, 0.01, 'ride the bones'],
    ['orbCloud', 0, 0.6, 0.005, 'helix off the limb'],
    ['orbSpiral', -2, 2, 0.01, 'slides along it / sec'],
    ['orbWhip', 0, 8, 0.05, 'whip around it'],
    ['orbRadius', 0.1, 5, 0.01, 'ring radius'],
    ['orbRadiusVary', 0, 1, 0.01, 'radius variation'],
    ['orbSeat', -0.2, 1.6, 0.01, 'ring height'],
    ['orbTilt', 0, 1.6, 0.01, 'ring lean'],
    ['orbPrecess', -1, 1, 0.005, 'precession / sec'],
    ['orbRate', -3, 3, 0.01, 'turns / sec'],
    ['orbRateVary', 0, 1, 0.01, 'rate variation'],
    ['orbBob', 0, 1, 0.005, 'bob'],
    ['orbBobRate', 0, 4, 0.01, 'bob rate'],
    ['orbSize', 0.01, 0.8, 0.005, 'orb radius'],
    ['orbSizeVary', 0, 1, 0.01, 'size variation'],
    ['orbStretch', 0, 3, 0.01, 'stretch along travel']
  ],
  'How an orb burns': [
    ['orbFalloff', 0.05, 4, 0.01, 'edge falloff'],
    ['orbRim', 0, 3, 0.01, 'hot rim'],
    ['orbRimPower', 0.2, 8, 0.05, 'rim tightness'],
    ['orbCells', 0, 1, 0.01, 'convection'],
    ['orbCellScale', 0.2, 12, 0.05, 'cells per orb'],
    ['orbCellWarp', 0, 2, 0.01, 'cell warp'],
    ['orbBoil', -4, 4, 0.01, 'boil'],
    ['orbHeat', 0, 4, 0.01, 'heat'],
    ['orbCoreSize', 0.05, 4, 0.01, 'white core'],
    ['orbCoronaSize', 1, 8, 0.05, 'corona size'],
    ['orbCoronaFalloff', 0.05, 6, 0.05, 'corona falloff'],
    ['orbCoronaOpacity', 0, 2, 0.01, 'corona opacity'],
    ['orbFlicker', 0, 1, 0.01, 'gutter'],
    ['orbFlickerSpeed', 1, 120, 1, 'gutter rate'],
    ['orbGlow', 0, 8, 0.01, 'glow'],
    ['orbOpacity', 0, 2, 0.01, 'opacity'],
    ['orbEmberRate', 0, 800, 1, 'embers / sec'],
    ['orbEmberSpeed', 0, 8, 0.05, 'ember speed'],
    ['colorOrbCore', 'core'],
    ['colorOrbFlame', 'flame'],
    ['colorOrbEmber', 'ember'],
    ['colorOrbSmoke', 'shadow']
  ],
  'The trails': [
    ['trailSpan', 0.05, 4, 0.01, 'seconds of wake'],
    ['trailRise', -2, 4, 0.01, 'lift / sec'],
    ['trailWander', 0, 2, 0.01, 'fray'],
    ['trailWanderScale', 0.1, 12, 0.05, 'fray scale'],
    ['trailWanderSpeed', -4, 4, 0.01, 'fray travel'],
    ['trailWidth', 0.05, 6, 0.01, 'width at the head'],
    ['trailTaper', 0.05, 4, 0.01, 'tail taper'],
    ['trailHeadSwell', 0, 3, 0.01, 'head swell'],
    ['trailSharp', 0.1, 6, 0.05, 'cross falloff'],
    ['trailGlowWidth', 1, 12, 0.05, 'halo width'],
    ['trailGlowFalloff', 0.2, 8, 0.05, 'halo falloff'],
    ['trailGlowOpacity', 0, 2, 0.01, 'halo opacity'],
    ['trailTear', 0, 1, 0.01, 'tearing'],
    ['trailTearScale', 0.1, 20, 0.1, 'puffs along it'],
    ['trailTearSpeed', -4, 4, 0.01, 'puff travel'],
    ['trailTearBias', 0, 1.5, 0.01, 'where tearing starts'],
    ['trailHeat', 0, 4, 0.01, 'heat'],
    ['trailCoreSize', 0.05, 4, 0.01, 'white core'],
    ['trailCool', 0.05, 6, 0.05, 'cooling with age'],
    ['trailEndFade', 0.01, 0.9, 0.01, 'tail dissolve'],
    ['trailFlicker', 0, 1, 0.01, 'gutter'],
    ['trailFlickerSpeed', 1, 120, 1, 'gutter rate'],
    ['trailSoftFade', 0.02, 3, 0.01, 'soft intersection'],
    ['trailGlow', 0, 8, 0.01, 'glow'],
    ['trailOpacity', 0, 2, 0.01, 'opacity'],
    ['colorTrailCore', 'core'],
    ['colorTrailFlame', 'flame'],
    ['colorTrailEmber', 'ember'],
    ['colorTrailSmoke', 'voids']
  ],
  'The burn on the floor': [
    ['fieldRadius', 0.2, 12, 0.05, 'radius'],
    ['fieldHeight', 0, 0.5, 0.005, 'height off the floor'],
    ['fieldFeather', 0.02, 1.5, 0.01, 'edge fade'],
    ['fieldTear', 0, 0.6, 0.005, 'out of round'],
    ['fieldChar', 0, 1, 0.01, 'char'],
    ['fieldCharScale', 0.05, 6, 0.05, 'char grain'],
    ['fieldCharContrast', 0.2, 6, 0.05, 'char contrast'],
    ['fieldCrackScale', 0.1, 8, 0.05, 'splits / metre'],
    ['fieldCrackWidth', 0.01, 0.6, 0.005, 'split width'],
    ['fieldCracks', 0, 4, 0.01, 'split brightness'],
    ['fieldWarp', 0, 3, 0.01, 'warp'],
    ['fieldCrawl', -3, 3, 0.01, 'crust crawl'],
    ['fieldEmbers', 0, 4, 0.01, 'embers'],
    ['fieldEmberScale', 0.5, 20, 0.1, 'embers / metre'],
    ['fieldRing', 0, 4, 0.01, 'burning lip'],
    ['fieldRingWidth', 0.01, 1, 0.01, 'lip width'],
    ['fieldSweep', 0, 1, 0.01, 'lip sweep'],
    ['fieldSweepSpeed', -2, 2, 0.01, 'sweep / sec'],
    ['fieldFalloff', 0.1, 8, 0.05, 'light falloff'],
    ['fieldPulse', 0, 1, 0.01, 'breathing'],
    ['fieldPulseSpeed', 0.05, 8, 0.05, 'breathing rate'],
    ['fieldOpacity', 0, 2, 0.01, 'opacity'],
    ['fieldGlow', 0, 8, 0.01, 'glow'],
    ['colorFieldChar', 'char'],
    ['colorFieldCrack', 'splits'],
    ['colorFieldEmber', 'embers'],
    ['colorFieldRing', 'lip']
  ],
  'Embers & smoke': [
    ['emberRate', 0, 900, 1, 'ember rate'],
    ['emberSize', 0.005, 0.4, 0.005, 'ember size'],
    ['emberSpeed', 0, 12, 0.05, 'ember speed'],
    ['emberLifetime', 0.1, 8, 0.05, 'ember lifetime'],
    ['emberRise', -3, 8, 0.05, 'ember rise'],
    ['emberTurbulence', 0, 3, 0.01, 'ember turbulence'],
    ['emberGlow', 0, 4, 0.01, 'ember glow'],
    ['smokeRate', 0, 300, 1, 'smoke rate'],
    ['smokeSize', 0.05, 3, 0.01, 'smoke size'],
    ['smokeSpeed', 0, 8, 0.05, 'smoke speed'],
    ['smokeLifetime', 0.1, 8, 0.05, 'smoke lifetime'],
    ['smokeRise', -3, 5, 0.05, 'smoke rise'],
    ['smokeTurbulence', 0, 3, 0.01, 'smoke turbulence'],
    ['smokeGlow', 0, 3, 0.01, 'smoke glow'],
    ['colorEmber*', 'Ember colour'],
    ['colorSmoke*', 'Smoke colour']
  ],
  'Scorches under the feet': [
    ['groundRate', 0, 20, 0.1, 'scorches / sec'],
    ['groundRadius', 0.05, 5, 0.05, 'scorch radius'],
    ['groundSpread', 0, 5, 0.05, 'scatter'],
    ['groundLife', 0.05, 8, 0.05, 'scorch lifetime'],
    ['groundIntensity', 0, 3, 0.01, 'intensity'],
    ['colorGround', 'burn'],
    ['colorGroundEmber', 'embers']
  ],
  'Dynamic light': [
    ['lightIntensity', 0, 60, 0.5, 'intensity'],
    ['lightRadius', 1, 40, 0.5, 'radius'],
    ['lightHeight', 0, 3, 0.01, 'height'],
    ['lightFlicker', 0, 1, 0.01, 'gutter'],
    ['lightFlickerSpeed', 0.5, 40, 0.5, 'gutter rate'],
    ['lightColor', 'colour']
  ],
  'Catch & burn out': [
    ['burstEmbers', 0, 800, 1, 'embers on ignition'],
    ['burstSpread', 0.05, 3, 0.01, 'ember release radius'],
    ['ringRadius', 0.5, 20, 0.1, 'shockwave radius'],
    ['activateFlash', 0, 2, 0.01, 'flash on ignition'],
    ['endFlash', 0, 2, 0.01, 'flash on burn out'],
    ['endSmoke', 0, 400, 1, 'smoke on burn out'],
    ['activateShake', 0, 4, 0.01, 'shake on ignition'],
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
