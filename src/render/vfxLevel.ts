import type { VfxLevel } from '../config';

export interface VfxProfile {
  /** The paper impact frame (GameRenderer.impactFrame): the whole picture turned to ink and paper for a frame or two -
   *  a full-screen white flash. 0: none (the hit is still its burst, its body flash and its number). */
  impactFrame: number;
  /** The colour fringe at the frame's edges on the heaviest hits (GameRenderer.chromaticPulse). */
  chroma: number;
  /** Screen-space speed lines (dashes, chases, ultimates). */
  speedLines: number;
  /** A technique's colour grade over the room (the frame drained and pushed to the move's hue). */
  grade: number;
  /** An ultimate's cinema grade (contrast, an ink vignette). */
  cinema: number;
  /** A big blow's zoom blur of the room. */
  blur: number;
  /** A power-up's night over the place. */
  powerDim: number;
  /** The bloom's glow added to the frame (the final pass's uBloomGain). */
  bloom: number;
  /** The effects kit's sprites (vfx/SparkField: hit bursts, sparks, rings, streaks, clouds, smoke): how much light they
   *  add and how much they cover (their opacity), and their size. */
  spriteGain: number;
  spriteSize: number;
  /** The shell an energy hit or an ultimate's blast throws round its point (CombatEffects' impact shell; an ultimate's
   *  is the blast's own size, and keeps it): how much of the frame behind it covers. */
  shells: number;
  /** The light an effect throws on the place and the fighters (vfx/LightPool, which the Armory's lights reach too, and
   *  the signature layers' light volumes). */
  lights: number;
  /** The struck body's flash (Fighter's hit flash): how far it goes to white and red. */
  bodyFlash: number;
  /** An awakened or powered-up fighter's aura (the awakening's flames, the ki aura): how much it covers. Never gone - it
   *  says the fighter is awakened. */
  aura: number;
  /** The emissive glow of the fighters' own technique layers (render/signature's glow and bolt batches: the LAST SUN's
   *  gathering, Kuon's, Gummy's, Gaunt', the spirits', the staged moves...) and of the VFX Armory's effects. */
  glow: number;
  /** The VFX Armory's effects' opacity, where they read the global one. */
  armoryOpacity: number;
  /** The manga lettering on the player's own exchanges (ui/MangaImpact): every word; 'big' the specials', ultimates' and
   *  finishers' words and the tags, smaller, with no ink frame round the screen; 'tags' only what a word tells - PARRY,
   *  GUARD BREAK, MISS, K.O. */
  lettering: 'all' | 'big' | 'tags';
}

export const VFX_PROFILES: Readonly<Record<VfxLevel, Readonly<VfxProfile>>> = {
  full: { impactFrame: 1, chroma: 1, speedLines: 1, grade: 1, cinema: 1, blur: 1, powerDim: 1, bloom: 1, spriteGain: 1, spriteSize: 1, shells: 1, lights: 1, bodyFlash: 1, aura: 1, glow: 1, armoryOpacity: 1, lettering: 'all' },
  reduced: { impactFrame: 0, chroma: 0, speedLines: .4, grade: .5, cinema: .6, blur: .35, powerDim: .6, bloom: .8, spriteGain: .8, spriteSize: .85, shells: .7, lights: .6, bodyFlash: .75, aura: .8, glow: .7, armoryOpacity: .85, lettering: 'big' },
  minimal: { impactFrame: 0, chroma: 0, speedLines: 0, grade: .2, cinema: .3, blur: 0, powerDim: .3, bloom: .6, spriteGain: .6, spriteSize: .65, shells: .45, lights: .3, bodyFlash: .5, aura: .65, glow: .45, armoryOpacity: .7, lettering: 'tags' },
};

/** The level in force and its factors, read live by the systems above. */
export const VFX: { level: VfxLevel } & VfxProfile = { level: 'full', ...VFX_PROFILES.full };

/** Puts `level` in force (an unknown one is Full). */
export function setVfxLevel(level: VfxLevel | undefined) {
  const next: VfxLevel = level && level in VFX_PROFILES ? level : 'full';
  Object.assign(VFX, VFX_PROFILES[next], { level: next });
}
