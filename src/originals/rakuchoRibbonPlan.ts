export type RibbonKey = readonly [t: number, x: number, y: number, z: number, reveal: number, aim?: number, trail?: number];
export interface ClipRibbons {
  /** The clip's length (seconds), for the clock map past the contact. */
  readonly end: number;
  /** The plan's contact (clip seconds), which each use's measured contact (CONTACTS) is mapped onto. */
  readonly contact?: number;
  /** Where the plan has the victim's chest (fighter frame): a key with `aim` is moved by the victim's real offset from it. */
  readonly hit?: readonly [number, number, number];
  /** Per ribbon (0 right forearm, 1 left forearm, 2 right waist, 3 left waist): its keys, or null to hang at rest. */
  readonly ribs: readonly (readonly RibbonKey[] | null)[];
}
const HIT: readonly [number, number, number] = [0, 1.05, 1.7];
type Track = RibbonKey[];
/** Keys for a tip that winds round him (the fighter frame's vertical through `cx`, `cz`) from `t0` to `t1`: `turns` turns
 *  from angle `a0` (0 = ahead, positive turning to his left), its radius and height eased from the first values to the
 *  second, unwinding to `reveal`, its ribbon laid along `trail` metres of the turn behind it. */
function wind(t0: number, t1: number, turns: number, a0: number, r0: number, r1: number, y0: number, y1: number, reveal0: number, reveal1: number, trail: number, steps = 14, cx = 0, cz = .04): Track {
  const out: Track = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps, e = u * u * (3 - 2 * u), a = a0 + turns * Math.PI * 2 * u, r = r0 + (r1 - r0) * e;
    out.push([+(t0 + (t1 - t0) * u).toFixed(4), +(cx + Math.sin(a) * r).toFixed(3), +(y0 + (y1 - y0) * e).toFixed(3), +(cz + Math.cos(a) * r).toFixed(3), +(reveal0 + (reveal1 - reveal0) * Math.min(1, u * 1.6)).toFixed(3), 0, trail]);
  }
  return out;
}

/** SILVERFISH CROSS (Light 3, Rush 2; the string shows it from 0.2 s to its blow at 0.4006 s): his two forearm ribbons
 *  cross into an X on the victim - the left one from over his left shoulder down through them, the right one from low on
 *  his right up through them, crossing on them just before the blow and whole, an X, as it lands - then let go. */
const SILVERFISH_L3: ClipRibbons = { end: .7333, contact: .4006, hit: HIT, ribs: [
  [[0, -.3, 1, .25, .15], [.18, -.45, .6, .35, .5, 0, .5], [.3, -.45, .35, .75, .88, .2, .6], [.372, -.05, .95, 1.4, 1, .8, 1.2], [.4006, .2, 1.75, 1.95, 1, 1, 1.6], [.46, .27, 1.9, 2.05, 1, 1, 1.6], [.58, .2, 1.5, 1.1, .5, .3, .8], [.7333, -.25, 1, .35, .15, 0, .4]],
  [[0, .3, 1.1, .25, .15], [.18, .4, 1.6, .2, .5, 0, .5], [.3, .35, 2.25, .45, .88, .2, .6], [.372, .05, 1.45, 1.35, 1, .8, 1.2], [.4006, -.2, .75, 1.95, 1, 1, 1.6], [.46, -.27, .58, 2.05, 1, 1, 1.6], [.58, -.2, .7, 1.1, .5, .3, .8], [.7333, .25, 1, .35, .15, 0, .4]],
  null, null] };
