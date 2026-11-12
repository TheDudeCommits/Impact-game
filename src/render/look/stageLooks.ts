import type {BallArenaId} from '../../game/ball/arenas';
import {ballArenaFor,ballCourtFor} from '../ball/arenaChoice';
import {CLASSIC_COURT,sameCourt} from '../../game/ball/model';
import { roanLook } from './roanPass';
import { powerupLook } from './powerupLook';
import type { StageId } from '../../game/stages';
import { originalLook } from '../../originals/looks';

/** One direction in world space, pointing toward whatever it describes (the
 *  sun, the rim light). Normalised where it is used. */
export type Vec3 = readonly [number, number, number];

/** The painted sky. Colours are sRGB hex as an artist would pick them; the
 *  sky shader converts them to linear. */
export interface SkyLook {
  zenith: number; horizon: number; ground: number;
  /** How far up the horizon colour reaches before the zenith takes over (0..1 of the dome). */
  horizonHeight: number;
  sunColor: number; sunIntensity: number;
  /** Angular radius of the disc, radians. */
  sunSize: number;
  /** Strength and width of the halo around the sun. */
  sunGlow: number; sunGlowWidth: number;
  /** Cel clouds: how much of the dome they cover, and their three tones. */
  cloudCoverage: number; cloudLit: number; cloudShade: number; cloudRim: number;
  cloudScale: number; cloudSpeed: number;
  /** Night and space. */
  stars: number; nebulaA: number; nebulaB: number; nebula: number;
  /** Where the sun is drawn, if not where the key light comes from. */
  sunDir?: Vec3;
  /** 0-1: the sun eclipsed, a black disc in a corona (arcade survival's Eclipse). */
  eclipse?: number;
}

/** A display-referred grade, applied after tone mapping. */
export interface GradeLook {
  lift: Vec3; gamma: Vec3; gain: Vec3;
  saturation: number; contrast: number;
  /** Split toning: shadows pulled toward one hue and highlights toward another. */
  shadowTint: number; highlightTint: number; split: number;
  /** How much saturation the shade loses before the split tone (0..1). */
  shadowDesat?: number;
  /** Strength of the Neutral tone map's toe (1 = stock Khronos, default 0.5). */
  toe?: number;
  vignette: number; vignetteColor: number;
  /** The power-up pass (look/powerupLook.ts): a light, contrast-adaptive sharpen of the frame (0..1; unset none). */
  sharpen?: number;
  /** Ink outlines drawn from the scene's depth (LookPost's final pass) where surfaces
   *  break or fold, 0..1; the ball arenas' paper-and-ink look. 0 or absent: none. */
  inkEdge?: number;
}

/** Light shafts through openings, drawn as soft additive billboards. Each
 *  opening is a rectangle on a vertical plane; the shaft runs from it along
 *  the key light's travel direction. */
export interface ShaftLook {
  /** Centres of the openings, world metres. */
  openings: readonly Vec3[];
  width: number; height: number; length: number;
  color: number; strength: number;
}

/** A procedural light cookie for interiors: the key light only reaches the
 *  stage where a ray toward the sun passes through a window in a wall. */
export interface CookieLook {
  /** The wall: axis 0 = x, 2 = z, and its coordinate on that axis. */
  axis: 0 | 2; plane: number;
  /** Window band height on the wall, and the repeating window pattern along it. */
  bottom: number; top: number; period: number; offset: number; duty: number;
  /** How much light the shaded part of the hall still gets from the key (0..1). */
  floor: number;
  /** How much of the cookie reaches the fighters (0 = always lit, 1 = fully cookied). */
  fighters: number;
  /** The painted panes' own light, as a multiple of the key's colour (GameRenderer; default 2.4). */
  glow?: number;
}

/** The colour pass, iteration eight: cloud shadows drifting over a sunny place (lightCookie.ts lookCloud). */
export interface CloudShadowLook {
  /** A cloud's size (m), the noise level above which it shades (higher, fewer clouds), the edge's softness. */
  scale: number; cover: number; soft: number;
  /** The key light left in a cloud's shadow (0..1). */
  floor: number;
  /** Metres a second the layer drifts, along x and z; and its height (m). */
  wind: [number, number]; height?: number;
  /** How much of the shadow reaches the fighters (0 = none). */
  fighters: number;
}

/** The look plan (stream C): the leaves' dappled light over a green place (lightCookie.ts lookLeaves) -
 *  soft sun patches in the shade of a canopy, mostly out of frame overhead. */
export interface LeafShadowLook {
  /** A sun fleck's size (m), the noise level above which it is leaf shade (higher, more sun), the edge's softness. */
  size: number; cover: number; soft: number;
  /** The key light left in the leaves' shade (0..1). */
  floor: number;
  /** The canopy's height (m): the pattern is where the ray toward the sun crosses it, and nothing above it is shaded. */
  height: number;
  /** Where the canopy is, in its own plane: ellipses [x, z, radius along x, radius along z (default the first)]. None:
   *  everywhere. At most six. */
  spots?: readonly (readonly [number, number, number, number?])[];
  /** The soft edge of a spot, a share of its radii (default 0.3). */
  edge?: number;
  /** How far the canopy sways (m), and the drift (m/s along x and z). */
  sway?: number; wind?: [number, number];
  /** How much of the leaves' shade reaches the fighters (0 = none). */
  fighters: number;
}

/** The look plan (stream C): the air laid on the distance from just behind the fight (look/air.ts),
 *  paler and toward the fog colour layer by layer, over the stage's own linear fog. */
export interface AirLook {
  /** Metres from the lens where it begins, and how far past that it has laid half of `most`. */
  start: number; half: number;
  /** The most of its colour it lays on anything (0..1); the far plane's fade does the rest. */
  most: number;
  /** Its colour (sRGB hex); unset, the fog's. The far fade keeps the fog's, which meets the painted horizon. */
  color?: number;
  /** It thins with height: half as thick every `height` metres above `base` (m). Unset: even. */
  base?: number; height?: number;
  /** How much colour the distance loses under it, at its thickest (0..1): aerial perspective. */
  desaturate?: number;
  /** Toward the sun the air takes the sun's colour (sRGB hex), by `amount`, gathered by `power` (a cosine power). */
  sun?: { color: number; amount: number; power?: number };
  /** The fighters' share of it (0..1): a body across the royale reads hazed, one in the lens's reach does not. */
  fighters: number;
}

export type AtmosphereKind = 'none' | 'dust' | 'leaves' | 'petals' | 'embers' | 'sparkles';

export interface LookPreset {
  /** The key light: the sun, or whatever plays it. */
  key: { color: number; intensity: number; dir: Vec3 };
  hemi: { sky: number; ground: number; intensity: number };
  fill: { color: number; intensity: number; dir: Vec3 };
  /** The fighters' rim, shared by every toon material through uniforms: a
   *  bright edge a few pixels wide just inside the ink, on the side the rim
   *  light comes from, plus a faint broad fresnel band. `px` is the edge's
   *  width at 1080p and `peak` its brightest channel in linear light - kept
   *  under the bloom knee, so it stays a crisp line instead of a halo. */
  rim: { color: number; strength: number; width: number; dir?: Vec3; px?: number; peak?: number };
  /** The fighters' cel ramp: shadow tint (multiplies their ambient where the key
   *  light does not reach), the warm terminator band, where the band edge
   *  sits and how soft it is, how much brighter their ambient is than the
   *  stage's, and the ink colour of the outline. */
  toon: { shadow: number; mid: number; midStrength: number; edge: number; soft: number; ambient: number; ink: number;
    /** A floor under near-black cloth, in the shade's hue (sRGB hex). */
    floor?: number;
    /** The fighters' share of the key light (1 = the room's). A toon lit side
     *  takes the whole key at once, with no N.L falloff, so at the room's
     *  strength every light costume clipped to white. */
    key?: number;
    /** How much of the key light's colour the fighters shed (0 = none, 1 =
     *  they take it as white): the warmth belongs to the room and the rim,
     *  and a gi keeps its own orange. */
    neutral?: number;
    /** The cool fill on the fighters' shade side, as a multiple of the
     *  stage's fill light, over an albedo floor (linear) so a black coat
     *  keeps a navy second tone instead of crushing. */
    fill?: number; fillFloor?: number;
    /** The soft clip on the fighters' own light (linear): hue-preserving
     *  compression from `knee`, approaching `max`, so white armour keeps its
     *  folds and an orange gi never tips into salmon. */
    clip?: readonly [number, number];
    /** The colour pass (look/roanPass.ts): the fighters' own colour
     *  pushed this far from grey after their light, so the cast is the most
     *  saturated thing on screen. */
    saturation?: number };
  /** Fog colour, and optionally a range that overrides the stage's own. */
  fog: { color: number; near?: number; far?: number };
  sky: SkyLook;
  /** Image-based light for the stage's standard materials (scene.environmentIntensity). */
  ibl: number;
  exposure: number;
  toneMapping: 'neutral' | 'aces' | 'agx';
  grade: GradeLook;
  /** Bloom on the linear HDR frame: only what is brighter than the threshold
   *  glows, with a soft knee, so energy, hot cores and the sun bloom and a lit
   *  wall does not. */
  bloom: { strength: number; radius: number; threshold: number; knee: number };
  atmosphere: { kind: AtmosphereKind; count: number; color: number; color2: number; size: number; shafts?: ShaftLook };
  cookie?: CookieLook;
  cloudShadows?: CloudShadowLook;
  /** The air on the distance (look/air.ts); none keeps three's linear fog alone. */
  air?: AirLook;
  /** The leaves' dappled light (lightCookie.ts). */
  leaves?: LeafShadowLook;
  /** A grade on the stage's own albedo (not the fighters'), for sources
   *  whose paint fights the scene. */
  albedo?: { saturation: number; tint: number };
  /** The room's own exposure, on the stage's materials only - not the
   *  fighters, the sky or the effects. `albedo` scales everything the room
   *  reflects, `key` the key light it takes (the lit floor bands and the
   *  window pools). A blind review found the sunlit floor the brightest
   *  large area of every frame, brighter than the fighters. */
  room?: { albedo: number; key: number };
  ground?: { tint: number; gain?: number; max: number; amount: number };
  /** The anime finish (look/powerupLook.ts): the fighters' cutscene rig and the frame's compositing. Unset: none. */
  rig?: RigLook;
  finish?: FinishLook;
  /** The anime finish's own colours for this stage, over the shared ones (powerupLook.ts): a night place takes a cold
   *  shadow and lift where the shared finish lays a violet one, which washed a whole dark frame violet. */
  finishTint?: Partial<Pick<FinishLook, 'shadow' | 'lift' | 'liftStrength' | 'warm'>>;
  /** The anime finish's near ground for this stage, over the shared one (FinishLook.ground): a place with no cloud
   *  shadows may spend more of the floor's one budget there (roanPass.ts GROUND_BUDGET; tests/floors.test.ts). */
  finishGround?: number;
}
/** The fighters' cutscene rig (toonShading.ts rigUniforms): lights in their shader only, placed relative to the camera. */
export interface RigLook {
  /** How far the key turns from the stage's toward the rig's camera-relative key (0..1), and the fill likewise. */
  key: number; fill: number;
  /** How much of the key's cast shadow the fighters keep (0..1). */
  shadow: number;
  /** The two rims from behind: the warm one on the key's side and the cool one opposite (sRGB hex, linear strength),
   *  their width at 1080p (px); the fill's colour and strength. */
  warm: number; warmStrength: number; cool: number; coolStrength: number; px: number;
  fillColor: number; fillStrength: number;
  /** The shade turned cool (0..1) and its saturation (1 as is). */
  shade: number; shadeSaturation: number;
}
/** The frame's anime compositing (LookPost.ts LookFinishPass and LookFinalPass). */
export interface FinishLook {
  /** The diffusion glow: its threshold and knee (linear, brightest channel), its spread (0..1) and the screen's strength. */
  diffusion: { threshold: number; knee: number; radius: number; strength: number };
  /** After the stage's grade: an S-curve (0..1), the darks multiplied toward a colour and lifted by another (sRGB hex,
   *  the lift linear-scaled), the highlights warmed by a colour, the mids' vibrance. */
  curve: number; shadow: number; lift: number; liftStrength: number; warm: number; vibrance: number;
  /** Film grain (code values, 0..1), the colour fringe at the frame's edges (px at 1080p) and a soft vignette (0..1). */
  grain: number; fringe: number; vignette: number;
  /** The bright background wrapped onto the fighters' edges (0..1). */
  wrap: number;
  /** The air far behind the fight: the most it lays (0..1), its colour (sRGB hex), the metres over which it thickens. */
  haze: { most: number; color: number; range: number };
  /** The ground nearer the lens than the fighters, darkened by up to this much (0..1). */
  ground: number;
}

