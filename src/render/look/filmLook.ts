import * as THREE from 'three';
import type { StageId } from '../../game/stages';
import type { LookPreset, Vec3 } from './stageLooks';
import type { SparkProfile } from './powerupLook';

/**
 * THE FILM LOOK: Impact drawn as a 1980s-90s cel feature on a well-kept print, the game's default look: light on every
 * device, and steady - no flicker, no scratches.
 *
 * A late-1980s cel production made its picture this way: flat cels and painted backgrounds; ink traced from them, bold on
 * the figures, thin and steady on the set; effects laid on top; then the film stage photographed it. Here that picture is
 * one switch over Impact's own (every stage, fighter and effect stays Impact's):
 *  - the colour script: `filmLook` turns each stage's own colours part of the way to a warm dusk;
 *  - the cels: `FILM_SPARK` (the fighters' line, shade and sheen) and the boil (`filmUniforms`, read by the toon
 *    terminator and the ink hull in toonShading.ts);
 *  - the painted set: look/filmPaint.ts (the stage re-painted as gouache under crisp bodies and effects);
 *  - the set's ink and the film stage: blocks of LookPost.ts's final pass under `uReel` (FILM below): halation, a soft
 *    print, grain; no flicker, weave, dust or scratches;
 *  - the painted far view: render/look/filmFarView.ts (painted ranges and cloud towers, public/assets/film-far);
 *  - the sakuga moments: FILM_IMPACT, the painted knockout (look/filmFreeze.ts), drawings twelve a second
 *    (look/filmDrawings.ts) and effects on twos (EFFECT_DRAWINGS).
 * OPTIONS / pause: ART STYLE (`Settings.artStyle`: 'film', the default, or 'modern', Impact's look before it), applied by
 * GameRenderer.applySettings. `?style=modern` and `?style=film` pick one for a visit, over the
 * setting. Each quality draws as much of it as it can afford (GameRenderer.applySettings:
 * HIGH all of it, MEDIUM a smaller painting, LOW no painting, no set ink and no diffusion).
 */
const asked = (() => {
  try { const q = new URLSearchParams(location.search).get('style'); return q === 'film' ? true : q === 'modern' ? false : null; }
  catch { return null; }
})();

// Off until the game's boot applies the ART STYLE (main.ts, before the renderer is made; the setting's default is the film
// look): a page or a test that does not run the game's boot draws the modern look unless it asks for this one.
let on = asked ?? false;
const listeners = new Set<(on: boolean) => void>();
export const filmOn = () => on;
/** The ART STYLE setting's answer (config.ts Settings.artStyle): The film look unless the player chose the modern one; a
 *  `?style=` on the link wins for that visit. */
export const filmLookFor = (artStyle: string | undefined) => asked ?? artStyle !== 'modern';
/** Turn the look on or off; listeners (the renderer) follow at once. */
export function setFilmLook(next: boolean) {
  if (next === on) return;
  on = next;
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('film-look', on);
  for (const listener of listeners) listener(on);
}
export function onFilmLook(listener: (on: boolean) => void) { listeners.add(listener); return () => listeners.delete(listener); }
/** Impact's effects refined with the look (toned down and drawn the way a TV anime's effects are): its hits are a short white-hot needle star in the technique's own
 *  colour, hairline bolts and one clean swept arc, a pinch of sparks, and nothing left on the floor - no rubble, no dirt,
 *  no dust columns, no ink splats, no full-screen flashes. vfx/VfxKit.ts refinedSpark and refinedGround, Debris,
 *  GroundMarks, Afterimages, StrikeTrails and the effects' levels (vfxLevel.ts REFINED_VFX) read it. On with the look. */
export const REFINE_EFFECTS = true;
export const refinedVfx = () => REFINE_EFFECTS && on;
if (typeof document !== 'undefined') document.documentElement.classList.toggle('film-look', on);

/** The boil, shared by every toon material and ink hull (toonShading.ts): x the shadow edge's wobble (N.L units, 0 off),
 *  y the animation step (twelve a second: the edge and the line are re-drawn only when it changes), z the line's
 *  pressure range (0 off: the hull's width as it was). */
export const filmUniforms = {
  uReelBoil: { value: new THREE.Vector4(0, 0, 0, 0) },
};

