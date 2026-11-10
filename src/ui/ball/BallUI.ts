import {BALL_ARENAS, MODE_ARENAS} from '../../game/ball/arenas';
import { FIGHTERS } from '../../config';
import { ballOf, BALL_TEAM_NAMES, type BallSeat, type BallTeam, type BallView } from '../../game/ball/model';
import type { GameSnapshot } from '../../game/types';
import { mangaPortrait } from '../MangaHome';
import { BALL_MUTATORS, MUTATOR_NAMES, mutatorLine } from '../../game/ball/mutators';
import { DRILLS, MEDALS, MODE_DRILLS } from '../../game/ball/drills';
import { LESSON } from '../../game/ball/lesson';
import type { BallModeId } from '../../game/ball/model';
import { TIERS, tierOf, RANKED, type SeatRank } from '../../game/ball/ranked';
import { ballPay } from './ballPay';
import { TRAIT_NAMES } from '../../game/ball/traits';
import { BallBadge } from './BallBadge';
import { MEDAL_MARK, recordDrill } from './drillMedals';
import { refreshRanks, stampHtml } from './ranks';
import './ballUi.css';
import './learnToPlay.css';

const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const nameOf = (seat: BallSeat) => (seat.bot || seat.name === 'Fighter' ? FIGHTERS[seat.fighter].name : seat.name).toUpperCase();
const TEAMS: readonly BallTeam[] = ['red', 'blue'];
const whole = (n: number) => Math.round(n).toLocaleString('en-US');
/** A ranked standing as how near the next stamp is - the stamp, the rating and the
 *  match's change, a bar to the next stamp and the points still to go (or the placements left). */
export function rankNext(r: SeatRank): string {
  const tier = tierOf(r), delta = r.delta ? `<em class="${r.delta > 0 ? 'up' : 'down'}">${r.delta > 0 ? '+' : '−'}${Math.abs(r.delta)}</em>` : '';
  if (!tier) {
    const played = Math.min(r.games, RANKED.placements), left = RANKED.placements - played;
    return `<p class="bu-next"><b>PLACEMENTS</b><span>${played} / ${RANKED.placements}${delta}</span><i><u style="width:${Math.round(played / RANKED.placements * 100)}%"></u></i><small>${left ? `${left} MORE TO YOUR STAMP` : 'YOUR STAMP NEXT MATCH'}</small></p>`;
  }
  const next = TIERS.find(t => t.from > r.rating);
  if (!next) return `<p class="bu-next"><b>${tier.name}</b><span>${whole(r.rating)}${delta}</span><small>THE TOP STAMP</small></p>`;
  const from = Number.isFinite(tier.from) ? tier.from : next.from - 150, share = Math.max(0, Math.min(1, (r.rating - from) / (next.from - from)));
  return `<p class="bu-next"><b>${tier.name}</b><span>${whole(r.rating)}${delta}</span><i><u style="width:${Math.round(share * 100)}%"></u></i><small>${whole(Math.ceil(next.from - r.rating))} TO ${next.name}</small></p>`;
}

/** The ball modes' two panels outside play (the HUD is BallHud's): a room's lobby - its code, the two sides, SWITCH SIDES,
 *  and for the host BOTS FILL and START - and the results once the winners have had their moment: the score, every
 *  player's line, the MVP, PLAY AGAIN and LEAVE. */
