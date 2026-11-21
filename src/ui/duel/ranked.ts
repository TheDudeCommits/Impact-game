import { RANKED, TIERS, seasonOf, type RankedBoard, type RankedBoardRow } from '../../game/ball/ranked';
import { RANKED_DUEL, placementsLeft, promotionOf, type RankedDuelView } from '../../game/duel/ranked';
import { myRanks, refreshRanks, seasonLine, stampHtml } from '../ball/ranks';
import { economyPost } from '../../network/p2Economy';
import { inPlayerTwo } from '../../boot/playerTwo';
import { account } from '../shop/account';
import type { ModePrefs } from '../modes/prefs';
import './rankedDuel.css';

/** The ranked Duel on the page (the rules: game/duel/ranked.ts): the Duel sheet's QUEUE on ONLINE and its RANKED panel
 *  (the account's stamp, the season, the placements left, the season's board), the queue's and the VS page's stamps, and
 *  the set's verdict on the results. The standing is the ball's ui/ball/ranks.ts asks for (its answer has every ranked
 *  mode); the board is the economy world's `ranked-board`, asked for when the panel is open. */

const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** The Duel's ONLINE queue: QUICK (the casual Duel, as before) or RANKED. */
export type DuelQueue = 'quick' | 'ranked';
export const duelQueueOf = (prefs: ModePrefs): DuelQueue => prefs.queue === 'ranked' ? 'ranked' : 'quick';
/** A press on the QUEUE row (data-ms-duel="queue:<id>"): the prefs to keep, or undefined. */
export function duelChoice(value: string | undefined): Pick<ModePrefs, 'queue'> | undefined {
  const [key, choice] = (value ?? '').split(':');
  return key === 'queue' && (choice === 'ranked' || choice === 'quick') ? { queue: choice === 'ranked' ? 'ranked' : 'classic' } : undefined;
}

/** Why this page can't queue ranked now (undefined: it can): it is not in PlayerTwo's player, or its account is a guest's. */
export function rankedBlocked(): 'p2' | 'sign-in' | undefined {
  if (!inPlayerTwo()) return 'p2';
  return account.wallet.signedIn ? undefined : 'sign-in';
}

/** The QUEUE row on the Duel's ONLINE: QUICK or RANKED (the season's number under it). */
export function duelQueueRow(prefs: ModePrefs, now = Date.now()): string {
  const queue = duelQueueOf(prefs), pressed = (on: boolean) => `aria-pressed="${on}"`;
  return `<div class="ms-option" role="group" aria-label="Queue"><b>QUEUE</b><button type="button" data-ms-duel="queue:quick" ${pressed(queue === 'quick')}>QUICK<small> CASUAL</small></button><button type="button" data-ms-duel="queue:ranked" ${pressed(queue === 'ranked')}>RANKED<small> SEASON ${seasonOf(now).n}</small></button></div>`;
}

/** RANKED's panel: the account's stamp (PLACING n/5 until the placements are played), the season and what the queue is,
 *  or for a guest how to sign in. Asks for the standing and the board as it is drawn (the board: duelBoardSection). */
export function duelRankedPanel(now = Date.now()): string {
  const blocked = rankedBlocked();
  if (blocked) {
    const why = blocked === 'sign-in'
      ? 'Ranked is for signed-in PlayerTwo players: sign in on PlayerTwo (its own SIGN IN, outside the game), then queue. Nothing is rated for a guest.'
      : "Ranked Duel is played on PlayerTwo's rooms: open Impact on PlayerTwo to queue.";
    return `<div class="bs-ranked dr-panel dr-locked">${stampHtml(undefined)}<p class="ms-note"><b>${seasonLine(now)}</b> ${why}</p></div>`;
  }
  void refreshRanks(); void refreshBoard();
  const mine = myRanks()?.modes.duel, left = placementsLeft(mine);
  return `<div class="bs-ranked dr-panel">${stampHtml(mine)}<p class="ms-note"><b>${seasonLine(now)}</b> First to two against a real player, matched by rating. Leaving before the end counts as a loss. ${left ? `${left} placement match${left === 1 ? '' : 'es'} to play.` : ''}</p></div>`;
}
/** RANKED's season board on the sheet, in the band the other ways give their places (ModeSheet draw): nothing for a guest
 *  or off PlayerTwo, whose panel says how to play ranked instead. */
export function duelBoardSection(): string { return rankedBlocked() ? '' : boardHtml(myBoard()); }

/** The season's board as the RANKED panel shows it: place, name, stamp and rating, the player's own row marked (and, when
 *  they are below the top rows, their own place after a gap). */