const SILVERFISH_LAUNCH: ClipRibbons = { end: .8667, contact: .4735, hit: HIT, ribs: [
  [[0, -.3, 1, .25, .15], [.22, -.45, .6, .35, .55, 0, .5], [.37, -.45, .35, .75, .9, .2, .6], [.445, -.05, .95, 1.4, 1, .8, 1.2], [.4735, .2, 1.75, 1.95, 1, 1, 1.6], [.53, .26, 1.85, 2.05, 1, 1, 1.6], [.59, .22, .9, 1.95, 1, .9, 1.2], [.66, .12, 2.15, 1.85, 1, .8, 1.5], [.76, 0, 2.4, 1.2, .65, .4, 1], [.8667, -.25, 1, .3, .15, 0, .4]],
  [[0, .3, 1.1, .25, .15], [.22, .4, 1.65, .2, .55, 0, .5], [.37, .35, 2.25, .45, .9, .2, .6], [.445, .05, 1.45, 1.35, 1, .8, 1.2], [.4735, -.2, .75, 1.95, 1, 1, 1.6], [.53, -.26, .6, 2.05, 1, 1, 1.6], [.59, -.2, .7, 1.95, 1, .9, 1.2], [.66, -.12, 2.1, 1.85, 1, .8, 1.5], [.76, 0, 2.35, 1.2, .65, .4, 1], [.8667, .25, 1.05, .3, .15, 0, .4]],
  null, null] };
/** RIBBON LASH (the heavy, Ribbon Lash; its blow at 0.5918 s): his right forearm's ribbon climbs high over him with the
 *  red orb riding its tip, arches forward and reaps down onto the victim as the blow lands, on into the floor; the right
 *  waist's ribbon whips in low beside it. */
const RIBBON_LASH: ClipRibbons = { end: 1.0833, contact: .5918, hit: HIT, ribs: [
  [[0, -.3, 1, .2, .15], [.12, -.55, 1.45, 0, .5, 0, .6], [.26, -.55, 2.1, .05, .85, 0, .9], [.4, -.3, 2.45, .5, 1, .2, 1.1], [.5, -.05, 2.2, 1.25, 1, .6, 1.4], [.5918, 0, 1, 1.75, 1, 1, 1.7], [.645, .05, .08, 1.9, 1, .8, 1.7], [.78, -.1, .1, 1.55, .85, .5, 1], [.93, -.3, .7, .8, .4, .2, .6], [1.0833, -.3, 1, .25, .15, 0, .4]],
  null,
  [[0, -.15, .8, .25, .15], [.36, -.55, .5, .45, .6, 0, .5], [.5918, -.15, .55, 1.65, 1, 1, 1], [.68, .2, .45, 1.75, 1, .6, 1], [.86, -.05, .6, .7, .4, .2, .6], [1.0833, -.15, .8, .25, .15, 0, .4]],
  null] };

/** STARVING (the awakening, STARVING; 2.3 s, its beats at .48 hand rise, .83 finger crack, 1.08 eye reveal, 1.61
 *  flare): the four ribbons unwind and wind round him, tighter and higher, binding him; on the flare they lash out from
 *  his arms and waist, hang a beat and go back to rest - where the STARVING body wears them bound. */
function starving(): ClipRibbons {
  const out: Track[] = [];
  // ribbon: start angle round him, its lash-out point (fighter frame)
  const lash: [number, number, number, number][] = [[-1.4, -1.15, 2.25, 1], [1.4, 1.15, 2.25, 1], [-2.6, -1.75, .9, 1.2], [2.6, 1.75, .9, 1.2]];
  for (let i = 0; i < 4; i++) {
    const [a0, lx, ly, lz] = lash[i], low = i >= 2, side = i % 2 ? 1 : -1;
    const rest: RibbonKey = [0, side * (low ? .15 : .3), low ? .8 : 1.05, .25, .15];
    const bind = wind(.32, 1.06, 1.7, a0, .36, .22, low ? .86 : 1, low ? 1.12 : 1.4, .3, 1, 2.8, 20);
    const last = bind[bind.length - 1];
    const tighten: RibbonKey[] = [[1.3, last[1] * .86, last[2] + .05, (last[3] - .04) * .86 + .04, 1, 0, 2.6], [1.52, last[1] * .8, last[2] + .08, (last[3] - .04) * .8 + .04, 1, 0, 2.4]];
    const flare: RibbonKey[] = [[1.62, lx, ly, lz, 1, 0, 1.7], [1.72, lx * 1.05, ly + .12, lz + .1, 1, 0, 1.2], [1.86, lx * .95, ly - .1, lz, .95, 0, .9], [2.1, side * (low ? .4 : .55), low ? .7 : 1.2, .55, .4, 0, .6], [2.3, rest[1], rest[2], rest[3], .15, 0, .4]];
    out.push([rest, [.2, rest[1] * 1.4, rest[2] - .05, .35, .2, 0, .4], ...bind, ...tighten, ...flare]);
  }
  return { end: 2.3, ribs: out };
}