/** The film stage and the set's ink (sizes in px at 1080p): a theatrical 1980s-90s print seen today - a soft, clumped grain living in the mids and faintly coloured, a softer print (the
 *  diffusion and the telecine's colour bleed), a wide red-orange halation round everything bright, deeper corners and a
 *  cool base under the blacks. No flicker, no breathing of the print, no weave or drift of the gate, no dust and no
 *  scratches: the picture holds still, only its grain moves. */
export const FILM = {
  halation: 1.1, halationTint: [1, .34, .12] as [number, number, number], bloom: .52,
  diffusion: .24, grain: .07, chroma: 1.3, bleed: 1.2, vignette: .45,
  blackLift: .035, saturation: 1.06, contrast: 1.1,
  shadowTone: [.92, .98, 1.08] as [number, number, number], highlightTone: [1.07, 1, .87] as [number, number, number],
  /** The set's line: its radius (px at 1080p) and strength. */
  envLine: 1, envInk: .6,
  /** The grain's clump (px at 1080p) and its colour share. */
  grainSize: 1.6, grainColor: .35,
  /** The colour the blacks lift toward (cool, so a navy gi stays navy). */
  liftTint: [.88, .92, 1] as [number, number, number],
};

/** The colour script's numbers (filmLook below), in one place so a probe can turn them in play
 *  (`__look.filmTune({ look: { ... } })`, GameRenderer). v2: the bodies in clear light - their own colours kept (a blue
 *  gi stays blue under the warm sun, a white jacket white), one hard shade and a thin warm rim off the set - and the set
 *  painted a step behind them, a little paler and less saturated, so the cels read off the painting (the first
 *  prototype's warm sun had turned both to one orange). */
export const LOOK = (() => {
  const v1 = {
    keyColor: 0xffd4aa, keyGain: 1.02, elevation: .56, hemiSky: 0x9e92d4, hemiGround: 0x9a7866, hemiGain: 1.2,
    fill: 0x8a80d8, fillGain: 1.15, shade: 0xa494d8, celNeutral: .2, celSaturation: 1.04, celKey: 0,
    rigKey: .85, rigFill: .55, rigShadow: .6, rimWarm: .2, rimCool: .15, rigShade: .7, rigShadeSaturation: 1.12,
    setTint: 0xfff0e2, setSaturation: 1, setKey: 1.12, gradeSaturation: 1.08, gradeContrast: 1.12,
    bloomThreshold: .95, bloomStrength: .42, haze: .3,
    /** The set's image light: its strength (of the stage's), and the cooler sky it is taken from in place of the one
     *  on screen (`envCool` 0 the painted sky as shown, 1 this one): warm light and cool shade, as a background painter
     *  mixes them - the dusk sky's peach horizon, taken as the set's ambient, had turned every stone orange. */
    iblGain: .8, envCool: 0, envZenith: 0x5c6cb0, envHorizon: 0xb4aacb, envGround: 0x6c6478,
    /** The sun's edge on the bodies: the look's own rim (a multiple of the stage's strength) and its width (px at 1080p). */
    rimGain: .3, rimPx: .8, rigPx: 1.4,
    /** How far each place's own colours are turned to the look's dusk (1 = replaced). */
    dusk: 1,
  };
  // `?dusk=0..1`: how far each place's own colours are turned to the look's dusk, for comparing.
  const asked = (() => { try { const q = new URLSearchParams(location.search).get('dusk'); return q === null ? NaN : Number(q); } catch { return NaN; } })();
  return {
    ...v1,
    keyColor: 0xffdcb8, keyGain: 1.05, iblGain: .9, setKey: 1.05, hemiGround: 0x8f7a74, envCool: .6, dusk: .45, hemiGain: 1.1,
    rimGain: 1.1, rimPx: 1.8, rigPx: 2.4, haze: .12,
    ...(asked >= 0 && asked <= 1 ? { dusk: asked } : {}),
    shade: 0xab9fdc, celNeutral: .8, celSaturation: 1.12,
    rigKey: .9, rigShadow: .35, rimWarm: 1.2, rimCool: .6, rigShade: .35,
    setTint: 0xfff4ea, setSaturation: .95,
    bloomThreshold: .85,
  };
})();

/** The film look's impact frame, held as a sakuga moment is (rare, kept for the biggest moves and the combos that finish
 *  a fight): only the biggest beats ask for one this strong (an ultimate's blow, a knockout, an awakening), never two within `rest` seconds, and it
 *  stands for two drawings (a twelfth of a second each) on light paper: the figures in ink, the set washed toward the
 *  paper (LookPost.ts). */
