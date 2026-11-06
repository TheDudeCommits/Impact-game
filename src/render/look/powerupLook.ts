import * as THREE from 'three';
import type { StageId } from '../../game/stages';
import type { FinishLook, LookPreset, RigLook } from './stageLooks';

export interface SparkProfile {
  /** The outline at 1080p (px), and how much of the cloth's own colour its ink takes (0 black .. 1 the cloth's deepest). */
  ink: { px: number; tint: number };
  /** the cel flattening, painted ink and crease lines, each 0 (off) .. 1 (as they were). */
  cel: { flat: number; ink: number; crease: number };
  /** The cel ramp: the terminator's softness; how much of the shade is the cloth's own colour deepened rather than the
   *  look's cool tint (0..1); how deep that shade is (of the lit colour); how much richer (an exponent on the hue). */
  shade: { soft: number; anime: number; depth: number; richness: number };
  /** Highlights: a sheen on the lit side (strength, and sharpness 0 broad .. 1 a point), and the hair's ring (a multiple). */
  spec: { sheen: number; sharp: number; hair: number };
  /** The stage's own edge rim: its width at 1080p (px), its brightest channel, and the broad fresnel wash's share. */
  rim: { px: number; peak: number; wash: number };
}

export const SPARK: SparkProfile = {
  ink: { px: 1.7, tint: .6 }, cel: { flat: .6, ink: .3, crease: 0 },
  shade: { soft: .022, anime: .85, depth: .56, richness: 1.45 },
  spec: { sheen: .5, sharp: .6, hair: 2.2 }, rim: { px: 2.6, peak: 1, wash: .4 },
};

/** The rig over every stage; the rims' and fill's colours lean on the stage's own (see powerupLook). */
const RIG: Omit<RigLook, 'warm' | 'cool' | 'fillColor'> = {
  key: .55, fill: .6, shadow: .6, warmStrength: 1.05, coolStrength: .85, px: 3.2, fillStrength: .3, shade: .55, shadeSaturation: 1.3,
};
/** The frame's finish over every stage; the haze takes the stage's own air. */
const FINISH: Omit<FinishLook, 'haze'> & { haze: Omit<FinishLook['haze'], 'color'> } = {
  diffusion: { threshold: .9, knee: .55, radius: .8, strength: .32 },
  curve: .55, shadow: 0xc9c3ff, lift: 0x2c2266, liftStrength: .18, warm: 0xfff6e6, vibrance: .35,
  grain: .03, fringe: 1.2, vignette: .24, wrap: .5,
  haze: { most: .25, range: 60 },
  ground: .12,
};

const mixHex = (a: number, b: number, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();

/** DEV only (GameRenderer's `__look.finish`): the whole anime finish off and on, on the running stage, so one held frame
 *  is drawn both ways from pixel-identical poses. A shipped build always draws it. */
let finishOn = true;
export function setAnimeFinish(on: boolean) { finishOn = on; }
export const animeFinishOn = () => finishOn;
export const sparkProfile = (): SparkProfile | undefined => finishOn ? SPARK : undefined;

/** A stage's look under the anime finish: the fighters' ramp, rim and rig, the ground, the grade and the compositing.
 *  The fighters' ink, cel passes, shade, sheen and wash ride on uniforms set with the look (toonShading.setToonLook). */
export function powerupLook(stage: StageId, base: LookPreset): LookPreset {
  if (!finishOn) return base;
  void stage;
  const p = SPARK;
  const look: LookPreset = { ...base, rim: { ...base.rim }, toon: { ...base.toon }, grade: { ...base.grade }, bloom: { ...base.bloom } };
  look.toon.soft = p.shade.soft;
  look.rim.px = p.rim.px; look.rim.peak = p.rim.peak;
  look.grade.saturation *= 1.04;
  look.grade.vignette *= .5;
  look.grade.sharpen = .3;
  // The bloom's pyramid carries the diffusion glow too: its threshold lowered to the bright half of the frame, so a lit
  // wall and the sky glow softly, and its own (linear) strength eased - the glow is mostly the final pass's screen.
  look.bloom = { strength: base.bloom.strength * .7, radius: Math.max(base.bloom.radius, FINISH.diffusion.radius), threshold: FINISH.diffusion.threshold, knee: FINISH.diffusion.knee };
  look.rig = {
    ...RIG,
    warm: mixHex(base.key.color, 0xffb36b, .55),
    cool: mixHex(base.hemi.sky, 0x7fb0ff, .6),
    fillColor: mixHex(base.fill.color, 0x6d7fd0, .6),
  };
  look.finish = { ...FINISH, ...base.finishTint, ground: base.finishGround ?? FINISH.ground, haze: { ...FINISH.haze, color: mixHex(base.fog.color, base.sky.horizon, .5) } };
  return look;
}
