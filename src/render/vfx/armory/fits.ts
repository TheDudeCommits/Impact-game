import * as THREE from 'three';

/**
 * What the adapter knows about each vendored Armory effect's settings block (docs/engine/armory/README.md).
 *
 * The Armory casts in its own world: a flat floor at y = 0 and a 1.8 m caster at the origin. Several of its shaders
 * draw straight in world space (the Tube and Shell kits, CelFlame, the ribbon hulls ignore the model matrix), so an
 * effect is never moved or scaled as a whole; it is fitted through its own settings, per cast, before it spawns and
 * every frame it updates (the Armory reads its settings live):
 *  - **colours** by heat: 0 is the fighter's core, .5 its main, 1 its rim; a key keeps its own brightness and takes the
 *    palette's hue (`recolour`), so an effect's value structure (white heart, dark ember) survives any fighter's colours.
 *    Keys not listed (smoke, ash, soot, scorch, ink outlines) keep the Armory's;
 *  - the **launch point** (a hand, a blade's heel): set from the real one, as metres forward, to the right and up from
 *    the thrower's feet along the throw;
 *  - **size**: lengths, radii and heights of the look, scaled with the cast (the casting's scale and the fighter's
 *    height); **counts** and rates, scaled with the quality tier and the density setting;
 *  - **timing**: the key for the front's speed and the one for how long it holds;
 *  - **set**: what the game needs other than the sandbox: no camera shake of its own, no screen-wide impact frame or
 *    distortion (the game has its own; effect.ts bridges a flash to it), no prop the game supplies itself.
 * An effect with no fit still runs, on the defaults and a colour guess by key name (`guessHeat`).
 */
export interface Fit {
  colours?: Readonly<Record<string, number>>;
  launch?: { readonly forward?: string; readonly side?: string; readonly height?: string };
  /** The height (metres) the cast ends at, set to the target's centre for a cast at a body. */
  end?: string;
  size?: readonly string[];
  counts?: readonly string[];
  /** Counts that are a quality level (an integer), per tier. */
  levels?: Readonly<Record<string, Readonly<Record<'low' | 'medium' | 'high', number>>>>;
  speed?: string;
  sustain?: string;
  /** The reach limits: raised so a cast is never clamped short of its line. */
  range?: readonly string[];
  set?: Readonly<Record<string, number | string | boolean>>;
  /** A body aura: the caster's origin follows its wearer; `lift` keys are heights that rise with the wearer off the
   *  floor; `holdKey` is the time it holds, made as long as it is worn. */
  follows?: boolean;
  lift?: readonly string[];
  holdKey?: string;
  /** The key that scales the whole effect when it has one (a zone's radius). */
  zone?: string;
  /** Its own wind-up before it lets go (seconds): next to nothing when it starts at a move's release, which has
   *  already wound up. */
  windup?: readonly string[];
  /** Its front's speed against the move's: more than 1 for a path longer than the straight line (the bend fire's S). */
  speedScale?: number;
  /** Its impact shells' and ground rings' size for the game's close camera (host.ts), over the defaults. */
  bursts?: number;
  decals?: number;
  /** A far cast's radius in the game (metres, least and most): a zone sized for the Armory's far camera rises out of
   *  the game's frame. */
  radius?: readonly [number, number];
  /** The keys for the time between one piece of a line and the next, and for their number: the pieces are spaced to
   *  keep pace with the move (the line's length over their number, at its speed). */
  step?: readonly [string, string];
  /** Every shader of it honours its model matrix (not so the Tube, Shell and CelFlame kits): a zone of it can be moved
   *  after its victim while it plays. */
  movable?: boolean;
  /** The key for the Armory's own clock rate, when it has one (p27's `timeScale`), and the second of its own cast its
   *  climax lands on (Solar Nova's nova): paced so the climax lands with the move's last blow. */
  pace?: string;
  peak?: number;
  /** How far past a target a line thrown at it ends (metres), over the move's: a blow that detonates on its victim. */
  past?: number;
  /** What one cast costs at High, 1080p, on an M4 laptop (scripts/engine/armory_perf.mjs): its draw calls and GPU
   *  milliseconds, the VOL.2 type's `cost`. */
  cost?: { readonly draws: number; readonly gpuMs: number };
  /** Its `size` keys at this much more (1): an effect fitted by name is drawn smaller for the game's close camera. */
  sizeScale?: number;
  /** Fitted by name (`autoFit`), not by hand. */
  auto?: boolean;
}

