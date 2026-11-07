// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*! Ported into VFX Armory (ext pack) from achrefelouafi/LinearAbilityExtThreeJS, MIT, Copyright (c) 2026 mohamedachrefelouafi. */
/* ================================================================== */
/* KRAKEN CROWN — the fourth far cast, and the one that moves          */
/* ================================================================== */
/**
 * The Glacial and Pyre Crowns argue that an ability's identity lives in its
 * material. This one is the counter-argument: it lives in the **motion**.
 *
 * Both of those bloom once and then stand — nothing about either silhouette
 * changes after the first half second. Here nothing about the silhouette is
 * the same on two consecutive frames: a ring of cephalopod arms hauls itself
 * out of a rift, rears back, and then hammers the middle of the footprint
 * over and over for the whole cast, ending on one synchronised slam.
 *
 * So the controls below are laid out by *beat* rather than by layer, and the
 * ones that matter most are not in the material group:
 *
 *   - **`reach`** decides where the arms land. Length is derived from the
 *     footprint through the arc identity in `KrakenAbility` — an arm of length
 *     `πR/2` turning through π puts its point on the exact centre of a circle
 *     of radius `R` — so `reach` is a multiplier on *that*, and 1.0 means dead
 *     centre at any footprint. Above 1 the arms overshoot and cross.
 *   - **`smashPeriod` and `cycleScatter`** decide whether this reads as
 *     rolling thunder or as a drum machine. At `cycleScatter: 0` every arm
 *     lands on the same frame all cast long, which is much less interesting
 *     than it sounds — the finale is the only moment that should do that.
 *   - **`strikeTime`** is the whip itself, and it wants to stay short: the
 *     pose is eased with a quartic, so almost the whole arc is covered in the
 *     last few frames, and stretching this control is the fastest way to make
 *     a heavy limb read as a pool noodle.
 *   - **`strikeTurn`** is π for a reason. Less and the arms punch the floor
 *     short of the middle with their points still up; more and they drive past
 *     it and hammer with the *back* of the curl, which is a different and much
 *     angrier ability. Both are worth a look.
 */
