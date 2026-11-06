import type { FighterId, GameSnapshot, PlayerState } from '../../game/types';
import { objectiveOf } from '../../game/objectives/model';
import { riftOf } from '../../game/moba/model';
import { prompt } from '../prompts';
import './finale.css';

export const FINALE = {
  /** The least the finale holds the results, from the end: the K.O. card, then a victory entry (median 2.4 s). */
  least: 4,
  /** And the most, whatever the line: the victory orbit runs six seconds, and a longer line ends over the results. */
  most: 5.5,
  /** When the winner's line starts, from the end (main.ts `cinematics`: after the announcer's VICTORY! on the winner's
   *  own page). The finale is timed from here on every page, so all of them agree. */
  lineAt: 1.9,
  /** Held after the line has ended. */
  after: .3,
  /** A line whose length is not known on this page (not decoded yet, nothing in the manifest): the roster's median. */
  line: 2.8,
  /** An end without a winner to show - a draw, an operation lost to the horde, a winner whose body is not drawn: a
   *  beat for the K.O. card, then the results. */
  beat: 1.6,
  /** A press this soon after the end is the fight's own, mashed into its last blow: it never skips the K.O. */
  guard: .8,
};

/** What a page is presenting as over: `key` names the end (a new key is a new finale), `winner` says a winner's pose
 *  is on screen, `line` is the winner's line's length when known. */
export interface FinaleEnd { key: string; winner: boolean; line?: number }

/** How long the finale of `end` holds the results, in seconds. */
export function finaleSeconds(end: Pick<FinaleEnd, 'winner' | 'line'>): number {
  if (!end.winner) return FINALE.beat;
  const line = end.line !== undefined && Number.isFinite(end.line) && end.line > 0 ? end.line : FINALE.line;
  return Math.min(FINALE.most, Math.max(FINALE.least, FINALE.lineAt + line + FINALE.after));
}

/** The winner whose pose the finale holds, from a snapshot that is over: the room's winner while standing; on a team's
 *  win (an operation, the Rift War, whose room names the first seat of the side, standing or not) the first of that
 *  side still standing. None on a draw or the horde's win. */
export function finaleWinner(snapshot: GameSnapshot): PlayerState | undefined {
  const named = snapshot.players.find(p => p.id === snapshot.winnerId);
  if (named?.alive) return named;
  const team = objectiveOf(snapshot)?.winner ?? riftOf(snapshot)?.winner;
  if (!team || team === 'draw' || team === 'horde') return undefined;
  return snapshot.players.find(p => p.alive && !p.enemy && p.team === team);
}

/** Whether the end on screen is the page's own win: its side's, in the team modes. */
export function finaleMine(snapshot: GameSnapshot, selfId: string): boolean {
  const team = objectiveOf(snapshot)?.winner ?? riftOf(snapshot)?.winner;
  if (team) return team === snapshot.players.find(p => p.id === selfId)?.team;
  return !!selfId && snapshot.winnerId === selfId;
}

/** The finale's reading of a presented snapshot: the end it shows (none while it waits or runs) and whether its fight
 *  is on. `drawn` says a fighter's body is on screen; `line` gives a fighter's victory line's length, when known. */
export function finaleStateOf(snapshot: GameSnapshot | undefined, drawn: (id: string) => boolean, line: (fighter: FighterId) => number | undefined): { end?: FinaleEnd; running: boolean } {
  if (!snapshot) return { running: false };
  const operation = objectiveOf(snapshot), war = riftOf(snapshot), phase = operation?.phase ?? war?.phase;
  let key: string | undefined;
  if (operation) key = phase === 'over' ? `operation:${operation.kind}:${operation.round}:${operation.endsAt}` : undefined;
  else if (war) key = phase === 'over' ? `rift:${war.round}:${war.endsAt}` : undefined;
  else if (snapshot.roomMode === 'match' && snapshot.status === 'finished' && (!snapshot.duel || snapshot.duel.phase === 'complete')) key = `match:${snapshot.matchId ?? ''}:${snapshot.duel?.set ?? 0}:${snapshot.winnerId ?? '-'}`;
  const running = operation || war ? phase === 'active' : snapshot.roomMode === 'match' && snapshot.status === 'active';
  if (!key) return { running };
  const winner = finaleWinner(snapshot), shown = !!winner && drawn(winner.id);
  return { end: { key, winner: shown, line: shown ? line(winner!.fighter) : undefined }, running: false };
}

/** The finale's clock: fed every frame with the end on screen (or none), asked whether the results may show. */
export class Finale {
  private key: string | null = null;
  private at = 0;
  private seconds = 0;
  private skipped = false;
  /** The fight was seen running since the last end: an end only gets a finale if this page watched it happen. */
  private live = false;
  /** Each frame. `end`: what is over on screen, undefined while the match waits or runs. `running`: the fight is on.
   *  `now`: the page's clock, in seconds. */
  observe(end: FinaleEnd | undefined, running: boolean, now: number) {
    if (!end) { this.key = null; this.skipped = false; if (running) this.live = true; return; }
    if (end.key === this.key) return;
    this.key = end.key; this.at = now; this.skipped = false;
    this.seconds = this.live ? finaleSeconds(end) : 0;
    this.live = false;
  }
  /** An end is on screen (its finale playing, or its results up). */
  get ended() { return this.key !== null; }
  /** The results may show: nothing is over, or its finale has played or been skipped. */
  done(now: number) { return this.key === null || this.skipped || now - this.at >= this.seconds; }
  /** A finale is on screen, holding the results. */
  holding(now: number) { return !this.done(now); }
  /** Seconds the results still wait. */
  left(now: number) { return this.holding(now) ? this.seconds - (now - this.at) : 0; }
  /** Seconds since the end, while it holds (0 otherwise). */
  elapsed(now: number) { return this.holding(now) ? now - this.at : 0; }
  /** Cut it short: a confirm press (never inside FINALE.guard), or `force` - the room gone. Whether it was cut. */
  skip(now: number, force = false) {
    if (!this.holding(now) || (!force && now - this.at < FINALE.guard)) return false;
    this.skipped = true; return true;
  }
  /** Leaving the match. */
  reset() { this.key = null; this.skipped = false; this.live = false; }
}

export class FinaleSkip {
  readonly element = document.createElement('div');
  private shown = false;
  private device = '';
  constructor(parent: HTMLElement, onSkip: () => void) {
    this.element.className = 'finale-skip';
    this.element.hidden = true;
    this.element.addEventListener('click', event => { event.stopPropagation(); onSkip(); });
    parent.append(this.element);
  }
  /** Each frame: up while a finale holds, from FINALE.guard seconds into it. */
  update(holding: boolean, elapsed: number) {
    const show = holding && elapsed >= FINALE.guard;
    if (show) {
      const root = document.querySelector<HTMLElement>('#interface'), device = `${root?.dataset.input ?? ''}:${root?.dataset.pad ?? ''}`;
      if (device !== this.device || !this.shown) { this.device = device; this.element.innerHTML = prompt('confirm', 'SKIP'); }
    }
    if (show === this.shown) return;
    this.shown = show; this.element.hidden = !show;
  }
}