import { classifyKey } from './macros';

const EMBERS = (prefix: string, a = 0, b = .3, c = .64, d = .95) => ({ [`${prefix}A`]: a, [`${prefix}B`]: b, [`${prefix}C`]: c, [`${prefix}D`]: d });

/** Each `cost` was measured by scripts/engine/armory_perf.mjs (docs/engine/armory/README.md, "What each costs"). */
export const FITS: Readonly<Record<string, Fit>> = Object.freeze({
  extra_rageaura: {
    cost: { draws: 4, gpuMs: 0.3 },
    colours: { colorCore: 0, colorInner: .12, colorOuter: .42, colorEdge: .72, sparkColor: .3, lightColor: .4 },
    decals: .45,
    size: ['radiusX', 'radiusY', 'height', 'shockRadius', 'sparkSize'],
    counts: ['burstSparks', 'riseSparks'],
    follows: true, lift: ['height'], holdKey: 'holdTime',
    // Worn all fight, its ignition should not ring the floor 5 m out or shake anyone's camera.
    set: { shockRadius: 1.6, burstShake: 0, rumble: 0, burstFlash: 0, shockStrength: 0 },
  },
  extra_celflame: {
    cost: { draws: 14, gpuMs: 0.6 },
    colours: { colorCore: .08, colorMid: .42, colorOuter: .78, sparkColor: .45, lightColor: .4 },
    size: ['width', 'height', 'sparkSize', 'scatter'],
    counts: ['count', 'embers', 'emberRate'],
    sustain: 'holdTime', windup: ['startDelay'], step: ['step', 'count'],
    range: ['range', 'minRange'],
    // The first tongue at the thrower's feet, and ten of them to the target: a sea of flame, not three far-off flares.
    set: { flameShake: 0, firstAt: .05, count: 12, width: 1.6, height: 2.9 },
  },
  dragonbreath: {
    cost: { draws: 9, gpuMs: 3.5 },
    colours: {
      // The volume's light and middle pushed toward the fighter's main: the soft cream of its in-scatter read pale in the toon frame.
      flameColorCore: 0, flameColorMid: .4, flameColorEdge: .72, flameColorDeep: .97, flameColorLight: .34,
      colorTongueCore: 0, colorTongueInner: .28, colorTongueOuter: .64, colorTongueHalo: .93,
      ...EMBERS('colorEmber', 0, .3, .66, .97), ...EMBERS('colorDrip', 0, .3, .72, .97),
      colorBurstA: .66, colorBurstB: .3, colorBurstC: 0, colorCastFlash: .3, colorFlash: 0, lightColor: .42, colorScorchGlow: .55,
    },
    launch: { forward: 'handForward', side: 'handSide', height: 'handHeight' },
    end: 'endHeight',
    size: ['muzzleSize', 'mouthBurstSize', 'emberSize', 'dripSize', 'smokeSize', 'scorchWidth', 'tongueWidth'],
    counts: ['emberRate', 'dripRate', 'smokeRate', 'tongueCount'],
    levels: { flameSteps: { low: 18, medium: 26, high: 38 } },
    speed: 'speed', sustain: 'sustainTime',
    range: ['range', 'minRange'],
    // A short gutter: the cone's volume, lingering, read as a pale cloud.
    set: { rumble: 0, impactShake: 0, coneFlare: .2, fadeTime: .38 },
  },
  firewhip: {
    cost: { draws: 7, gpuMs: 1.1 },
    colours: {
      lashColorCore: 0, lashColorInner: .28, lashColorOuter: .62, lashColorHalo: .93,
      crackColorBody: .9, crackColorRim: .28, crackColorEdge: .06, crackColorCorona: .35,
      colorCrackBurstA: .9, colorCrackBurstB: .45, colorCrackBurstC: .06, colorCrackFlash: .06,
      colorMuzzleA: .9, colorMuzzleB: .45, colorMuzzleC: .06, colorCastFlash: .3,
      ...EMBERS('colorEmber', 0, .3, .62, .95), colorScorchEmber: .55, lightColor: .42,
    },
    launch: { forward: 'handForward', side: 'handSide', height: 'handHeight' },
    end: 'tipHeight',
    size: ['lashRadius', 'lashRadiusNear', 'crackRadius', 'crackRadiusEnd', 'crackBurstSize', 'muzzleSize', 'scorchRadius', 'emberSize', 'ashSize', 'smokeSize'],
    counts: ['emberRate', 'emberFallRate', 'ashRate', 'smokeRate', 'crackSparks', 'crackAshBurst', 'releaseSparks', 'snapSparks', 'scorchRate'],
    speed: 'speed', sustain: 'lifetime', windup: ['windUp'],
    range: ['range', 'minRange'],
    set: { rumble: 0, crackShake: 0, snapShake: 0 },
  },
  emberflock: {
    cost: { draws: 10, gpuMs: 0.9 },
    colours: {
      ...EMBERS('colorBird', 0, .22, .62, .95), ...EMBERS('colorTrail', .05, .4, .75, .97), ...EMBERS('colorEmber', 0, .3, .62, .95),
      ...EMBERS('colorSpark', 0, .15, .5, .9), colorCharEmber: .55, colorCastFlash: .22, colorShockA: .22, colorShockB: .03,
      colorBurstA: .62, colorBurstB: .3, colorBurstC: 0, colorFlash: .3, lightColor: .4,
    },
    launch: { forward: 'handForward', side: 'handSide', height: 'handHeight' },
    end: 'endHeight',
    size: ['size', 'spacingSide', 'spacingUp', 'columnHeight', 'columnRadius', 'burstSize', 'shockRadius', 'scorchRadius', 'leadRise', 'trailWidth', 'emberSize', 'sparkSize', 'smokeSize'],
    counts: ['birds', 'emberRate', 'sparkRate', 'smokeRate', 'burstSparks', 'burstEmbers', 'columnEmbers', 'gatherSparks'],
    speed: 'speed', sustain: 'lifetime', windup: ['revealTime'],
    range: ['range', 'minRange'],
    // Its end column and burst sized for a close camera.
    set: { rumble: 0, impactShake: 0, columnHeight: 2.4, burstSize: 1.6, shockRadius: 2.6 },
  },
  ext_bend_fire: {
    cost: { draws: 5, gpuMs: 4.2 },
    // The fireball is black-body by default (paletteBlend 0): blended toward the fighter's palette, so another
    // fighter's fire can take it.
    colours: { colorCore: 0, colorMid: .3, colorEdge: .68, lightColor: .42 },
    // It cruises at its flight height: the thrower's palms.
    launch: { height: 'flightHeight' },
    size: ['headSize', 'flameWidth', 'flameHeight', 'explosionSize', 'streamLength', 'emberSize', 'smokeSize'],
    counts: ['emberRate', 'sparkRate'],
    levels: { volumeSteps: { low: 18, medium: 26, high: 35 } },
    // Its S-curve is longer than the shot's straight line: it flies faster to arrive with the blow.
    speed: 'speed', speedScale: 1.35,
    range: ['range', 'minRange'],
    set: { explosionShake: 0, heatDistortion: 0, paletteBlend: .45, explosionSize: 2 },
  },
  ext_pyre: {
    cost: { draws: 57, gpuMs: 8.8 },
    colours: {
      colorEmber: .72, colorFlame: .36, colorCore: 0, colorRim: .3, colorField: .55, colorFieldEdge: .18, colorVeil: .42, colorVeilCrest: .5,
      colorScorchEmber: .5, colorFracture: .25, colorShockA: .5, colorShockB: .04,
      colorCinderA: 0, colorCinderB: .38, colorCinderC: .82, ...EMBERS('colorEmber', 0, .25, .62, .95), ...EMBERS('colorUpdraft', .1, .38, .8, .97),
      colorCastFlash: .3, colorFlash: .3, lightColor: .42,
    },
    launch: { forward: 'handForward', side: 'handSide', height: 'handHeight' },
    zone: 'zoneRadius', radius: [2.2, 3.4], movable: true,
    size: ['ringHeight', 'skirtHeight', 'radius', 'veilHeight', 'veilRadius', 'shockRadius', 'trailScorchRadius', 'scorchRadius', 'cinderSize', 'emberSize', 'updraftSize', 'smokeSize'],
    counts: ['smokeRate', 'emberRate', 'updraftRate', 'burstCinders', 'burstSmoke', 'burstEmbers', 'trailScorchRate', 'scorchRate'],
    // Its crown is the one heavy thing in the pilot (11.5 ms at High with 103 blades): 80 at High, still a crown.
    levels: { density: { low: .35, medium: .45, high: .5 } },
    speed: 'speed', sustain: 'lifetime',
    range: ['range', 'minRange'],
    set: { impactShake: 0, holdShake: 0, rumble: 0, haze: 0 },
  },
  p27_solarnova: {
    colours: { lightColor: .2 },
    launch: { forward: 'handForward', side: 'handSide', height: 'handHeight' },
    // Its star rises ten radii over the target: kept low enough for the game's camera to see it.
    zone: 'zoneRadius', radius: [1.6, 2.4], movable: true,
    counts: ['particles', 'fragments'],
    levels: { detail: { low: 0, medium: 1, high: 2 }, rings: { low: 2, medium: 3, high: 5 }, flares: { low: 2, medium: 5, high: 9 }, blades: { low: 4, medium: 10, high: 18 }, rays: { low: 8, medium: 16, high: 28 } },
    pace: 'timeScale', peak: 4.5,
    range: ['range', 'minRange'],
    set: { shake: 0 },
  },
  colossus_flamefist: {
    cost: { draws: 10, gpuMs: 0.5 },
    colours: {
      fistColorCore: 0, fistColorMid: .22, fistColorBody: .5, fistColorRim: .8,
      trailColorCore: 0, trailColorMid: .25, trailColorBody: .52, trailColorRim: .85,
      boomColorCore: 0, boomColorMid: .25, boomColorBody: .52, boomColorRim: .85,
      tongueColorRim: .08, tongueColorHeart: .25, tongueColorBody: .5,
      ...EMBERS('colorEmber', 0, .25, .52, .92), ...EMBERS('colorStreak', 0, .12, .3, .55),
      colorHitCore: 0, colorHitRim: .5, colorFlash: .2, lightColor: .42,
    },
    // The fist ignites at the real hand and flies at the height it grows to (its own size times `fistHeight`).
    launch: { forward: 'handForward', side: 'handSide', height: 'handHeight' },
    size: ['fistSize', 'fistStart', 'boomSize', 'boomRing', 'scorchSize', 'tongueHeight', 'tongueWidth', 'rockSize'],
    counts: ['trailRate', 'emberRate', 'streakRate', 'boomCount', 'boomRocks', 'tongueCount'],
    speed: 'speed', sustain: 'hold', windup: ['charge'],
    range: ['range', 'minRange'],
    // It detonates on the victim, not past them.
    past: .4,
    // Its focus lines and impact frame are drawn on the whole screen, over every player's view (the game's impact frame
    // stands in); its grade dims the world. Its fist, blast, shock ring and scorch are sized for the game's camera, a
    // special's blast rather than an ultimate's.
    // Seen from just behind the thrower, a fist at its full size from the hand fills the frame white: it starts smaller,
    // swells as it flies off, and burns a little less white (the game's bloom does the rest). Its trail and blast cool
    // to lighter smoke, sooner.
    set: { lines: 0, ifStrength: 0, ifFrames: 0, gradeWeight: 0, impactShake: 0, impactFlash: .3, fistSize: 2.3, fistStart: .35, fistGrow: .32,
      fistGlow: 1.15, fistCoreCut: .85, trailGlow: 1.1, trailHeat: .5, boomGlow: 1.3, trailLife: .65, trailSmokeAlpha: .55, boomSmokeAlpha: .6, boomLife: 1.1,
      boomRing: 5.5, boomSize: 1.15, boomCount: 26, boomRocks: 14, scorchSize: 3.6, hitScale: .7, fadeTime: 1.1 },
  },
  blade_crescent: {
    cost: { draws: 9, gpuMs: 1.0 },
    colours: {
      colorCore: 0, colorMid: .42, colorEdge: .86, colorScarHot: 0, colorScar: .42, colorScarEmber: .85,
      ...EMBERS('colorSpark', 0, .15, .42, .9), ...EMBERS('colorMote', 0, .2, .42, .9),
      colorBurstCore: 0, colorBurstMid: .42, colorBurstRim: .88, colorHitCore: 0, colorHitRim: .42, colorFlash: 0, lightColor: .42,
    },
    launch: { forward: 'handForward', height: 'swingHeight' },
    size: ['swingRadius', 'crescentRadius', 'crescentWidth', 'burstSize', 'shellSize', 'ringSize', 'sparkSize', 'moteSize', 'burstHeight'],
    counts: ['sparkRate', 'moteRate', 'debrisRate', 'dustRate', 'endSparks', 'endDebris', 'endDust'],
    speed: 'speed', sustain: 'lifetime', windup: ['windup'],
    range: ['range', 'minRange'],
    // Its own anime impact frame inks the whole screen (two full-screen quads): the game's impact frame stands in. Its
    // detonation at the end of the line is sized for the game's camera.
    // Its own hit spark, crescent swell and echoes too, all sized for a close camera.
    set: { ifStrength: 0, ifFrames: 0, impactShake: 0, releaseShake: 0, rumble: 0, shellSize: 1.1, ringSize: 1.4, burstSize: .9, endSparks: 60,
      hitScale: .4, burstExpand: .15, echoes: 1, crescentRadius: 1.7, crescentWidth: .85 },
  },
  extra_cross: {
    cost: { draws: 2, gpuMs: 0.9 },
    colours: { color: .32 },
    launch: { forward: 'handForward', height: 'handHeight' },
    end: 'targetHeight',
    size: ['scale'], windup: ['windup'],
    range: ['range', 'minRange'],
    set: { useColor: 1, impactFrames: 0, distortion: 0, shake: 0 },
  },
  ext_aura_fire: {
    cost: { draws: 13, gpuMs: 1.1 },
    colours: {
      colorRim: .62, colorCore: .1, colorVein: .4, colorFlameCore: 0, colorFlameBody: .42, colorFlameEmber: .8,
      colorOrbCore: 0, colorOrbFlame: .4, colorOrbEmber: .8, colorTrailCore: 0, colorTrailFlame: .45, colorTrailEmber: .85,
      colorFieldCrack: .55, colorFieldEmber: .2, colorFieldRing: .5, ...EMBERS('colorEmber', 0, .3, .66, .96), colorGroundEmber: .55, colorFlash: .3, lightColor: .4,
    },
    counts: ['flames', 'orbs', 'emberRate', 'smokeRate', 'burstEmbers', 'orbEmberRate'],
    size: ['fieldRadius', 'ringRadius'],
    follows: true, holdKey: 'duration',
    set: { activateShake: 0, rumble: 0, fresnel: 0 },
  },
});

