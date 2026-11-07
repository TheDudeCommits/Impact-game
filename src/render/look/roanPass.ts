import { STAGES as STAGE_DEFINITIONS, type StageId } from '../../game/stages';
import type { AirLook, CloudShadowLook, LeafShadowLook, LookPreset } from './stageLooks';

const enabled = typeof location === 'undefined' || new URLSearchParams(location.search).get('roan') !== '0';
export const roanEnabled = () => enabled;

/** The fighters' share of the light, roster-wide: up from 0.6-0.75 of the key
 *  with 20-45% of its colour stripped and a soft clip from 0.5 to a 0.74
 *  ceiling, which sat the cast under the room. The clip still eases toward a
 *  ceiling under the bloom threshold, so a white costume keeps its folds. */
const FIGHTER = { key: .9, neutral: .12, clip: [.62, .92] as const, ambient: 1.08, saturation: 1.16 };

type Override = (look: LookPreset) => void;
const STAGES: Partial<Record<StageId, Override>> = {
  // The training hall every new player sees: olive, sage and slate walls
  // under warm sunlight, not one amber room. The
  // stone goes cool and grey-green, the shade blue-violet, the air cool; the
  // sunlight through the windows stays warm, so it is the accent, and the
  // orange fighters read against the room instead of inside it.
  'proving-hall': look => {
    look.key.color = 0xffead2;
    look.hemi.sky = 0x88aed6; look.hemi.ground = 0x56625e; look.hemi.intensity = .78;
    look.fill.color = 0x8fb4ff;
    look.fog.color = 0xa4bcb4;
    // (Round 2 of the stages: a pale jade - the stone greyer and cooler, as it read lime on the floor and khaki
    // on the walls under the golden light, and lighter: at .86 of its albedo the hall read "muddy olive", a navy gi
    // close to the floor in the shade. Two blind critics.)
    look.albedo = { saturation: .55, tint: 0xc8dcd6 };
    look.room = { albedo: 1, key: .42 };
    // Round 2 of the stages (24 October 2026): the hall's shade lifted - at .2 of the image light its pale green
    // stone walls stood near black outside the windows' pools, "a generic dark concrete warehouse" to a blind critic.
    look.ibl = .75;
    // The floors round: the hall's pale stone read at sRGB luma 113 against its paint's 206 (the old clamp at .42 took
    // 39 of it); a blind critic asked for "a mid-value, desaturated sage-grey ... never lighter than about #9DB09F".
    look.ground = { tint: 0xfcfcff, gain: 1.03, max: .8, amount: 1 };
    look.grade = { ...look.grade, highlightTint: 0xffe8c8, shadowTint: 0x2e4c9a, split: .3, saturation: 1.18 };
    look.toon.shadow = 0xb0c0e8; look.toon.mid = 0xffa060;
    look.atmosphere = { ...look.atmosphere, color: 0xfff0d0, color2: 0xe8f4ff, shafts: look.atmosphere.shafts ? { ...look.atmosphere.shafts, color: 0xfff0d4, strength: .5 } : undefined };
  },
  'sunward-summit': look => {
    look.ground = { tint: 0xcddaff, gain: 1.08, max: .8, amount: 1 };
    look.room = { albedo: .74, key: .56 };
    look.exposure = .98;
    look.fog = { ...look.fog, color: 0xb8d4f0 };
    look.grade = { ...look.grade, saturation: 1.24, contrast: 1.16 };
  },
  // The Ash Colosseum: a sunset court. Its ground kept green, its stands and
  // the distance laid in the evening haze.
  'ash-colosseum': look => {
    look.albedo = { saturation: .96, tint: 0xf4fff0 };
    // The field is the grass's (render/ground), which this does not grade; the stage's own up-facing stone keeps its
    // old value (the old tint's luminance times the room's albedo: .82 x .82).
    look.ground = { tint: 0xe2f0d6, gain: .67, max: .6, amount: .7 };
  },
  // Midday at the Sunfall Arena: a blue sky, a pale stone ring kept off white.
  'sunfall-arena': look => {
    // The floors round: the ring read luma 166, tan (193/163/113: the warm noon took its blue), and 126 under a cloud,
    // against its paint's 214 - "a warm tan floor". A cool hue (it only
    // turns the colour now) against the warm noon and the floor's own exposure: sun-bleached pale stone, 189/185/178.
    // (Bluer, 186/190/196, a blind critic saw "icy blue-white ... a rink or plastic rather than stone".)
    look.ground = { tint: 0xb7ceff, gain: .745, max: .8, amount: 1 };
    look.room = { albedo: .8, key: .62 };
  },
  'wreckers-causeway': look => {
    look.ground = { tint: 0xe6edf6, gain: .68, max: .8, amount: 1 };
    look.fog = { ...look.fog, color: 0xb8dcf6, near: 320, far: 1350 };
  },
  // The harbour's late afternoon, with sea-blue air over the far side.
  harbor: look => {
    // (The floors round: the old tint's luminance as the exposure, and the shoulder's ceiling where the old clamp's
    // never reached its paint - the harbour's floor as it was.)
    look.ground = { tint: 0xd8dce4, gain: .72, max: .8, amount: .8 };
    look.fog = { ...look.fog, color: 0xc8d4e4, near: 30, far: 340 };
  },
  'ashfall-weir': look => {
    look.grade = { ...look.grade, contrast: 1.25 };
  },
  'hollowmere-quarry': look => {
    look.ground = { tint: 0xbed8ff, gain: 3.5, max: .8, amount: 1 };
  },

  // The Starfall Crater: the crater's earth a middle ochre, the dust's tan in the air.
  'starfall-crater': look => {
    // The floors round: the earth read luma 66 against its paint's 141 (79 out of a cloud): a warm ochre now, 136
    // (168/133/82), the dust's gold kept - preferred to the old floor by a blind critic. (Made tan-grey or a greyer
    // ochre, it lost to it: "pale khaki ... milky", "flat chalky dust or concrete".)
    look.ground = { tint: 0xfffbf5, gain: 1.47, max: .8, amount: 1 };
  },
  'dry-harbour': look => {
    look.ground = { tint: 0xdde6ee, gain: .74, max: .8, amount: 1 };
    look.fog = { ...look.fog, color: 0xbcd8f0 };
  },
};