export function boardHtml(board: RankedBoard | undefined): string {
  if (!board) return '';
  const mark = (tier: RankedBoardRow['tier']) => TIERS.find(t => t.id === tier);
  const row = (r: RankedBoardRow) => { const t = mark(r.tier); return `<li class="dr-row${r.you ? ' you' : ''}"><b>${r.place}</b><span>${escape(r.name)}${r.you ? ' <i>YOU</i>' : ''}</span><em class="dr-tier rk-${t?.id ?? 'rough'}" title="${escape(t?.name ?? '')}">${t?.mark ?? ''}</em><strong>${r.rating.toLocaleString('en-US')}</strong></li>`; };
  if (!board.top.length) return `<section class="dr-board" aria-label="Season board"><h4>SEASON ${board.season} · BOARD</h4><p class="dr-empty">Nobody has placed yet this season: ${RANKED.placements} ranked Duels earn a stamp, and a place here.</p></section>`;
  return `<section class="dr-board" aria-label="Season board"><h4>SEASON ${board.season} · TOP ${board.top.length}</h4><ol>${board.top.map(row).join('')}${board.me ? `<li class="dr-gap" aria-hidden="true">···</li>${row(board.me)}` : ''}</ol></section>`;
}

let board: RankedBoard | undefined;
let boardAt = -Infinity;
let boardAsk: Promise<RankedBoard | undefined> | undefined;
const boardListeners = new Set<() => void>();
/** The Duel's season board as last told (undefined: not asked yet, or not reachable). */
export const myBoard = () => board;
export function onBoard(listener: () => void) { boardListeners.add(listener); return () => { boardListeners.delete(listener); }; }
/** Ask the economy world for the board again (at most every half minute, unless `force`: after a ranked set). */
export function refreshBoard(force = false): Promise<RankedBoard | undefined> {
  if (boardAsk) return boardAsk;
  if (!force && performance.now() - boardAt < 30_000) return Promise.resolve(board);
  boardAt = performance.now();
  boardAsk = economyPost('ranked-board', { token: account.secret(), mode: RANKED_DUEL.mode }, 5000)
    .then(r => r.status === 200 ? r.body as RankedBoard : undefined)
    .then(next => { if (next && Array.isArray(next.top)) { board = next; for (const each of boardListeners) each(); } return board; }, () => board)
    .finally(() => { boardAsk = undefined; });
  return boardAsk;
}

/** The set's verdict on the standing, for the results card: the stamp with the change, then a promotion (or the stamp first
 *  earned at the last placement, or one lost), the placements counted down, or the change alone. A ranked room's set
 *  that could not be rated says UNRANKED; any other room, nothing. */
export function rankedResultHtml(view: RankedDuelView | undefined, id: string): string {
  if (!view) return '';
  const seat = view.seats[id];
  if (!view.rated || !seat || seat.delta === undefined) return view.rated ? '' : '<div class="dr-result dr-unrated"><p><b>UNRANKED</b><small>NOT RATED: THE SET DID NOT START WITH BOTH STANDINGS</small></p></div>';
  const after = { rating: seat.rating, games: seat.games }, before = { rating: seat.rating - seat.delta, games: Math.max(0, seat.games - 1) };
  const promo = promotionOf(before, after), left = placementsLeft(after), change = `${seat.delta >= 0 ? '+' : '−'}${Math.abs(seat.delta)}`;
  const line = promo?.kind === 'placed' ? `PLACED · ${promo.tier.name}` : promo?.kind === 'promoted' ? `PROMOTED · ${promo.tier.name}` : promo?.kind === 'demoted' ? `DOWN TO ${promo.tier.name}`
    : left ? `PLACEMENT ${after.games} OF ${RANKED.placements} · ${left} TO GO` : `${change} RATING`;
  return `<div class="dr-result${promo ? ` dr-${promo.kind}` : ''}">${stampHtml(after, seat.delta)}<p><b>${escape(line)}</b><small>RANKED DUEL · SEASON ${view.season} · ${seat.rating.toLocaleString('en-US')} (${change})</small></p></div>`;
}

/** A ranked set's results seen (MatchResults): the standing and the board asked for again once its change is in - at
 *  once, and again a few seconds on, for the room's notes still on their way to the world. */
let seen = '';
export function rankedSetSeen(view: RankedDuelView, matchId: string | undefined) {
  if (!Object.values(view.seats).some(seat => seat.delta !== undefined)) return;
  const key = `${matchId ?? ''}:${view.season}`;
  if (key === seen) return;
  seen = key;
  const again = () => { void refreshRanks(true); void refreshBoard(true); };
  again(); setTimeout(again, 4000);
}

/** A seat's stamp for the VS page: their standing as the set begins (none: not read yet). */
export function vsStamp(view: RankedDuelView | undefined, id: string): string | undefined {
  const seat = view?.seats[id];
  return seat ? stampHtml(seat) : undefined;
}
