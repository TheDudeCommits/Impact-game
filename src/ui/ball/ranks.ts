import { RANKED, bandOf, seasonOf, tierOf, type Rating, type RankedAnswer, type SeatRank } from '../../game/ball/ranked';
import type { BallModeId } from '../../game/ball/model';
import { account, economyServer } from '../shop/account';

/** The page's side of ranked (game/ball/ranked.ts has the rules): this browser's account's standing in each mode,
 *  asked of the match server (src/server/ball/ranked.ts, POST /ball/ranked) and kept for the session, and the ink
 *  stamp a standing is drawn as on the mode sheet, the lobby and the results. */
let known: RankedAnswer | undefined;
let asking: Promise<RankedAnswer | undefined> | undefined;
let askedAt = -Infinity;
const listeners = new Set<() => void>();

/** This account's standing, as last told (undefined: not asked yet, or no account). */
export const myRanks = () => known;
/** Told when the standing arrives or changes. */
export function onRanks(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
/** Ask the server again (at most once a few seconds, unless `force`): on opening the sheet, and after a ranked match. */
export function refreshRanks(force = false): Promise<RankedAnswer | undefined> {
  const token = account.secret();
  if (!token) return Promise.resolve(undefined);
  if (asking) return asking;
  if (!force && performance.now() - askedAt < 5000) return Promise.resolve(known);
  askedAt = performance.now();
  asking = fetch(`${economyServer()}/ball/ranked`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ token }), signal: AbortSignal.timeout(5000) })
    .then(async response => response.ok ? await response.json() as RankedAnswer : undefined)
    .then(answer => { if (answer && typeof answer.season === 'number') { known = answer; for (const each of listeners) each(); } return known; }, () => known)
    .finally(() => { asking = undefined; });
  return asking;
}
/** The band matchmaking looks in first (network.ts): this account's rating's, once it is known. */
export function rankBand(mode: BallModeId): number | undefined {
  const r = known?.modes[mode];
  return r ? bandOf(r.rating) : undefined;
}

const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
/** A standing as its ink stamp: the tier's seal and name, the rating under it; during the placements, how many are
 *  left. `delta`: the change a match made, beside it. */
export function stampHtml(r: Pick<Rating, 'rating' | 'games'> | SeatRank | undefined, delta?: number): string {
  const rating = r?.rating ?? RANKED.start, games = r?.games ?? 0, tier = tierOf({ rating, games });
  const change = delta === undefined || delta === 0 ? '' : `<em class="${delta > 0 ? 'up' : 'down'}">${delta > 0 ? '+' : '−'}${Math.abs(delta)}</em>`;
  if (!tier) return `<span class="rk-stamp rk-placing" title="${RANKED.placements - Math.min(games, RANKED.placements)} placement matches to play"><b>新</b><i>PLACING</i><small>${Math.min(games, RANKED.placements)}/${RANKED.placements}</small>${change}</span>`;
  return `<span class="rk-stamp rk-${tier.id}" title="${escape(tier.name)} · ${Math.round(rating)}"><b>${tier.mark}</b><i>${escape(tier.name)}</i><small>${Math.round(rating).toLocaleString('en-US')}</small>${change}</span>`;
}
/** The season as the sheet names it: SEASON 1 · 23 DAYS LEFT. */
export function seasonLine(now = Date.now()): string {
  const season = seasonOf(now), days = Math.max(0, Math.ceil((season.end - now) / 86_400_000));
  return `SEASON ${season.n} · ${days} DAY${days === 1 ? '' : 'S'} LEFT`;
}