export const CLOUD_SHADOWS: Partial<Record<StageId, CloudShadowLook>> = {
  // Round 2 of the stages (24 October 2026): fewer, softer and bigger over the Sunfall Arena - at .51 cover and .35 of the
  // key, a cloud's shade lay over the whole 29 m ring for seconds at a time (the ring measured sRGB 39/41/67 in it
  // against 68/75/73 out of it), which a blind critic read as "a flat, unlit navy slab".
  // The floors round: still a cloud the size of the ring (26 m) shaded all of it for 20-40 s at a time (clouds.mts:
  // 80% of the floor or more for 40.5 s running). Clouds of 11 m at .64 cover drift across it in patches - never more
  // than about two thirds of it at once, a fifth of it on average - and their shade keeps .72 of the key.
  'sunfall-arena': { scale: 11, cover: .64, soft: .1, floor: .72, wind: [1.4, .7], fighters: .45 },
  'wreckers-causeway': { scale: 11, cover: .63, soft: .1, floor: .72, wind: [-1.2, 1.1], fighters: .45 },
  'warlords-roof': { scale: 24, cover: .55, soft: .09, floor: .7, wind: [-1.1, -.9], fighters: .4 },
  harbor: { scale: 26, cover: .54, soft: .09, floor: .7, wind: [1.5, -.6], fighters: .45 },
  'sunward-summit': { scale: 22, cover: .53, soft: .1, floor: .7, wind: [1.6, .4], height: 90, fighters: .35 },
  'hollowmere-quarry': { scale: 18, cover: .52, soft: .09, floor: .7, wind: [.9, 1.3], fighters: .45 },
  'dry-harbour': { scale: 26, cover: .54, soft: .09, floor: .7, wind: [-1.3, 1.0], fighters: .45 },
  // The storm breaking: big, slow shadows, more cloud than sun.
  'starfall-crater': { scale: 30, cover: .51, soft: .12, floor: .7, wind: [1.6, .6], fighters: .4 },
};
export const GROUND_BUDGET = { keep: .6 };
/** The least of the key a floor keeps under a cloud. */
export const CLOUD_FLOOR = .7;
/** No cloud wider than this share of the floor's short side: a cloud the size of the floor covers all of it at once. */
export const CLOUD_SPAN = .42;
export function cloudsFor(stage: StageId): CloudShadowLook | undefined {
  const k = CLOUD_SHADOWS[stage], def = STAGE_DEFINITIONS[stage];
  if (!k || !def) return k;
  const most = CLOUD_SPAN * 2 * Math.min(def.halfX, def.halfZ);
  return k.scale <= most ? k : { ...k, scale: most };
}