// ---- colours -------------------------------------------------------------------------------------------------

export interface Palette { readonly core: string; readonly main: string; readonly rim: string }

const lum = (c: THREE.Color) => .2126 * c.r + .7152 * c.g + .0722 * c.b;
const _a = new THREE.Color(), _b = new THREE.Color(), _c = new THREE.Color();

/** A palette as the fire's three stops. A fire-and-ice fighter's rim is its ice (Tancho's pale blue): brighter than
 *  its main, it would put a pale edge on the fire, so the fire's rim is then the main burnt down to a deep red. */
export class HeatRamp {
  readonly core = new THREE.Color(); readonly main = new THREE.Color(); readonly rim = new THREE.Color();
  constructor(palette: Palette) {
    this.core.set(palette.core); this.main.set(palette.main); this.rim.set(palette.rim);
    if (lum(this.rim) >= lum(this.main)) this.rim.copy(this.main).multiplyScalar(.32).lerp(_a.setRGB(.3, .02, .01), .35);
  }
  at(t: number, out: THREE.Color) {
    const k = Math.max(0, Math.min(1, t));
    return k <= .5 ? out.copy(this.core).lerp(this.main, k / .5) : out.copy(this.main).lerp(this.rim, (k - .5) / .5);
  }
  /** `hex` (an effect's own colour) as heat `t` of this palette, keeping its brightness. */
  recolour(hex: string, t: number) {
    _b.set(hex);
    this.at(t, _c);
    const want = lum(_b), have = lum(_c);
    if (have > 1e-5) _c.multiplyScalar(want / have);
    _c.r = Math.min(1, _c.r); _c.g = Math.min(1, _c.g); _c.b = Math.min(1, _c.b);
    return `#${_c.getHexString()}`;
  }
}

