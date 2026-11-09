import {ITEM} from '../economy/catalog';
import type {Worn} from '../economy/catalog';

/** What a seat wears in the ball modes (the shop's ball gear: economy/catalog.ts, kinds `ball`, `balltrail`,
 *  `goalburst`, `celebration`). A room fills it from the account it was handed - only what the account owns - and a
 *  page's own match from the page's account (LocalBall), so every page draws everyone's the same:
 *  - the BALL SKIN is the one each page's own player wears: the ball looks to you as you dressed it;
 *  - the TRAIL is the last striker's while the ball is theirs, the GOAL BURST the scorer's, the CELEBRATION the scorer's
 *    (BallMatch holds it through the celebration). */
export interface BallLook { ball?: string; trail?: string; burst?: string; celebration?: string }
const SLOTS: readonly [keyof BallLook, 'ball' | 'balltrail' | 'goalburst' | 'celebration'][] = [['ball', 'ball'], ['trail', 'balltrail'], ['burst', 'goalburst'], ['celebration', 'celebration']];

/** A look from what an account wears, keeping only what `owns` says it owns (none: nothing worn in the ball modes). */
export function lookOfWorn(worn: Worn | undefined, owns: (id: string) => boolean): BallLook | undefined {
  const look: BallLook = {};
  for (const [slot, kind] of SLOTS) { const id = worn?.[kind]; if (typeof id === 'string' && ITEM.get(id)?.kind === kind && owns(id)) look[slot] = id; }
  return Object.keys(look).length ? look : undefined;
}
/** A look as a room or a page hands it over, each slot checked to be an item of its kind (nothing else is kept). */
export function cleanLook(raw: unknown): BallLook | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const look: BallLook = {}, from = raw as Record<string, unknown>;
  for (const [slot, kind] of SLOTS) { const id = from[slot]; if (typeof id === 'string' && ITEM.get(id)?.kind === kind) look[slot] = id; }
  return Object.keys(look).length ? look : undefined;
}

/** The celebrations: what the scorer does, held by BallMatch for the celebration's length (the next kickoff or serve,
 *  or the scorer moving, ends it). CLASSIC, every fighter's own victory pose, is everyone's without an item. */
export type Celebration = 'classic' | 'spin' | 'stand-tall' | 'showboat';
export const CELEBRATION_IDS = ['celebration-spin', 'celebration-stand-tall', 'celebration-showboat'] as const;
export const celebrationOf = (look: BallLook | undefined): Celebration => {
  const id = look?.celebration;
  return id === 'celebration-spin' ? 'spin' : id === 'celebration-stand-tall' ? 'stand-tall' : id === 'celebration-showboat' ? 'showboat' : 'classic';
};
/** SPIN: turns and seconds; SHOWBOAT: the heavy swing's longest, before the pose. */
export const CELEBRATE = {spinTurns: 2, spinSeconds: .9, showboatMost: .9} as const;