/** The look plan, stream C: the air on each place (look/air.ts), laid from a few metres behind the fight - each
 *  layer of the distance paler and bluer than the one before - where three's linear fog, eased in from 22-30 m, had
 *  laid 3% of its colour on scenery 50 m out. Per stage, outside the tuned presets,
 *  as the clouds are: the objective modes' places (spread from the harbour's look) and the rifts have none, and nor
 *  has the Proving Hall, whose own fog (10-80 m) is already the air of a room 25 m long. The fighters take about a
 *  third of it, so a fighter in the lens's reach is untouched. */
export const AIR: Partial<Record<StageId, AirLook>> = {
  // Dusk over the court: a blue-lavender air on its walls and the distance, warm on the sun's
  // side; the far fade keeps the painted horizon's orange.
  'ash-colosseum': { start: 16, half: 120, most: .8, color: 0x9ca8c8, base: 0, height: 26, desaturate: .1, sun: { color: 0xe89a78, amount: .6, power: 5 }, fighters: .35 },
  'sunward-summit': { start: 16, half: 110, most: .85, color: 0xa8cce8, base: -6, height: 50, desaturate: .05, fighters: .35 },
  // A ring in a stadium: the crowd 20-30 m off keeps its colours; the air is on the palace and the hills beyond.
  // (Round 2 of the stages: as light as tests/air.test.ts lets it be - at .7 it laid a milky veil on the hall and the
  // stands 30-50 m off.)
  'sunfall-arena': { start: 25, half: 115, most: .56, color: 0xc4dcf0, fighters: .35 },
  'wreckers-causeway': { start: 38, half: 88, most: .72, color: 0x9cc8f0, base: 0, height: 45, desaturate: .03, fighters: .35 },
  'ashfall-weir': { start: 16, half: 110, most: .75, color: 0xa890b0, base: 0, height: 18, sun: { color: 0xffb070, amount: .7, power: 4 }, fighters: .35 },
  'hollowmere-quarry': { start: 14, half: 90, most: .8, color: 0xa8bcd0, desaturate: .1, sun: { color: 0xf2e4cc, amount: .4, power: 5 }, fighters: .35 },
  'mirror-mere': { start: 16, half: 110, most: .6, color: 0x4a0e14, desaturate: .05, fighters: .3 },
  // The blast's dust hanging in the crater: tan on the wall and the rim, the faces in it.
  // Round 2: thinner and warmer (was most .34 in a blue-grey 0x98a4b4 from 50 m): the grey air washed the wall and the sky
  // into one pale band; the crater stands sharp under a clear sky after the blast, the dust low on the floor.
  'starfall-crater': { start: 60, half: 420, most: .26, color: 0xb4a890, base: 0, height: 60, desaturate: .04, sun: { color: 0xf8e4c4, amount: .3, power: 4 }, fighters: .3 },
  'dry-harbour': { start: 90, half: 500, most: .24, color: 0xa8cbea, desaturate: .02, sun: { color: 0xf6ecd8, amount: .3, power: 5 }, fighters: .3 },
  'thornwood-ward': { start: 18, half: 100, most: .85, color: 0x182234, base: 0, height: 46, desaturate: .16, fighters: .3 },
  // The hall's amber haze: the near buildings keep their lights, the far ones sink into gold - round 2 a lighter
  // amber (was 0x3a2214), toward the painted sky's haze behind them.
  // From 26 m now (it was 50): the walls 46 m off a step back into the haze behind the fight; a lighter amber, thicker
  // sooner (half by 80 m), so what stands beyond dissolves into a glow, not into black silhouettes.
  'kuroyuki-hall': { start: 26, half: 80, most: .9, color: 0x7a4a20, desaturate: .16, fighters: .25 },
  'scrap-pit': { start: 16, half: 55, most: .55, color: 0x2a2a46, base: 0, height: 34, desaturate: .25, fighters: .15 },
};

/** The look plan, stream C: the leaves' dappled light on the green places (lightCookie.ts lookLeaves) -
 *  soft sun patches in a deep green shade, the canopy mostly out of frame overhead. Per stage, as the
 *  clouds are. Where the canopy has spots they are in its own plane: the ground they shade lies off them away from the
 *  sun, by the canopy's height over the sun's. */
export const LEAVES: Partial<Record<StageId, LeafShadowLook>> = {
  // The field under the evening's trees: sun patches all over it.
  'ash-colosseum': { size: 3.5, cover: .44, soft: .08, floor: .1, height: 8, sway: .3, wind: [.12, .08], fighters: .2 },
  'sunward-summit': { size: 2.2, cover: .5, soft: .07, floor: .3, height: 9, sway: .25, wind: [.1, .05],
    spots: [[-28, 22, 8], [28, 22, 8], [-22, 34, 8], [22, 34, 8], [0, 36, 5]], fighters: .2 },
  'ashfall-weir': { size: 3, cover: .5, soft: .08, floor: .3, height: 7, sway: .3, wind: [.08, .12],
    spots: [[-20.8, -11.5, 5, 80], [9.2, -11.5, 5, 80]], fighters: .2 },
};

