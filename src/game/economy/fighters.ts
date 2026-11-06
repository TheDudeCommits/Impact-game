import { isReleasedFighter } from '../rosterAvailability';
import { ITEMS, released } from './catalog';
import { owns, type Owner } from './account';
import type { FighterId } from '../types';

/** Each locked fighter and the item that unlocks them (sold, or the road's; a retired one stays its owners'). */
export const LOCKED: ReadonlyMap<FighterId, string> = new Map(ITEMS
  .filter(each => each.kind === 'fighter' && released(each) && each.fighter)
  .map(each => [each.fighter!, each.id] as const));

/** Fighters built but held back: their item is not on sale yet (`next`, `ask`), most often because the home
 *  screen's art for them - another agent's - has not landed. Not sold, not on the home screen, never drafted as a
 *  bot, and refused outside the Training Ground; the build ships, and putting the item live releases them. */
export const HELD: ReadonlySet<FighterId> = new Set(ITEMS
  .filter(each => each.kind === 'fighter' && !released(each) && each.fighter)
  .map(each => each.fighter!));

/** Whether `owner` (an account, or none) may play `fighter` (in any mode; Training asks nothing). Ownership is
 *  account.ts's owns(), so an account with all access plays every fighter that is out. A held fighter is not out. */
const reviewBuild = (() => { try { return import.meta.env?.MODE === 'preview'; } catch { return false; } })();
export const mayPlay = (fighter: FighterId, owner: Owner | undefined) => {
  if (!isReleasedFighter(fighter) || HELD.has(fighter)) return false;
  if (reviewBuild) return true;
  const unlock = LOCKED.get(fighter);
  return !unlock || owns(owner, unlock);
};

/** Why `owner` may not play `fighter` there, or nothing if they may. */
export function lockedOut(fighter: FighterId, owner: Owner | undefined): string | undefined {
  if (!isReleasedFighter(fighter)) return 'This fighter is not available.';
  if (mayPlay(fighter, owner)) return undefined;
  if (HELD.has(fighter)) return `${ITEMS.find(each => each.kind === 'fighter' && each.fighter === fighter)?.name ?? 'This fighter'} is not out yet. The Training Ground is open to every fighter.`;
  const name = ITEMS.find(each => each.id === LOCKED.get(fighter))?.name ?? fighter;
  return `${name} is locked: unlock them in Account to play here. The Training Ground is open to every fighter.`;
}