const dir = (x: number, y: number, z: number): Vec3 => {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
};

/** Golden hour through the Proving Hall's high windows (concept 0). Its
 *  windows are in the far wall (z = -12), which the default view faces. The
 *  sun is put low behind that wall and the windows become a light cookie on
 *  it: light pours toward the lens, window-shaped pools and long shadows run
 *  across the floor where the fight is, the shafts come at the camera from
 *  the glowing panes, and the fighters are backlit with a warm rim - the
 *  concept's composition. A side key from the +x wall was tried
 *  first; it lit the fighters more evenly but put the rays out of frame. */
const HALL_KEY = dir(.3, .5, -.81);

export const STAGE_LOOKS: Record<Exclude<StageId, `rift-${string}`|`ball-${string}`|'ashwood'|'blood-citadel'>, LookPreset> & Partial<Record<StageId, LookPreset>> = {
  'proving-hall': {
    // Warmth only where the sun lands; the shade is a desaturated violet-grey,
    // and the key is strong enough that sunlit surfaces reach near-white gold
    // (a blind review measured the brightest pixels at dull tan before).
    key: { color: 0xffdcb0, intensity: 4.9, dir: HALL_KEY },
    hemi: { sky: 0x9c98c8, ground: 0x6e6070, intensity: .7 },
    fill: { color: 0x9fb3ff, intensity: .25, dir: dir(-.3, .35, .9) },
    rim: { color: 0xffdca0, strength: 2.0, width: .45, dir: HALL_KEY, px: 2.4, peak: .92 },
    toon: { shadow: 0xb8bce0, mid: 0xff9a5a, midStrength: .35, edge: .02, soft: .035, ambient: 3.3, ink: 0x0c0708, floor: 0x444060,
      key: .75, neutral: .45, fill: 5, fillFloor: .22, clip: [.5, .74] },
    fog: { color: 0xe6c9a0, near: 10, far: 80 },
    sky: {
      zenith: 0x5d7fc4, horizon: 0xffc98f, ground: 0x7a5a48, horizonHeight: .32,
      sunColor: 0xfff0c8, sunIntensity: 14, sunSize: .045, sunGlow: .9, sunGlowWidth: 7,
      cloudCoverage: .42, cloudLit: 0xfff1d6, cloudShade: 0xc9a3b0, cloudRim: 0xfffbe8, cloudScale: 1.1, cloudSpeed: .006,
      stars: 0, nebulaA: 0, nebulaB: 0, nebula: 0,
    },
    ibl: .2, exposure: 1.15, toneMapping: 'neutral',
    grade: {
      lift: [.012, .01, .022], gamma: [1, 1, 1], gain: [1.02, 1, .97], toe: .45,
      saturation: 1.2, contrast: 1.16, shadowTint: 0x5a4aa8, highlightTint: 0xffd49a, split: .34, shadowDesat: .55,
      vignette: .26, vignetteColor: 0x1a1020,
    },
    // (Round 2 of the stages: a little less, from a little higher - the panes bloomed into white slabs that hid their
    // frames.)
    bloom: { strength: .6, radius: .55, threshold: 1.12, knee: .4 },
    atmosphere: {
      kind: 'dust', count: 620, color: 0xffe0a0, color2: 0xfff4d8, size: .026,
      shafts: {
        openings: [[-5.5, 4.2, -11.7], [-2.2, 4.4, -11.7], [2.2, 4.4, -11.7], [5.5, 4.2, -11.7]],
        width: 2.2, height: 2.6, length: 22, color: 0xffd08a, strength: 1.0,
      },
    },
    // (Round 2 of the stages: the panes' light 2.4 -> .65 times the key's colour, so they keep their frames instead of
    // blooming into white slabs; the hall's shade off the windows' pools .15 -> .3, so the shafts' stripes no longer cut
    // the fighters in two.)
    cookie: { axis: 2, plane: -11.8, bottom: 2.4, top: 6.1, period: 3.5, offset: -.45, duty: .78, floor: .3, fighters: .25, glow: .65 },
    albedo: { saturation: .72, tint: 0xfff4ea },
    room: { albedo: .8, key: .38 },
  },
  'ash-colosseum': {
    // A low sunset sun (about 15 degrees) for long shadows, violet shade, and
    // the warmth only in what it touches.
    key: { color: 0xffb880, intensity: 5.2, dir: dir(-.8, .27, -.55) },
    hemi: { sky: 0x8c88c0, ground: 0x5a5058, intensity: .65 },
    fill: { color: 0x8f9cff, intensity: .3, dir: dir(.6, .4, .7) },
    rim: { color: 0xffc080, strength: 1.9, width: .45, px: 2.4, peak: .92 },
    toon: { shadow: 0xb4b2e2, mid: 0xff8a50, midStrength: .4, edge: .02, soft: .035, ambient: 2.2, ink: 0x0c0708, floor: 0x444060,
      key: .6, neutral: .45, fill: 3, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0xe8a07a },
    sky: {
      zenith: 0x3a4a9e, horizon: 0xffa565, ground: 0x6a3f52, horizonHeight: .38,
      sunColor: 0xffe0a0, sunIntensity: 16, sunSize: .05, sunGlow: 1.2, sunGlowWidth: 5,
      cloudCoverage: .46, cloudLit: 0xffb487, cloudShade: 0x9a6a92, cloudRim: 0xffeec0, cloudScale: 1.6, cloudSpeed: .005,
      stars: 0, nebulaA: 0, nebulaB: 0, nebula: 0,
    },
    ibl: .3, exposure: 1.12, toneMapping: 'neutral',
    grade: {
      lift: [.01, .008, .02], gamma: [1, 1, 1], gain: [1.02, 1, .96], toe: .45,
      saturation: 1.15, contrast: 1.18, shadowTint: 0x4a4aa8, highlightTint: 0xffb880, split: .34, shadowDesat: .55,
      vignette: .26, vignetteColor: 0x1a0c18,
    },
    bloom: { strength: .75, radius: .6, threshold: 1, knee: .4 },
    atmosphere: { kind: 'leaves', count: 150, color: 0x7fa83a, color2: 0xe08a3a, size: .07 },
    // Round 4b (MAPS): less grey - at .62 the field's grass went violet-grey
    // under the shade's split tone.
    albedo: { saturation: .84, tint: 0xfff8ee },
    room: { albedo: .82, key: .65 },
  },
  'sunfall-arena': {
    // Hard midday light: a strong key at about 50 degrees for crisp, readable
    // shadows, cool blue shade and a clean white rim. Round 2 of the stages:
    // from the north-east, behind the stage-select and duel cameras, which look
    // south at the hall - from the south it lit the hall's back and left its
    // face, its sign and its gate in shade.
    key: { color: 0xfff2dc, intensity: 5.2, dir: dir(.35, .74, -.57) },
    hemi: { sky: 0xb0d0ff, ground: 0x708058, intensity: .62 },
    fill: { color: 0xb8d0ff, intensity: .25, dir: dir(-.5, .3, -.6) },
    rim: { color: 0xffffff, strength: 1.4, width: .42, px: 2.2, peak: .9 },
    toon: { shadow: 0xa4b4e8, mid: 0xffb070, midStrength: .3, edge: .03, soft: .03, ambient: 2.2, ink: 0x0a0c14, floor: 0x404460,
      key: .6, neutral: .3, fill: 2.5, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0xcfe6ff },
    sky: {
      zenith: 0x2a78e0, horizon: 0xc6ecff, ground: 0x8aa0a8, horizonHeight: .3,
      sunColor: 0xfffbe8, sunIntensity: 18, sunSize: .04, sunGlow: .6, sunGlowWidth: 9,
      cloudCoverage: .46, cloudLit: 0xffffff, cloudShade: 0xaec3e0, cloudRim: 0xffffff, cloudScale: 1.25, cloudSpeed: .008,
      stars: 0, nebulaA: 0, nebulaB: 0, nebula: 0,
    },
    ibl: .35, exposure: 1.06, toneMapping: 'neutral',
    grade: {
      lift: [.006, .008, .018], gamma: [1, 1, 1], gain: [1.02, 1.01, .99],
      saturation: 1.18, contrast: 1.15, shadowTint: 0x3a5ad0, highlightTint: 0xfff0d0, split: .28, shadowDesat: .4,
      vignette: .22, vignetteColor: 0x0a1428,
    },
    // (Round 2: a little less and from a little higher: the pale slabs in the sun bloomed into a milky haze.)
    bloom: { strength: .5, radius: .55, threshold: 1.1, knee: .4 },
    atmosphere: { kind: 'petals', count: 110, color: 0xffd6e4, color2: 0xfff4f8, size: .06 },
    // The ring's paint is mobile-game pastel; pushed so the midday reads vivid.
    albedo: { saturation: 1.3, tint: 0xfffaf2 },
    room: { albedo: .84, key: .68 },
  },
  'zenith-coliseum': {
    key: { color: 0xf4fbff, intensity: 4.4, dir: dir(-.3, .85, .42) },
    hemi: { sky: 0x6ad0d8, ground: 0x1a4a52, intensity: .55 },
    fill: { color: 0x40e0d0, intensity: .5, dir: dir(.55, .25, -.8) },
    rim: { color: 0x9ff8ff, strength: 2.1, width: .42, dir: dir(.3, .35, -.9), px: 2.4, peak: .92 },
    toon: { shadow: 0x88b4e6, mid: 0x7fe8ff, midStrength: .28, edge: .03, soft: .035, ambient: 1.6, ink: 0x0a0a1e, floor: 0x3c5066,
      key: .75, neutral: .2, fill: 2, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0x0e4e56 },
    sky: {
      zenith: 0x052a38, horizon: 0x0f6a70, ground: 0x06222a, horizonHeight: .5,
      sunColor: 0xcffcff, sunIntensity: 0, sunSize: .03, sunGlow: 0, sunGlowWidth: 12,
      cloudCoverage: 0, cloudLit: 0xffffff, cloudShade: 0xffffff, cloudRim: 0xffffff, cloudScale: 1, cloudSpeed: 0,
      stars: 0, nebulaA: 0x0e5a62, nebulaB: 0x143a7a, nebula: 0,
    },
    ibl: .85, exposure: 1.2, toneMapping: 'neutral',
    grade: {
      lift: [.008, .022, .026], gamma: [1, 1, 1], gain: [1, 1.01, 1], toe: .3,
      saturation: 1.14, contrast: 1.1, shadowTint: 0x0e4a4e, highlightTint: 0xfff0c8, split: .26, shadowDesat: .4,
      vignette: .22, vignetteColor: 0x02100f,
    },
    bloom: { strength: .95, radius: .65, threshold: 1, knee: .4 },
    atmosphere: { kind: 'sparkles', count: 260, color: 0x9ffff0, color2: 0xfff2a0, size: .035 },
    room: { albedo: 1, key: .85 },
    ground: { tint: 0xffe9f8, gain: .825, max: .45, amount: 1 },
  },
  'drifting-isle': {
    // A night sky full of stars over the open isle: a wider floor wants a
    // little more key on it. Floodlight warm-white against a violet void, with a cyan rim:
    // the contrast is what makes it read as dramatic rather than just blue.
    key: { color: 0xf2f4ff, intensity: 4.3, dir: dir(-.45, .72, .52) },
    hemi: { sky: 0x7a70d0, ground: 0x2c1a40, intensity: .85 },
    fill: { color: 0xff6ad0, intensity: .5, dir: dir(.55, .25, -.8) },
    rim: { color: 0x7fe0ff, strength: 2.1, width: .42, dir: dir(.3, .35, -.9), px: 2.4, peak: .92 },
    toon: { shadow: 0x8a88e6, mid: 0x7fd8ff, midStrength: .28, edge: .03, soft: .035, ambient: 1.9, ink: 0x0a0a1e, floor: 0x3c3866,
      key: .75, neutral: .2, fill: 2, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0x1d1a4a },
    sky: {
      zenith: 0x04050f, horizon: 0x241a5c, ground: 0x0c0a1c, horizonHeight: .42,
      sunColor: 0xcfe6ff, sunIntensity: 9, sunSize: .03, sunGlow: .7, sunGlowWidth: 12,
      cloudCoverage: 0, cloudLit: 0xffffff, cloudShade: 0xffffff, cloudRim: 0xffffff, cloudScale: 1, cloudSpeed: 0,
      stars: 1, nebulaA: 0x8a2ab8, nebulaB: 0x1e7ad0, nebula: .85,
    },
    // Raised a little so the crowd and the floor keep their detail: the blind
    // review found the blacks crushed to navy.
    ibl: .7, exposure: 1.14, toneMapping: 'neutral',
    grade: {
      lift: [.014, .012, .04], gamma: [1, 1, 1], gain: [.98, 1, 1.05], toe: .3,
      saturation: 1.14, contrast: 1.1, shadowTint: 0x3a2a9a, highlightTint: 0xd8f0ff, split: .3, shadowDesat: .45,
      vignette: .3, vignetteColor: 0x05030f,
    },
    bloom: { strength: .8, radius: .65, threshold: 1, knee: .4 },
    atmosphere: { kind: 'sparkles', count: 260, color: 0x9fdcff, color2: 0xe4b8ff, size: .035 },
    room: { albedo: .9, key: .8 },
  },
  'wreckers-causeway': {
    key: { color: 0xfff1d6, intensity: 5.0, dir: dir(.42, .74, .45) },
    hemi: { sky: 0xb8d8ff, ground: 0x6d7c8c, intensity: .7 },
    fill: { color: 0xa9c4ff, intensity: .25, dir: dir(-.5, .3, -.6) },
    rim: { color: 0xffffff, strength: 1.4, width: .42, px: 2.2, peak: .9 },
    toon: { shadow: 0xa4b8e8, mid: 0xffb27a, midStrength: .3, edge: .03, soft: .03, ambient: 2.2, ink: 0x0a0e18, floor: 0x404460,
      key: .6, neutral: .3, fill: 2.5, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0xcfe7f6 },
    sky: {
      zenith: 0x1d6ad8, horizon: 0xd6f0ff, ground: 0x2a6aa0, horizonHeight: .28,
      sunColor: 0xfffcec, sunIntensity: 18, sunSize: .04, sunGlow: .6, sunGlowWidth: 9,
      cloudCoverage: .5, cloudLit: 0xffffff, cloudShade: 0xa9bfe0, cloudRim: 0xffffff, cloudScale: 1.35, cloudSpeed: .007,
      stars: 0, nebulaA: 0, nebulaB: 0, nebula: 0,
    },
    ibl: .4, exposure: 1.04, toneMapping: 'neutral',
    grade: {
      lift: [.006, .008, .018], gamma: [1, 1, 1], gain: [1.02, 1.01, .99],
      saturation: 1.18, contrast: 1.13, shadowTint: 0x3a6ad8, highlightTint: 0xfff4dc, split: .26, shadowDesat: .4,
      vignette: .2, vignetteColor: 0x06142a,
    },
    bloom: { strength: .65, radius: .55, threshold: 1, knee: .4 },
    atmosphere: { kind: 'sparkles', count: 90, color: 0xffffff, color2: 0xd8f0ff, size: .025 },
    albedo: { saturation: 1.35, tint: 0xfff6ea },
    room: { albedo: .84, key: .68 },
  },
  'cinder-flats': {
    // Moonlight on white sand under a black sky. The sand is the brightest
    // large thing in the frame, so the room is held down; the shade is a cold
    // violet, the fighters' rim a pale cyan, and the moon (a crescent in the
    // stage GLB, where the key comes from) is the one warm note.
    key: { color: 0xdde6ff, intensity: 3.6, dir: dir(.5, .62, -.6) },
    hemi: { sky: 0x2c3358, ground: 0xd6d2c8, intensity: .85 },
    fill: { color: 0x7868d8, intensity: .4, dir: dir(-.55, .3, .75) },
    rim: { color: 0xc4ecff, strength: 2.0, width: .42, dir: dir(-.3, .4, .85), px: 2.4, peak: .92 },
    toon: { shadow: 0x8084c0, mid: 0xa8c0ff, midStrength: .22, edge: .03, soft: .035, ambient: 2, ink: 0x06070f, floor: 0x3a3c5a,
      key: .72, neutral: .35, fill: 2.2, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0x0f1328 },
    sky: {
      zenith: 0x010207, horizon: 0x161c38, ground: 0x0a0c16, horizonHeight: .3,
      sunColor: 0xfff6d8, sunIntensity: 0, sunSize: .001, sunGlow: 0, sunGlowWidth: 1,
      cloudCoverage: 0, cloudLit: 0xffffff, cloudShade: 0xffffff, cloudRim: 0xffffff, cloudScale: 1, cloudSpeed: 0,
      stars: 1, nebulaA: 0x2a1a5a, nebulaB: 0x0a2a4a, nebula: .22,
    },
    ibl: .45, exposure: 1.1, toneMapping: 'neutral',
    grade: {
      lift: [.01, .01, .03], gamma: [1, 1, 1], gain: [.98, 1, 1.04], toe: .35,
      saturation: .95, contrast: 1.14, shadowTint: 0x2a2a7a, highlightTint: 0xf0f4ff, split: .25, shadowDesat: .5,
      vignette: .32, vignetteColor: 0x02030a,
    },
    bloom: { strength: .7, radius: .6, threshold: 1, knee: .4 },
    atmosphere: { kind: 'dust', count: 280, color: 0xe8ecff, color2: 0xffffff, size: .028 },
    room: { albedo: 1, key: .95 },
  },
  'warlords-roof': {
    // A stormy night: fire below and a huge red moon over the keep.
    // The key is the fires' orange, the fill a cold blue so the
    // shade does not drown in red, and embers ride the updraught.
    key: { color: 0xffbf8a, intensity: 5.4, dir: dir(.55, .5, -.65) },
    hemi: { sky: 0x7a4a5a, ground: 0x5a3a30, intensity: 1.15 },
    fill: { color: 0x7a9aff, intensity: .6, dir: dir(-.6, .3, .7) },
    rim: { color: 0xffa060, strength: 2.2, width: .42, dir: dir(-.2, .35, -.9), px: 2.4, peak: .92 },
    toon: { shadow: 0xa88ab8, mid: 0xff9a5a, midStrength: .3, edge: .03, soft: .035, ambient: 2.8, ink: 0x0a0406, floor: 0x4a3440,
      key: .7, neutral: .35, fill: 2.4, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0x3a161a },
    sky: {
      zenith: 0x0a0306, horizon: 0x8a2a14, ground: 0x1a0806, horizonHeight: .34,
      sunColor: 0xffb070, sunIntensity: 11, sunSize: .075, sunGlow: 1.1, sunGlowWidth: 6, sunDir: dir(.08, .3, -1),
      cloudCoverage: .34, cloudLit: 0xff8a4a, cloudShade: 0x2a0e14, cloudRim: 0xffb070, cloudScale: 1.2, cloudSpeed: .01,
      stars: .35, nebulaA: 0, nebulaB: 0, nebula: 0,
    },
    ibl: .55, exposure: 1.2, toneMapping: 'neutral',
    grade: {
      lift: [.03, .016, .02], gamma: [1, 1, 1], gain: [1.03, 1, .96], toe: .3,
      saturation: 1.12, contrast: 1.16, shadowTint: 0x3a0a2a, highlightTint: 0xffc890, split: .3, shadowDesat: .45,
      vignette: .34, vignetteColor: 0x0a0204,
    },
    bloom: { strength: .9, radius: .65, threshold: 1, knee: .4 },
    atmosphere: { kind: 'embers', count: 320, color: 0xffa050, color2: 0xff5a1e, size: .03 },
    room: { albedo: 1.15, key: 1 },
  },
  harbor: {
    // Late afternoon from behind the harbour, not from behind the lobby camera:
    // frontal light left the plaza flat, with no darks or shadows.
    key: { color: 0xffd8a4, intensity: 4.9, dir: dir(-.5, .42, -.76) },
    hemi: { sky: 0xa8b4e0, ground: 0x625a60, intensity: .7 },
    fill: { color: 0x9fb8ff, intensity: .25, dir: dir(-.6, .35, -.5) },
    rim: { color: 0xffdca8, strength: 1.7, width: .44, px: 2.4, peak: .92 },
    toon: { shadow: 0xb0b4e2, mid: 0xff9a5a, midStrength: .36, edge: .02, soft: .035, ambient: 2.2, ink: 0x0c0708, floor: 0x444060,
      key: .62, neutral: .4, fill: 3, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0xf0cfb0 },
    sky: {
      zenith: 0x3b78cc, horizon: 0xffd6a6, ground: 0x6a6a78, horizonHeight: .32,
      sunColor: 0xfff0cc, sunIntensity: 16, sunSize: .045, sunGlow: .85, sunGlowWidth: 7,
      cloudCoverage: .46, cloudLit: 0xfff2dc, cloudShade: 0xa7a6c6, cloudRim: 0xfffaea, cloudScale: 1.15, cloudSpeed: .007,
      stars: 0, nebulaA: 0, nebulaB: 0, nebula: 0,
    },
    ibl: .38, exposure: 1.1, toneMapping: 'neutral',
    grade: {
      lift: [.008, .006, .018], gamma: [1, 1, 1], gain: [1.02, 1, .97],
      saturation: 1.18, contrast: 1.15, shadowTint: 0x5a58b8, highlightTint: 0xffd29a, split: .3, shadowDesat: .45,
      vignette: .24, vignetteColor: 0x1a1020,
    },
    bloom: { strength: .65, radius: .55, threshold: 1, knee: .4 },
    atmosphere: { kind: 'petals', count: 180, color: 0xffc6d8, color2: 0xfff0f4, size: .06 },
  },
  'sunward-summit': {
    key: { color: 0xfff4e0, intensity: 5.1, dir: dir(.38, .78, .5) },
    hemi: { sky: 0xb4d2ff, ground: 0xe6e2d8, intensity: .72 },
    fill: { color: 0xb6ccff, intensity: .28, dir: dir(-.5, .3, -.6) },
    rim: { color: 0xffffff, strength: 1.45, width: .42, px: 2.2, peak: .9 },
    toon: { shadow: 0xa2b2ea, mid: 0xffb070, midStrength: .3, edge: .03, soft: .03, ambient: 2.2, ink: 0x0a0c16, floor: 0x404864,
      key: .6, neutral: .3, fill: 2.5, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0xdcecff },
    sky: {
      zenith: 0x1650cc, horizon: 0xcfe6ff, ground: 0xf4f7ff, horizonHeight: .24,
      sunColor: 0xfffdf0, sunIntensity: 19, sunSize: .04, sunGlow: .65, sunGlowWidth: 9,
      cloudCoverage: .34, cloudLit: 0xffffff, cloudShade: 0xb2c4ea, cloudRim: 0xffffff, cloudScale: 1.4, cloudSpeed: .006,
      stars: 0, nebulaA: 0, nebulaB: 0, nebula: 0,
    },
    ibl: .38, exposure: 1.04, toneMapping: 'neutral',
    grade: {
      lift: [.006, .008, .02], gamma: [1, 1, 1], gain: [1.01, 1.01, 1],
      saturation: 1.2, contrast: 1.14, shadowTint: 0x3a5ad8, highlightTint: 0xfff4dc, split: .26, shadowDesat: .4,
      vignette: .2, vignetteColor: 0x08142e,
    },
    bloom: { strength: .62, radius: .55, threshold: 1, knee: .4 },
    atmosphere: { kind: 'sparkles', count: 70, color: 0xffffff, color2: 0xdff0ff, size: .025 },
    albedo: { saturation: 1.18, tint: 0xfffaf0 },
    room: { albedo: .82, key: .64 },
  },
  'ashfall-weir': {
    key: { color: 0xffa868, intensity: 4.4, dir: dir(-.25, .3, -.92) },
    hemi: { sky: 0x9a8ec8, ground: 0x4a4250, intensity: .85 },
    fill: { color: 0x8aa2ff, intensity: .34, dir: dir(.4, .35, .85) },
    rim: { color: 0xffb478, strength: 2, width: .45, dir: dir(-.25, .3, -.92), px: 2.4, peak: .92 },
    toon: { shadow: 0xa6a6e0, mid: 0xff8a50, midStrength: .42, edge: .02, soft: .035, ambient: 2.25, ink: 0x0c0708, floor: 0x403e5e,
      key: .6, neutral: .42, fill: 3, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0xb88a90, near: 55, far: 620 },
    sky: {
      zenith: 0x272b6c, horizon: 0xff9858, ground: 0x2c2c3c, horizonHeight: .36,
      sunColor: 0xffe2a8, sunIntensity: 15, sunSize: .055, sunGlow: 1.3, sunGlowWidth: 5,
      cloudCoverage: .5, cloudLit: 0xffb08a, cloudShade: 0x8a6898, cloudRim: 0xffe6c0, cloudScale: 1.5, cloudSpeed: .006,
      stars: .25, nebulaA: 0, nebulaB: 0, nebula: 0,
    },
    ibl: .42, exposure: 1.1, toneMapping: 'neutral',
    grade: {
      lift: [.012, .008, .024], gamma: [1, 1, 1], gain: [1.03, 1, .95], toe: .45,
      saturation: 1.14, contrast: 1.2, shadowTint: 0x4a46a8, highlightTint: 0xffb47a, split: .34, shadowDesat: .5,
      vignette: .28, vignetteColor: 0x160a18,
    },
    bloom: { strength: .72, radius: .6, threshold: 1, knee: .4 },
    atmosphere: { kind: 'leaves', count: 90, color: 0x7a9a46, color2: 0xd8803a, size: .06 },
    albedo: { saturation: 1.12, tint: 0xfff2e6 },
    room: { albedo: .92, key: .75 },
  },
  'mirror-mere': {
    // A dark red night over the lake: no sun, a black-red sky, a pale, warm
    // key from the opening camera's side, high and to the right, a red fill
    // from the left and a red rim from behind the stones, so the pale rock
    // and the fighters read white-and-red against the dark rather than all
    // one red. The fires' own glow is what blooms. (The Mirror Mere's own
    // night look, src/originals/looks.ts, is laid over this.)
    key: { color: 0xffe2d2, intensity: 4, dir: dir(.38, .7, .6) },
    hemi: { sky: 0x7a4a50, ground: 0x2a0608, intensity: .7 },
    fill: { color: 0xff3036, intensity: .55, dir: dir(-.8, .3, .2) },
    // Round 4b (MAPS): a blind critic lost the fighters against the dark red
    // - the rim is brighter and paler and the fighters take more of every
    // light than the room does, so they stand out of it (no light added).
    rim: { color: 0xff9a80, strength: 3.1, width: .48, dir: dir(-.2, .45, -.87), px: 2.9, peak: .96 },
    toon: { shadow: 0xb07a86, mid: 0xff7a50, midStrength: .34, edge: .025, soft: .035, ambient: 3.3, ink: 0x080204, floor: 0x5a3a46,
      key: .86, neutral: .72, fill: 3.4, fillFloor: .28, clip: [.5, .74] },
    // A black-red haze.
    fog: { color: 0x1c0306, near: 40, far: 460 },
    sky: {
      zenith: 0x030001, horizon: 0x6a0812, ground: 0x140204, horizonHeight: .34,
      sunColor: 0xff5a40, sunIntensity: 0, sunSize: .05, sunGlow: 0, sunGlowWidth: 6,
      cloudCoverage: .12, cloudLit: 0x4a0a10, cloudShade: 0x120204, cloudRim: 0x8a1a1e, cloudScale: 1.9, cloudSpeed: .012,
      stars: 0, nebulaA: 0x7a0612, nebulaB: 0x240206, nebula: .35,
    },
    ibl: .22, exposure: 1.1, toneMapping: 'neutral',
    grade: {
      lift: [.014, .004, .006], gamma: [1, 1, 1], gain: [1.03, .99, .98], toe: .4,
      saturation: 1.04, contrast: 1.24, shadowTint: 0x3a0612, highlightTint: 0xfff0e8, split: .22, shadowDesat: .3,
      vignette: .34, vignetteColor: 0x0c0002,
    },
    bloom: { strength: .8, radius: .6, threshold: 1, knee: .4 },
    atmosphere: { kind: 'embers', count: 170, color: 0xff6a3a, color2: 0xa0141e, size: .02 },
    albedo: { saturation: .96, tint: 0xfff4ee },
    room: { albedo: .95, key: .9 },
  },
  'hollowmere-quarry': {
    key: { color: 0xfff0d6, intensity: 5, dir: dir(.42, .66, .62) },
    hemi: { sky: 0xb4d0ff, ground: 0x8a7c6a, intensity: .68 },
    fill: { color: 0xa8c0ff, intensity: .26, dir: dir(-.5, .3, -.6) },
    rim: { color: 0xfff4e4, strength: 1.5, width: .42, px: 2.2, peak: .9 },
    toon: { shadow: 0xa8b4e2, mid: 0xffa868, midStrength: .32, edge: .03, soft: .03, ambient: 2.2, ink: 0x0c0a0c, floor: 0x44445e,
      key: .6, neutral: .35, fill: 2.6, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0xc9d9e6, near: 45, far: 560 },
    sky: {
      zenith: 0x2c6ed4, horizon: 0xd6ecff, ground: 0x7a7e86, horizonHeight: .3,
      sunColor: 0xfffaea, sunIntensity: 17, sunSize: .045, sunGlow: .7, sunGlowWidth: 8,
      cloudCoverage: .56, cloudLit: 0xffffff, cloudShade: 0xa8b8d8, cloudRim: 0xffffff, cloudScale: 1.25, cloudSpeed: .006,
      stars: 0, nebulaA: 0, nebulaB: 0, nebula: 0,
    },
    ibl: .38, exposure: 1.06, toneMapping: 'neutral',
    grade: {
      lift: [.008, .008, .016], gamma: [1, 1, 1], gain: [1.02, 1.005, .98],
      saturation: 1.06, contrast: 1.14, shadowTint: 0x40549c, highlightTint: 0xfff0d6, split: .24, shadowDesat: .45,
      vignette: .22, vignetteColor: 0x10141c,
    },
    bloom: { strength: .6, radius: .55, threshold: 1, knee: .4 },
    atmosphere: { kind: 'dust', count: 90, color: 0xdccab0, color2: 0xfff4e4, size: .05 },
    albedo: { saturation: 1.12, tint: 0xfff6ea },
    room: { albedo: .94, key: .8 },
  },
  'starfall-crater': {
    // The day after the star fell: a storm
    // breaking over the flattened village, the light low from the west through
    // its gaps and warm with the dust in the air, the shade a cool slate. The
    // crater's ochre earth is the room; the fighters keep the colour.
    key: { color: 0xfff0dc, intensity: 4.4, dir: dir(-.62, .52, .3) },
    hemi: { sky: 0x9fb4d8, ground: 0x6e6c6a, intensity: .82 },
    fill: { color: 0x9cacd8, intensity: .32, dir: dir(.6, .3, -.5) },
    // Round 2: a stronger rim on both fighters (a blind critic: Amagoi "depends on his outline" against the rubble).
    rim: { color: 0xffe0b8, strength: 2.6, width: .42, dir: dir(-.62, .52, .3), px: 2.6, peak: .94 },
    toon: { shadow: 0xa8aed0, mid: 0xffa868, midStrength: .32, edge: .03, soft: .03, ambient: 2.4, ink: 0x0c0a0c, floor: 0x46445e,
      key: .62, neutral: .35, fill: 2.6, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0x9aa4b0 },
    sky: {
      zenith: 0x4a5a78, horizon: 0xc8b494, ground: 0x7a6a58, horizonHeight: .32,
      sunColor: 0xffe8c0, sunIntensity: 10, sunSize: .045, sunGlow: .7, sunGlowWidth: 8,
      cloudCoverage: .7, cloudLit: 0xe8dcc8, cloudShade: 0x5e6478, cloudRim: 0xfff0d8, cloudScale: 1.2, cloudSpeed: .008,
      stars: 0, nebulaA: 0, nebulaB: 0, nebula: 0,
    },
    ibl: .34, exposure: 1.04, toneMapping: 'neutral',
    grade: {
      lift: [.006, .005, .008], gamma: [1, 1, 1], gain: [1.03, 1.0, .96],
      // Round 2: the shade a cooler blue-grey under the warm key (split .26 -> .34).
      saturation: 1.02, contrast: 1.22, shadowTint: 0x3a5096, highlightTint: 0xfff0dc, split: .34, shadowDesat: .3,
      vignette: .14, vignetteColor: 0x1a140e,
    },
    bloom: { strength: .38, radius: .5, threshold: 1.05, knee: .35 },
    atmosphere: { kind: 'dust', count: 110, color: 0x6a6258, color2: 0xa8988a, size: .03 },
    albedo: { saturation: .88, tint: 0xf4f4ee },
    room: { albedo: .9, key: .78 },
  },
  'dry-harbour': {
    key: { color: 0xffe4c4, intensity: 5.4, dir: dir(-.5, .64, .58) },
    hemi: { sky: 0xc4d8f4, ground: 0x9aa2a6, intensity: .72 },
    fill: { color: 0xa8b4ff, intensity: .3, dir: dir(.55, .3, -.6) },
    rim: { color: 0xf4fbff, strength: 1.5, width: .42, px: 2.2, peak: .9 },
    toon: { shadow: 0xa2b8e8, mid: 0xffae76, midStrength: .3, edge: .03, soft: .03, ambient: 2.2, ink: 0x0a0e18, floor: 0x3e4662,
      key: .6, neutral: .3, fill: 2.6, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0xb8d4ee },
    sky: {
      zenith: 0x1a62d2, horizon: 0xd2ecff, ground: 0x6a8aa8, horizonHeight: .28,
      sunColor: 0xfffcec, sunIntensity: 18, sunSize: .04, sunGlow: .6, sunGlowWidth: 9,
      cloudCoverage: .52, cloudLit: 0xffffff, cloudShade: 0xa6bee2, cloudRim: 0xffffff, cloudScale: 1.3, cloudSpeed: .007,
      stars: 0, nebulaA: 0, nebulaB: 0, nebula: 0,
    },
    ibl: .38, exposure: .9, toneMapping: 'neutral',
    grade: {
      lift: [.003, .005, .012], gamma: [1, 1, 1], gain: [1.03, 1.01, .98],
      saturation: 1.14, contrast: 1.22, shadowTint: 0x45589c, highlightTint: 0xfff8ee, split: .16, shadowDesat: .4,
      vignette: .2, vignetteColor: 0x06142a,
    },
    bloom: { strength: .38, radius: .5, threshold: 1.22, knee: .35 },
    atmosphere: { kind: 'sparkles', count: 110, color: 0xffffff, color2: 0xcfefff, size: .026 },
    albedo: { saturation: 1.0, tint: 0xfff6ec },
    room: { albedo: .84, key: .72 },
  },
  'thornwood-ward': {
    key: { color: 0xc8dcff, intensity: 3.2, dir: dir(.32, .74, .58) },
    hemi: { sky: 0x26507a, ground: 0x24262c, intensity: .82 },
    fill: { color: 0xffa070, intensity: .5, dir: dir(-.8, .35, .3) },
    rim: { color: 0xa8dcff, strength: 3.6, width: .5, dir: dir(.15, .45, -.88), px: 2.9, peak: .97 },
    toon: { shadow: 0x8a98c8, mid: 0xffa070, midStrength: .3, edge: .025, soft: .035, ambient: 3.1, ink: 0x06060c, floor: 0x46507a,
      key: .86, neutral: .6, fill: 3.2, fillFloor: .28, clip: [.5, .74] },
    fog: { color: 0x10172a, near: 70, far: 820 },
    sky: {
      zenith: 0x040408, horizon: 0x142030, ground: 0x0e0e18, horizonHeight: .3,
      sunColor: 0xc8d0ff, sunIntensity: 0, sunSize: .04, sunGlow: 0, sunGlowWidth: 6,
      cloudCoverage: 0, cloudLit: 0x2a2440, cloudShade: 0x0a0812, cloudRim: 0x4a3a6a, cloudScale: 1.6, cloudSpeed: .004,
      stars: 0, nebulaA: 0x1a2040, nebulaB: 0x0a0814, nebula: .15,
    },
    ibl: .26, exposure: 1.12, toneMapping: 'neutral',
    grade: {
      lift: [.012, .008, .022], gamma: [1, 1, 1], gain: [1.02, 1, 1.02], toe: .42,
      saturation: 1.0, contrast: 1.2, shadowTint: 0x0a2c52, highlightTint: 0xfff0dc, split: .24, shadowDesat: .3,
      vignette: .3, vignetteColor: 0x06040c,
    },
    bloom: { strength: .85, radius: .62, threshold: 1, knee: .45 },
    atmosphere: { kind: 'embers', count: 110, color: 0xff8a4a, color2: 0xff4fb0, size: .018 },
    albedo: { saturation: .98, tint: 0xe8f2ff },
    room: { albedo: .94, key: .74 },
    ground: { tint: 0xffebc8, gain: 1.08, max: .5, amount: 1 },
    finishTint: { shadow: 0xc4d6ff, lift: 0x0a1a30, liftStrength: .12, warm: 0xfff3e4 },
  },
  'kuroyuki-hall': {
    key: { color: 0xfff0dc, intensity: 2.9, dir: dir(.3, .72, .62) },
    hemi: { sky: 0x3e3044, ground: 0x241818, intensity: .46 },
    // Round 2: the fill off the void a teal, and the fighters' rim warm and a little stronger (two blind critics asked
    // for a warm rim on both fighters; a cool one was tried in between), so a fighter's shade side reads against the
    // amber hall instead of sinking into it.
    fill: { color: 0x3e7a86, intensity: .7, dir: dir(-.7, .3, -.6) },
    rim: { color: 0xffdca0, strength: 3.9, width: .48, dir: dir(.1, .5, -.86), px: 3.0, peak: .98 },
    toon: { shadow: 0xa08c98, mid: 0xffa060, midStrength: .34, edge: .025, soft: .035, ambient: 3.0, ink: 0x0a0604, floor: 0x5a4a52,
      key: .86, neutral: .6, fill: 3.0, fillFloor: .26, clip: [.5, .74] },
    // Near is clear and dark; the far halls sink into amber, with the air's
    // own haze over them (roanPass.ts). Round 2: a warmer, lighter amber, so
    // the far rooms fade toward the painted sky's glowing haze
    // (sky-kuroyuki-hall.webp) rather than into black - round 1's void read as
    // "a pavilion floating in black space".
    fog: { color: 0x3a2210, near: 90, far: 700 },
    sky: {
      zenith: 0x050302, horizon: 0x3a2414, ground: 0x0a0604, horizonHeight: .3,
      sunColor: 0xffc890, sunIntensity: 0, sunSize: .04, sunGlow: 0, sunGlowWidth: 6,
      cloudCoverage: 0, cloudLit: 0x3a2414, cloudShade: 0x0c0806, cloudRim: 0x5a3a20, cloudScale: 1.6, cloudSpeed: .004,
      stars: 0, nebulaA: 0x3a2010, nebulaB: 0x100804, nebula: .2,
    },
    ibl: .22, exposure: 1.02, toneMapping: 'neutral',
    grade: {
      lift: [.016, .01, .006], gamma: [1, 1, 1], gain: [1.03, 1, .96], toe: .42,
      saturation: 1.0, contrast: 1.34, shadowTint: 0x1c1844, highlightTint: 0xfff0d4, split: .3, shadowDesat: .3,
      // Round 2: a lighter vignette (was .38): the near floor's corners went to black under it.
      vignette: .28, vignetteColor: 0x0a0604,
    },
    bloom: { strength: .9, radius: .65, threshold: 1, knee: .45 },
    atmosphere: { kind: 'embers', count: 70, color: 0xffa040, color2: 0xffd080, size: .018 },
    albedo: { saturation: .9, tint: 0xfff4ea },
    room: { albedo: 1.0, key: 1.0 },
    // The floors round: the mats at the hall's own light (luma 78; 69 before), the shoulder holding the heart's pool.
    ground: { tint: 0xf0e8d4, gain: 1.03, max: .62, amount: 1 },
    // The finish's darks warm umber, not its shared lavender.
    // Deep shadow with a cool indigo cast under the amber, from near-black to
    // hot cream (a blind critic found one orange band).
    finishTint: { shadow: 0xc8c6ee, lift: 0x080616, liftStrength: .1, warm: 0xfff2dc },
  },
  'scrap-pit': {
    key: { color: 0xf4f6ff, intensity: 4.2, dir: dir(.18, .94, .28) },
    hemi: { sky: 0x5c5a6c, ground: 0x1e1e24, intensity: .8 },
    fill: { color: 0xff6ad0, intensity: .5, dir: dir(.3, .25, -1) },
    rim: { color: 0x8fe6ff, strength: 3.2, width: .5, dir: dir(-.2, .35, -.9), px: 2.8, peak: .95 },
    toon: { shadow: 0x9a96e0, mid: 0x8fd8ff, midStrength: .25, edge: .03, soft: .035, ambient: 2.2, ink: 0x0a0a1a, floor: 0x3c3a62,
      key: .72, neutral: .25, fill: 2.2, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0x121218 },
    sky: {
      zenith: 0x0a0608, horizon: 0x24141e, ground: 0x0c0709, horizonHeight: .4,
      sunColor: 0xe8f0ff, sunIntensity: 0, sunSize: .03, sunGlow: 0, sunGlowWidth: 8,
      cloudCoverage: 0, cloudLit: 0xffffff, cloudShade: 0xffffff, cloudRim: 0xffffff, cloudScale: 1, cloudSpeed: 0,
      stars: 0, nebulaA: 0, nebulaB: 0, nebula: 0,
    },
    ibl: .55, exposure: 1.1, toneMapping: 'neutral',
    grade: {
      lift: [.012, .01, .03], gamma: [1, 1, 1], gain: [.99, 1, 1.04], toe: .3,
      saturation: 1.12, contrast: 1.16, shadowTint: 0x2a2a4a, highlightTint: 0xeaf4ff, split: .26, shadowDesat: .4,
      vignette: .3, vignetteColor: 0x0c0408,
    },
    bloom: { strength: .8, radius: .6, threshold: .9, knee: .4 },
    atmosphere: { kind: 'dust', count: 160, color: 0xb8c4e0, color2: 0xe8eeff, size: .022 },
    albedo: { saturation: 1.0, tint: 0xffffff },
    room: { albedo: .9, key: .85 },
    ground: { tint: 0xe2eaf4, gain: .78, max: .8, amount: 1 },
    finishGround: .3,
  },
};