// --- the light string ---------------------------------------------------------------------------------------------
/** A track thrown by the other side of him: x mirrored, its times later by `dt`. */
const mirror = (keys: readonly RibbonKey[], dt = 0): Track => keys.map(([t, x, y, z, r, a, tr], i) => [i && i < keys.length - 1 ? +(t + dt).toFixed(4) : t, -x, y, z, r, a, tr] as RibbonKey);
/** TORN PAGE (Light 1, Torn Page; the blow at 0.28 s): his right forearm's ribbon snaps out along the jab. */
const TORN_PAGE: ClipRibbons = { end: .6, contact: .28, hit: HIT, ribs: [
  [[0, -.3, 1, .25, .15], [.16, -.25, 1.15, .55, .4, 0, .4], [.28, -.05, 1.15, 1.45, .75, .6, .7], [.36, -.1, 1.1, 1.3, .6, .3, .6], [.6, -.3, 1, .25, .15, 0, .4]],
  null, null, null] };
/** RIBBON HOOK (Light 2, Rush 1; the string shows it from 0.21 s to its blow at 0.28 s): his left forearm's ribbon swings
 *  wide round his left side and hooks across the victim. */
const RIBBON_HOOK_L2: ClipRibbons = { end: .6, contact: .28, hit: HIT, ribs: [
  null,
  [[0, .3, 1.1, .25, .15], [.1, .75, 1.35, .25, .6, 0, .5], [.2, .95, 1.25, .95, .95, .2, .8], [.28, .05, 1.1, 1.7, 1, 1, 1.4], [.34, -.55, 1, 1.45, 1, .6, 1.4], [.45, -.3, 1, .8, .5, .2, .7], [.6, .3, 1.1, .25, .15, 0, .4]],
  null, null] };
/** SHREDDED CHAPTER (Light 4, the finisher, Rush 3 - mirrored on the base body, as thrown awake; the blow at 0.4333 s):
 *  all four ribbons rake down across the victim one after another, high to low, crossing as they go - a claw of ribbons. */
const RAKE0: Track = [[0, -.3, 1, .25, .15], [.2, -.6, 2, .5, .8, 0, .6], [.4, -.3, 1.6, 1.6, 1, .9, 1.1], [.4333, .15, .7, 1.85, 1, 1, 1.5], [.5, .3, .35, 1.7, 1, .6, 1.4], [.65, 0, .6, 1, .5, .2, .7], [.8667, -.3, 1, .25, .15, 0, .4]];
const RAKE2: Track = [[0, -.15, .8, .25, .15], [.22, -.7, 1.3, .6, .8, 0, .6], [.42, -.35, 1.2, 1.6, 1, .8, 1.1], [.45, .15, .45, 1.8, 1, 1, 1.4], [.52, .3, .25, 1.6, 1, .6, 1.3], [.66, 0, .5, .9, .5, .2, .7], [.8667, -.15, .8, .25, .15, 0, .4]];
const SHREDDED: ClipRibbons = { end: .8667, contact: .4333, hit: HIT, ribs: [RAKE0, mirror(RAKE0, .012), RAKE2, mirror(RAKE2, .01)] };