/** A heat for a colour key by its name, for an effect with no fit: hot names to the core, edges to the rim; smoke, ash,
 *  scorch, soot, dust, debris, ink and outlines keep their own (undefined). */
export function guessHeat(key: string): number | undefined {
  if (!/colou?r/i.test(key)) return undefined;
  if (/smoke|ash|scorch|soot|dust|debris|ink|outline|char|rock|shadow|void|ground(?!ember)/i.test(key)) return undefined;
  if (/core|white|hot|tip|bright|flash|A$/i.test(key)) return .05;
  if (/inner|B$|light/i.test(key)) return .3;
  if (/mid|main|body|flame|fire|spark|C$/i.test(key)) return .5;
  if (/edge|outer|rim|ember|D$/i.test(key)) return .75;
  if (/deep|halo|dark/i.test(key)) return .92;
  return .5;
}

/** The screen-wide tricks an effect may carry, which in the game would be drawn over every player's view: its own impact
 *  frames, focus lines, grade, distortion and haze. Off for an effect fitted by name (the game's impact frame stands in);
 *  its camera shakes move nothing in the game anyway (host.ts) and only tell its sound of a hit. */
const SCREEN = ['ifFrames', 'ifStrength', 'impactFrames', 'impactFrame', 'gradeWeight', 'stoneGrade', 'lines', 'distortion', 'haze', 'heatDistortion'];
const WINDUP = ['charge', 'windup', 'windUp', 'startDelay', 'castDelay', 'revealTime', 'chargeTime', 'gather', 'gatherTime', 'buildUp', 'buildup'];
/** Stand-ins the sandbox brings because it has no one to hit, which in the game would stand next to the real target:
 *  the heart beam's figure that it turns to stone (`edge_heartbeam`, Boa's Sandrose Volley), the seal pack's straw practice
 *  post. Off; what the effect does to them still lands where they stood. */