/** Arcade survival's last stands: dark, brutal, lit by fire and a sick sky.
 *  Every one keeps the fighters readable - a strong rim, a lifted shade, the
 *  ink - while the world around them sinks toward black. */
const RIFT_LOOKS: Record<'rift-village' | 'rift-swords' | 'rift-fortress' | 'rift-eclipse', LookPreset> = {
  'rift-village': {
    // Night in a burning village under a blood moon: the fires are the key,
    // low and orange; the moon's cold blue is the fill; embers everywhere.
    key: { color: 0xff9a5c, intensity: 4.8, dir: dir(-.55, .4, .74) },
    hemi: { sky: 0x4a2634, ground: 0x2a1812, intensity: .85 },
    fill: { color: 0x5a78ff, intensity: .55, dir: dir(.6, .35, -.7) },
    rim: { color: 0xff8848, strength: 2.4, width: .44, dir: dir(.3, .4, -.85), px: 2.4, peak: .92 },
    toon: { shadow: 0x9a7aa8, mid: 0xff8a4a, midStrength: .34, edge: .03, soft: .035, ambient: 2.6, ink: 0x0a0406, floor: 0x40303c,
      key: .72, neutral: .35, fill: 2.6, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0x2c1014 },
    sky: {
      zenith: 0x060204, horizon: 0x9a2a12, ground: 0x120604, horizonHeight: .3,
      sunColor: 0xff3a1c, sunIntensity: 8, sunSize: .085, sunGlow: 1.3, sunGlowWidth: 5, sunDir: dir(.35, .22, 1),
      cloudCoverage: .42, cloudLit: 0xa83a1c, cloudShade: 0x1c070a, cloudRim: 0xff7a3a, cloudScale: 1.1, cloudSpeed: .012,
      stars: .2, nebulaA: 0, nebulaB: 0, nebula: 0,
    },
    ibl: .45, exposure: 1.18, toneMapping: 'neutral',
    grade: {
      lift: [.03, .014, .018], gamma: [1, 1, 1], gain: [1.04, 1, .95], toe: .3,
      saturation: 1.06, contrast: 1.22, shadowTint: 0x2a0a1c, highlightTint: 0xffb070, split: .32, shadowDesat: .5,
      vignette: .42, vignetteColor: 0x080102,
    },
    bloom: { strength: 1, radius: .68, threshold: 1, knee: .4 },
    atmosphere: { kind: 'embers', count: 400, color: 0xffa050, color2: 0xff4a18, size: .032 },
    room: { albedo: 1.05, key: .95 },
  },
  'rift-swords': {
    // An overcast dusk over a hill of graves: cold, grey, ash on the wind -
    // everything drained but the blood.
    key: { color: 0xd8d4e8, intensity: 3.4, dir: dir(.45, .38, -.8) },
    hemi: { sky: 0x5a5868, ground: 0x2a2624, intensity: .95 },
    fill: { color: 0x9a6aa0, intensity: .4, dir: dir(-.6, .3, .7) },
    rim: { color: 0xe4e8ff, strength: 2.1, width: .42, dir: dir(-.3, .4, .85), px: 2.4, peak: .92 },
    toon: { shadow: 0x8a8aa8, mid: 0xd8b0a0, midStrength: .2, edge: .03, soft: .035, ambient: 2.4, ink: 0x07070a, floor: 0x3c3c48,
      key: .7, neutral: .5, fill: 2.2, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0x3a3a44 },
    sky: {
      zenith: 0x16161e, horizon: 0x8a7880, ground: 0x1a1a1e, horizonHeight: .34,
      sunColor: 0xffe2c8, sunIntensity: 3, sunSize: .05, sunGlow: .9, sunGlowWidth: 5,
      cloudCoverage: .74, cloudLit: 0x9a8c94, cloudShade: 0x2a2a34, cloudRim: 0xd8c8c8, cloudScale: 1.25, cloudSpeed: .016,
      stars: 0, nebulaA: 0, nebulaB: 0, nebula: 0,
    },
    ibl: .5, exposure: 1.12, toneMapping: 'neutral',
    grade: {
      lift: [.02, .02, .026], gamma: [1, 1, 1], gain: [1, 1, 1.02], toe: .35,
      saturation: .74, contrast: 1.2, shadowTint: 0x1a1a3a, highlightTint: 0xf0e0d4, split: .28, shadowDesat: .6,
      vignette: .4, vignetteColor: 0x040406,
    },
    bloom: { strength: .8, radius: .6, threshold: 1, knee: .4 },
    atmosphere: { kind: 'dust', count: 460, color: 0xbcbcc4, color2: 0x8a8a92, size: .03 },
    room: { albedo: .95, key: .9 },
  },
  'rift-fortress': {
    // A stormy night in a black keep: moonlight from above, torchlight from
    // the braziers, and the courtyard between them.
    key: { color: 0xa8b8ff, intensity: 3.6, dir: dir(-.5, .62, .6) },
    hemi: { sky: 0x1c2644, ground: 0x16100c, intensity: .8 },
    fill: { color: 0xff8a3a, intensity: .5, dir: dir(.6, .25, -.7) },
    rim: { color: 0x9ab8ff, strength: 2.3, width: .44, dir: dir(.4, .45, -.8), px: 2.4, peak: .92 },
    toon: { shadow: 0x7a86b8, mid: 0xffa060, midStrength: .26, edge: .03, soft: .035, ambient: 2.3, ink: 0x05060c, floor: 0x343a54,
      key: .72, neutral: .4, fill: 2.4, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0x0e1224 },
    sky: {
      zenith: 0x02030a, horizon: 0x1c2440, ground: 0x08080c, horizonHeight: .3,
      sunColor: 0xdde6ff, sunIntensity: 6, sunSize: .045, sunGlow: .8, sunGlowWidth: 6,
      cloudCoverage: .6, cloudLit: 0x4a5a7a, cloudShade: 0x0a0c14, cloudRim: 0xa0b4e0, cloudScale: 1.15, cloudSpeed: .02,
      stars: .3, nebulaA: 0, nebulaB: 0, nebula: 0,
    },
    ibl: .45, exposure: 1.16, toneMapping: 'neutral',
    grade: {
      lift: [.012, .016, .03], gamma: [1, 1, 1], gain: [1.02, 1, .98], toe: .3,
      saturation: .92, contrast: 1.24, shadowTint: 0x0a1a3a, highlightTint: 0xffc890, split: .3, shadowDesat: .45,
      vignette: .45, vignetteColor: 0x010208,
    },
    bloom: { strength: .9, radius: .62, threshold: 1, knee: .4 },
    atmosphere: { kind: 'embers', count: 220, color: 0xffa050, color2: 0xff6a2a, size: .028 },
    room: { albedo: 1, key: .95 },
  },
  'rift-eclipse': {
    // Dusk: a black sun in a ring of fire over a field of the dead.
    // Crimson light from the corona, violet fill, and the fighters rimmed red.
    key: { color: 0xff5a3a, intensity: 4, dir: dir(0, .36, 1) },
    hemi: { sky: 0x5a0a16, ground: 0x1a0406, intensity: 1 },
    fill: { color: 0x7a5aff, intensity: .4, dir: dir(-.6, .3, -.7) },
    rim: { color: 0xff3a2a, strength: 2.6, width: .46, dir: dir(0, .35, 1), px: 2.5, peak: .94 },
    toon: { shadow: 0x9a6a9a, mid: 0xff5a4a, midStrength: .32, edge: .03, soft: .035, ambient: 2.6, ink: 0x0a0204, floor: 0x442030,
      key: .7, neutral: .3, fill: 2.6, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0x3a060c },
    sky: {
      zenith: 0x0a0002, horizon: 0xa0160e, ground: 0x140204, horizonHeight: .36,
      sunColor: 0xff4a1a, sunIntensity: 9, sunSize: .11, sunGlow: 1.6, sunGlowWidth: 4, sunDir: dir(0, .42, 1),
      cloudCoverage: .36, cloudLit: 0x8a1a14, cloudShade: 0x120204, cloudRim: 0xff6a3a, cloudScale: 1, cloudSpeed: .018,
      stars: 0, nebulaA: 0, nebulaB: 0, nebula: 0, eclipse: 1,
    },
    ibl: .5, exposure: 1.2, toneMapping: 'neutral',
    grade: {
      lift: [.03, .008, .012], gamma: [1, 1, 1], gain: [1.05, .98, .95], toe: .3,
      saturation: 1.1, contrast: 1.24, shadowTint: 0x2a0418, highlightTint: 0xff9070, split: .34, shadowDesat: .5,
      vignette: .46, vignetteColor: 0x060001,
    },
    bloom: { strength: 1.05, radius: .7, threshold: 1, knee: .4 },
    atmosphere: { kind: 'embers', count: 360, color: 0xff5a30, color2: 0xa01a10, size: .03 },
    room: { albedo: 1, key: .95 },
  },
};
Object.assign(STAGE_LOOKS, RIFT_LOOKS);
STAGE_LOOKS['ashwood']={
  ...STAGE_LOOKS.harbor,
  key:{color:0xffd4a3,intensity:2.8,dir:dir(-.65,.42,.6)},
  hemi:{sky:0xa9b7db,ground:0x716258,intensity:.6},
  fill:{color:0x9eafff,intensity:.65,dir:dir(.7,.4,-.6)},
  rim:{color:0xffc991,strength:1.8,width:.42,dir:dir(-.65,.42,.6),px:2,peak:.88},
  fog:{color:0x9d93aa,near:140,far:430},
  sky:{...STAGE_LOOKS.harbor.sky,zenith:0x566f9d,horizon:0xf3bc90,ground:0x655651,
    sunDir:dir(-.65,.18,.6),sunColor:0xffdc9d,sunIntensity:10,sunSize:.033,cloudCoverage:.48,
    cloudLit:0xf8c8a8,cloudShade:0x7e7f9c,cloudRim:0xffe5b8},
  ibl:.32,exposure:1.03,
  grade:{...STAGE_LOOKS.harbor.grade,saturation:1.08,contrast:1.19,shadowTint:0x283d60,highlightTint:0xffd5a8,split:.17,vignette:.22},
  bloom:{strength:.38,radius:.5,threshold:1.1,knee:.3},
  atmosphere:{kind:'leaves',count:60,color:0xd7a466,color2:0x7d9466,size:.035},
};
STAGE_LOOKS['blood-citadel']={
  ...STAGE_LOOKS.harbor,
  key:{color:0xc0d9fa,intensity:3.9,dir:dir(.4,.68,-.65)},
  hemi:{sky:0x788dbd,ground:0x414854,intensity:.62},
  fill:{color:0xe6b39f,intensity:.38,dir:dir(-.7,.4,.5)},
  rim:{color:0xd0e7ff,strength:2.3,width:.44,dir:dir(.4,.68,-.65),px:2.1,peak:.9},
  toon:{...STAGE_LOOKS.harbor.toon,shadow:0x8e9caf,ambient:2.8,floor:0x566176,fill:2,fillFloor:.2,key:.72,neutral:.65},
  fog:{color:0x263e60,near:65,far:240},
  sky:{...STAGE_LOOKS.harbor.sky,zenith:0x142542,horizon:0x6483ab,ground:0x1c2b3d,sunIntensity:0},
  ibl:.3,exposure:1.08,
  grade:{...STAGE_LOOKS.harbor.grade,saturation:1.06,contrast:1.16,shadowTint:0x173455,highlightTint:0xc5dbf6,split:.12,vignette:.2},
  bloom:{strength:.5,radius:.55,threshold:1.05,knee:.35},
  atmosphere:{kind:'embers',count:100,color:0xcfb092,color2:0x6f9bbb,size:.018},
};
// Open daylight keeps the three routes readable. Jade shade and ivory stone
// distinguish the new valley from the village's warm, enclosed streets.
STAGE_LOOKS['rift-war']={
  ...STAGE_LOOKS['ashwood'],
  key:{color:0xffd9a3,intensity:3.1,dir:dir(-.55,.7,.42)},
  hemi:{sky:0xb8cbe7,ground:0x454c37,intensity:.6},
  fill:{color:0x90b8e1,intensity:.65,dir:dir(.7,.4,-.6)},
  rim:{color:0xffd6ac,strength:1.75,width:.42,dir:dir(-.55,.7,.42),px:2,peak:.88},
  toon:{...STAGE_LOOKS.harbor.toon,shadow:0x9facc2,ambient:2.6,floor:0x46516b,fill:2.2,fillFloor:.2,key:.72,neutral:.62},
  fog:{color:0xa8aab9,near:110,far:370},
  sky:{...STAGE_LOOKS['ashfall-weir'].sky},
  ibl:.32,exposure:1.02,
  grade:{...STAGE_LOOKS.harbor.grade,saturation:1.07,contrast:1.17,shadowTint:0x303c5c,highlightTint:0xffdbad,split:.14,vignette:.18},
  bloom:{strength:.24,radius:.4,threshold:1.15,knee:.25},
  atmosphere:{kind:'leaves',count:48,color:0xb9c17c,color2:0xd19a6d,size:.025},
};
// The ball modes' arenas (render/ball/BallArena.ts). Goal Rush's Ink Bowl is a floodlit night: a cold white key high
// over the pitch where the four towers stand, a navy sky with stars over the canopy, the lamps, the ribbon boards and
// the hot ball left to the bloom.
STAGE_LOOKS['ball-pitch']={
  ...STAGE_LOOKS['cinder-flats'],
  key:{color:0xf2f5ff,intensity:3.4,dir:dir(.35,.85,.4)},
  hemi:{sky:0x4a5a8c,ground:0x22331f,intensity:.8},
  fill:{color:0x8fa4ff,intensity:.45,dir:dir(-.5,.5,-.6)},
  rim:{color:0xe4ecff,strength:2.1,width:.42,dir:dir(-.35,.6,-.7),px:2.2,peak:.9},
  toon:{...STAGE_LOOKS.harbor.toon,shadow:0x9aa2c4,mid:0xb0c4ff,midStrength:.2,ambient:2.4,floor:0x3a3f5c,key:.72,neutral:.6,fill:2.2,fillFloor:.18},
  fog:{color:0x0d1226,near:150,far:410},
  sky:{...STAGE_LOOKS['cinder-flats'].sky,zenith:0x02040c,horizon:0x1c2550,ground:0x090b14,stars:1,nebula:.15,
    cloudCoverage:.18,cloudLit:0x2c3560,cloudShade:0x0a0d1c,cloudRim:0x5a6aa0,cloudScale:1.1,cloudSpeed:.004},
  ibl:.42,exposure:1.12,
  grade:{...STAGE_LOOKS['cinder-flats'].grade,saturation:1.12,contrast:1.16,shadowTint:0x1a2050,highlightTint:0xf2f6ff,split:.2,vignette:.28,inkEdge:1},
  bloom:{strength:.8,radius:.6,threshold:1,knee:.4},
  atmosphere:{kind:'dust',count:120,color:0xe8eeff,color2:0xffffff,size:.02},
  room:{albedo:1,key:1},
};
// Sky Spike's court above the clouds at sunset: the sun low and gold across the court, a violet fill off the sky
// behind it, rose haze over the cloud sea, petals in the air with the trees' own.
STAGE_LOOKS['ball-court']={
  ...STAGE_LOOKS.harbor,
  key:{color:0xffb27c,intensity:3.6,dir:dir(-.62,.34,.7)},
  hemi:{sky:0xb59ad8,ground:0x8a5a62,intensity:.75},
  fill:{color:0x9a8cff,intensity:.5,dir:dir(.6,.4,-.7)},
  rim:{color:0xffc48e,strength:2,width:.44,dir:dir(-.62,.34,.7),px:2.3,peak:.9},
  toon:{...STAGE_LOOKS.harbor.toon,shadow:0xb09ad0,mid:0xff9a5a,midStrength:.38},
  fog:{color:0xf0a184,near:140,far:400},
  sky:{...STAGE_LOOKS.harbor.sky,zenith:0x34407e,horizon:0xffa476,ground:0xd88f86,horizonHeight:.36,
    sunDir:dir(-.62,.1,.7),sunColor:0xffd59a,sunIntensity:13,sunSize:.05,sunGlow:1.1,sunGlowWidth:6,
    cloudCoverage:.42,cloudLit:0xffc4a4,cloudShade:0x8c6aa4,cloudRim:0xffe4b8,cloudScale:1.2,cloudSpeed:.006},
  ibl:.36,exposure:1.06,
  grade:{...STAGE_LOOKS.harbor.grade,saturation:1.14,contrast:1.15,shadowTint:0x4a3a8a,highlightTint:0xffcc9a,split:.3,vignette:.22,inkEdge:1},
  bloom:{strength:.6,radius:.55,threshold:1,knee:.4},
  atmosphere:{kind:'petals',count:70,color:0xffb8d0,color2:0xfff0f4,size:.055},
};
// The survival places added on 30 September start from their nearest kin
// here; arcade survival's own table (src/render/rift/looks.ts) replaces all
// of them at load.
Object.assign(STAGE_LOOKS, { 'rift-frost': RIFT_LOOKS['rift-fortress'], 'rift-grove': RIFT_LOOKS['rift-eclipse'], 'rift-wastes': RIFT_LOOKS['rift-swords'], 'rift-harbor': RIFT_LOOKS['rift-fortress'] });