export const FILM_IMPACT = { min: .8, rest: 12, hold: 2 / 12, koRest: 5 };

/** The effects' drawings a second (vfx/SparkField.ts): a spark, a ring, a crescent each advance in drawings from
 *  their own first frame, as an effects animator drew them on twos (the bodies are posed twelve times a second too,
 *  filmDrawings.ts); `?fxdrawings=0` smooth, as the game draws them. */
export const EFFECT_DRAWINGS = (() => { try { const q = new URLSearchParams(location.search).get('fxdrawings'); if (q !== null) return Math.max(0, Number(q) || 0); } catch { /* no page */ } return 12; })();

/** The fighters as cels: a bold line in a dark shade of what it rings (an "iro trace"), the painted rips
 *  flattened toward flat colour, one hard shadow shape a little way into the lit side (its threshold 0.16), the shade
 *  a deepened, cooled version of the cloth's own colour, no sheen and no rim. */
export const FILM_SPARK: SparkProfile = {
  ink: { px: 2.5, tint: .55 }, cel: { flat: 1, ink: .4, crease: .3 },
  shade: { soft: .006, anime: .9, depth: .58, richness: 1.25 },
  spec: { sheen: 0, sharp: .5, hair: 1.6 }, rim: { px: 1.2, peak: .7, wash: 0 },
};

/** The sky the set's image light is taken from (GameRenderer.refreshEnvironment): the look's own, with LOOK's cooler
 *  colours `envCool` of the way in. */
export function filmEnvLook(look: LookPreset): LookPreset | null {
  const k = LOOK.envCool; if (!(k > 0)) return null;
  const mix = (a: number, b: number) => new THREE.Color(a).lerp(new THREE.Color(b), k).getHex();
  const sky = look.sky;
  return { ...look, sky: { ...sky, zenith: mix(sky.zenith, LOOK.envZenith), horizon: mix(sky.horizon, LOOK.envHorizon), ground: mix(sky.ground, LOOK.envGround),
    cloudLit: mix(sky.cloudLit, 0xd6cad6), cloudShade: mix(sky.cloudShade, 0x8a82aa), sunColor: mix(sky.sunColor, 0xfff0e0) } };
}

const _ca = new THREE.Color(), _cb = new THREE.Color();
const sun = (base: Vec3, elevation: number): Vec3 => {
  const flat = Math.hypot(base[0], base[2]) || 1, c = Math.sqrt(1 - elevation * elevation);
  return [base[0] / flat * c, elevation, base[2] / flat * c];
};

/** A stage's look at the film look's dusk. The key keeps the side the stage's own sun is on (its shadows fall where they
 *  did) and drops to about 34 degrees, warm (lower, the stands' and halls' long shadows took the whole ring); the shade
 *  goes lilac; the sky deep blue over mauve to peach, with peach and violet cel clouds; the grade is left nearly neutral,
 *  since the film stage prints the colour. */
