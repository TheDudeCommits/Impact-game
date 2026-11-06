/** The shop's featured shelf (8 October 2026, the shop streamlined: "one clear featured area, with the most exciting
 *  item or items shown big"): a fighter, an outfit and an effect, all three from what the shop sells, the same for
 *  everyone for a week - an ISO week, turning over at midnight UTC on Monday, as the weekly missions do. Each list is
 *  gone through in turn, so every fighter has a week at the front. What is shown first changes; what is sold does
 *  not. Data and arithmetic only. */
import { ITEMS, type Item, type ItemKind } from './catalog';

const DAY = 86_400_000, WEEK = 7 * DAY;
/** Weeks since the first Monday of 1970 (the 5th of January), UTC. */
const weekIndex = (now: number) => Math.floor((now - 4 * DAY) / WEEK);

/** What the effects shelf holds: what burns round a fighter, how they are drawn, what the fallen do. */
export const EFFECT_KINDS: readonly ItemKind[] = ['aura', 'skin', 'kill', 'trail', 'banner', 'emote', 'form'];
const sold = (kinds: readonly ItemKind[]) => ITEMS.filter(item => item.stage === 'live' && kinds.includes(item.kind));

export interface Featured { fighter?: Item; outfit?: Item; effect?: Item }
/** This week's three. */
export function featured(now: number): Featured {
  const w = weekIndex(now), pick = (list: readonly Item[], step: number) => list.length ? list[((w * step) % list.length + list.length) % list.length] : undefined;
  return { fighter: pick(sold(['fighter']), 1), outfit: pick(sold(['outfit']), 1), effect: pick(sold(EFFECT_KINDS), 1) };
}

/** Milliseconds to the next day (missions) and to the next week (the featured shelf), both at midnight UTC. */
export function turnover(now: number) {
  const day = Math.floor(now / DAY) * DAY + DAY;
  // (ISO weeks start on Monday: 1970-01-01 was a Thursday.)
  const monday = day + ((8 - new Date(day).getUTCDay()) % 7) * DAY;
  return { day: day - now, week: monday - now };
}