// The ball modes' other arenas (game/ball/arenas.ts), each its own light. lookFor
// reads the arena the match asked for (render/ball/arenaChoice.ts) when the stage is a ball stage.
export const BALL_ARENA_LOOKS: Partial<Record<BallArenaId, LookPreset>> = {
  // The Wreck Yard: the Dust Sea at sundown, low gold sun and dust in the air.
  'dust-yard': {...STAGE_LOOKS['sunfall-arena'], fog: {...STAGE_LOOKS['sunfall-arena'].fog, near: 140, far: 410},
    sky: {...STAGE_LOOKS['ball-court'].sky, zenith: 0x3a4a86, horizon: 0xffb27a, ground: 0xc08a5a, cloudCoverage: .35,
      cloudLit: 0xffd2a0, cloudShade: 0x9a6a7a, cloudRim: 0xffe6b8},
    key: {...STAGE_LOOKS['sunfall-arena'].key, color: 0xffd2a8},
    grade: {...STAGE_LOOKS['sunfall-arena'].grade, saturation: .92, inkEdge: 1},
    atmosphere: {kind: 'dust', count: 110, color: 0xf0c890, color2: 0xffe6c0, size: .025}},
  // Rain Roof: a wet night, the cloud down on the city, the floodlights cold.
  'rain-roof': {...STAGE_LOOKS['ball-pitch'], key: {...STAGE_LOOKS['ball-pitch'].key, intensity: 2.9},
    fog: {color: 0x151b26, near: 70, far: 330},
    sky: {...STAGE_LOOKS['ball-pitch'].sky, stars: 0, nebula: 0, cloudCoverage: .85, cloudLit: 0x2a3346, cloudShade: 0x0c0f16, cloudRim: 0x3c4a66},
    grade: {...STAGE_LOOKS['ball-pitch'].grade, saturation: .96, inkEdge: 1},
    atmosphere: {kind: 'none', count: 0, color: 0xffffff, color2: 0xffffff, size: .02}},
  // Tide Court: dusk on the beach, the sun down on the sea.
  'tide-court': {...STAGE_LOOKS['ball-court'], key: {...STAGE_LOOKS['ball-court'].key, color: 0xffa070, intensity: 3.3},
    fog: {color: 0xe89a86, near: 160, far: 420},
    sky: {...STAGE_LOOKS['ball-court'].sky, zenith: 0x2a3a78, horizon: 0xff9a7a, cloudCoverage: .3},
    atmosphere: {kind: 'sparkles', count: 30, color: 0xfff0d0, color2: 0xffffff, size: .02}},
  // Ember Rim: night on the volcano, the light coming up from the lava.
  'ember-rim': {...STAGE_LOOKS['ball-court'], key: {color: 0xff8a50, intensity: 2.5, dir: dir(-.4, .5, .6)},
    hemi: {sky: 0x3a2228, ground: 0xb04a20, intensity: .9},
    rim: {...STAGE_LOOKS['ball-court'].rim, color: 0xff7a40},
    fog: {color: 0x2a1310, near: 110, far: 380},
    sky: {...STAGE_LOOKS['ball-court'].sky, zenith: 0x0d0709, horizon: 0x5a1e12, ground: 0x2a0c08, sunIntensity: 2, sunColor: 0xff6a30,
      cloudCoverage: .6, cloudLit: 0x6a2a1a, cloudShade: 0x140a0a, cloudRim: 0xff7a40},
    grade: {...STAGE_LOOKS['ball-court'].grade, saturation: 1.1, shadowTint: 0x2a0c10, highlightTint: 0xffb070, inkEdge: 1},
    bloom: {strength: .9, radius: .6, threshold: 1, knee: .4},
    atmosphere: {kind: 'embers', count: 90, color: 0xff7a30, color2: 0xffc060, size: .03}},
};

