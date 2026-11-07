// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*! Ported into VFX Armory (ext pack) from achrefelouafi/LinearAbilityExtThreeJS, MIT, Copyright (c) 2026 mohamedachrefelouafi. */
/* ================================================================== */
/* PYRE CROWN — the third far cast, and the Glacial Crown in fire      */
/* ================================================================== */
/**
 * The same silhouette as `glacier`, answered in the opposite element — which
 * makes the two of them the sandbox's clearest statement of where an ability's
 * identity actually lives. The layout controls below are deliberately the
 * *same names with different numbers*: a ring seated at the boundary, a skirt
 * banked against its foot, an empty middle. Everything that tells them apart
 * is either material or timing:
 *
 *   - the blades are opaque fire rather than transparent glass
 *     (`materials/PyreMaterial.js`), and they are longer, thinner and far more
 *     uneven — the reference's tallest blade is three times its shortest;
 *   - they **rise without a bounce** (`riseSnap`, `creep` — and note there is
 *     no overshoot control here at all, which is the point: see
 *     `PyreAbility#_emergence`);
 *   - the air inside the ring *climbs* instead of falling (`updraft*`);
 *   - and it ends by burning down from the points rather than shattering
 *     (`burnDelay`, `burnSweep`, `ashTime`).
 */
export const ext_pyre = {
  /* --- the cast --- */
  range: 18.0, // maximum cast distance, metres
  minRange: 0.0, // a ring of fire around your own feet is a legitimate play
  zoneRadius: 4.2, // the footprint — what the circle indicator measures out
  speed: 46.0, // how fast the fire line races to the point, metres/second
  snapTime: 0.2, // seconds the crater takes to burn out to the boundary
  lifetime: 4.0, // seconds the crown burns
  burnDelay: 0.45, // seconds after `lifetime` before it starts going out
  burnSweep: 0.5, // seconds the burn-out takes to sweep back around the ring
  burnStagger: 0.4, // seconds of random delay between neighbours
  ashTime: 1.1, // seconds one blade takes to burn down to nothing
  cooldown: 1.6,
  castAnim: 'cast1', // which clip in `CAST_ANIMATIONS` the body throws

  /* --- where the fire leaves the caster --- */
  handHeight: 1.22, // metres above the floor
  handForward: 0.6, // metres in front of the caster
  handSide: 0.18, // metres to the side (+ follows `Ability#side`)

  /* --- how the footprint is filled --- */
  /**
   * Everything is seated in a band about `zoneRadius`; the middle of the
   * circle is left empty on purpose, because the read of the ability is a wall
   * you are looking *into* and filling the disc stops it being a ring. The
   * pyre in the middle is kept as a control and ships at zero.
   */
  spikeCount: 159, // instances spent on one cast (capped at 320)
  density: 0.65, // multiplier on that count
  ringShare: 0.66, // fraction of them spent on the wall at the boundary
  coreShare: 0.0, // ... on the pyre in the middle (0 = the middle stays open)
  lateShare: 0.14, // ... held back to catch during the blaze
  ringSeat: 0.93, // where the wall stands, × zoneRadius
  ringScatter: 0.2, // radial jitter of the wall, × zoneRadius
  skirtSeat: 0.7, // inner lip of the wreckage banked against it, × zoneRadius
  skirtBand: 0.46, // how wide that band is, × zoneRadius
  skirtBias: 0.9, // <1 pushes the skirt outward, >1 crowds it inward
  coreSpread: 0.16, // radius of the cluster in the middle, × zoneRadius

  /* --- the silhouette --- */
  /**
   * Much less even than the ice, and shipped short and inward-leaning: the
   * blades are barely taller than a person and tip *in* over the crater rather
   * than out over the floor. `ringLean` is still the single control that
   * decides whether this reads as a crown or a picket line — at 0 it is a
   * fence, positive throws the blades outward, negative closes them over the
   * middle.
   */
  ringHeight: 1.5, // length of a blade on the wall, metres
  ringWave: 0.33, // how uneven the crest of that wall is, 0..1
  skirtHeight: 1.35, // length of a shard in the skirt, metres
  coreHeight: 6.05, // length of the pyre, metres
  heightJitter: 0.98,
  ringLean: -0.46, // radians the wall leans — negative tips it *inward* (≈26°)
  skirtLean: 0.34, // ... and the skirt
  coreLean: 0.16, // the pyre stands nearly upright
  leanJitter: 1.35,
  fan: 1.25, // radians a blade is splayed off its own radius, ± — the crossing
  twist: 1.0, // random yaw, 0..1 of a full turn
  rubble: 0.52, // fraction of the skirt demoted to ankle-height wreckage
  rubbleScale: 0.24,

  /* --- an individual blade --- */
  /**
   * Broad, heavily faceted tongues with a hard curve in them: a wide base
   * that still runs to a point, ragged enough that no two read the same.
   *
   * `belly` is what separates a fire-blade from an ice one. The ice is a cone
   * — widest where it leaves the floor, straight to the tip. A flame is not:
   * it is pinched at the ground, swells through its lower middle and runs
   * from there to a long point, and that swelling is most of what makes the
   * reference read as burning rather than as a shard painted orange. It is a
   * multiplier on the profile at `bellyAt`, pinned to zero effect at the base
   * and the tip, so `radius` and `taper` keep meaning exactly what they say
   * and `belly: 1` is the plain cone.
   */
  radius: 0.45, // base radius, metres
  radiusJitter: 0.58,
  belly: 1.67, // mid-height radius, × the cone profile (1 = a cone)
  bellyAt: 0.34, // where the blade is widest, 0 = the floor, 1 = the tip
  taper: 0.12, // tip radius as a fraction of the base
  facets: 10, // sides of the prism
  roughness: 0.68, // how far the facets are pushed off a clean prism
  bend: 1.5, // sideways curve from base to tip — a real hook, not a lean

  /* --- the eruption: when each blade catches, and how it arrives --- */
  /**
   * **There is no overshoot here, and that is deliberate.** The Glacial Crown
   * punches through the floor and springs back onto its height, which is most
   * of what sells ice as something hard arriving. A flame that bounces onto
   * its height reads as rubber. So the curve is monotonic in two pieces: a
   * front-loaded surge (`riseSnap`) that lands exactly on full height, and
   * then a `creep` that approaches a little past it from below and never
   * arrives — which is what a flame does when it settles.
   */
  riseTime: 0.18, // seconds from buried to full height
  riseSnap: 0.65, // 0 = a heavy shove, 1 = a snap that is done almost at once
  creep: 0.06, // how much further it reaches, forever, × its own height
  creepTime: 1.4, // seconds that reach takes to (nearly) finish
  sweepTime: 0.38, // seconds the wave takes to run around the ring
  skirtDelay: 0.09, // seconds before the skirt starts
  skirtWave: 0.24, // ... and how long it takes to cross the band
  coreDelay: 0.18, // seconds before the pyre comes up
  stagger: 0.06, // seconds of random delay on top of all of it
  bloomSpread: 0.7, // fraction of the blaze the late blades are scattered over
  sink: 0.3, // how far a dying blade settles into the floor, × its height

  /* --- the fire: opaque, and lit by nothing but itself --- */
  /**
   * Deliberately the *inverse* treatment to `glacier`. Where those blades are
   * near-empty glass carried by their edges, these are solid and almost
   * entirely emissive: one domain-warped flame field, run through one
   * four-stop heat ramp, shaped so the heat crowds to the point and chokes at
   * the foot. `sharp` is the control that matters most — it is the contrast
   * curve that turns a soft gradient into tongues with black voids between
   * them. See `materials/PyreMaterial.js`.
   */
  colorChar: '#150402', // the voids in the flame — coolest stop of the ramp
  colorEmber: '#c01807', // deep red
  colorFlame: '#ff7d1a', // orange
  colorCore: '#fff0bd', // the incandescent white-hot stop
  colorRock: '#2a1310', // the charred stone under it, when `rock` is turned up
  colorRim: '#ff9a3c', // the hot fringe at the silhouette
  colorAsh: '#4a4038', // what is left where the fire has passed
  rock: 0.0, // how much charred stone shows through (0 = pure fire)
  flameScale: 3.25, // flame features per unit of the blade
  flameStretch: 0.77, // <1 draws the tongues out along its length
  flameSpeed: 1.0, // how fast they climb it
  flameGain: 1.52, // master gain on the heat — how hot the whole blade runs
  curl: 0.71, // domain warp — the licking
  sharp: 0.15, // 0 = a soft gradient, 1 = hard tongue edges
  heatBias: 1.24, // how hard the heat crowds toward the point
  soot: 0.48, // how dark the foot of the blade goes
  sootHeight: 0.3, // over what fraction of the blade
  rim: 0.5, // hot fringe at the silhouette
  rimPower: 2.2, // how tightly that fringe hugs the edge
  tipStart: 0.51, // where the incandescent point begins, 0..1 up the blade
  tipGlow: 1.6,
  flicker: 0.22, // depth of the per-blade gutter
  flickerSpeed: 7.5,
  envIntensity: 0.71, // how much of the HDR probe the stone catches
  specular: 1.35, // the tight sun lobe off it
  glow: 1.28, // overall emissive gain
  opacity: 1.0,
  birthGlow: 2.6, // extra glow on a blade that has just torn out of the ground
  birthFade: 0.45, // seconds that birth flash lasts

  /* --- the combustion front and the burn-down --- */
  /**
   * The two things that make this ability's fire *catch* and *go out* rather
   * than fade in and out. Both are per-instance ramps the ability drives; what
   * lives here is only their look. The second one runs the first one backwards
   * from the point down — which is why the Crown is consumed rather than
   * broken.
   */
  frontRough: 0.4, // how ragged the leading edge of the fire is
  frontWidth: 0.14, // how much of the blade is white-hot behind that edge
  frontGlow: 3.2, // how hard it burns
  charRough: 0.5, // how ragged the line the ash eats down is
  charEdge: 0.09, // width of the ember rim riding it
  charGlow: 3.4,
  ashDrain: 0.85, // how completely the body cools behind that edge

  /* --- the crater on the floor --- */
  /**
   * The indicator's promise, made real: the same circle and the same thick
   * boundary, now split open and glowing. An ability-owned mesh rather than a
   * decal precisely because a decal captures its radius when it spawns — this
   * one has to re-scale under `zoneRadius` while the crown is standing, and to
   * run its own front outward and back. The *dark* half of the crater is a
   * `SCORCH` decal underneath it, because this pass is additive and burnt
   * ground has to subtract.
   */
  fieldBoundary: 0.56, // thickness of the band at the edge, metres
  fieldBoundaryGlow: 0.75,
  fieldFill: 1.39, // the wash inside it
  fieldFalloff: 0.65, // how hard that wash crowds to the rim
  fieldPlates: 0.8, // tonal break-up between plates of cooling crust
  fieldCrackScale: 3.45, // plates per metre
  fieldCrackWidth: 0.22, // how wide the molten seams between them read
  fieldCracks: 1.99, // how hard those seams burn
  fieldVeins: 1.36, // runnels of fire crawling over the crust
  fieldVeinScale: 1.5, // runnels per metre
  fieldWarp: 0.6, // domain warp — what stops them reading as spokes
  fieldCrawl: 0.16, // how fast they writhe
  fieldEmbers: 0.9, // single embers glittering in the crust
  fieldEmberScale: 5.0,
  fieldRings: 4.2, // heat rings travelling out from the middle
  fieldRingSpeed: -0.75, // rings/second (positive travels outward)
  fieldSweep: 0.0, // slow sweep around the disc
  fieldSweepSpeed: -0.58, // revolutions/second
  fieldCore: 1.4, // brightness of the pool of melt in the middle
  fieldCoreSize: 0.31, // its radius, × zoneRadius
  fieldPulse: 0.35, // brightness breathing
  fieldPulseSpeed: 2.4,
  fieldOpacity: 1.0,
  fieldHeight: 0.03, // hover distance above the floor, metres
  colorField: '#ff4314', // the wash, the crust and the runnels
  colorFieldEdge: '#ffbd80', // the boundary band, the seams and the pool

  /* --- the wall of flame standing on the ring --- */
  /**
   * An open cylinder seated on the boundary, eroded by ridged noise stretched
   * hard vertically and scrolled *upward* — the exact opposite of the Glacial
   * Crown's curtain, which pours down. This is the piece that frames the crown
   * from the outside and fills the gaps between the blades; without it the
   * wall ends at its own silhouette and the ring reads as a fence of lit
   * cones. Set `veil` to 0 to take it off.
   */
  veil: 0.84, // master opacity of the wall, 0 hides it
  veilHeight: 1.5, // how high it stands, metres
  veilRadius: 0.99, // where it stands, × zoneRadius
  veilFlare: 0.18, // how far it leans outward at the top
  veilBillow: 0.3, // metre-scale lobes pushing its silhouette off round
  veilScale: 1.6, // noise features per metre
  veilStretch: 0.35, // <1 draws the structures out into vertical licks
  veilFlow: 1.6, // how fast they climb
  veilErode: 0.75, // how much harder the top is eaten away than the base
  veilFalloff: 1.5, // how fast it thins with height
  veilSpin: 0.125, // revolutions/second the whole wall turns
  veilSoftFade: 2.25, // metres of soft fade where it meets geometry
  colorVeil: '#ff9f80', // the body of it
  colorVeilCrest: '#f4930b', // the hottest part, at the floor
  colorVeilSmoke: '#2a1109', // what the tops go as they cool

  /* --- the air over it --- */
  /**
   * Heat haze, written into the distortion buffer on `LAYER.DISTORTION` and
   * never drawn directly. It ships **off**: the crown already carries its heat
   * in the crater and the wall of flame, and over water the shimmer fought the
   * reflection rather than reading as air. Turn `haze` up and the tell comes
   * straight back — the floor behind the crown starts wobbling.
   */
  haze: 0.0, // master strength — off by default; turn it up to bend the room
  hazeHeight: 3.4, // how far up the shimmer reaches, metres
  hazeRadius: 1.3, // where it stands, × zoneRadius
  hazeFrequency: 2.4, // cells per metre
  hazeSpeed: 1.6, // how fast they rise
  hazeFalloff: 1.2, // how fast the warp thins with height

  /* --- what the ground does --- */
  trailScorchRate: 2.2, // scorch patches laid per metre of front travel
  trailScorchRadius: 1.0, // radius of one, metres
  scorchSpread: 1.5, // the burnt sheet under the crown, × zoneRadius
  scorchLife: 7.5, // seconds a scorch patch lingers
  scorchIntensity: 0.9,
  scorchCollar: 2.4, // scorch around the foot of a blade, × its own radius
  scorchRate: 3.0, // scorch patches creeping around the boundary, per second
  scorchRadius: 1.0, // radius of one, metres
  fractureSpread: 1.15, // the star of molten cracks at the bloom, × zoneRadius
  fractureWidth: 0.45, // how wide those cracks run
  fractureIntensity: 1.1,
  colorScorch: '#140b08', // the burnt ground itself
  colorScorchEmber: '#ff7a22', // the embers still cooling in it
  colorFracture: '#ffb347', // what shows through the cracks
  shockRadius: 8.0, // the ring that snaps out when the crown catches, metres
  ringRate: 0.9, // heat rings pushed out while it burns, per second
  colorShockA: '#ff7a22', // body of the shockwave ring
  colorShockB: '#ffe6b0', // its crest

  /* --- smoke, cinders, embers and the updraft --- */
  /**
   * As in every other block: a four-stop gradient sampled over the particle's
   * own lifetime, `A` at birth through `D` as it dies. The **updraft** is this
   * ability's signature system — embers released at the floor inside the ring
   * and carried up the column of hot air over the crater, orbiting its middle
   * as they climb. It is the Glacial Crown's falling snow run in reverse, and
   * a rising spiral inside the ring is what says the air over it is burning
   * rather than freezing.
   */
  smokeRate: 220, // smoke rolling off the fire, particles/second
  smokeSize: 1.15,
  smokeSpeed: 2.2,
  smokeLifetime: 3.2,
  smokeOpacity: 0.075,
  smokeRise: 0.85, // positive: it is buoyant, and it leaves over the top
  smokeTurbulence: 0.55,
  colorSmokeA: '#5a3020',
  colorSmokeB: '#3a2418',
  colorSmokeC: '#241a15',
  colorSmokeD: '#0d0908',
  cinderSize: 0.07, // burning fragments
  cinderSpeed: 6.5,
  cinderLifetime: 1.8,
  cinderGravity: -14.0,
  breachCinders: 3, // fragments thrown as a blade breaks the surface
  gutterCinders: 4, // ... and as it burns down
  colorCinderA: '#fff0bd',
  colorCinderB: '#ff8a2a',
  colorCinderC: '#8e2408',
  colorCinderD: '#1a0f0b',
  emberRate: 260, // the sparks coming off everything
  emberSize: 0.05,
  emberSpeed: 3.4,
  emberLifetime: 2.2,
  emberRise: 1.4, // buoyancy, metres/second²
  emberTurbulence: 0.9,
  emberStretch: 0.4, // how far a spark is drawn out along its own velocity
  emberGlow: 1.4,
  breachEmbers: 6, // sparks thrown as a blade breaks the surface
  gutterEmbers: 10, // ... and as it goes out
  colorEmberA: '#fff4cf',
  colorEmberB: '#ffb03c',
  colorEmberC: '#ff4a10',
  colorEmberD: '#4a0d04',
  updraftRate: 120, // embers climbing the column inside the ring
  updraftSize: 0.06,
  updraftSpeed: 1.2, // how hard they are pushed up to start with
  updraftLifetime: 3.4,
  updraftLift: 1.1, // buoyancy, metres/second²
  updraftSwirl: 1.35, // radians/second the column turns
  updraftExpand: 0.7, // how far the spiral opens out as it climbs
  updraftGlow: 1.2,
  updraftInset: 0.8, // how far inside the boundary it rises, × zoneRadius
  colorUpdraftA: '#ffdc8a',
  colorUpdraftB: '#ff8a2a',
  colorUpdraftC: '#c02a08',
  colorUpdraftD: '#2a0a04',

  /* --- dynamic light --- */
  lightIntensity: 4,
  lightRadius: 17,
  lightHeight: 0.45, // how far up the crown the light sits, 0..1
  lightColor: '#ff7a26',

  /* --- the throw, the bloom and the blaze --- */
  castFlash: 0.09, // screen flash on release
  colorCastFlash: '#ffb066',
  burstCinders: 130, // extra fragments at the bloom
  burstSmoke: 80,
  burstEmbers: 170,
  impactShake: 0.95,
  shakeDuration: 0.85,
  holdShake: 0.06, // continuous rumble while the crown burns
  impactFlash: 0.24,
  rumble: 0.05, // rumble while the fire line races out
  colorFlash: '#ffb066' // the full-screen flash when it catches
};

