/** CC0 stand-ins for the sound effects held back from this repository (README.md): each held-back file has one made for
 *  its slot - the same length, loudness and timing - in public/assets/audio/v2/cc0/ (its manifest.json lists each one, what
 *  it stands in for and the CC0 sources it is made from). A stand-in sits at the held file's path under cc0/, so the sound
 *  bank finds it when a cue's own file is not served, and plays the cue's own file again once it is back. */

/** A cue's file (its path under /assets/audio/v2) as its stand-in's: sfx/originals/families/hits/blast.wav ->
 *  cc0/families/hits/blast.wav, sfx/px/sear.wav -> cc0/px/sear.wav. */
export const standIn = (file: string) => file.replace(/^sfx\/(originals\/)?/, 'cc0/');

/** Arcade Survival's held-back takes, by name (/assets/audio/survival/<name>.m4a): their stand-ins are
 *  cc0/survival/<name>.m4a. Take a name off when its own file is back. */
const SURVIVAL = new Set([
  'bed-armoury-lake', 'bed-fallen-star', 'star-groan-1', 'star-groan-2', 'star-groan-3', 'chain-strain-1', 'chain-strain-2', 'chain-strain-3',
  'iron-grind-1', 'iron-grind-2', 'iron-grind-3', 'iron-grind-4', 'furnace-roar-1', 'furnace-roar-2', 'furnace-roar-3',
  'iron-fall-1', 'iron-fall-2', 'iron-fall-3', 'fuse-hiss-1', 'fuse-hiss-2', 'fuse-hiss-3',
  'wood-swing-2', 'wood-cry-1', 'wood-cry-2', 'wood-hurt-1', 'wood-hurt-2', 'wood-hurt-3', 'wood-die-1', 'wood-die-2',
]);
export const SURVIVAL_STAND_INS: ReadonlySet<string> = SURVIVAL;

/** A survival take's url, or its stand-in's where the take is held back. */
export function survivalStandIn(url: string): string {
  const name = /^\/assets\/audio\/survival\/([\w-]+)\.m4a$/.exec(url)?.[1];
  return name && SURVIVAL.has(name) ? `/assets/audio/v2/cc0/survival/${name}.m4a` : url;
}