/** The preset a stage is drawn with. */
export function lookFor(stage: StageId): LookPreset {
  // The colour pass is laid over the tuned table (roanPass.ts), and the power-up look chosen with
  // ?look= over that (powerupLook.ts).
  // A ball stage is lit as the arena the match plays in.
  const arena = stage === 'ball-pitch' || stage === 'ball-court' ? BALL_ARENA_LOOKS[ballArenaFor(stage)] : undefined;
  const look = originalLook(stage, powerupLook(stage, roanLook(stage, arena ?? STAGE_LOOKS[stage] ?? STAGE_LOOKS.harbor)));
  return stage === 'ball-court' && !sameCourt(ballCourtFor(), CLASSIC_COURT) ? volleyLook(look, ballArenaFor(stage)) : look;
}

/** So the fighters are not dark on the red-orange court - the volleyball rules' court only (its own court: arenaChoice
 *  ballCourtFor): its camera films your side from behind (SpikeCam VOLLEY) and every arena's sun stands beyond the far
 *  baseline, so your own fighters were seen from their unlit backs - dark shapes on the bright court - and the far side
 *  from the front against the light. A fill from over the camera's shoulder lights both: VOLLEY_FILL's strength, the
 *  key's colour taken `white` of the way to white, from `dir`; the sky's light under it `hemi` times as strong. The
 *  sun, its shadows and the rims are the arena's. */