export const ext_kraken = {
  /* --- the cast --- */
  range: 18.0, // maximum cast distance, metres
  minRange: 0.0, // dropping it on your own feet is a legitimate play
  zoneRadius: 4.6, // the footprint — what the circle indicator measures out
  speed: 42.0, // how fast the wet surge races to the point, metres/second
  openTime: 0.3, // seconds the rift takes to tear out to the boundary
  lifetime: 5.5, // seconds the arms stand and hammer
  withdrawDelay: 0.35, // seconds after `lifetime` before they are pulled back
  withdrawTime: 0.85, // seconds one arm takes to go under
  withdrawStagger: 0.4, // seconds of random delay between neighbours
  withdrawSink: 0.8, // how far the arm settles into the rift as it goes, metres
  cooldown: 2.2,
  castAnim: 'cast2', // which clip in `CAST_ANIMATIONS` the body throws

  /* --- where the cast leaves the caster --- */
  handHeight: 1.22, // metres above the floor
  handForward: 0.6, // metres in front of the caster
  handSide: 0.18, // metres to the side (+ follows `Ability#side`)

  /* --- how the ring is filled --- */
  /**
   * Two roles, stepped separately around the circle and offset half a stride
   * from each other so the whips fall *between* the arms rather than on top of
   * them. The heavy arms are what smash; the whips are there so the gaps
   * between them are never empty and so something is always moving somewhere
   * in the ring even at the bottom of a strike cycle.
   */
  armCount: 9, // heavy limbs on the boundary — these do the hammering
  whipCount: 12, // thin cords lashing between them
  density: 1.0, // multiplier on both counts (26 arms total, hard cap)
  ringSeat: 0.97, // where the heavy arms come up, × zoneRadius
  ringScatter: 0.06, // radial jitter on that seat, × zoneRadius
  whipSeat: 1.05, // ... and where the whips do
  whipScatter: 0.14,

  /* --- the arm --- */
  /**
   * `reach` is the one number that decides where the arms land, and it is a
   * multiplier on a derivation rather than a length: see the block comment.
   * `splay` is what stops nine arms converging on a single point like the ribs
   * of an umbrella — each is aimed a little off the middle, so they cross over
   * the throat and pile onto each other.
   */
  reach: 1.06, // × the length that lands the point dead centre
  lengthJitter: 0.12,
  thickness: 0.4, // radius where the arm leaves the rift, metres
  thicknessJitter: 0.22,
  whipLength: 0.72, // × an arm's length
  whipThickness: 0.42, // × an arm's thickness
  splay: 0.32, // radians a strike is aimed off the radius, ±

  /* --- the tube it is built from --- */
  rings: 44, // cross-sections up the arm — this is the bend's resolution
  sides: 12, // vertices around one cross-section
  taper: 0.05, // radius at the point, × the base
  swell: 1.32, // radius through the muscle, × the cone profile
  swellAt: 0.17, // where that swell sits, 0 = the rift, 1 = the point
  armRoughness: 0.15, // muscle segmentation up the length
  flatten: 0.85, // cross-section flattening across the sucker face

  /* --- the poses, in radians of total turn --- */
  /**
   * Every shape the arm ever takes is four numbers: a lean, a curl, a wave and
   * a twist. Positive turns the arm *inward*, over the middle; negative leans
   * it out over the floor. The strike is the only pose with the turn in the
   * lean rather than the curl, and that is not a style choice — a constant
   * curvature is the only profile whose tip has a closed form, and that closed
   * form is what places every shockwave, crack and chip of stone.
   */
  coilLean: 0.2, // how it arrives: a tight curl, because that is what
  coilCurl: 5.4, // ... comes out of a hole
  idleLean: -0.7, // at rest: leaning out over the floor
  idleCurl: 2.4, // ... with the point curling back in over the ring
  rearLean: -1.3, // cocked: bowed hard out, and the curl only half as strong,
  rearCurl: 1.6, // ... so the point stands up *behind* the ring, poised
  strikeTurn: 3.14159, // π — the turn that lands the point on the middle
  turnJitter: 0.09, // extra turn, per arm — one-sided, and never less
  strikeSquash: 0.35, // how much the arm thickens as it whips, × its radius
  settle: 0.22, // radians of ring-out after it lands
  settleSpeed: 26.0, // how fast that ringing beats

  /* --- the travelling wave, which is what keeps a resting arm alive --- */
  waveIdle: 0.55, // amplitude at rest
  waveRear: 0.3, // ... while it is cocked
  waveStrike: 0.04, // ... during the whip: a whip is smooth
  waveCoil: 0.8, // ... while it is still coming out
  waveFreq: 1.15, // waves along the arm
  waveSpeed: 0.55, // how fast they travel, revolutions/second
  twist: 0.9, // radians the section rolls from the rift to the point

  /* --- the beat --- */
  /**
   * The arms erupt as a sweep from the near side, then each runs its own
   * strike cycle — rear, whip, press, peel — scattered around the ring by
   * `cycleScatter` so the slams arrive as rolling thunder. `finaleLead` is the
   * exception: that many seconds before the end, every arm abandons its own
   * clock and lands together.
   */
  riseTime: 0.45, // seconds from the first of it out of the rift to uncoiled
  sweepTime: 0.7, // seconds the wave of arms takes to run around the ring
  stagger: 0.14, // seconds of random delay on top of that
  whipDelay: 0.12, // seconds the thin cords come up behind the heavy arms
  smashPeriod: 1.35, // seconds between one arm's strikes
  whipPeriod: 0.62, // × that, for the whips — they lash far more often
  cycleScatter: 0.85, // fraction of a period the ring is scattered over
  rearTime: 0.38, // seconds spent winding up
  strikeTime: 0.19, // seconds the whip itself takes — short, but still visible
  holdTime: 0.22, // seconds pressed against the floor
  peelTime: 0.45, // seconds lifting back off it
  finaleLead: 0.75, // seconds before the end that every arm lands together

  /* --- the flesh --- */
  /**
   * The only *shaded* material in the project that is not energy: it is lit by
   * the room's own sun, it has a wet coat, and it has to hold up close. Three
   * controls carry it. `chroma` runs the bands of colour that travel the arm —
   * real cephalopods do exactly this and it is what sells the thing as alive;
   * `suckers` lays two staggered rows down the inside of every curl, which is
   * the read at any distance; and `biolume` is what the arm makes for itself,
   * spent almost entirely on the sucker rims because the inside of a curl is
   * the side that faces you across the ring.
   */
  colorSkin: '#7a2f56', // the body of it
  colorSkinDeep: '#2a0f22', // the dark in the mottling
  colorBelly: '#e8b9a8', // the pale underside, where the suckers are
  colorFlush: '#ff3b5c', // what a chromatophore wave floods it toward
  colorBiolume: '#4ff2d8', // the light it makes itself
  colorSucker: '#f2d8c8', // the rims of the cups
  colorRim: '#ff6f9c', // the fresnel at the silhouette
  mottle: 0.65, // depth of the blotching
  mottleScale: 3.2, // blotches along the arm
  mottleWarp: 0.55, // domain warp on them
  bellyBlend: 0.8, // how far the pale underside reaches around
  depthShade: 0.5, // how dark the foot of the arm is, down in the rift
  chroma: 0.5, // strength of the travelling colour bands
  chromaScale: 2.4, // bands along the arm
  chromaSpeed: 0.45, // how fast they travel (a strike speeds them up)
  chromaSharp: 3.4, // 0 = a wash, high = distinct bands
  chromaWarp: 0.7, // how far the mottling drags them out of line
  suckers: 1.0, // master — 0 takes the rows off entirely
  suckerDensity: 30.0, // cups down the length of the arm
  suckerSize: 0.62, // how much of its cell one cup fills
  suckerSpan: 0.85, // radians of the circumference they cover, ±
  suckerRows: 0.46, // radians between the two rows
  suckerRelief: 0.65, // how deep the cups read
  suckerGlow: 1.2, // how hard the rims carry the biolume
  suckerStart: 0.06, // how far up the arm the rows begin
  biolume: 0.85, // strength of the light the arm makes
  biolumeScale: 2.6, // veins along the arm
  biolumeSpeed: 0.7, // how fast they crawl
  biolumePulse: 0.4, // depth of the slow breathing
  specular: 1.5, // the wet highlight
  gloss: 52.0, // how tight that highlight is
  envIntensity: 0.55, // how much of the HDR probe the wet coat catches
  rim: 0.65, // fresnel at the silhouette
  rimPower: 3.2, // how tightly it hugs the edge
  translucency: 0.5, // light coming through the thin end
  glow: 1.0,
  opacity: 1.0,
  frontRough: 0.3, // how ragged the arm's leading edge is as it emerges
  frontWidth: 0.12, // how much of it glows behind that edge
  frontGlow: 2.0,
  strikeFlash: 1.5, // how hard the arm floods when it lands

  /* --- the rift on the floor --- */
  /**
   * The same circle and the same thick boundary as the three far casts before
   * it, torn open into deep water. What it does that none of them do is
   * *turn*: the interior is a maelstrom, and shearing the angle by the radius
   * is the whole spiral. `fieldGlyphRing` is the project's one piece of
   * deliberate iconography, and it earns its place by saying *called* rather
   * than *thrown*. The dark half of the rift is a `SCORCH` decal underneath
   * this quad, because drowned stone has to subtract and this pass is
   * additive.
   */
  fieldBoundary: 0.5, // thickness of the band at the edge, metres
  fieldBoundaryGlow: 1.5,
  fieldFill: 0.45, // the wash inside it
  fieldFalloff: 1.15, // how hard that wash crowds to the rim
  fieldPlates: 0.7, // tonal break-up between the drowned flagstones
  fieldCrackScale: 2.6, // plates per metre
  fieldCrackWidth: 0.2, // how wide the lit seams between them read
  fieldCracks: 1.25, // how hard those seams glow
  fieldSpiral: 0.75, // the maelstrom
  fieldSpiralArms: 3, // how many arms it has
  fieldSpiralTwist: 1.1, // how tightly they wind going inward
  fieldSpin: 0.1, // revolutions/second the whole thing turns
  fieldWarp: 0.65, // domain warp — what stops the arms reading as spokes
  fieldCrawl: 0.45, // how fast the sparks drift
  fieldSparks: 1.0, // cold points glittering in the water
  fieldSparkScale: 5.0,
  fieldRings: 3.0, // swell rings travelling over the disc
  fieldRingSpeed: -0.55, // rings/second (negative runs them inward)
  fieldGlyphRing: 0.8, // the summoning ring — 0 takes it off
  fieldGlyphSeat: 0.6, // where it sits, × zoneRadius
  fieldGlyphTicks: 18, // marks stepped around it
  fieldThroat: 1.4, // the mouth in the middle — and the anvil
  fieldThroatSize: 0.28, // its radius, × zoneRadius
  fieldPulse: 0.28, // brightness breathing
  fieldPulseSpeed: 1.3,
  fieldOpacity: 1.0,
  fieldHeight: 0.03, // hover distance above the floor, metres
  colorField: '#0e6f7a', // the water, the crust and the spiral
  colorFieldEdge: '#7ff5e2', // the boundary band, the seams and the throat

  /* --- the curtain of spray on its rim --- */
  /**
   * The Pyre Crown's wall of flame, answered by the one thing that behaves the
   * opposite way: fire climbs, spray *hangs*. It leans inward over the hole
   * instead of flaring out, it is dragged around the ring rather than up it,
   * and it is the only veil in the project that is **not additive** — spray is
   * matter, and half of what makes the crown look deep is that the far arms
   * are seen through a haze of it while the near ones are not.
   */
  veil: 0.55, // master opacity of the curtain, 0 hides it
  veilHeight: 1.6, // how high it stands, metres
  veilRadius: 1.0, // where it stands, × zoneRadius
  veilLean: -0.14, // negative closes it over the rift
  veilBillow: 0.35, // metre-scale lobes pushing its silhouette off round
  veilScale: 1.1, // noise features per metre
  veilStretch: 0.6, // <1 draws the structures out vertically
  veilFlow: 0.45, // how fast it settles downward
  veilSwirl: 0.12, // how fast it is dragged around the ring
  veilErode: 0.8, // how much harder the top is eaten away than the base
  veilFalloff: 1.35, // how fast it thins with height
  veilSpin: 0.05, // revolutions/second the whole curtain turns
  veilSoftFade: 1.8, // metres of soft fade where it meets geometry
  veilGlint: 0.7, // droplets catching the light as the sheet falls
  colorVeil: '#2c5b63', // the body of it
  colorVeilFoam: '#cfeff5', // where the sheet tears
  colorVeilInk: '#070d12', // what it goes at the floor, where it is thickest

  /* --- what the ground does --- */
  trailSlickRate: 2.0, // wet patches laid per metre of surge travel
  trailSlickRadius: 1.1, // radius of one, metres
  slickSpread: 1.5, // the drowned sheet under the crown, × zoneRadius
  slickLife: 8.0, // seconds a wet patch lingers
  slickIntensity: 0.9,
  slickRate: 2.5, // wet patches creeping around the boundary, per second
  slickRadius: 1.0, // radius of one, metres
  rippleRate: 0.8, // swell rings pushed out while it stands, per second
  tearShock: 8.5, // the ring that snaps out when the rift opens, metres
  colorSlick: '#0a1a20', // wet stone
  colorFoam: '#bfe8ef', // the foam drying on it
  colorDrowned: '#050d14', // the dark half of the rift
  colorShockA: '#3fd8d0', // body of a shockwave ring
  colorShockB: '#e8fffb', // its crest
  colorRippleA: '#2aa7b8', // body of a swell ring
  colorRippleB: '#d8fbff', // its crest
  colorDust: '#3a4a4e', // the dust ring a slam throws out

  /* --- the smash --- */
  /**
   * Four layers per landing, because a single shockwave decal reads as a UI
   * element: a ring snapping out from under the point, a ground-hugging ring
   * of dust, the stone itself thrown up, and the water that was standing there
   * thrown flat and outward. `whipPower` scales all of it down for the thin
   * cords — they lash, they do not hammer — and `finalePower` scales it up for
   * the one strike every arm makes together.
   */
  smashShock: 0.85, // the ring under the point, × zoneRadius
  smashDust: 0.7, // the dust ring, × zoneRadius
  smashDebris: 26, // chips of floor thrown up
  smashSpray: 44, // water thrown flat and outward
  smashInk: 10,
  smashShake: 0.5, // how hard one landing hits the camera
  smashShakeDecay: 0.5, // seconds that hit takes to die away
  whipPower: 0.42, // × everything above, for a whip's landing
  finalePower: 1.7, // ... and for the synchronised one
  finaleFlash: 0.26, // screen flash when every arm lands together
  finaleShock: 13.0, // the ring that answers it, metres

  /* --- the tear, and the standing crown --- */
  tearSpray: 150, // water blown out of the rift as it opens
  tearInk: 70,
  tearDebris: 90,
  tearShake: 0.9,
  shakeDuration: 0.8,
  tearFlash: 0.18,
  holdShake: 0.05, // continuous rumble while the arms stand
  rumble: 0.05, // rumble while the surge races out
  castFlash: 0.08, // screen flash on release
  colorCastFlash: '#5fe6dc',
  colorFlash: '#8ff5e6', // the full-screen flash when the rift tears
  breachSpray: 22, // water thrown as one arm hauls itself out
  breachInk: 5,
  breachDebris: 10,

  /* --- ink, spray, stone and the marine snow --- */
  /**
   * As in every other block: a four-stop gradient sampled over the particle's
   * own lifetime, `A` at birth through `D` as it dies. The **marine snow** is
   * this ability's signature system, and it is defined by what it does *not*
   * do. Every other crown's air is in a hurry — the Glacial Crown's snow falls
   * through its ring, the Pyre Crown's embers race up out of its crater. This
   * hangs: high drag, almost no gravity, turning slowly about the throat. It
   * is what says the space inside this ring is full of water.
   */
  inkRate: 153, // ink rolling off the rift, particles/second
  inkSize: 0.56,
  inkSpeed: 0,
  inkLifetime: 2.55,
  inkOpacity: 0.105,
  inkRise: 0.36, // barely buoyant: ink spreads, it does not climb
  inkTurbulence: 0,
  colorInkA: '#123838',
  colorInkB: '#0b1d26',
  colorInkC: '#9fbedf',
  colorInkD: '#ffffff',
  sprayRate: 180, // water running off the arms, particles/second
  spraySize: 0.08,
  sprayFxSpeed: 9.1,
  sprayLifetime: 2.45,
  sprayGravity: -13.0,
  sprayOpacity: 0.75,
  sprayTurbulence: 0.35,
  colorSprayA: '#ffffff',
  colorSprayB: '#cfeef5',
  colorSprayC: '#7fb8c6',
  colorSprayD: '#2a4a55',
  debrisSize: 0.07, // the floor, broken
  debrisSpeed: 7.5,
  debrisLifetime: 1.9,
  debrisGravity: -16.0,
  colorDebrisA: '#6b7a7e',
  colorDebrisB: '#4a585c',
  colorDebrisC: '#2c3639',
  colorDebrisD: '#141a1c',
  moteRate: 90, // marine snow hanging inside the ring
  moteSize: 0.05,
  moteSpeed: 0.9, // the push it is released with, immediately lost to drag
  moteLifetime: 4.5,
  moteDrift: 0.06, // buoyancy, metres/second² — very nearly neutral
  moteSwirl: 0.55, // radians/second it turns about the throat
  moteExpand: 0.35, // how far the spiral opens as it climbs
  moteGlow: 1.3,
  moteTurbulence: 0.6,
  moteInset: 0.85, // how far inside the boundary it rises, × zoneRadius
  moteSeat: 2.2, // how high above the floor it is released, metres
  colorMoteA: '#d8fff6',
  colorMoteB: '#5ef0d8',
  colorMoteC: '#1e9fb0',
  colorMoteD: '#06202c',

  /* --- dynamic light --- */
  lightIntensity: 14,
  lightRadius: 16,
  lightHeight: 0.9, // metres above the floor — down in the water, not up
  lightColor: '#2ed6c8'
};

