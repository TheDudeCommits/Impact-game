import { FIGHTERS } from '../../config';
import { ballOf, BALL_TEAM_NAMES, type BallSeat, type BallTeam, type BallView } from '../../game/ball/model';
import type { GameSnapshot } from '../../game/types';
import { mangaPortrait } from '../MangaHome';
import './ballUi.css';

const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const nameOf = (seat: BallSeat) => (seat.bot || seat.name === 'Fighter' ? FIGHTERS[seat.fighter].name : seat.name).toUpperCase();
const TEAMS: readonly BallTeam[] = ['red', 'blue'];

/** The ball modes' two panels outside play (the HUD is BallHud's): a room's lobby - its code, the two sides, SWITCH SIDES,
 *  and for the host BOTS FILL and START - and the results once the winners have had their moment: the score, every
 *  player's line, the MVP, PLAY AGAIN and LEAVE. */
export class BallUI {
  readonly root: HTMLElement;
  /** A message for the room (ball-start, ball-swap, ball-fill, ball-rematch). */
  onSend: (type: string, payload?: unknown) => void = () => {};
  onAgain: () => void = () => {};
  onLeave: () => void = () => {};
  /** The match's finale is on screen (main.ts): the results wait for the winners' pose. */
  finale: () => boolean = () => false;
  private key = '';
  private view?: BallView;
  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'ball-ui hidden';
    parent.append(this.root);
    this.root.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]');
      if (!button || button.disabled) return;
      const act = button.dataset.act;
      if (act === 'start') this.onSend('ball-start', { fillBots: this.view?.fillBots ?? true });
      else if (act === 'swap') this.onSend('ball-swap');
      else if (act === 'fill') this.onSend('ball-fill', !(this.view?.fillBots ?? true));
      else if (act === 'rumble') this.onSend('ball-rumble', !(this.view?.rumble ?? false));
      else if (act === 'again') this.onAgain();
      else if (act === 'leave') this.onLeave();
    });
  }
  /** A panel is up, and the fight's input waits. */
  get blocking() { return !this.root.classList.contains('hidden'); }
  update(snapshot: GameSnapshot | null | undefined, selfId: string) {
    const v = ballOf(snapshot);
    this.view = v;
    const lobby = !!v && v.phase === 'lobby' && v.access !== 'bots';
    const results = !!v && v.phase === 'over' && !this.finale();
    const show = lobby || results;
    this.root.classList.toggle('hidden', !show);
    if (!v || !show) { this.key = ''; return; }
    const key = `${v.phase}|${v.code}|${v.fillBots}|${v.rumble}|${v.hostId}|${v.startsAt ? Math.ceil(v.startsAt - (snapshot?.serverTime ?? 0)) : ''}|${v.seats.map(s => `${s.id}:${s.team}:${s.goals}:${s.kills}:${s.points}`).join(',')}|${v.score.red}-${v.score.blue}`;
    if (key === this.key) return;
    this.key = key;
    this.root.dataset.mode = v.mode;
    this.root.innerHTML = lobby ? this.lobby(v, selfId, snapshot?.serverTime ?? 0) : this.results(v, selfId);
    if (results) this.root.querySelector<HTMLButtonElement>('button[data-act="again"]')?.focus({ preventScroll: true });
  }
  private seatRow(seat: BallSeat, selfId: string, stats: string, feats = false) {
    // The accolades earned (each once, with how many times: HAT TRICK ×2).
    const counts = new Map<string, number>();
    for (const f of feats ? seat.feats ?? [] : []) counts.set(f, (counts.get(f) ?? 0) + 1);
    const badges = counts.size ? `<span class="bu-feats">${[...counts].map(([f, n]) => `<i>${escape(f)}${n > 1 ? ` ×${n}` : ''}</i>`).join('')}</span>` : '';
    return `<li class="${seat.id === selfId ? 'self' : ''}"><span class="bu-face">${mangaPortrait(seat.fighter)}</span><span class="bu-who"><b>${escape(nameOf(seat))}</b>${badges}</span>${seat.bot ? '<small>BOT</small>' : ''}${stats}</li>`;
  }
  private lobby(v: BallView, selfId: string, now: number) {
    const host = v.hostId === selfId, title = v.mode === 'goal-rush' ? 'GOAL RUSH' : 'SKY SPIKE';
    const columns = TEAMS.map(team => {
      const seats = v.seats.filter(s => s.team === team);
      const empty = Array.from({ length: Math.max(0, 3 - seats.length) }, () => `<li class="empty"><b>${v.fillBots ? 'BOT FILLS THIS SEAT' : 'OPEN SEAT'}</b></li>`).join('');
      return `<section class="bu-side ${team}"><h3>${BALL_TEAM_NAMES[team]}</h3><ul>${seats.map(s => this.seatRow(s, selfId, '')).join('')}${empty}</ul></section>`;
    }).join('<div class="bu-vs">VS</div>');
    const starts = v.startsAt !== null ? `<p class="bu-count">KICKING OFF IN ${Math.max(0, Math.ceil(v.startsAt - now))}</p>` : '';
    return `<div class="bu-card"><header><small>${v.access === 'host' ? 'PRIVATE ROOM' : 'MATCHMAKING'}${v.rumble ? ' · RUMBLE' : ''}</small><h2>${title}</h2>${v.code && v.access === 'host' ? `<p class="bu-code">ROOM CODE <b>${escape(v.code)}</b></p>` : ''}</header>
      <div class="bu-teams">${columns}</div>${starts}
      <footer><button data-act="swap">SWITCH SIDES</button>${host ? `<button data-act="fill" class="${v.fillBots ? 'on' : ''}">BOTS FILL: ${v.fillBots ? 'ON' : 'OFF'}</button><button data-act="rumble" class="${v.rumble ? 'on' : ''}">RULES: ${v.rumble ? 'RUMBLE' : 'CLASSIC'}</button><button data-act="start" class="go">START</button>` : v.access === 'host' ? '<span>WAITING FOR THE HOST</span>' : ''}<button data-act="leave">LEAVE</button></footer></div>`;
  }
  private results(v: BallView, selfId: string) {
    const own = v.seats.find(s => s.id === selfId)?.team, won = v.winner && v.winner !== 'draw' && v.winner === own;
    const head = v.winner === 'draw' || !v.winner ? 'DRAW' : won ? 'VICTORY' : 'DEFEAT';
    const mvp = v.seats.find(s => s.id === v.mvp);
    const goal = v.mode === 'goal-rush';
    const header = goal ? '<i>G</i><i>A</i><i>SV</i><i>SH</i><i>PTS</i>' : '<i>KILL</i><i>ACE</i><i>BLK</i><i>DIG</i><i>PTS</i>';
    const stat = (s: BallSeat) => `<span class="bu-stats">${(goal ? [s.goals, s.assists, s.saves, s.shots, s.points] : [s.kills, s.aces, s.blocks, s.digs, s.points]).map(n => `<i>${n}</i>`).join('')}</span>`;
    const columns = TEAMS.map(team => {
      const seats = v.seats.filter(s => s.team === team).sort((a, b) => b.points - a.points);
      return `<section class="bu-side ${team}${v.winner === team ? ' won' : ''}"><h3>${BALL_TEAM_NAMES[team]} <b>${v.score[team]}</b></h3><div class="bu-head">${header}</div><ul>${seats.map(s => this.seatRow(s, selfId, (s.id === v.mvp ? '<em>MVP</em>' : '') + stat(s), true)).join('')}</ul></section>`;
    }).join('');
    return `<div class="bu-card results ${won ? 'won' : 'lost'}"><header><small>${goal ? 'GOAL RUSH' : 'SKY SPIKE'}${v.rumble ? ' RUMBLE' : ''} · ${escape(v.reason.toUpperCase())}</small><h2>${head}</h2>
      <p class="bu-final"><span class="red">${v.score.red}</span> – <span class="blue">${v.score.blue}</span></p>${mvp ? `<p class="bu-mvp">MVP <b>${escape(nameOf(mvp))}</b> · ${mvp.points} PTS</p>` : ''}</header>
      <div class="bu-teams results">${columns}</div>
      <footer><button data-act="again" class="go">PLAY AGAIN</button><button data-act="leave">LEAVE</button></footer></div>`;
  }
  clear() { this.root.classList.add('hidden'); this.root.innerHTML = ''; this.key = ''; this.view = undefined; }
}