export function filmLook(stage: StageId, base: LookPreset): LookPreset {
  void stage;
  const L = LOOK, k = L.dusk;
  // Each place keeps its own light, shade, air and sky, turned `dusk` of the way to the look's dusk (replaced outright,
  // they suited the Drifting Isle and washed every other place into one mauve: the Proving Hall's gold, the Zenith
  // Coliseum's blue stone, the Mirror Mere's night). The cels, the paint, the film and the sakuga moments are the
  // style; the colours stay the place's.
  const mix = (a: number, b: number, t = k) => _ca.setHex(a).lerp(_cb.setHex(b), t).getHex();
  const lerp = (a: number, b: number, t = k) => a + (b - a) * t;
  const d = base.key.dir, elevation = d[1] / (Math.hypot(d[0], d[1], d[2]) || 1);
  const keyDir = sun(base.key.dir, lerp(elevation, L.elevation));
  const s = base.sky, g = base.grade;
  return {
    ...base,
    key: { color: mix(base.key.color, L.keyColor), intensity: base.key.intensity * L.keyGain, dir: keyDir },
    hemi: { sky: mix(base.hemi.sky, L.hemiSky), ground: mix(base.hemi.ground, L.hemiGround), intensity: base.hemi.intensity * L.hemiGain },
    fill: { color: mix(base.fill.color, L.fill), intensity: base.fill.intensity * L.fillGain, dir: base.fill.dir },
    rim: { ...base.rim, color: mix(base.rim.color, 0xffcf9e, .6), strength: base.rim.strength * L.rimGain, dir: keyDir, px: L.rimPx, peak: .55 },
    toon: {
      ...base.toon, shadow: mix(base.toon.shadow, L.shade), mid: mix(base.toon.mid, 0xff9466), midStrength: lerp(base.toon.midStrength, .1),
      edge: .08, soft: .006, ink: 0x1e0f16, floor: mix(base.toon.floor ?? 0x3a3052, 0x3a3052),
      neutral: L.celNeutral, saturation: L.celSaturation, ...(L.celKey > 0 ? { key: L.celKey } : {}),
    },
    fog: { color: mix(base.fog.color, 0xe3a69e), near: base.fog.near, far: base.fog.far },
    sky: {
      ...s,
      zenith: mix(s.zenith, 0x2f3f86), horizon: mix(s.horizon, 0xffb27a), ground: mix(s.ground, 0x5c4262), horizonHeight: lerp(s.horizonHeight ?? .5, .55),
      sunColor: mix(s.sunColor, 0xffd29a), sunIntensity: lerp(s.sunIntensity, 8), sunSize: lerp(s.sunSize, .045), sunGlow: lerp(s.sunGlow, 1.4), sunGlowWidth: lerp(s.sunGlowWidth, 3.5),
      cloudCoverage: lerp(s.cloudCoverage, .36), cloudLit: mix(s.cloudLit, 0xffb08c), cloudShade: mix(s.cloudShade, 0x7d5f9e), cloudRim: mix(s.cloudRim, 0xffe6c8),
      cloudScale: lerp(s.cloudScale ?? 1.5, 1.5), cloudSpeed: lerp(s.cloudSpeed ?? .003, .003),
    },
    ibl: base.ibl * L.iblGain,
    grade: {
      ...g, toe: lerp(g.toe ?? .5, .5),
      saturation: lerp(g.saturation, L.gradeSaturation), contrast: lerp(g.contrast, L.gradeContrast),
      shadowTint: mix(g.shadowTint, 0x4a3c80), highlightTint: mix(g.highlightTint, 0xffd8a8), split: lerp(g.split, .08), shadowDesat: lerp(g.shadowDesat ?? 0, .2),
      vignette: 0, sharpen: 0,
    },
    bloom: { strength: lerp(base.bloom.strength, L.bloomStrength), radius: lerp(base.bloom.radius, .62), threshold: lerp(base.bloom.threshold, L.bloomThreshold), knee: lerp(base.bloom.knee, .45) },
    atmosphere: { ...base.atmosphere, count: Math.round(base.atmosphere.count * .35), color: mix(base.atmosphere.color, 0xffd9b0), color2: mix(base.atmosphere.color2, 0xfff0dc), shafts: undefined },
    // The set painted: its own colours kept, warmed a little, as gouache under a dusk sun.
    albedo: { saturation: (base.albedo?.saturation ?? 1) * L.setSaturation, tint: mix(base.albedo?.tint ?? 0xffffff, L.setTint) },
    room: { albedo: base.room?.albedo ?? 1, key: Math.max(.85, base.room?.key ?? 1) * L.setKey },
    // The fighters lit from the lens's side (a cel body's own key, turned with the camera: most of a body in its lit
    // tone), a warm rim of the sun.
    rig: { key: L.rigKey, fill: L.rigFill, shadow: L.rigShadow, warm: 0xffb070, warmStrength: L.rimWarm, cool: 0x8f86e0, coolStrength: L.rimCool, px: L.rigPx,
      fillColor: 0x7d74d0, fillStrength: .3, shade: L.rigShade, shadeSaturation: L.rigShadeSaturation },
    // Impact's anime finish kept only for its light wrap and far air: the film stage does the glow, grain and vignette.
    finish: {
      diffusion: { threshold: .9, knee: .5, radius: .8, strength: .14 },
      curve: .18, shadow: 0xe6dcf6, lift: 0x2c2266, liftStrength: .05, warm: 0xfff2e2, vibrance: .12,
      grain: 0, fringe: 0, vignette: 0, wrap: .35, haze: { most: L.haze, color: mix(base.finish?.haze?.color ?? 0xd9a0a6, 0xd9a0a6), range: 60 }, ground: .04,
    },
    finishTint: undefined, finishGround: undefined,
  };
}
