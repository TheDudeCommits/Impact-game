// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*! Ported into VFX Armory (ext pack) from achrefelouafi/LinearAbilityExtThreeJS, MIT, Copyright (c) 2026 mohamedachrefelouafi. */
/* ================================================================== */
/* FIRE PORTAL — a black disc with a ring of fire throwing lines off it */
/* ================================================================== */
/**
 * Deliberately the smallest ability block in the file.
 *
 * The gate needs fourteen controls to say how its stones are stacked and the
 * ring needs ten to say how its segments swing in. This one has no pieces,
 * no assembly and no dressing: it is a **black disc** with a **ring emitter**
 * standing in front of it, and everything you can see other than those two is
 * one particle system.
 *
 * Which means the colour design is `The sparks`, and only that. The four
 * stops are a lifetime gradient — white where a spark is born, orange through
 * the middle of its life, red as it goes out, and gone — and nothing else in
 * the ability tints anything. `spark speed` and `drag` between them are the
 * shape of the fan: the sparks leave on a straight tangent and the drag is
 * what bends them into the long curved lines, so a low drag gives a starburst
 * and a high one gives a tight scroll. Nothing in the ability draws a curve.
 *
 * `licks back over the hole` is the one slider that can ruin it. Push it past
 * a couple of centimetres and the ring's bloom crosses the contour, the middle
 * lights, and the hole is gone — and the hole is the ability.
 */
export const ext_fireportal = {
  /* --- the cast --- */
  range: 18.0, // maximum cast distance, metres
  minRange: 3.0, // a portal cut on your own feet is a portal in your face
  speed: 48.0, // how fast the cast races to the site, metres/second
  cooldown: 3.0,
  castAnim: 'cast1', // which clip in `CAST_ANIMATIONS` the body throws

  /* --- the circle (metres) --- */
  ringRadius: 2.15, // the clear radius of the way through
  ringHover: 0.55, // how far the foot of it clears the floor
  lean: 0.0, // radians the top tips away from the caster

  /* --- opening: the circle is struck, not switched on --- */
  // A spark leaves the foot of the circle and runs all the way round it,
  // laying the ring down behind it and throwing its shower as it goes. Only
  // once it is nearly home does the way through start to open inside what it
  // drew. `scribeTime` is the beat the whole opening is cut to.
  scribeTime: 0.62, // seconds the spark takes to run round
  scribeFeather: 0.16, // metres of contour the line takes to come up behind it
  scribeHead: 3.6, // brightness of the spark itself
  scribeHeadSize: 0.19, // metres — how big a blob that spark is
  scribeTrail: 2.4, // metres behind it that are still white-hot
  scribeTrailHeat: 1.8, // how much hotter than the settled ring that is
  scribeRate: 6500, // sparks/second thrown off the running head
  scribeTail: 0.55, // metres of contour behind it they are born on
  scribeSpeed: 7.4, // metres/second they leave it at
  scribeOut: 0.85, // how much of that throw is straight out of the circle
  scribeSpread: 0.4, // cone spread at the head — wider than the settled fan
  // The head peaks at better than 40 m/s — twice the average, because the
  // sweep is eased at both ends — so this is a small number by design.
  scribeInherit: 0.15, // how much of the head's own travel they carry away
  openTime: 0.22, // seconds the stroke takes to reach its settled brightness
  apertureDelay: 0.76, // fraction of the draw before the hole starts to open
  apertureTime: 0.5, // seconds the hole takes to iris open

  /* --- going out --- */
  closeTime: 1.0, // seconds the whole thing takes to go out

  /* --- the ring --- */
  ring: 1.42, // brightness of the bloom around the line
  ringWidth: 0.33, // how far that bloom reaches outward, metres
  ringInner: 0.06, // and inward, metres — keep this small
  ringHot: 1.24, // the white core of the line itself
  colorRing: '#ff8c1e', // the bloom
  surfaceOpacity: 1.0, // how solid the way through reads

  /* --- the middle --- */
  voidDark: 0.26, // how black it is — 0 leaves a ring with nothing in it
  voidWarm: 1.27, // warm bounce on the inside of the lip
  voidFeather: 0.02, // metres the black feathers out into the ring
  colorVoid: '#150400', // the middle. Very nearly black, and meant to be

  /* --- the sparks: the whole of the rest of it --- */
  sparkRate: 3200, // sparks/second thrown off the ring
  sparkSize: 0.085, // width of one streak, metres
  sparkLife: 0.89, // seconds — with the gradient below, this is the fan's length
  sparkLifeVariance: 0.64,
  // Speed over drag is how far a spark actually gets (metres): 6.1 / 3.56 is
  // a little under two metres, so the fan sits inside a radius of the ring
  // and sweeps round it. Wind the speed up or the drag down and the tangents
  // straighten into a starburst that reads as a sun rather than as a portal.
  sparkSpeed: 6.1, // metres/second, along the tangent
  sparkSpeedVariance: 0.51,
  sparkSwirl: 1.45, // which way round they are thrown — negative reverses it
  sparkOut: 0.3, // how much of the throw is straight out instead
  sparkSpread: 0.11, // 0..1 cone widening — keep it tight or the fan breaks up
  sparkJitter: 0.0, // metres of scatter at the birth point — off, so the line stays crisp
  sparkDrag: 3.56, // what pulls a straight tangent up into a curved line
  sparkGravity: -0.8, // metres/second², so the fan sags a little
  sparkStretch: 0.7, // how long the streak is drawn per unit of speed
  sparkEndSize: 0.12, // how much of its width is left when it dies
  sparkFadeOut: 0.55, // fraction of its life spent fading
  sparkWander: 0.0, // wobble — off, so the fan keeps its clean sweep

  /* --- the lifetime gradient, and the entire colour design --- */
  colorBirth: '#fff6e0', // white, on the ring
  colorEarly: '#ffab34', // orange, through the middle of the throw
  colorLate: '#ff4a0a', // red, out at the ends
  colorDeath: '#4a0a00', // and gone

  /* --- dynamic light --- */
  lightIntensity: 40, // the firelight the portal throws on the floor
  lightRadius: 18.5,
  lightColor: '#ff7a22',
  lightFlicker: 0.38, // depth of the gutter in that light

  /* --- Armory port: fields the combined sandbox needs --- */
  zoneRadius: 2.15, // Armory: indicator radius (the ring radius)
  standTime: 8 // Armory: seconds it stands before closing itself (0 = until re-cast)
};