export const VOLLEY_FILL = { intensity: 3.2, white: .55, dir: [.35, .6, -.72] as Vec3, hemi: 1.3 } as const;
/** So every arena Sky Spike plays in reads as well as Tide Court, Ember Rim's dark night too: an arena's own lift on
 *  the volleyball rules - its key `key` times as strong, the fill `fill` times, the sky's light `hemi` times
 *  and the sky's colour taken `warm` of the way to the lava's glow (BallArena paints its court paler too). Ember Rim is
 *  night on the volcano: unlifted, its fighters and court are lit at about half the beach's dusk. */
export const VOLLEY_ARENA_LIFT: Partial<Record<BallArenaId, { key: number; fill: number; hemi: number; warm: number }>> = {
  'ember-rim': { key: 1.35, fill: 1.35, hemi: 1.7, warm: .45 },
};
function volleyLook(look: LookPreset, arena?: BallArenaId): LookPreset {
  const k = look.key.color, w = VOLLEY_FILL.white, ch = (shift: number) => Math.round(((k >> shift) & 255) * (1 - w) + 255 * w) << shift;
  const lift = arena ? VOLLEY_ARENA_LIFT[arena] : undefined, mixed = (a: number, b: number, t: number) => [16, 8, 0].reduce((c, sh) => c | Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t) << sh, 0);
  return { ...look, key: lift ? { ...look.key, intensity: look.key.intensity * lift.key } : look.key,
    fill: { color: ch(16) | ch(8) | ch(0), intensity: VOLLEY_FILL.intensity * (lift?.fill ?? 1), dir: dir(...VOLLEY_FILL.dir) },
    hemi: { ...look.hemi, sky: lift ? mixed(look.hemi.sky, look.hemi.ground, lift.warm) : look.hemi.sky, intensity: look.hemi.intensity * VOLLEY_FILL.hemi * (lift?.hemi ?? 1) } };
}