const STAND_INS = ['statueShow', 'showTarget'];
/** The nature pack's camera pull-out (the Armory's orbit eased out for a ten-storey wave): the gameplay camera is
 *  untouchable (the host never hands it over anyway). */
const CAMERA = ['cameraPull'];
/** The scifi pack's screen glitch (ScifiPost: blocks shoved and tinted over the whole screen, tear lines, the grade's
 *  colour split), as the other screen-wide tricks. Only where the block is the pack's, which carries `aberration`: the
 *  found hologram's `glitchAmount` is its own material's. */
const GLITCH = ['glitchAmount', 'glitchTint', 'glitchScan', 'glitchSort', 'aberration'];
const LAUNCH = ['handForward', 'handSide', 'handHeight'];

/** A fit made from an effect's own settings names, for one nobody has fitted by hand (a Forge kit may pick any of the
 *  catalogue's): its hand keys as the launch point, its range and speed, its wind-up, its sizes (the Armory inspector's
 *  Size dial's keys) and counts scaled, and its screen-wide tricks, camera moves and stand-in props off. A hand fit
 *  (FITS) wins. */
/** Effects fitted by name that the game frames itself: settings over the auto fit's (a length among its `size` keys is
 *  given at the Armory's scale and scaled with the cast like every size; the rest are as they play). */