export const ext_krakenSchema = {
  'The cast': [
    ['zoneRadius', 0.5, 14, 0.05, 'footprint radius'],
    ['range', 2, 50, 0.1, 'max range'],
    ['minRange', 0, 10, 0.1, 'min range'],
    ['speed', 5, 200, 1, 'surge speed'],
    ['openTime', 0.02, 1.5, 0.01, 'rift tear time'],
    ['lifetime', 1, 16, 0.05, 'how long they hammer'],
    ['withdrawDelay', 0, 4, 0.01, 'delay before withdrawal'],
    ['withdrawTime', 0.05, 4, 0.01, 'withdrawal time'],
    ['withdrawStagger', 0, 3, 0.01, 'withdrawal stagger'],
    ['withdrawSink', 0, 4, 0.05, 'how far it sinks going under'],
    ['cooldown', 0, 8, 0.05, 'cooldown'],
    ['castAnim', 'cast animation']
  ],
  'Where the cast leaves the hand': [
    ['handHeight', 0, 3, 0.01, 'hand height'],
    ['handForward', -1, 3, 0.01, 'hand forward'],
    ['handSide', -1.5, 1.5, 0.01, 'hand lateral'],
    ['castFlash', 0, 2, 0.01, 'flash on release'],
    ['colorCastFlash', 'release flash colour']
  ],
  'Filling the ring': [
    ['armCount', 1, 20, 1, 'heavy arms'],
    ['whipCount', 0, 20, 1, 'thin whips'],
    ['density', 0.1, 2, 0.01, 'density'],
    ['ringSeat', 0.2, 1.4, 0.01, 'arm seat, × footprint'],
    ['ringScatter', 0, 0.6, 0.005, 'arm seat jitter'],
    ['whipSeat', 0.2, 1.6, 0.01, 'whip seat, × footprint'],
    ['whipScatter', 0, 0.6, 0.005, 'whip seat jitter']
  ],
  'The arm': [
    ['reach', 0.3, 1.8, 0.01, 'reach (1 = dead centre)'],
    ['lengthJitter', 0, 1, 0.01, 'length jitter'],
    ['thickness', 0.05, 1.2, 0.01, 'base radius'],
    ['thicknessJitter', 0, 1, 0.01, 'thickness jitter'],
    ['whipLength', 0.1, 1.5, 0.01, 'whip length, × an arm'],
    ['whipThickness', 0.05, 1.5, 0.01, 'whip thickness, × an arm'],
    ['splay', 0, 1.4, 0.01, 'aim off the radius, ±'],
    ['rings', 8, 80, 1, 'rings (bend resolution)'],
    ['sides', 5, 24, 1, 'sides'],
    ['taper', 0.005, 0.5, 0.005, 'tip taper'],
    ['swell', 0.5, 2.5, 0.01, 'muscle swell'],
    ['swellAt', 0.02, 0.95, 0.01, 'where it is thickest'],
    ['armRoughness', 0, 1, 0.01, 'muscle segmentation'],
    ['flatten', 0.35, 1.4, 0.01, 'cross-section flattening']
  ],
  'The poses': [
    ['coilLean', -2, 2, 0.01, 'coil lean'],
    ['coilCurl', 0, 10, 0.05, 'coil curl'],
    ['idleLean', -3, 3, 0.01, 'idle lean'],
    ['idleCurl', -3, 6, 0.01, 'idle curl'],
    ['rearLean', -3, 3, 0.01, 'rear lean'],
    ['rearCurl', -3, 8, 0.01, 'rear curl'],
    ['strikeTurn', 1.2, 5, 0.01, 'strike turn (π lands centre)'],
    ['turnJitter', 0, 0.6, 0.005, 'turn jitter'],
    ['strikeSquash', 0, 1.5, 0.01, 'thickening on the whip'],
    ['settle', 0, 1, 0.01, 'ring-out after landing'],
    ['settleSpeed', 2, 60, 0.5, 'ring-out speed'],
    ['twist', -3, 3, 0.01, 'roll from rift to point']
  ],
  'The travelling wave': [
    ['waveIdle', 0, 2, 0.01, 'amplitude at rest'],
    ['waveRear', 0, 2, 0.01, '... while cocked'],
    ['waveStrike', 0, 2, 0.01, '... during the whip'],
    ['waveCoil', 0, 2, 0.01, '... while coming out'],
    ['waveFreq', 0.1, 5, 0.01, 'waves along the arm'],
    ['waveSpeed', -3, 3, 0.01, 'travel speed']
  ],
  'The beat': [
    ['riseTime', 0.05, 3, 0.01, 'rise out of the rift'],
    ['sweepTime', 0, 3, 0.01, 'sweep around the ring'],
    ['stagger', 0, 1, 0.005, 'random stagger'],
    ['whipDelay', 0, 2, 0.01, 'whip delay'],
    ['smashPeriod', 0.25, 6, 0.01, 'seconds between strikes'],
    ['whipPeriod', 0.1, 2, 0.01, '× that, for the whips'],
    ['cycleScatter', 0, 1, 0.01, 'scatter around the ring'],
    ['rearTime', 0.05, 2, 0.01, 'wind-up'],
    ['strikeTime', 0.02, 1, 0.005, 'the whip itself'],
    ['holdTime', 0.02, 2, 0.01, 'pressed on the floor'],
    ['peelTime', 0.05, 2, 0.01, 'peel back off'],
    ['finaleLead', 0, 4, 0.01, 'finale, seconds before the end']
  ],
  'The flesh': [
    ['opacity', 0, 1, 0.01, 'opacity'],
    ['mottle', 0, 1.5, 0.01, 'mottling'],
    ['mottleScale', 0.2, 12, 0.05, 'blotches along the arm'],
    ['mottleWarp', 0, 2, 0.01, 'domain warp'],
    ['bellyBlend', 0, 1.5, 0.01, 'pale underside'],
    ['depthShade', 0, 1, 0.01, 'darkening at the rift'],
    ['specular', 0, 6, 0.01, 'wet highlight'],
    ['gloss', 4, 160, 1, 'highlight tightness'],
    ['envIntensity', 0, 3, 0.01, 'env reflection'],
    ['rim', 0, 3, 0.01, 'silhouette fresnel'],
    ['rimPower', 0.5, 8, 0.01, 'fresnel tightness'],
    ['translucency', 0, 3, 0.01, 'light through the tip'],
    ['glow', 0, 4, 0.01, 'glow'],
    ['colorSkin', 'skin'],
    ['colorSkinDeep', 'skin (dark)'],
    ['colorBelly', 'underside'],
    ['colorFlush', 'chromatophore flush'],
    ['colorRim', 'silhouette']
  ],
  'Chromatophores & biolume': [
    ['chroma', 0, 2, 0.01, 'colour bands'],
    ['chromaScale', 0.2, 10, 0.05, 'bands along the arm'],
    ['chromaSpeed', -3, 3, 0.01, 'band travel speed'],
    ['chromaSharp', 0.5, 12, 0.05, 'band sharpness'],
    ['chromaWarp', 0, 3, 0.01, 'band break-up'],
    ['biolume', 0, 3, 0.01, 'bioluminescence'],
    ['biolumeScale', 0.2, 10, 0.05, 'veins along the arm'],
    ['biolumeSpeed', -4, 4, 0.01, 'vein crawl'],
    ['biolumePulse', 0, 1, 0.01, 'breathing'],
    ['strikeFlash', 0, 6, 0.05, 'flood on landing'],
    ['colorBiolume', 'biolume']
  ],
  'Suckers': [
    ['suckers', 0, 2, 0.01, 'strength (0 hides them)'],
    ['suckerDensity', 4, 90, 1, 'cups along the arm'],
    ['suckerSize', 0.1, 1, 0.01, 'cup size'],
    ['suckerSpan', 0.1, 2, 0.01, 'span around the arm, ±'],
    ['suckerRows', 0.1, 1.2, 0.01, 'row spacing'],
    ['suckerRelief', 0, 1.5, 0.01, 'cup depth'],
    ['suckerGlow', 0, 4, 0.01, 'rim glow'],
    ['suckerStart', 0, 0.5, 0.005, 'where the rows begin'],
    ['colorSucker', 'cup rims']
  ],
  'Coming out of the rift': [
    ['frontRough', 0, 1.5, 0.01, 'leading edge raggedness'],
    ['frontWidth', 0.01, 0.8, 0.01, 'lit edge width'],
    ['frontGlow', 0, 8, 0.05, 'edge glow'],
    ['breachSpray', 0, 80, 1, 'spray on breach'],
    ['breachInk', 0, 40, 1, 'ink on breach'],
    ['breachDebris', 0, 40, 1, 'stone on breach']
  ],
  'The smash': [
    ['smashShock', 0, 3, 0.01, 'shock ring, × footprint'],
    ['smashDust', 0, 3, 0.01, 'dust ring, × footprint'],
    ['smashDebris', 0, 200, 1, 'stone thrown'],
    ['smashSpray', 0, 300, 1, 'water thrown'],
    ['smashInk', 0, 100, 1, 'ink thrown'],
    ['smashShake', 0, 3, 0.01, 'shake per landing'],
    ['smashShakeDecay', 0.05, 3, 0.01, 'shake decay'],
    ['whipPower', 0, 1.5, 0.01, 'a whip landing, × an arm'],
    ['finalePower', 0.5, 4, 0.01, 'the finale, × an arm'],
    ['finaleFlash', 0, 2, 0.01, 'finale screen flash'],
    ['finaleShock', 0, 30, 0.1, 'finale ring, metres']
  ],
  'The rift': [
    ['fieldBoundary', 0.02, 2, 0.01, 'band thickness'],
    ['fieldBoundaryGlow', 0, 8, 0.05, 'band glow'],
    ['fieldFill', 0, 2, 0.01, 'interior fill'],
    ['fieldFalloff', 0.1, 5, 0.05, 'fill falloff'],
    ['fieldPlates', 0, 3, 0.01, 'flagstone break-up'],
    ['fieldCrackScale', 0.2, 10, 0.05, 'plates / metre'],
    ['fieldCrackWidth', 0.02, 1, 0.01, 'seam width'],
    ['fieldCracks', 0, 4, 0.01, 'lit seams'],
    ['fieldSpiral', 0, 3, 0.01, 'the maelstrom'],
    ['fieldSpiralArms', 1, 8, 1, 'spiral arms'],
    ['fieldSpiralTwist', 0, 4, 0.01, 'how tightly it winds'],
    ['fieldSpin', -2, 2, 0.005, 'rotation'],
    ['fieldWarp', 0, 2, 0.01, 'domain warp'],
    ['fieldCrawl', -4, 4, 0.01, 'spark drift'],
    ['fieldSparks', 0, 4, 0.01, 'sparks in the water'],
    ['fieldSparkScale', 0.5, 20, 0.1, 'sparks / metre'],
    ['fieldRings', 0, 12, 0.1, 'swell rings'],
    ['fieldRingSpeed', -6, 6, 0.01, 'ring speed'],
    ['fieldGlyphRing', 0, 3, 0.01, 'summoning ring'],
    ['fieldGlyphSeat', 0.1, 1.2, 0.01, 'its seat, × footprint'],
    ['fieldGlyphTicks', 3, 48, 1, 'marks around it'],
    ['fieldThroat', 0, 4, 0.01, 'the throat'],
    ['fieldThroatSize', 0.02, 1, 0.005, 'throat size, × footprint'],
    ['fieldPulse', 0, 1, 0.01, 'pulse'],
    ['fieldPulseSpeed', 0, 10, 0.05, 'pulse speed'],
    ['fieldOpacity', 0, 2, 0.01, 'opacity'],
    ['fieldHeight', 0.005, 0.4, 0.005, 'hover height'],
    ['colorField', 'water & spiral'],
    ['colorFieldEdge', 'band & throat']
  ],
  'The curtain of spray': [
    ['veil', 0, 2, 0.01, 'opacity (0 hides it)'],
    ['veilHeight', 0.1, 8, 0.05, 'height'],
    ['veilRadius', 0.5, 1.6, 0.005, 'seat, × footprint'],
    ['veilLean', -0.8, 1.2, 0.01, 'lean (negative closes it over)'],
    ['veilBillow', 0, 1.5, 0.01, 'silhouette lobes'],
    ['veilScale', 0.1, 6, 0.05, 'noise / metre'],
    ['veilStretch', 0.05, 3, 0.01, 'vertical stretch'],
    ['veilFlow', -4, 4, 0.01, 'settling speed'],
    ['veilSwirl', -2, 2, 0.01, 'drag around the ring'],
    ['veilErode', 0, 1, 0.01, 'erosion with height'],
    ['veilFalloff', 0.2, 6, 0.05, 'thinning with height'],
    ['veilSpin', -1, 1, 0.005, 'rotation'],
    ['veilSoftFade', 0.02, 4, 0.01, 'soft intersection'],
    ['veilGlint', 0, 4, 0.01, 'droplet glints'],
    ['colorVeil', 'body'],
    ['colorVeilFoam', 'foam (where it tears)'],
    ['colorVeilInk', 'ink (at the floor)']
  ],
  'Wet stone & fractures': [
    ['trailSlickRate', 0.05, 10, 0.05, 'trail slick / metre'],
    ['trailSlickRadius', 0.05, 6, 0.05, 'trail slick radius'],
    ['slickSpread', 0.2, 4, 0.05, 'drowned sheet, × footprint'],
    ['slickLife', 0.5, 20, 0.1, 'slick lifetime'],
    ['slickIntensity', 0, 2, 0.01, 'slick intensity'],
    ['slickRate', 0, 20, 0.1, 'rim slick / sec'],
    ['slickRadius', 0.05, 6, 0.05, 'rim slick radius'],
    ['rippleRate', 0, 12, 0.1, 'swell rings / sec'],
    ['tearShock', 0.5, 25, 0.1, 'tear shockwave radius'],
    ['colorSlick', 'wet stone'],
    ['colorFoam', 'foam'],
    ['colorDrowned', 'drowned sheet'],
    ['colorShockA', 'shockwave ring'],
    ['colorShockB', 'shockwave crest'],
    ['colorRippleA', 'swell ring'],
    ['colorRippleB', 'swell crest'],
    ['colorDust', 'dust']
  ],
  'Ink, spray & marine snow': [
    ['inkRate', 0, 900, 1, 'ink rate'],
    ['inkSize', 0.05, 4, 0.01, 'ink size'],
    ['inkSpeed', 0, 10, 0.05, 'ink speed'],
    ['inkLifetime', 0.2, 8, 0.05, 'ink lifetime'],
    ['inkOpacity', 0, 1, 0.005, 'ink opacity'],
    ['inkRise', -3, 4, 0.01, 'ink buoyancy'],
    ['inkTurbulence', 0, 3, 0.01, 'ink swirl'],
    ['sprayRate', 0, 900, 1, 'spray rate'],
    ['spraySize', 0.005, 0.4, 0.005, 'spray size'],
    ['sprayFxSpeed', 0, 20, 0.1, 'spray speed'],
    ['sprayLifetime', 0.1, 8, 0.05, 'spray lifetime'],
    ['sprayGravity', -40, 0, 0.1, 'spray gravity'],
    ['sprayOpacity', 0, 1, 0.01, 'spray opacity'],
    ['sprayTurbulence', 0, 3, 0.01, 'spray swirl'],
    ['moteRate', 0, 600, 1, 'marine snow rate'],
    ['moteSize', 0.005, 0.4, 0.005, 'mote size'],
    ['moteSpeed', 0, 10, 0.05, 'initial push'],
    ['moteLifetime', 0.2, 12, 0.05, 'mote lifetime'],
    ['moteDrift', -2, 3, 0.01, 'mote buoyancy'],
    ['moteSwirl', -6, 6, 0.01, 'turn about the throat'],
    ['moteExpand', 0, 3, 0.01, 'spiral opening'],
    ['moteTurbulence', 0, 3, 0.01, 'mote swirl'],
    ['moteGlow', 0, 4, 0.01, 'mote glow'],
    ['moteInset', 0.05, 1.4, 0.01, 'rise inset, × footprint'],
    ['moteSeat', 0.1, 8, 0.05, 'release height'],
    ['colorInk*', 'Ink colour'],
    ['colorSpray*', 'Spray colour'],
    ['colorMote*', 'Marine snow colour']
  ],
  'Broken floor': [
    ['debrisSize', 0.005, 0.5, 0.005, 'chip size'],
    ['debrisSpeed', 0, 30, 0.1, 'chip speed'],
    ['debrisLifetime', 0.1, 6, 0.05, 'chip lifetime'],
    ['debrisGravity', -50, 0, 0.1, 'chip gravity'],
    ['colorDebris*', 'Chip colour']
  ],
  'The tear & the standing crown': [
    ['tearSpray', 0, 600, 1, 'tear spray'],
    ['tearInk', 0, 400, 1, 'tear ink'],
    ['tearDebris', 0, 400, 1, 'tear stone'],
    ['tearShake', 0, 3, 0.01, 'tear shake'],
    ['shakeDuration', 0.1, 4, 0.01, 'shake duration'],
    ['tearFlash', 0, 2, 0.01, 'tear screen flash'],
    ['holdShake', 0, 0.5, 0.005, 'standing rumble'],
    ['rumble', 0, 0.5, 0.005, 'travel rumble'],
    ['colorFlash', 'tear flash colour']
  ],
  'Dynamic light': [
    ['lightIntensity', 0, 120, 0.5, 'light intensity'],
    ['lightRadius', 0.5, 50, 0.1, 'light radius'],
    ['lightHeight', 0, 6, 0.05, 'height above the floor'],
    ['lightColor', 'light colour']
  ]
};