const SHADE: Partial<Record<StageId, Override>> = {
  // The field under the evening's trees: sun patches warm and bright through the leaves (LEAVES), in a sun a little
  // less orange so the grass keeps its green in it; a deep teal-green shade that keeps its colour (the preset's grade
  // takes 55% of the darks' saturation, and the field's shade read grey); the grass's green from below.
  'ash-colosseum': look => {
    look.key = { ...look.key, color: 0xffc490, intensity: 6.5 };
    look.room = { albedo: .82, key: 1.25 };
    look.hemi = { ...look.hemi, ground: 0x4a7a2a, intensity: .45 };
    look.ibl = .16;
    look.sky = { ...look.sky, zenith: 0x2a8078, horizon: 0xd8a070, ground: 0x3a6a2a };
    look.grade = { ...look.grade, shadowTint: 0x1a7060, split: .4, shadowDesat: .3, contrast: 1.26 };
  },
  'sunward-summit': look => {
    look.key = { ...look.key, color: 0xffe8c8, intensity: 5.3 };
    look.hemi = { ...look.hemi, ground: 0xb8c0d0, intensity: .5 };
    look.ibl = .26;
    look.sky = { ...look.sky, zenith: 0x1e6a9a };
    look.grade = { ...look.grade, shadowTint: 0x1e6a8a, split: .3, contrast: 1.22 };
    look.exposure = .9;
  },
  // The Sunfall Arena's noon (its painted dome is the sky you see, so its colour stays): a warmer sun, a deeper shade
  // under the stands, the ring's stone from below, denser clouds.
  'sunfall-arena': look => {
    look.key = { ...look.key, color: 0xffe6c4, intensity: 5.45 };
    look.hemi = { ...look.hemi, ground: 0x8a96a8, intensity: .4 };
    look.ibl = .2;
    look.grade = { ...look.grade, contrast: 1.26 };
  },
  'wreckers-causeway': look => {
    look.hemi = { ...look.hemi, intensity: .5 };
    look.ibl = .3;
    look.grade = { ...look.grade, split: .16, contrast: 1.16, vignette: .12 };
    look.exposure = 1;
    look.albedo = { saturation: 1.25, tint: look.albedo?.tint ?? 0xffffff };
  },
  'ashfall-weir': look => {
    look.hemi = { ...look.hemi, ground: 0x4a3e66, intensity: .78 };
    look.ibl = .38;
  },
  'hollowmere-quarry': look => {
    look.hemi = { ...look.hemi, ground: 0x6a5a4a, intensity: .52 };
    look.ibl = .3;
    look.grade = { ...look.grade, contrast: 1.2 };
  },
};

function keepFighters(look: LookPreset, shade: Override) {
  const linear = (c: number) => Math.pow(c / 255, 2.2);
  const skyLight = (h: LookPreset['hemi']) => h.intensity * (.2126 * linear((h.sky >> 16) & 255) + .7152 * linear((h.sky >> 8) & 255) + .0722 * linear(h.sky & 255));
  const before = skyLight(look.hemi);
  shade(look);
  look.toon.ambient *= before / Math.max(skyLight(look.hemi), 1e-3);
}

/** The look a stage is drawn with, after the pass. Copied, never mutated in
 *  place: the tuned tables stay the source. */
export function roanLook(stage: StageId, base: LookPreset): LookPreset {
  if (!enabled) return base;
  const look: LookPreset = { ...base, key: { ...base.key }, hemi: { ...base.hemi }, fill: { ...base.fill }, rim: { ...base.rim }, toon: { ...base.toon }, fog: { ...base.fog }, grade: { ...base.grade }, atmosphere: { ...base.atmosphere }, bloom: { ...base.bloom } };
  look.toon.key = Math.max(base.toon.key ?? 1, FIGHTER.key);
  look.toon.neutral = Math.min(base.toon.neutral ?? 0, FIGHTER.neutral);
  look.toon.clip = FIGHTER.clip;
  look.toon.ambient = base.toon.ambient * FIGHTER.ambient;
  look.toon.saturation = FIGHTER.saturation;
  STAGES[stage]?.(look);
  const shade = SHADE[stage];
  if (shade) keepFighters(look, shade);
  look.cloudShadows = cloudsFor(stage);
  look.air = AIR[stage];
  look.leaves = LEAVES[stage];
  return look;
}