const FRAMED: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  // The cinematic dragon (the Armory's remake): framed from the Armory's far camera, its portal tears open 12.5 m up
  // and 8 m past the circle and it laps at 3.6 m, so from the gameplay camera it dived above the frame and only its
  // fire read. Here the portal opens low and close, the dive is quick and the lap is at head height round a tighter
  // circle: the whole dragon is in view through the strike (its skeleton in frame 0.39 of the time before, 0.9 after).
  cin_dragon: { portalHeight: 5, portalBack: 2, portalOpen: .3, arriveTime: .6, altitude: 1.9, wingspan: 6.9, zoneRadius: 4.7, traceTime: 2.4, departTime: 1 },
};

export function autoFit(defaults: Readonly<Record<string, unknown>>, id?: string): Fit {
  const num = (key: string) => typeof defaults[key] === 'number';
  const [forward, side, height] = LAUNCH.map(key => (num(key) ? key : undefined));
  const set: Record<string, number> = {};
  for (const key of SCREEN) if (num(key)) set[key] = 0;
  for (const key of [...STAND_INS, ...CAMERA]) if (num(key)) set[key] = 0;
  if (num('aberration')) for (const key of GLITCH) if (num(key)) set[key] = 0;
  const size: string[] = [], counts: string[] = [];
  for (const [key, value] of Object.entries(defaults)) {
    if (LAUNCH.includes(key) || key === 'range' || key === 'minRange' || WINDUP.includes(key)) continue;
    const cls = classifyKey(key, value);
    if (cls === 'size') size.push(key);
    else if (cls === 'power' && Number.isInteger(value) && /(count|rate)$/i.test(key)) counts.push(key);
  }
  return {
    ...(forward || side || height ? { launch: { forward, side, height } } : {}),
    range: ['range', 'minRange'].filter(num),
    ...(num('speed') ? { speed: 'speed' } : {}),
    windup: WINDUP.filter(num),
    // The Armory frames from eleven metres back; the game's camera rides a few metres behind the fighter. A force of
    // nature is framed from further out still (its `cameraPull`), and drawn smaller again by as much.
    size, sizeScale: CLOSE_CAMERA * framing(defaults), counts, set: { ...set, ...(id ? FRAMED[id] : undefined) }, auto: true,
  };
}
/** An effect fitted by name, drawn at this much of the Armory's size (the pilot's hand fits came to about this). */
const CLOSE_CAMERA = .6;
/** How far back the Armory's camera frames an effect (metres). */
const FRAMED_AT = 11;
/** The nature pack eases the Armory's camera out to `cameraPull` metres while a cast stands (a ten-storey wave does not
 *  fit the usual orbit): its walls and volumes are sized for that, and from the gameplay camera they would swallow the
 *  view. Drawn at the usual framing's share of it. */
function framing(defaults: Readonly<Record<string, unknown>>) {
  const pull = defaults.cameraPull;
  return typeof pull === 'number' && pull > FRAMED_AT ? FRAMED_AT / pull : 1;
}