// --- the enders -------------------------------------------------------------------------------------------------------
/** RIBBON HOOK, the blowback (J K, Ribbon Hook; also the first air blow; the blow at 0.3915 s): his right forearm's ribbon
 *  sweeps out wide round his right and hooks through the victim, driving them back; the right waist's hooks in low. */
const RIBBON_HOOK: ClipRibbons = { end: .7167, contact: .3915, hit: HIT, ribs: [
  [[0, -.3, 1, .25, .15], [.12, -.75, 1.6, .1, .6, 0, .5], [.25, -1.15, 1.8, .8, .95, .2, .9], [.3915, -.05, 1.15, 1.75, 1, 1, 1.6], [.45, .75, 1.15, 1.35, 1, .6, 1.6], [.58, .4, 1.1, .7, .5, .2, .8], [.7167, -.3, 1, .25, .15, 0, .4]],
  null,
  [[0, -.15, .8, .25, .15], [.15, -.7, .6, .4, .6, 0, .5], [.3, -.9, .5, 1.1, .95, .2, .7], [.3915, -.1, .55, 1.7, 1, 1, 1.2], [.46, .5, .5, 1.4, 1, .5, 1.2], [.6, .1, .6, .6, .4, .2, .5], [.7167, -.15, .8, .25, .15, 0, .4]],
  null] };
/** SHREDDED CHAPTER, the knockdown (J J J K, Shredded Chapter; also the lock string's second blow; the blow at 0.5083 s): the
 *  four ribbons rise high round him and come down together on the victim, slamming them into the floor. */
function rend(x: number, y: number, z: number, side: number, low: boolean, dt: number): Track {
  const r: RibbonKey = [0, side * (low ? .15 : .3), low ? .8 : 1.05, .25, .15];
  return [r, [.25, x * .8, y * .85, z, .7, 0, .6], [.4, x, y, z, 1, 0, .9], [.5083 + dt, side * (low ? .2 : .12), low ? .8 : 1, 1.75, 1, 1, 1.6], [.56 + dt, side * (low ? .22 : .15), .05, 1.85, 1, .8, 1.6], [.75, side * .2, .1, 1.5, .8, .4, 1], [.9, side * .3, .6, .7, .35, .1, .5], [1.0167, r[1], r[2], r[3], .15, 0, .4]];
}
const KNOCKDOWN: ClipRibbons = { end: 1.0167, contact: .5083, hit: HIT, ribs: [rend(-.55, 2.3, .4, -1, false, 0), rend(.55, 2.3, .4, 1, false, .008), rend(-.75, 1.7, .6, -1, true, .016), rend(.75, 1.7, .6, 1, true, .024)] };
/** HUNGRY LUNGE, the stun (J J J Q, Hungry Lunge; also the lock string's third blow; the blow at 0.5667 s): the four
 *  ribbons draw back out wide, then spear in together through the victim. */
function lunge(side: number, low: boolean): Track {
  const y = low ? .85 : 1.35, r: RibbonKey = [0, side * (low ? .15 : .3), low ? .8 : 1.05, .25, .15];
  return [r, [.3, side * .85, y + .45, .1, .65, 0, .5], [.47, side * .7, y + .35, .55, .92, .2, .7], [.5667, side * .06, low ? .95 : 1.15, 1.75, 1, 1, 1.6], [.63, side * .05, low ? .95 : 1.1, 2.05, 1, .8, 1.6], [.8, side * .25, y, .9, .5, .2, .7], [1.1333, r[1], r[2], r[3], .15, 0, .4]];
}
const STUN: ClipRibbons = { end: 1.1333, contact: .5667, hit: HIT, ribs: [lunge(-1, false), lunge(1, false), lunge(-1, true), lunge(1, true)] };
/** RIBBON DESCENT, the air strike (in the air, K; Ribbon Descent; the blow at 0.5008 s): his forearm ribbons fan up over
 *  him and stab down through the victim below as he dives; his waist's fan out to his sides. */
