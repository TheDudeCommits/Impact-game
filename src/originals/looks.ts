import type { StageId } from '../game/stages';
import type { LookPreset } from '../render/look/stageLooks';

type Deep<T> = { [K in keyof T]?: NonNullable<T[K]> extends readonly unknown[] ? T[K] : NonNullable<T[K]> extends object ? Deep<NonNullable<T[K]>> : T[K] };
export type LookChange = Deep<LookPreset>;

export const LOOK_CHANGES: Partial<Record<StageId, LookChange>> = {
  'rift-war': {
    fog: { color: 0x7c6270, near: 150, far: 640 },
    atmosphere: { kind: 'dust', count: 60, color: 0xc8a8e8, color2: 0x8a6ab8, size: .022 },
  },
  'kuroyuki-hall': {
    finish: { haze: { color: 0x2a1c1a } },
    key: { color: 0xffcc94, intensity: 4.4, dir: [-.12, .78, -.6] },
    hemi: { sky: 0x4a3c48, ground: 0x2a1c16, intensity: 1.35 },
    fill: { color: 0x8a9ad8, intensity: .5, dir: [.3, .4, .86] },
    rim: { color: 0xffb468, strength: 2.8, dir: [0, .4, -.92] },
    toon: { shadow: 0x9c8ca8, mid: 0xffa860, midStrength: .28, floor: 0x3a2a30 },
    fog: { color: 0x1c1416, near: 70, far: 640 },
    sky: { zenith: 0x050406, horizon: 0x2c1c1a, ground: 0x0a0808, sunIntensity: 0, sunGlow: 0, cloudLit: 0x6a3a28, cloudShade: 0x1a1214, cloudRim: 0xffb070, stars: 0, nebula: 0 },
    ibl: .35,
    exposure: 1.42,
    grade: { lift: [.01, .008, .008], gain: [1.02, 1, .97], saturation: 1.1, contrast: 1.14, shadowTint: 0x1c1a30, highlightTint: 0xffe8c8, split: .22, vignette: .2, vignetteColor: 0x0a0606 },
    bloom: { strength: .75 },
    atmosphere: { kind: 'none', count: 0 },
    albedo: { saturation: .95, tint: 0xfff4ec },
    finishTint: { shadow: 0xc4acb4, lift: 0x0e0a0a, warm: 0xfff0e0 },
    room: { albedo: 1.08, key: .8 },
    air: { start: 40, half: 260, most: .5, color: 0x281c1c, base: -60, height: 160, desaturate: .2 },
  },
  'sunfall-arena': {
    key: { color: 0xffe2bc, intensity: 4.9 },
    hemi: { sky: 0xa8a0d0, ground: 0xc8a080, intensity: .8 },
    fill: { color: 0x8a9ae8, intensity: .42 },
    rim: { color: 0xffd498, strength: 2.2 },
    toon: { shadow: 0xb0a8d8, mid: 0xffa060, midStrength: .3 },
    fog: { color: 0xc8a094 },
    sky: { zenith: 0x3a2c6a, horizon: 0xffb070, ground: 0x8a5a48, sunColor: 0xffc080, cloudLit: 0xffc8a0, cloudShade: 0x7a5a8a, cloudRim: 0xffe0b0, cloudCoverage: .25 },
    grade: { saturation: 1.1, shadowTint: 0x3a3a7a, highlightTint: 0xffe8cc, vignetteColor: 0x180c14 },
    atmosphere: { kind: 'dust', count: 120, color: 0xe8b880, color2: 0xffd8a0, size: .05 },
    albedo: { saturation: 1.04, tint: 0xfff8f2 },
  },
  'cinder-flats': {
    finish: { haze: { color: 0x3a1410 } },
    key: { color: 0xffbc84, intensity: 4.8, dir: [-.1, .66, -.74] },
    hemi: { sky: 0x6a2c26, ground: 0x2a1612, intensity: 1.3 },
    fill: { color: 0x9a70d0, intensity: .45, dir: [.3, .4, .86] },
    rim: { color: 0xff8a40, strength: 2.8, dir: [0, .35, -.94] },
    toon: { shadow: 0xa48eac, mid: 0xff9a58, midStrength: .28, floor: 0x3a2a30 },
    fog: { color: 0x3a1612 },
    sky: { zenith: 0x120606, horizon: 0x8a2a14, ground: 0x1a0a08, sunIntensity: 0, sunGlow: 0, cloudLit: 0xc84a20, cloudShade: 0x2a0e0a, cloudRim: 0xff9a50, stars: 0, nebula: 0 },
    exposure: 1.34,
    grade: { saturation: 1.1, contrast: 1.14, shadowTint: 0x2a1426, highlightTint: 0xffdcb4, split: .2, vignette: .2, vignetteColor: 0x0c0404 },
    bloom: { strength: .72 },
    atmosphere: { kind: 'embers', count: 140, color: 0xff7a2a, color2: 0xffc060, size: .024 },
    room: { albedo: 1.12, key: .9 },
  },
  'mirror-mere': {
    finish: { haze: { color: 0x1e1a44 } },
    key: { color: 0xe4dcff, intensity: 4.4, dir: [.38, .72, .58] },
    hemi: { sky: 0x5c58b8, ground: 0x1c1a34, intensity: 1.45 },
    fill: { color: 0xa486ff, intensity: .6, dir: [0, .3, -.95] },
    rim: { color: 0xcab4ff, strength: 3, dir: [0, .34, -.94] },
    toon: { shadow: 0x8c86cc, mid: 0xcaa8ff, midStrength: .22, floor: 0x2c2a54 },
    fog: { color: 0x1c1a3c },
    sky: { zenith: 0x080820, horizon: 0x40306e, ground: 0x0c0a1a, sunIntensity: 0, sunGlow: 0, sunColor: 0xd8c8ff, cloudLit: 0x6a5aa8, cloudShade: 0x16142c, cloudRim: 0xc8b8ff, stars: .8, nebula: 0 },
    room: { albedo: 1.12, key: .62 },
    exposure: 1.42,
    grade: { saturation: 1.12, contrast: 1.12, shadowTint: 0x1c1a4a, highlightTint: 0xf0e8ff, split: .22, vignette: .2, vignetteColor: 0x04040e },
    bloom: { strength: .72 },
    atmosphere: { kind: 'sparkles', count: 80, color: 0xd4c4ff, color2: 0x9a80ff, size: .022 },
    albedo: { saturation: 1, tint: 0xf2f0ff },
    air: { color: 0x2a161a },
  },
  'ash-colosseum': {
    finish: { haze: { color: 0x54484a } },
    key: { color: 0xffd4b0, intensity: 5.0, dir: [-.37, .42, .83] },
    hemi: { sky: 0x8a6a6e, ground: 0x5a6a3a, intensity: 1.12 },
    fill: { color: 0xc87a68, intensity: .4 },
    rim: { color: 0xffb070, strength: 2.4 },
    toon: { shadow: 0xb0a0c0, mid: 0xffb088, midStrength: .24, ambient: 2.6, neutral: .6 },
    fog: { color: 0x3a2020 },
    sky: { zenith: 0x1a0c10, horizon: 0xb03a20, ground: 0x2a1614, sunColor: 0xff8a40, cloudLit: 0xff8a50, cloudShade: 0x3a2024, cloudRim: 0xffb070, stars: 0, nebula: 0 },
    exposure: 1.2,
    grade: { saturation: 1.06, contrast: 1.2, shadowTint: 0x2a4a5a, highlightTint: 0xfff0e0, vignette: .26, vignetteColor: 0x120808 },
    atmosphere: { kind: 'embers', count: 200, color: 0xff6a2a, color2: 0xffb050, size: .03 },
    bloom: { strength: .42 },
    albedo: { saturation: 1.0, tint: 0xfff0e6 },
    room: { albedo: 1.0, key: .9 },
    // The air the ash cloud's dark wine, orange toward the mountain, where it laid a pale blue-lavender (its depth kept).
    air: { color: 0x5a2a28, desaturate: .05, sun: { color: 0xc04a20, amount: .22, power: 4 } },
  },
  'starfall-crater': {
    finish: { haze: { color: 0x2c2850 } },
    key: { color: 0xd6d4ff, intensity: 4.4 },
    hemi: { sky: 0x5c5aac, ground: 0x2a2834, intensity: 1.1 },
    fill: { color: 0x60e8b8, intensity: .5, dir: [0, .3, -.95] },
    rim: { color: 0x88ffd8, strength: 2.6, dir: [0, .35, -.94] },
    toon: { shadow: 0x8c8ccc, mid: 0xc8b0ff, midStrength: .22, floor: 0x2c2a50 },
    fog: { color: 0x24223e },
    sky: { zenith: 0x0a0a24, horizon: 0x5a4a9a, ground: 0x141224, sunIntensity: 0, sunGlow: 0, cloudLit: 0x6a6aa8, cloudShade: 0x1c1a30, cloudRim: 0xa0ffe0, cloudCoverage: .3, stars: .6, nebula: 0 },
    exposure: 1.22,
    grade: { saturation: 1.1, contrast: 1.12, shadowTint: 0x1c1a4a, highlightTint: 0xe0fff0, vignette: .18, vignetteColor: 0x04040e },
    bloom: { strength: .72 },
    atmosphere: { kind: 'sparkles', count: 80, color: 0x90ffd8, color2: 0xc8b8ff, size: .022 },
    albedo: { saturation: 1, tint: 0xf4f4ff },
    // The crater's pale ash and sandstone (polish3's afternoon) taken down to a twilight's: the room darker, the fighters not.
    room: { albedo: .78, key: .8 },
  },
  'drifting-isle': {
    finish: { haze: { color: 0xb4cce8 } },
    key: { color: 0xfff4e0, intensity: 4.6 },
    hemi: { sky: 0xa8c8f0, ground: 0x8a9a6a, intensity: .8 },
    fill: { color: 0xb0c8f0, intensity: .32 },
    rim: { color: 0xffffff, strength: 1.6 },
    toon: { shadow: 0xa8b8e0, mid: 0xffb878, midStrength: .28, floor: 0x44506a },
    fog: { color: 0xc8dcf0 },
    sky: { zenith: 0x2a68c8, horizon: 0xcfe4f8, ground: 0xe8eef8, sunIntensity: 16, cloudCoverage: .3, cloudLit: 0xffffff, cloudShade: 0xb8c8e4, cloudRim: 0xffffff, stars: 0, nebula: 0 },
    grade: { saturation: 1.1, shadowTint: 0x3a5aa8, highlightTint: 0xfff4e0, vignetteColor: 0x0a1428 },
    atmosphere: { kind: 'sparkles', count: 60, color: 0xffffff, color2: 0xe8ffd0, size: .02 },
  },
  'warlords-roof': {
    finish: { haze: { color: 0x2a2840 } },
    key: { color: 0xd0ccff, intensity: 4.4, dir: [.4, .7, .6] },
    hemi: { sky: 0x4c4a7c, ground: 0x2a2028, intensity: 1.35 },
    fill: { color: 0xff9a50, intensity: .6, dir: [.6, .3, -.74] },
    rim: { color: 0xffa860, strength: 2.6, dir: [.6, .35, -.72] },
    toon: { shadow: 0x8a88b8, mid: 0xffa060, midStrength: .26, floor: 0x2c2a44 },
    fog: { color: 0x22203a },
    sky: { zenith: 0x0a0a14, horizon: 0x3a3058, ground: 0x0c0a14, sunIntensity: 0, sunGlow: 0, cloudLit: 0x5a5a8a, cloudShade: 0x14121c, cloudRim: 0xb8b0ff, stars: 0, nebula: 0 },
    exposure: 1.4,
    grade: { saturation: 1.1, contrast: 1.14, shadowTint: 0x1a1a3a, highlightTint: 0xffe2c4, vignette: .2, vignetteColor: 0x06060c },
    bloom: { strength: .7 },
    atmosphere: { kind: 'none', count: 0 },
  },
  'hidden-ash': {
    finish: { haze: { color: 0x6a6466 } },
    rim: { color: 0xffa868, strength: 2.1 },
    fog: { color: 0x5a5658 },
    grade: { saturation: 1.02, contrast: 1.22, shadowTint: 0x262a32, highlightTint: 0xfff0e2, split: .16, vignette: .26, vignetteColor: 0x100c0c },
    atmosphere: { kind: 'embers', count: 160, color: 0xff7a30, color2: 0xffc060, size: .03 },
  },
  'blood-citadel': {
    finish: { haze: { color: 0x301820 } },
    key: { color: 0xd8dcf2, intensity: 3.9, dir: [.62, .58, -.4] },
    hemi: { sky: 0x8a6a86, ground: 0x3a2a32, intensity: .62 },
    fill: { color: 0xff5a64, intensity: .5, dir: [.7, .3, -.45] },
    rim: { color: 0xff7078, strength: 2.6, dir: [.7, .4, -.45] },
    toon: { shadow: 0xa68ea4 },
    fog: { color: 0x2a1018 },
    sky: { zenith: 0x10060c, horizon: 0x5a1626, ground: 0x180a10 },
    grade: { saturation: 1.12, contrast: 1.2, shadowTint: 0x2c0a1a, highlightTint: 0xffd4d4, split: .14, vignette: .26, vignetteColor: 0x140408 },
    atmosphere: { kind: 'embers', count: 140, color: 0xff4a40, color2: 0xb01a24, size: .02 },
  },
  'proving-hall': {
    hemi: { sky: 0xc8b8a8, ground: 0x7a6656, intensity: .9 },
    fill: { color: 0xa8b8ff, intensity: .32 },
    fog: { color: 0xe8d2b4 },
    exposure: 1.2,
    grade: { saturation: 1.1, shadowTint: 0x4a3a78, highlightTint: 0xffe6c0, vignette: .2, vignetteColor: 0x140c08 },
    albedo: { saturation: 1.02, tint: 0xfff8f0 },
    room: { albedo: 1.1, key: .62 },
    atmosphere: { shafts: { openings: [[-6.1, 5.3, -13.3], [6.1, 5.3, -13.3], [0, 10.1, -13.3]], width: 1.6, height: 3.8, length: 20, color: 0xffd8a0, strength: .85 } },
    cookie: { plane: -13.45, bottom: 3.1, top: 7.9, period: 12.2, offset: -6.85, duty: .123, floor: .62 },
  },
};

const plain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function merge<T>(base: T, change: Deep<T>): T {
  return mergeAny(base, change) as T;
}
function mergeAny(base: unknown, change: unknown): unknown {
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(change as Record<string, unknown>)) {
    if (v === undefined) continue;
    out[k] = plain(v) && plain(out[k]) ? mergeAny(out[k], v) : v;
  }
  return out;
}

export function originalLook(stage: StageId, look: LookPreset): LookPreset {
  const change = LOOK_CHANGES[stage];
  return change ? merge(look, change) : look;
}
