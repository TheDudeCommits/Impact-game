import * as THREE from 'three';
import type { FighterId } from '../game/types';
import type { GhostPrint } from '../render/signature/GhostShell';
import type { StageLook } from '../render/signature/MoveStage';
import type { Element } from '../render/vfx/palette';
import { ORIGINALS } from './roster';

type Rgb = readonly [number, number, number];
interface CompanionLook {
  /** The spirit's manifestation shell (SPIRIT_SHELL): body colour, burning edge, ink, and its print's shade and light. */
  shell: { body: Rgb; rim: number; ink: number; shade: Rgb; light: Rgb; levels?: readonly [number, number]; glow?: RegExp };
  /** The light the companion throws (SPIRIT_GLOW). */
  glow: Rgb;
  stage: Record<string, { core: Rgb; main: Rgb; rim: Rgb; light: Rgb; element: StageLook['element']; shell: number; edge: number }>;
  /** Its strike sparks per slot (vfx/palette.ts TABLE). */
  sparks: Record<'light' | 'heavy' | 'special' | 'ultimate', Element>;
}

const GREEN: Element = { spike: 0xf6fff0, rim: 0x7ee08a, light: 0x9cf09a, ink: 0x081a0a };
const COBALT: Element = { spike: 0xf4f8ff, rim: 0x5a8cff, light: 0x9cc0ff, ink: 0x060c22 };
const GOLD: Element = { spike: 0xfff4d8, rim: 0xffc060, light: 0xffd890, ink: 0x1e1206 };

export const COMPANION_LOOKS: Partial<Record<FighterId, CompanionLook>> = {
  kinu: {
    shell: { body: [.3, .8, .38], rim: 0xd2ffd0, ink: 0x0f1a10, shade: [.03, .11, .04], light: [.95, 1.12, .95] },
    glow: [.5, 1.15, .55],
    stage: { THREAD: { core: [2.9, 3.4, 2.7], main: [.5, 2.0, .6], rim: [.1, .45, .15], light: [.75, 1.3, .7], element: GREEN, shell: 0x9cf09a, edge: 0x24602a } },
    sparks: { light: GREEN, heavy: GREEN, special: GREEN, ultimate: GREEN },
  },
  gosu: {
    shell: { body: [.12, .24, .82], rim: 0xffd27a, ink: 0x0a1030, shade: [.01, .02, .1], light: [.5, .66, 1.08], levels: [.1, 1.5], glow: /mender-gold/ },
    glow: [1.5, 1.05, .35],
    stage: {
      DIAMOND: { core: [2.8, 3.0, 3.4], main: [.45, .9, 2.4], rim: [.12, .25, .75], light: [.8, 1.0, 1.45], element: COBALT, shell: 0x5a8cff, edge: 0x1c3a8a },
      // the mending: kintsugi's gold
      MEND: { core: [3.3, 3.0, 1.9], main: [2.3, 1.55, .55], rim: [.85, .5, .15], light: [1.4, 1.1, .55], element: GOLD, shell: 0xffd890, edge: 0x8a5a1a },
    },
    sparks: { light: COBALT, heavy: COBALT, special: GOLD, ultimate: GOLD },
  },
};

const PLACEMENT: Partial<Record<FighterId, { scale: number; position: [number, number, number] }>> = {
  kinu: { scale: 1, position: [0, 0, 0] },
  gosu: { scale: 1.85 / 1.95, position: [.0099 * 1.85 / 1.95, 0, -.1739 * 1.85 / 1.95] },
};
export function companionPlacement(state: { id?: string; fighter: FighterId }) {
  return state.id?.endsWith('-spirit') && own(state.fighter) ? PLACEMENT[state.fighter] : undefined;
}

/** The slots whose original fights with a companion of its own (roster.ts `companion`) and has its own colours here. */
const own = (id: FighterId) => !!ORIGINALS[id]?.companion && !!COMPANION_LOOKS[id];
const colour = ([r, g, b]: Rgb) => new THREE.Color(r, g, b);

/** SPIRIT_SHELL: the companion's shell in its own colours (applyOriginalSpiritShells calls this). */
export function applyCompanionShells<T extends { body: THREE.Color; rim: number; ink: number; print: GhostPrint }>(shells: Partial<Record<FighterId, T>>) {
  for (const id of Object.keys(COMPANION_LOOKS) as FighterId[]) {
    const shell = shells[id], look = COMPANION_LOOKS[id]!.shell;
    if (!shell || !own(id)) continue;
    shells[id] = { ...shell, body: colour(look.body), rim: look.rim, ink: look.ink, print: { ...shell.print, shade: colour(look.shade), light: colour(look.light), line: look.ink,
      ...(look.levels ? { levels: look.levels } : {}), ...(look.glow ? { glow: look.glow } : {}) } };
  }
  return shells;
}

/** SPIRIT_GLOW: the light the companion throws. */
export function applyCompanionGlows(glows: Partial<Record<FighterId, THREE.Color>>) {
  for (const id of Object.keys(COMPANION_LOOKS) as FighterId[]) if (own(id) && glows[id]) glows[id] = colour(COMPANION_LOOKS[id]!.glow);
  return glows;
}

/** A signature stage's looks (KinuStoneThread's THREAD, GosuRestoration's DIAMOND and MEND), recoloured in place. */
export function applyCompanionStageLooks(id: FighterId, looks: Record<string, StageLook>) {
  if (!own(id)) return looks;
  for (const [name, look] of Object.entries(looks)) {
    const mine = COMPANION_LOOKS[id]!.stage[name];
    if (!mine) continue;
    look.core.copy(colour(mine.core)); look.main.copy(colour(mine.main)); look.rim.copy(colour(mine.rim)); look.light.copy(colour(mine.light));
    Object.assign(look, { element: { ...mine.element }, shell: mine.shell, edge: mine.edge });
  }
  return looks;
}

/** vfx/palette.ts TABLE: the slot's strike sparks. */
export function applyCompanionSparks(table: Partial<Record<FighterId, Record<string, Element>>>) {
  for (const id of Object.keys(COMPANION_LOOKS) as FighterId[]) if (own(id) && table[id]) table[id] = { ...table[id], ...COMPANION_LOOKS[id]!.sparks };
  return table;
}