const DIVE0: Track = [[0, -.3, 1, .25, .15], [.25, -.9, 1.9, .2, .8, 0, .7], [.4, -.6, 2.1, .9, 1, .2, 1], [.5008, -.05, .2, 1.5, 1, 1, 1.6], [.56, 0, -.4, 1.6, 1, .8, 1.6], [.75, -.3, .4, .9, .5, .3, .8], [.9167, -.3, 1, .25, .15, 0, .4]];
const FAN2: Track = [[0, -.15, .8, .25, .15], [.3, -1.1, 1, .1, .7, 0, .6], [.5, -1.2, .9, .6, .8, 0, .7], [.75, -.5, .8, .4, .35, 0, .5], [.9167, -.15, .8, .25, .15, 0, .4]];
const AIR_STRIKE: ClipRibbons = { end: .9167, contact: .5008, hit: [0, .2, 1.5], ribs: [DIVE0, mirror(DIVE0, .015), FAN2, mirror(FAN2)] };
/** RED INK BREAK, the ground smash (in the air, Q; Red Ink Break; the blow at 0.529 s): all four ribbons rise over him as
 *  he falls and slam into the floor round where he lands. */
const SMASH0: Track = [[0, -.3, 1, .25, .15], [.38, -.6, 2.3, .3, .9, 0, .8], [.47, -.9, 2.5, .8, 1, 0, 1], [.529, -1.1, 0, 1.4, 1, 0, 1.8], [.7, -1.1, .05, 1.3, .9, 0, 1], [.9, -.4, .7, .6, .4, 0, .6], [1.0833, -.3, 1, .25, .15, 0, .4]];
const SMASH2: Track = [[0, -.15, .8, .25, .15], [.38, -.8, 1.8, .4, .9, 0, .8], [.47, -1.2, 2, .3, 1, 0, 1], [.54, -1.6, 0, .2, 1, 0, 1.8], [.72, -1.5, .05, .2, .9, 0, 1], [.92, -.5, .6, .3, .4, 0, .6], [1.0833, -.15, .8, .25, .15, 0, .4]];
const GROUND_SMASH: ClipRibbons = { end: 1.0833, contact: .529, ribs: [SMASH0, mirror(SMASH0, .01), SMASH2, mirror(SMASH2, .02)] };

// --- the special ------------------------------------------------------------------------------------------------------
function bookmark(x: number, y: number, side: number, low: boolean): Track {
  const r: RibbonKey = [0, side * (low ? .15 : .3), low ? .8 : 1.05, .25, .15];
  return [r, [.2, x * .7, y * .8, .2, .6, 0, .5], [.45, x, y, .35, 1, 0, .8], [.55, x * 1.05, y + .05, .2, 1, 0, .8],
    [.6167, side * (low ? .15 : .08), low ? .95 : 1.25, 3.3, 1, 1, 2.6], [.68, side * (low ? .18 : .1), low ? .9 : 1.2, 3.75, 1, 1, 2.6],
    [.85, side * .12, 1.1, 3.6, .95, .8, 2], [1.05, side * .3, 1.15, 1.2, .4, .3, .8], [1.2333, r[1], r[2], r[3], .15, 0, .4]];
}
const FOUR_BOOKMARKS: ClipRibbons = { end: 1.2333, contact: .6167, hit: [0, 1.1, 3.3], ribs: [bookmark(-.42, 2.45, -1, false), bookmark(.42, 2.45, 1, false), bookmark(-.9, 2, -1, true), bookmark(.9, 2, 1, true)] };