export const ext_pyreSchema = {
  'The cast': [
    ['zoneRadius', 0.5, 14, 0.05, 'footprint radius'],
    ['range', 2, 50, 0.1, 'max range'],
    ['minRange', 0, 10, 0.1, 'min range'],
    ['speed', 5, 200, 1, 'front speed'],
    ['snapTime', 0.02, 1.5, 0.01, 'burn-out time'],
    ['lifetime', 0.2, 14, 0.05, 'blaze time'],
    ['burnDelay', 0, 4, 0.01, 'delay before it goes out'],
    ['burnSweep', 0, 3, 0.01, 'burn-out sweep'],
    ['burnStagger', 0, 3, 0.01, 'burn-out stagger'],
    ['ashTime', 0.05, 5, 0.01, 'burn-down time'],
    ['cooldown', 0, 8, 0.05, 'cooldown'],
    ['castAnim', 'cast animation']
  ],
  'Where the fire leaves the hand': [
    ['handHeight', 0, 3, 0.01, 'hand height'],
    ['handForward', -1, 3, 0.01, 'hand forward'],
    ['handSide', -1.5, 1.5, 0.01, 'hand lateral'],
    ['castFlash', 0, 2, 0.01, 'flash on release'],
    ['colorCastFlash', 'release flash colour']
  ],
  'Filling the footprint': [
    ['spikeCount', 1, 320, 1, 'blades'],
    ['density', 0.1, 2, 0.01, 'density'],
    ['ringShare', 0, 1, 0.01, 'share on the wall'],
    ['coreShare', 0, 0.5, 0.01, 'share on the pyre'],
    ['lateShare', 0, 0.5, 0.01, 'share held back'],
    ['ringSeat', 0.2, 1.4, 0.01, 'wall seat, × footprint'],
    ['ringScatter', 0, 0.6, 0.005, 'wall jitter, × footprint'],
    ['skirtSeat', 0, 1.4, 0.01, 'skirt inner lip, × footprint'],
    ['skirtBand', 0.02, 1.4, 0.01, 'skirt width, × footprint'],
    ['skirtBias', 0.2, 3, 0.01, 'skirt crowding'],
    ['coreSpread', 0.01, 0.6, 0.005, 'pyre cluster, × footprint']
  ],
  'Silhouette': [
    ['ringHeight', 0.2, 12, 0.05, 'wall height'],
    ['ringWave', 0, 1, 0.01, 'crest unevenness'],
    ['skirtHeight', 0.05, 6, 0.05, 'skirt height'],
    ['coreHeight', 0.2, 12, 0.05, 'pyre height'],
    ['heightJitter', 0, 1.5, 0.01, 'height jitter'],
    ['ringLean', -1.5, 1.5, 0.01, 'wall lean (0 = a fence)'],
    ['skirtLean', -1.5, 1.5, 0.01, 'skirt lean'],
    ['coreLean', -1.5, 1.5, 0.01, 'pyre lean'],
    ['leanJitter', 0, 3, 0.01, 'lean jitter'],
    ['fan', 0, 1.6, 0.01, 'splay off the radius'],
    ['twist', 0, 1, 0.01, 'random yaw'],
    ['rubble', 0, 1, 0.01, 'rubble fraction'],
    ['rubbleScale', 0.05, 1, 0.01, 'rubble height']
  ],
  'The blade': [
    ['radius', 0.05, 1.2, 0.005, 'base radius'],
    ['radiusJitter', 0, 1.5, 0.01, 'radius jitter'],
    ['belly', 0.4, 3, 0.01, 'belly (1 = a cone)'],
    ['bellyAt', 0.05, 0.95, 0.01, 'widest point up the blade'],
    ['taper', 0.01, 0.9, 0.01, 'tip taper'],
    ['facets', 3, 12, 1, 'facets'],
    ['roughness', 0, 1, 0.01, 'facet roughness'],
    ['bend', 0, 1.5, 0.01, 'bend']
  ],
  'The eruption': [
    ['sweepTime', 0, 3, 0.01, 'sweep around the ring'],
    ['skirtDelay', 0, 2, 0.01, 'skirt delay'],
    ['skirtWave', 0, 2, 0.01, 'skirt wave'],
    ['coreDelay', 0, 2, 0.01, 'pyre delay'],
    ['stagger', 0, 1, 0.005, 'random stagger'],
    ['bloomSpread', 0, 1, 0.01, 'late blades spread'],
    ['riseTime', 0.02, 1.5, 0.01, 'rise time'],
    ['riseSnap', 0, 1, 0.01, 'rise snap (never overshoots)'],
    ['creep', 0, 0.5, 0.005, 'creep past full height'],
    ['creepTime', 0.05, 6, 0.05, 'creep time'],
    ['sink', 0, 1.5, 0.01, 'sink as it dies']
  ],
  'Burning fire': [
    ['opacity', 0, 1, 0.01, 'opacity'],
    ['flameGain', 0, 4, 0.01, 'heat'],
    ['sharp', 0, 1, 0.01, 'tongue edges (0 = a wash)'],
    ['flameScale', 0.5, 16, 0.05, 'flame scale'],
    ['flameStretch', 0.02, 2, 0.01, 'stretch along the blade'],
    ['flameSpeed', -6, 6, 0.01, 'climb speed'],
    ['curl', 0, 2, 0.01, 'licking (domain warp)'],
    ['heatBias', 0.2, 6, 0.01, 'crowding to the point'],
    ['soot', 0, 1, 0.01, 'soot at the foot'],
    ['sootHeight', 0.01, 1, 0.01, 'soot height'],
    ['rim', 0, 3, 0.01, 'hot silhouette'],
    ['rimPower', 0.5, 8, 0.01, 'silhouette tightness'],
    ['tipStart', 0, 1, 0.01, 'tip start'],
    ['tipGlow', 0, 6, 0.01, 'tip glow'],
    ['flicker', 0, 1, 0.01, 'gutter depth'],
    ['flickerSpeed', 0, 30, 0.1, 'gutter speed'],
    ['rock', 0, 2, 0.01, 'charred stone showing through'],
    ['envIntensity', 0, 3, 0.01, 'env reflection'],
    ['specular', 0, 8, 0.05, 'sun glint'],
    ['glow', 0, 4, 0.01, 'glow'],
    ['birthGlow', 0, 6, 0.01, 'birth flash'],
    ['birthFade', 0.02, 3, 0.01, 'birth fade'],
    ['colorChar', 'voids'],
    ['colorEmber', 'deep red'],
    ['colorFlame', 'orange'],
    ['colorCore', 'white-hot'],
    ['colorRock', 'stone'],
    ['colorRim', 'silhouette'],
    ['colorAsh', 'ash']
  ],
  'Combustion front & burn-down': [
    ['frontRough', 0, 1.5, 0.01, 'front raggedness'],
    ['frontWidth', 0.01, 0.8, 0.01, 'front width'],
    ['frontGlow', 0, 8, 0.05, 'front glow'],
    ['charRough', 0, 1.5, 0.01, 'ash-line raggedness'],
    ['charEdge', 0.005, 0.4, 0.005, 'ember rim width'],
    ['charGlow', 0, 8, 0.05, 'ember rim glow'],
    ['ashDrain', 0, 1, 0.01, 'how far the fire drains out']
  ],
  'The crater': [
    ['fieldBoundary', 0.02, 2, 0.01, 'band thickness'],
    ['fieldBoundaryGlow', 0, 8, 0.05, 'band glow'],
    ['fieldFill', 0, 2, 0.01, 'interior fill'],
    ['fieldFalloff', 0.1, 5, 0.05, 'fill falloff'],
    ['fieldPlates', 0, 3, 0.01, 'crust break-up'],
    ['fieldCrackScale', 0.2, 10, 0.05, 'plates / metre'],
    ['fieldCrackWidth', 0.02, 1, 0.01, 'seam width'],
    ['fieldCracks', 0, 4, 0.01, 'molten seams'],
    ['fieldVeins', 0, 3, 0.01, 'runnels'],
    ['fieldVeinScale', 0.1, 8, 0.05, 'runnels / metre'],
    ['fieldWarp', 0, 2, 0.01, 'domain warp'],
    ['fieldCrawl', -4, 4, 0.01, 'runnel crawl'],
    ['fieldEmbers', 0, 4, 0.01, 'embers in the crust'],
    ['fieldEmberScale', 0.5, 20, 0.1, 'embers / metre'],
    ['fieldRings', 0, 12, 0.1, 'heat rings'],
    ['fieldRingSpeed', -6, 6, 0.01, 'ring speed'],
    ['fieldSweep', 0, 3, 0.01, 'sweep'],
    ['fieldSweepSpeed', -2, 2, 0.01, 'sweep speed'],
    ['fieldCore', 0, 4, 0.01, 'pool of melt'],
    ['fieldCoreSize', 0.02, 1, 0.005, 'pool size, × footprint'],
    ['fieldPulse', 0, 1, 0.01, 'pulse'],
    ['fieldPulseSpeed', 0, 10, 0.05, 'pulse speed'],
    ['fieldOpacity', 0, 2, 0.01, 'opacity'],
    ['fieldHeight', 0.005, 0.4, 0.005, 'hover height'],
    ['colorField', 'crust & runnels'],
    ['colorFieldEdge', 'band & seams']
  ],
  'The wall of flame': [
    ['veil', 0, 2, 0.01, 'opacity (0 hides it)'],
    ['veilHeight', 0.1, 8, 0.05, 'height'],
    ['veilRadius', 0.5, 1.6, 0.005, 'seat, × footprint'],
    ['veilFlare', -0.5, 1.5, 0.01, 'outward lean'],
    ['veilBillow', 0, 1.5, 0.01, 'silhouette lobes'],
    ['veilScale', 0.1, 6, 0.05, 'noise / metre'],
    ['veilStretch', 0.05, 3, 0.01, 'vertical stretch'],
    ['veilFlow', -6, 6, 0.01, 'climb speed'],
    ['veilErode', 0, 1, 0.01, 'erosion with height'],
    ['veilFalloff', 0.2, 6, 0.05, 'thinning with height'],
    ['veilSpin', -1, 1, 0.005, 'rotation'],
    ['veilSoftFade', 0.02, 3, 0.01, 'soft intersection'],
    ['colorVeil', 'body'],
    ['colorVeilCrest', 'crest (at the floor)'],
    ['colorVeilSmoke', 'smoke (at the top)']
  ],
  'Heat haze': [
    ['haze', 0, 4, 0.01, 'strength (0 hides it)'],
    ['hazeHeight', 0.2, 12, 0.05, 'height'],
    ['hazeRadius', 0.5, 2.5, 0.01, 'seat, × footprint'],
    ['hazeFrequency', 0.2, 10, 0.05, 'cells / metre'],
    ['hazeSpeed', -6, 6, 0.01, 'rise speed'],
    ['hazeFalloff', 0.2, 6, 0.05, 'thinning with height']
  ],
  'Scorch & fractures': [
    ['trailScorchRate', 0.05, 10, 0.05, 'trail scorch / metre'],
    ['trailScorchRadius', 0.05, 6, 0.05, 'trail scorch radius'],
    ['scorchSpread', 0.2, 4, 0.05, 'impact scorch, × footprint'],
    ['scorchLife', 0.5, 20, 0.1, 'scorch lifetime'],
    ['scorchIntensity', 0, 2, 0.01, 'scorch intensity'],
    ['scorchCollar', 0, 8, 0.05, 'collar, × blade radius'],
    ['scorchRate', 0, 20, 0.1, 'rim scorch / sec'],
    ['scorchRadius', 0.05, 6, 0.05, 'rim scorch radius'],
    ['fractureSpread', 0.2, 4, 0.05, 'fractures, × footprint'],
    ['fractureWidth', 0, 1, 0.01, 'fracture width'],
    ['fractureIntensity', 0, 3, 0.01, 'fracture intensity'],
    ['shockRadius', 0.5, 25, 0.1, 'shockwave radius'],
    ['ringRate', 0, 12, 0.1, 'heat rings / sec'],
    ['colorScorch', 'burnt ground'],
    ['colorScorchEmber', 'cooling embers'],
    ['colorFracture', 'molten fracture'],
    ['colorShockA', 'shockwave ring'],
    ['colorShockB', 'shockwave crest']
  ],
  'Smoke, embers & the updraft': [
    ['smokeRate', 0, 900, 1, 'smoke rate'],
    ['smokeSize', 0.05, 4, 0.01, 'smoke size'],
    ['smokeSpeed', 0, 10, 0.05, 'smoke speed'],
    ['smokeLifetime', 0.2, 8, 0.05, 'smoke lifetime'],
    ['smokeOpacity', 0, 1, 0.005, 'smoke opacity'],
    ['smokeRise', -3, 4, 0.01, 'smoke buoyancy'],
    ['smokeTurbulence', 0, 3, 0.01, 'smoke swirl'],
    ['emberRate', 0, 900, 1, 'ember rate'],
    ['emberSize', 0.005, 0.4, 0.005, 'ember size'],
    ['emberSpeed', 0, 20, 0.1, 'ember speed'],
    ['emberLifetime', 0.1, 8, 0.05, 'ember lifetime'],
    ['emberRise', -3, 8, 0.01, 'ember buoyancy'],
    ['emberTurbulence', 0, 3, 0.01, 'ember swirl'],
    ['emberStretch', 0, 2, 0.01, 'ember streaking'],
    ['emberGlow', 0, 4, 0.01, 'ember glow'],
    ['breachEmbers', 0, 40, 1, 'embers on breach'],
    ['gutterEmbers', 0, 40, 1, 'embers on burn-down'],
    ['updraftRate', 0, 600, 1, 'updraft rate'],
    ['updraftSize', 0.005, 0.4, 0.005, 'updraft size'],
    ['updraftSpeed', 0, 10, 0.05, 'initial push'],
    ['updraftLifetime', 0.2, 10, 0.05, 'updraft lifetime'],
    ['updraftLift', -2, 12, 0.05, 'updraft buoyancy'],
    ['updraftSwirl', -6, 6, 0.01, 'column spin'],
    ['updraftExpand', 0, 3, 0.01, 'spiral opening'],
    ['updraftGlow', 0, 4, 0.01, 'updraft glow'],
    ['updraftInset', 0.05, 1.4, 0.01, 'rise inset, × footprint'],
    ['colorSmoke*', 'Smoke colour'],
    ['colorEmber*', 'Ember colour'],
    ['colorUpdraft*', 'Updraft colour']
  ],
  'Cinders': [
    ['cinderSize', 0.005, 0.5, 0.005, 'cinder size'],
    ['cinderSpeed', 0, 30, 0.1, 'cinder speed'],
    ['cinderLifetime', 0.1, 6, 0.05, 'cinder lifetime'],
    ['cinderGravity', -50, 0, 0.1, 'cinder gravity'],
    ['breachCinders', 0, 30, 1, 'cinders on breach'],
    ['gutterCinders', 0, 30, 1, 'cinders on burn-down'],
    ['colorCinder*', 'Cinder colour']
  ],
  'Bloom & blaze': [
    ['burstCinders', 0, 600, 1, 'bloom cinders'],
    ['burstSmoke', 0, 400, 1, 'bloom smoke'],
    ['burstEmbers', 0, 600, 1, 'bloom embers'],
    ['impactShake', 0, 3, 0.01, 'shake'],
    ['shakeDuration', 0.1, 4, 0.01, 'shake duration'],
    ['holdShake', 0, 0.5, 0.005, 'blaze rumble'],
    ['impactFlash', 0, 2, 0.01, 'screen flash'],
    ['rumble', 0, 0.5, 0.005, 'travel rumble'],
    ['colorFlash', 'bloom flash colour']
  ],
  'Dynamic light': [
    ['lightIntensity', 0, 120, 0.5, 'light intensity'],
    ['lightRadius', 0.5, 50, 0.1, 'light radius'],
    ['lightHeight', 0, 1, 0.01, 'height up the crown'],
    ['lightColor', 'light colour']
  ]
};