export class BallUI {
  readonly root: HTMLElement;
  /** A message for the room (ball-start, ball-swap, ball-fill, ball-rematch). */
  onSend: (type: string, payload?: unknown) => void = () => {};
  onAgain: () => void = () => {};
  /** LEARN TO PLAY's end offers the real thing: a 3 v 3 of the mode against EASY bots (main.ts starts it). */
  onKickOff: (mode: BallModeId) => void = () => {};
  onLeave: () => void = () => {};
  /** The match's finale is on screen (main.ts): the results wait for the winners' pose. */
  finale: () => boolean = () => false;
  private key = '';
  private view?: BallView;
  /** The mutator, RANKED and a drill's progress during play (BallBadge.ts). */
  private readonly badge: BallBadge;
  /** The drill whose result was last kept (ui/ball/drillMedals.ts), and what keeping it said. */
  private drillKept = ''; private drillBest?: ReturnType<typeof recordDrill>;
  /** A ranked match's end, once asked of the server again for the new standing. */
  private rankedAsked = '';
  /** What the match paid (ballPay.ts: the shop draws it here), kept on the results card beside PLAY AGAIN. */
  private readonly pay = document.createElement('div');
  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'ball-ui hidden';
    parent.append(this.root);
    this.pay.className = 'bu-pay hidden';
    ballPay.host = () => this.view && !this.view.practice && this.view.phase !== 'lobby' ? this.pay : undefined;
    this.badge = new BallBadge(parent);
    this.root.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]');
      if (!button || button.disabled) return;
      const act = button.dataset.act;
      if (act === 'start') this.onSend('ball-start', { fillBots: this.view?.fillBots ?? true });
      else if (act === 'swap') this.onSend('ball-swap');
      else if (act === 'fill') this.onSend('ball-fill', !(this.view?.fillBots ?? true));
      else if (act === 'rumble') this.onSend('ball-rumble', !(this.view?.rumble ?? false));
      else if (act === 'arena' && this.view) { const list = MODE_ARENAS[this.view.mode], at = list.indexOf(this.view.arena ?? list[0]); this.onSend('ball-arena', list[(at + 1) % list.length]); }
      // The host's RULES: CLASSIC, RUMBLE, then each mutator, and round (BallRoom's 'ball-rules').
      else if (act === 'rules') { const order = ['classic', 'rumble', ...BALL_MUTATORS], now = this.view?.rumble ? 'rumble' : this.view?.mutator ?? 'classic'; this.onSend('ball-rules', order[(order.indexOf(now) + 1) % order.length]); }
      // A drill's AGAIN and NEXT DRILL (LocalBall: the same FREE PLAY, that drill from its first ball).
      else if (act === 'drill-again') this.onSend('ball-rematch');
      else if (act === 'drill-next' && button.dataset.drill) this.onSend('ball-drill', button.dataset.drill);
      else if (act === 'again') this.onAgain();
      else if (act === 'kick-off' && this.view) this.onKickOff(this.view.mode);
      // A private room's host plays the same people again in the same room (BallRoom's 'ball-rematch').
      else if (act === 'rematch') this.onSend('ball-rematch');
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
    // A drill's ten balls done: its card (no match result: a drill is FREE PLAY's).
    const drill = !!v && v.practice && v.drill?.state === 'over';
    // LEARN TO PLAY over: its card, YOU'RE READY and the match it leads to.
    const lesson = !!v && v.practice && v.lesson?.state === 'over';
    const show = lobby || results || drill || lesson;
    this.root.classList.toggle('hidden', !show);
    this.badge.update(snapshot, show);
    if (v && drill && this.drillKept !== `${v.drill!.id}:${v.startedAt}`) { this.drillKept = `${v.drill!.id}:${v.startedAt}`; this.drillBest = recordDrill(v.drill!.id, v.drill!.done); }
    // After a ranked match, the account's standing is asked again (the sheet's stamp).
    if (v && results && v.ranked && this.rankedAsked !== `${v.code}:${v.round}`) { this.rankedAsked = `${v.code}:${v.round}`; void refreshRanks(true); }
    // A new match: the last one's pay goes.
    if (v && (v.phase === 'countdown' || v.phase === 'lobby') && this.pay.childElementCount) { this.pay.replaceChildren(); this.pay.classList.add('hidden'); }
    if (!v || !show) { this.key = ''; return; }
    if (lesson) {
      const key = `lesson|${v.mode}|${v.startedAt}`;
      if (key !== this.key) { this.key = key; this.root.dataset.mode = v.mode; this.root.innerHTML = this.lessonCard(v); this.root.querySelector<HTMLButtonElement>('button[data-act="kick-off"]')?.focus({ preventScroll: true }); }
      return;
    }
    if (drill) {
      const key = `drill|${v.drill!.id}|${v.startedAt}`;
      if (key !== this.key) { this.key = key; this.root.dataset.mode = v.mode; this.root.innerHTML = this.drillCard(v); this.root.querySelector<HTMLButtonElement>('button[data-act="drill-again"]')?.focus({ preventScroll: true }); }
      return;
    }
    const key = `${v.phase}|${v.code}|${v.fillBots}|${v.rumble}|${v.mutator}|${v.arena}|${v.level}|${v.ranked}|${v.seats.map(s => s.rank ? `${s.rank.rating}:${s.rank.delta}` : '').join(',')}|${v.hostId}|${v.startsAt ? Math.ceil(v.startsAt - (snapshot?.serverTime ?? 0)) : ''}|${v.seats.map(s => `${s.id}:${s.team}:${s.goals}:${s.kills}:${s.points}`).join(',')}|${v.score.red}-${v.score.blue}`;
    if (key === this.key) return;
    this.key = key;
    this.root.dataset.mode = v.mode;
    this.root.innerHTML = lobby ? this.lobby(v, selfId, snapshot?.serverTime ?? 0) : this.results(v, selfId);
    if (results) { this.root.querySelector('.bu-pay-slot')?.replaceWith(this.pay); this.root.querySelector<HTMLButtonElement>('footer button.go:not(:disabled)')?.focus({ preventScroll: true }); }
  }
  private seatRow(seat: BallSeat, selfId: string, stats: string, feats = false) {
    // The accolades earned (each once, with how many times: HAT TRICK ×2).
    const counts = new Map<string, number>();
    for (const f of feats ? seat.feats ?? [] : []) counts.set(f, (counts.get(f) ?? 0) + 1);
    const badges = counts.size ? `<span class="bu-feats">${[...counts].map(([f, n]) => `<i>${escape(f)}${n > 1 ? ` ×${n}` : ''}</i>`).join('')}</span>` : '';
    // The fighter's ball trait under the name, and a ranked match's stamps (with the change, at the end).
    const trait = seat.trait ? `<span class="bu-trait">${TRAIT_NAMES[seat.trait]}</span>` : '';
    const rank = this.view?.ranked !== undefined && seat.rank && !seat.bot ? stampHtml(seat.rank, seat.rank.delta) : '';
    return `<li class="${seat.id === selfId ? 'self' : ''}"><span class="bu-face">${mangaPortrait(seat.fighter)}</span><span class="bu-who"><b>${escape(nameOf(seat))}</b>${trait}${badges}</span>${rank}${seat.bot ? '<small>BOT</small>' : ''}${stats}</li>`;
  }
  private lobby(v: BallView, selfId: string, now: number) {
    const host = v.hostId === selfId, title = v.mode === 'goal-rush' ? 'GOAL RUSH' : 'SKY SPIKE';
    const columns = TEAMS.map(team => {
      const seats = v.seats.filter(s => s.team === team);
      const empty = Array.from({ length: Math.max(0, 3 - seats.length) }, () => `<li class="empty"><b>${v.fillBots ? 'BOT FILLS THIS SEAT' : 'OPEN SEAT'}</b></li>`).join('');
      return `<section class="bu-side ${team}"><h3>${BALL_TEAM_NAMES[team]}</h3><ul>${seats.map(s => this.seatRow(s, selfId, '')).join('')}${empty}</ul></section>`;
    }).join('<div class="bu-vs">VS</div>');
    const starts = v.startsAt !== null ? `<p class="bu-count">KICKING OFF IN ${Math.max(0, Math.ceil(v.startsAt - now))}</p>` : '';
    const rules = v.rumble ? 'RUMBLE' : v.mutator ? MUTATOR_NAMES[v.mutator] : 'CLASSIC';
    return `<div class="bu-card"><header><small>${v.access === 'host' ? 'PRIVATE ROOM' : v.ranked !== undefined ? 'RANKED MATCHMAKING' : 'MATCHMAKING'}${v.rumble ? ' · RUMBLE' : v.mutator ? ` · ${MUTATOR_NAMES[v.mutator]}` : ''}${v.arena ? ` · ${escape(BALL_ARENAS[v.arena].name.toUpperCase())}` : ''}${v.level ? ` · ${v.level.toUpperCase()} BOTS` : ''}</small><h2>${title}</h2>${v.code && v.access === 'host' ? `<p class="bu-code">ROOM CODE <b>${escape(v.code)}</b></p>` : ''}${v.mutator ? `<p class="bu-rules">${escape(mutatorLine(v.mutator, v.mode))}</p>` : ''}${v.ranked !== undefined ? '<p class="bu-rules">Rated against the people on the other side; bots don\'t count. People on both sides at kickoff, or it\'s unranked.</p>' : ''}</header>
      <div class="bu-teams">${columns}</div>${starts}
      <footer><button data-act="swap">SWITCH SIDES</button>${host ? `<button data-act="fill" class="${v.fillBots ? 'on' : ''}">BOTS FILL: ${v.fillBots ? 'ON' : 'OFF'}</button>${v.access === 'host' ? `<button data-act="rules" class="${rules !== 'CLASSIC' ? 'on' : ''}">RULES: ${rules}</button><button data-act="arena">ARENA: ${escape(BALL_ARENAS[v.arena ?? MODE_ARENAS[v.mode][0]].name.replace(/^The /, '').toUpperCase())}</button>` : ''}<button data-act="start" class="go">START</button>` : v.access === 'host' ? '<span>WAITING FOR THE HOST</span>' : ''}<button data-act="leave">LEAVE</button></footer></div>`;
  }
  private results(v: BallView, selfId: string) {
    const own = v.seats.find(s => s.id === selfId)?.team, won = v.winner && v.winner !== 'draw' && v.winner === own;
    const head = v.winner === 'draw' || !v.winner ? 'DRAW' : won ? 'VICTORY' : 'DEFEAT';
    const mvp = v.seats.find(s => s.id === v.mvp);
    const goal = v.mode === 'goal-rush';
    const header = goal ? '<i>G</i><i>A</i><i>SV</i><i>SH</i><i>PTS</i>' : '<i>KILL</i><i>ACE</i><i>BLK</i><i>DIG</i><i>PTS</i>';
    // A ranked match says how near the next stamp is; what the match paid sits by PLAY AGAIN (ballPay.ts). A
    // private room's host has REMATCH - the same people, the same room, its short intro - and the others wait for it.
    const me = v.seats.find(s => s.id === selfId), rank = v.ranked && me?.rank ? rankNext(me.rank) : '';
    const again = v.access !== 'host' ? '<button data-act="again" class="go">PLAY AGAIN</button>'
      : v.hostId === selfId ? '<button data-act="rematch" class="go">REMATCH</button>' : '<button class="go" disabled>REMATCH · THE HOST STARTS IT</button>';
    const stat = (s: BallSeat) => `<span class="bu-stats">${(goal ? [s.goals, s.assists, s.saves, s.shots, s.points] : [s.kills, s.aces, s.blocks, s.digs, s.points]).map(n => `<i>${n}</i>`).join('')}</span>`;
    const columns = TEAMS.map(team => {
      const seats = v.seats.filter(s => s.team === team).sort((a, b) => b.points - a.points);
      return `<section class="bu-side ${team}${v.winner === team ? ' won' : ''}"><h3>${BALL_TEAM_NAMES[team]} <b>${v.score[team]}</b></h3><div class="bu-head">${header}</div><ul>${seats.map(s => this.seatRow(s, selfId, (s.id === v.mvp ? '<em>MVP</em>' : '') + stat(s), true)).join('')}</ul></section>`;
    }).join('');
    return `<div class="bu-card results ${won ? 'won' : 'lost'}"><header><small>${goal ? 'GOAL RUSH' : 'SKY SPIKE'}${v.rumble ? ' RUMBLE' : v.mutator ? ` ${MUTATOR_NAMES[v.mutator]}` : ''}${v.ranked ? ' · RANKED' : v.ranked === false ? ' · UNRANKED' : ''} · ${escape(v.reason.toUpperCase())}</small><h2>${head}</h2>
      <p class="bu-final"><span class="red">${v.score.red}</span> – <span class="blue">${v.score.blue}</span></p>${mvp ? `<p class="bu-mvp">MVP <b>${escape(nameOf(mvp))}</b> · ${mvp.points} PTS</p>` : ''}${rank}</header>
      <div class="bu-teams results">${columns}</div>
      <footer><div class="bu-pay-slot"></div>${again}<button data-act="leave">LEAVE</button></footer></div>`;
  }
  /** A drill's ten balls done: how many were right, the medal, the best kept, and AGAIN, NEXT DRILL, LEAVE. */
  private drillCard(v: BallView) {
    const d = v.drill!, def = DRILLS[d.id], list = MODE_DRILLS[v.mode], next = list[(list.indexOf(d.id) + 1) % list.length], best = this.drillBest;
    const medal = d.medal ? `<p class="bu-medal ${d.medal}"><i>${MEDAL_MARK[d.medal]}</i>${d.medal.toUpperCase()} MEDAL</p>` : `<p class="bu-medal none">NO MEDAL · BRONZE AT ${def.medals[0]}</p>`;
    // The next medal over the best kept, and how many more balls it takes than the best.
    const held = best?.medal ? MEDALS.indexOf(best.medal) + 1 : 0, nextMedal = MEDALS[held];
    const kept = best?.best ?? d.done;
    const toGo = nextMedal ? `<p class="bu-next"><b>NEXT · ${nextMedal.toUpperCase()}</b><span>${def.medals[held]} / ${d.balls}</span><i><u style="width:${Math.round(Math.min(1, kept / def.medals[held]) * 100)}%"></u></i><small>${def.medals[held] - kept} MORE THAN YOUR BEST</small></p>` : '<p class="bu-next"><b>GOLD</b><small>EVERY MEDAL WON</small></p>';
    const dots = d.results.map(r => `<i class="${r ? 'hit' : 'miss'}"></i>`).join('');
    return `<div class="bu-card results ${d.medal ? 'won' : 'lost'}"><header><small>${v.mode === 'goal-rush' ? 'GOAL RUSH' : 'SKY SPIKE'} · DRILL</small><h2>${escape(def.name)}</h2>
      <p class="bu-final">${d.done} / ${d.balls}</p><p class="bu-dots">${dots}</p>${medal}${best?.improved && d.done > 0 ? '<p class="bu-rules">YOUR BEST YET</p>' : best ? `<p class="bu-rules">YOUR BEST: ${best.best} / ${d.balls}</p>` : ''}${toGo}</header>
      <footer><button data-act="drill-again" class="go">AGAIN</button><button data-act="drill-next" data-drill="${next}">NEXT: ${escape(DRILLS[next].name)}</button><button data-act="leave">LEAVE</button></footer></div>`;
  }
  /** LEARN TO PLAY done (game/ball/lesson.ts): the steps ticked, YOU'RE READY, and the match - KICK OFF (or SERVE)
   *  against EASY bots, the lesson AGAIN, or LEAVE. */
  private lessonCard(v: BallView) {
    const l = v.lesson!, steps = LESSON[v.mode], goal = v.mode === 'goal-rush';
    const ticks = steps.map(s => `<li class="${l.done.includes(s.id) ? 'hit' : 'miss'}"><i aria-hidden="true">${l.done.includes(s.id) ? '✓' : '–'}</i>${escape(s.title)}</li>`).join('');
    return `<div class="bu-card results won bu-learn"><header><small>${goal ? 'GOAL RUSH' : 'SKY SPIKE'} · LEARN TO PLAY</small><h2>YOU'RE READY</h2>
      <p class="bu-rules">${l.done.length} OF ${steps.length} DONE · NOW A REAL ${goal ? 'MATCH' : 'GAME'}: YOU AND TWO BOTS AGAINST THREE</p><ol class="bu-learn-steps">${ticks}</ol></header>
      <footer><button data-act="kick-off" class="go">${goal ? 'KICK OFF' : 'SERVE'} · VS EASY BOTS</button><button data-act="drill-again">AGAIN</button><button data-act="leave">LEAVE</button></footer></div>`;
  }
  clear() { this.root.classList.add('hidden'); this.root.innerHTML = ''; this.key = ''; this.view = undefined; this.badge.clear(); this.pay.replaceChildren(); this.pay.classList.add('hidden'); }
}