// --- the ultimate -----------------------------------------------------------------------------------------------------
function lastChapter(i: number): Track {
  const side = i % 2 ? 1 : -1, low = i >= 2, r: RibbonKey = [0, side * (low ? .15 : .3), low ? .8 : 1.05, .25, .15];
  const spire = wind(2.15, 2.88, 1, [-.6, .6, -2.2, 2.2][i], .55, .38, 2, 2.95, .75, 1, 1.8, 10, 0, .45);
  const cut: Track = i === 0 ? [[.45, -.3, 1.2, .7, .45, 0, .5], [.563, -.05, 1.15, 1.5, .8, .6, .8], [.7, -.3, 1.1, .8, .5, .2, .6], [1.05, -.75, 2.1, .6, .9, 0, .8], [1.231, .3, .55, 1.85, 1, 1, 1.6], [1.33, .45, .4, 1.6, 1, .6, 1.5], [1.6, -.2, 1.2, .9, .55, .2, .7]]
    : i === 1 ? [[1.5, .4, 1.3, .4, .4, 0, .5], [1.8, .75, 2.1, .6, .9, 0, .8], [1.981, -.3, .55, 1.85, 1, 1, 1.6], [2.06, -.45, .4, 1.6, 1, .6, 1.5]] : [[1.7, side * .4, .9, .4, .3, 0, .4]];
  const dt = [0, .008, .016, .024][i];
  const fall: Track = [[2.98, side * .3, 3, 1.35, 1, .5, 2], [3.048 + dt, side * (low ? .2 : .08), low ? .85 : 1.05, 1.75, 1, 1, 2.2], [3.11 + dt, side * .12, .05, 1.85, 1, .8, 2.2], [3.4, side * .15, .1, 1.6, .85, .4, 1.2], [3.75, r[1], r[2], r[3], .15, 0, .4]];
  return [r, ...cut, ...spire, ...fall];
}
const LAST_CHAPTER: ClipRibbons = { end: 3.75, contact: 3.048, hit: HIT, ribs: [lastChapter(0), lastChapter(1), lastChapter(2), lastChapter(3)] };

// --- the area move ----------------------------------------------------------------------------------------------------
/** TORN BINDING's cast (his area move, G: the cast plays Hungry Lunge's first 0.6 s): the four ribbons unwind and rise
 *  ahead of him toward the circle. From the circle's release they are rakuchoRibbons.ts's own (`areaTip`): they climb
 *  high over the sigil and circle down round it, and as the sigil strikes they wind round the victim and bind them. */
const BIND_CAST0: Track = [[0, -.3, 1, .25, .15], [.3, -.45, 1.7, .5, .6, 0, .6], [.6, -.35, 2.1, 1, .8, 0, .8]];
const BIND_CAST2: Track = [[0, -.15, .8, .25, .15], [.3, -.7, 1.3, .5, .55, 0, .6], [.6, -.6, 1.6, 1, .75, 0, .8]];
const TORN_BINDING_CAST: ClipRibbons = { end: .6, ribs: [BIND_CAST0, mirror(BIND_CAST0), BIND_CAST2, mirror(BIND_CAST2)] };

/** The plans by clip (as either body plays it); `area:<clip>` for a clip the area cast plays. */
export const RIBBON_PLAN: Readonly<Record<string, ClipRibbons>> = {
  'Rush 2': SILVERFISH_L3,
  'Silverfish Cross': SILVERFISH_LAUNCH,
  'Ribbon Lash': RIBBON_LASH,
  'STARVING': starving(),
  'Torn Page': TORN_PAGE, 'Rush 1': RIBBON_HOOK_L2, 'Rush 3 (mirrored)': SHREDDED, 'Rush 3': SHREDDED,
  'Ribbon Hook': RIBBON_HOOK, 'Shredded Chapter': KNOCKDOWN, 'Hungry Lunge': STUN, 'Ribbon Descent': AIR_STRIKE, 'Red Ink Break': GROUND_SMASH,
  'Four Bookmarks': FOUR_BOOKMARKS,
  'Last Chapter': LAST_CHAPTER,
  'area:Hungry Lunge': TORN_BINDING_CAST,
};
