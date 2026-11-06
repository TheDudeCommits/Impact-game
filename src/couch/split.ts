import type { CouchScreen } from '../network';
import type { ModeId } from '../ui/modes/catalogue';

export const SCREENS: Readonly<Record<ModeId, readonly CouchScreen[]>> = {
  duel: ['shared', 'split-h', 'split-v'], arcade: ['split-h', 'split-v', 'shared'], training: ['shared', 'split-h', 'split-v'],
  royale: ['split-h', 'split-v'], 'last-stand': ['split-h', 'split-v'], 'bad-blood': ['split-h', 'split-v'], 'rift-war': ['split-h', 'split-v'],
};
/** The screen a mode's couch opens on: the one chosen last, if the mode has it, else the mode's first. */
export function screenFor(mode: ModeId, chosen?: CouchScreen): CouchScreen {
  const ways = SCREENS[mode];
  return chosen && ways.includes(chosen) ? chosen : ways[0];
}
export const SCREEN_WORDS: Readonly<Record<CouchScreen, { label: string; note: string }>> = {
  'split-h': { label: 'TOP / BOTTOM', note: 'Split screen: Player 1 on top, Player 2 below' },
  'split-v': { label: 'SIDE BY SIDE', note: 'Split screen: Player 1 on the left, Player 2 on the right' },
  shared: { label: 'ONE SCREEN', note: 'No split: one camera keeps you both in view' },
};

/** A half of the screen, in CSS pixels from the top left. */
export interface Rect { x: number; y: number; w: number; h: number }
/** The divider between the halves is this many CSS pixels of ink, taken from both. */
export const DIVIDER = 4;
/**
 * Player 1's half and Player 2's: the left and the right of a `split-v` screen, the top and the bottom of a `split-h`
 * one. Whole pixels, the divider between them, each half at least one pixel.
 */
export function halves(screen: Exclude<CouchScreen, 'shared'>, width: number, height: number): [Rect, Rect] {
  const w = Math.max(2, Math.round(width)), h = Math.max(2, Math.round(height)), gap = Math.min(DIVIDER, screen === 'split-v' ? w - 2 : h - 2) / 2;
  if (screen === 'split-v') {
    const mid = Math.round(w / 2), a = Math.max(1, Math.round(mid - gap)), b = Math.min(w - 1, Math.round(mid + gap));
    return [{ x: 0, y: 0, w: a, h }, { x: b, y: 0, w: w - b, h }];
  }
  const mid = Math.round(h / 2), a = Math.max(1, Math.round(mid - gap)), b = Math.min(h - 1, Math.round(mid + gap));
  return [{ x: 0, y: 0, w, h: a }, { x: 0, y: b, w, h: h - b }];
}
/** A half as WebGL's viewport takes it: from the bottom left. */
export const glRect = (rect: Rect, height: number) => ({ x: rect.x, y: Math.round(height) - rect.y - rect.h, w: rect.w, h: rect.h });