export const ext_fireportalSchema = {
  'The cast': [
    ['range', 2, 60, 0.1, 'max range'],
    ['minRange', 0, 12, 0.1, 'min range'],
    ['speed', 5, 120, 1, 'cast speed'],
    ['cooldown', 0, 12, 0.05, 'cooldown'],
    ['castAnim', 'cast animation']
  ],
  'The circle (metres)': [
    ['ringRadius', 0.6, 6, 0.05, 'clear radius'],
    ['ringHover', 0, 3, 0.01, 'clears the floor by'],
    ['lean', -0.6, 0.6, 0.005, 'tips back by (rad)'],
    ['closeTime', 0.2, 5, 0.05, 'goes out over']
  ],
  'Struck — the spark that draws it': [
    ['scribeTime', 0.1, 3, 0.01, 'runs round in'],
    ['scribeHead', 0, 8, 0.05, 'the spark itself'],
    ['scribeHeadSize', 0.03, 0.8, 0.005, 'how big it is (m)'],
    ['scribeFeather', 0.02, 1.2, 0.01, 'line comes up over (m)'],
    ['scribeTrail', 0.1, 8, 0.05, 'still white-hot for (m)'],
    ['scribeTrailHeat', 0, 5, 0.05, 'how much hotter'],
    ['scribeRate', 0, 30000, 100, 'shower / second'],
    ['scribeTail', 0.05, 4, 0.01, 'born within (m) of it'],
    ['scribeSpeed', 0, 40, 0.1, 'shower speed (m/s)'],
    ['scribeOut', -1, 2, 0.01, 'thrown outward by'],
    ['scribeSpread', 0, 1, 0.01, 'cone spread at the head'],
    ['scribeInherit', 0, 1.5, 0.01, 'carries its travel'],
    ['openTime', 0.05, 4, 0.01, 'stroke settles over'],
    ['apertureDelay', 0, 1, 0.01, 'hole waits for (of the draw)'],
    ['apertureTime', 0.05, 4, 0.01, 'hole irises over']
  ],
  'The ring': [
    ['ring', 0, 4, 0.01, 'bloom brightness'],
    ['ringWidth', 0.02, 2, 0.01, 'bloom outward (m)'],
    ['ringInner', 0.01, 0.6, 0.005, 'licks back over the hole (m)'],
    ['ringHot', 0, 6, 0.01, 'the white line itself'],
    ['colorRing', 'bloom colour'],
    ['surfaceOpacity', 0, 1, 0.01, 'how solid the hole reads']
  ],
  'The middle': [
    ['voidDark', 0, 1, 0.01, 'how black it is'],
    ['voidWarm', 0, 2, 0.01, 'bounce inside the lip'],
    ['voidFeather', 0.02, 2, 0.01, 'feathers into the ring (m)'],
    ['colorVoid', 'the middle']
  ],
  'The sparks': [
    ['sparkRate', 0, 6000, 20, 'sparks / second'],
    ['sparkSpeed', 0, 40, 0.1, 'spark speed (m/s)'],
    ['sparkDrag', 0, 6, 0.01, 'drag — what curves them'],
    ['sparkLife', 0.1, 4, 0.01, 'spark life'],
    ['sparkSwirl', -2, 2, 0.05, 'which way round'],
    ['sparkOut', -1, 2, 0.01, 'thrown outward by'],
    ['sparkSpread', 0, 1, 0.01, 'cone spread'],
    ['sparkGravity', -20, 10, 0.1, 'gravity'],
    ['sparkSize', 0.005, 0.4, 0.005, 'spark width'],
    ['sparkStretch', 0, 1, 0.005, 'streak length'],
    ['sparkEndSize', 0, 2, 0.01, 'width when it dies'],
    ['sparkFadeOut', 0, 1, 0.01, 'fades over'],
    ['sparkWander', 0, 1.5, 0.01, 'wobble'],
    ['sparkJitter', 0, 0.6, 0.005, 'birth scatter (m)'],
    ['sparkSpeedVariance', 0, 1, 0.01, 'speed variance'],
    ['sparkLifeVariance', 0, 1, 0.01, 'life variance']
  ],
  'Spark colour over its life': [
    ['colorBirth', 'birth — white'],
    ['colorEarly', 'early — orange'],
    ['colorLate', 'late — red'],
    ['colorDeath', 'death']
  ],
  'Light': [
    ['lightIntensity', 0, 40, 0.1, 'light intensity'],
    ['lightRadius', 1, 40, 0.5, 'light radius'],
    ['lightFlicker', 0, 1, 0.01, 'gutter depth'],
    ['lightColor', 'light colour']
  ],
  'Armory': [
    ['zoneRadius', 0.5, 6, 0.05, 'indicator radius'],
    ['standTime', 0, 60, 0.5, 'stand time (0 = until re-cast)']
  ]
};
