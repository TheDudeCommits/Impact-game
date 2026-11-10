import { FIGHTERS } from '../../config';
import { BALL_ARENAS } from '../../game/ball/arenas';
import { BALL_TEAM_NAMES, BALL_TEAM_COLOURS, type BallSeat, type BallTeam, type BallView } from '../../game/ball/model';
import type { FighterId } from '../../game/types';
import { mangaPortrait } from '../MangaHome';
import { vsArt, vsFaceAt } from '../VsSplash';
import { brushStroke, inkSplats } from '../inkSplat';
import { pictures } from '../hud/protos/proto';
import { VFX } from '../../render/vfxLevel';
import './ballShow.css';

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const nameOf = (seat: BallSeat) => (seat.bot || seat.name === 'Fighter' ? FIGHTERS[seat.fighter].name : seat.name).toUpperCase();
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const SEAM = brushStroke(11, .8), STROKE = brushStroke(7, .62);
/** The signature cut-in, start to finish (ballShow.css runs its beats inside it). */
export const CUT_IN_SECONDS = 1.2;
/** What the show is doing, for the HUD's CSS (#interface[data-ball-show]): the intro, a goal's close-up, the podium. */
export type ShowMode = 'intro' | 'close' | 'podium' | '';

/**
 * The ball modes' spectacle on the page, drawn in the VS splash's ink, paper
 * and red. BallCeremony (render/ball) times it from the room's clock; this only draws:
 *
 * - the intro's title over the flyover (the arena, the mode), its splash page - both sides of three as a manga page, the
 *   VS stamped on the seam - and its skip prompt with the vote;
 * - a SUPER SHOT's cut-in: the screen goes ink, a slanted panel slams in with the striker's bust (the HUD's own busts) and
 *   the shot's name, 1.2 s;
 * - the podium's accolades dropping in as manga panels;
 * - a goal's held picture over the canvas at the net's furthest stretch (render/ball/GoalHold.ts).
 *
 * Pictures only: it never takes focus or the pointer. With reduced motion everything only fades; the VISUAL EFFECTS
 * level's Minimal leaves the cut-in to the HUD's banner.
 */
export class BallShow {
  readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly splash: HTMLElement;
  private readonly skip: HTMLElement;
  private readonly cut: HTMLElement;
  private readonly podium: HTMLElement;
  private titleKey = ''; private splashKey = ''; private podiumKey = ''; private skipText = '';
  private cutTimer = 0;
  /** The goal's held picture, laid over the game's canvas while it holds (holdFrame). */
  private held: HTMLCanvasElement | null = null;
  constructor(private readonly host: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'ball-show';
    this.root.setAttribute('aria-hidden', 'true');
    this.title = this.layer('bs-title'); this.splash = this.layer('bs-splash'); this.skip = this.layer('bs-skip');
    this.cut = this.layer('bs-cut'); this.podium = this.layer('bs-podium');
    host.append(this.root);
  }
  private layer(cls: string) { const el = document.createElement('div'); el.className = cls; el.hidden = true; this.root.append(el); return el; }

  /** The page is played by touch (the prompts say TAP). */
  get touch() { return this.host.dataset.input === 'touch'; }
  /** What the show holds the screen for (the HUD steps back under it: ballShow.css). */
  mode(mode: ShowMode) { if (mode) this.host.dataset.ballShow = mode; else delete this.host.dataset.ballShow; }

  /** The intro's title card over the flyover: the arena's name and line, the mode, the two sides. */
  introTitle(v: BallView | null) {
    if (!v) { if (this.titleKey) { this.title.hidden = true; this.titleKey = ''; } return; }
    const key = `${v.startedAt}:${v.round}:${v.arena}`;
    if (key === this.titleKey) return;
    this.titleKey = key;
    const arena = v.arena ? BALL_ARENAS[v.arena] : undefined;
    this.title.innerHTML = `<div class="bs-title-card"><small>${v.mode === 'goal-rush' ? 'GOAL RUSH' : 'SKY SPIKE'} · 3 V 3${v.rumble ? ' · RUMBLE' : ''}</small>
      <strong>${esc((arena?.name ?? '').toUpperCase())}</strong><span>${esc(arena?.blurb ?? '')}</span></div>
      <div class="bs-title-sides"><b class="red">${BALL_TEAM_NAMES.red}</b><i>VS</i><b class="blue">${BALL_TEAM_NAMES.blue}</b></div>`;
    this.title.hidden = false;
    this.restart(this.title, 'bs-on');
  }

  /** The splash page: your side over the seam, the other under it, three panels each, the VS stamped between.
   *  `kicker`: a line beside the VS (the short intro's - GOAL RUSH · REMATCH · THE INK BOWL - with no title card
   *  before it). */
  introSplash(v: BallView | null, selfId: string, kicker?: string) {
    if (!v) { if (this.splashKey) { this.splash.classList.add('bs-out'); window.setTimeout(() => { if (!this.splashKey) this.splash.hidden = true; }, 380); } this.splashKey = ''; return; }
    const key = `${v.startedAt}:${v.round}:${kicker ?? ''}`;
    if (key === this.splashKey) return;
    this.splashKey = key;
    const own = v.seats.find(s => s.id === selfId)?.team ?? 'red', other: BallTeam = own === 'red' ? 'blue' : 'red';
    const band = (team: BallTeam, cls: string) => {
      const seats = v.seats.filter(s => s.team === team);
      const cells = seats.map((s, i) => {
        const colour = FIGHTERS[s.fighter].color;
        return `<section class="bs-cell" style="--tint:${colour};--i:${i};--face:${vsFaceAt(s.fighter)}"><div class="bs-lines"></div>
          <img alt="" decoding="async" draggable="false" data-fighter="${s.fighter}" src="${vsArt(s.fighter)}"><div class="bs-tone"></div>
          <div class="bs-cell-name">${s.id === selfId ? '<small>YOU</small>' : s.bot ? '<small>BOT</small>' : ''}<strong>${esc(nameOf(s))}</strong></div></section>`;
      }).join('');
      return `<div class="bs-band ${cls}" style="--team:${hex(BALL_TEAM_COLOURS[team])}"><h3>${BALL_TEAM_NAMES[team]}${team === own ? '<small>YOUR SIDE</small>' : ''}</h3><div class="bs-cells">${cells}</div></div>`;
    };
    this.splash.innerHTML = `<div class="bs-page">${band(own, 'bs-top')}${band(other, 'bs-bottom')}
      <svg class="bs-seam" viewBox="0 0 1000 200" preserveAspectRatio="none"><path d="${SEAM}"/></svg>
      <div class="bs-vs"><svg viewBox="-50 -50 100 100"><path d="${inkSplats()[3]}"/></svg><b>VS</b></div>${kicker ? `<div class="bs-kicker"><span>${esc(kicker)}</span></div>` : ''}</div><div class="bs-flash"></div>`;
    for (const img of this.splash.querySelectorAll<HTMLImageElement>('img')) img.addEventListener('error', () => {
      const span = document.createElement('span'); span.className = 'bs-fallback'; span.innerHTML = mangaPortrait(img.dataset.fighter as FighterId); img.replaceWith(span);
    }, { once: true });
    this.splash.classList.remove('bs-out');
    this.splash.hidden = false;
    this.restart(this.splash, 'bs-on');
  }

  /** The skip prompt and its vote; null hides it. */
  skipPrompt(text: string | null) {
    if (text === null) { if (!this.skip.hidden) { this.skip.hidden = true; this.skipText = ''; } return; }
    if (text !== this.skipText) { this.skipText = text; this.skip.innerHTML = `<span>${text}</span>`; }
    this.skip.hidden = false;
  }

  /** A SUPER SHOT's cut-in. `own`: the page's own side's (it slams in from the left; the other side's from the right). */
  cutIn(fighter: FighterId, name: string, kicker: string, team: BallTeam, own: boolean, signature: boolean) {
    if (VFX.level === 'minimal') return;
    clearTimeout(this.cutTimer);
    const art = pictures(fighter, false), colour = FIGHTERS[fighter].color;
    this.cut.className = `bs-cut ${own ? 'bs-mine' : 'bs-theirs'}${signature ? ' bs-sig' : ''}${VFX.level === 'reduced' ? ' bs-soft' : ''}`;
    this.cut.style.setProperty('--tint', colour); this.cut.style.setProperty('--team', hex(BALL_TEAM_COLOURS[team]));
    this.cut.innerHTML = `<div class="bs-cut-ink"></div><div class="bs-cut-panel"><div class="bs-cut-lines"></div><img alt="" decoding="async" draggable="false"><div class="bs-cut-tone"></div></div>
      <div class="bs-cut-name"><small>${esc(kicker)}</small><svg viewBox="0 0 1000 200" preserveAspectRatio="none"><path d="${STROKE}"/></svg><b>${esc(name)}</b></div>`;
    // The bust, else the next picture the HUD has (proto.ts pictures: the bust, the manga portrait).
    const img = this.cut.querySelector('img')!;
    let at = 0; img.addEventListener('error', () => { if (++at < art.length) img.src = art[at]; else img.remove(); });
    img.src = art[0];
    this.cut.hidden = false;
    this.restart(this.cut, 'bs-on');
    this.cutTimer = window.setTimeout(() => { this.cut.hidden = true; this.cut.innerHTML = ''; }, CUT_IN_SECONDS * 1000);
  }

  /** The podium's panels: the champions' banner, then each of the three's accolades dropping in. */
  podiumPanels(v: BallView | null, selfId: string, order: readonly string[]) {
    if (!v) { if (this.podiumKey) { this.podium.hidden = true; this.podium.innerHTML = ''; this.podiumKey = ''; } return; }
    const key = `${v.startedAt}:${v.round}:${v.endsAt}`;
    if (key === this.podiumKey) return;
    this.podiumKey = key;
    const seats = order.map(id => v.seats.find(s => s.id === id)).filter((s): s is BallSeat => !!s);
    const team = seats[0]?.team ?? 'red';
    // Each fighter's accolades, once each with how many; the MVP's first. Nothing earned: the line they played.
    let delay = 1.1;
    const panels = seats.flatMap((s, i) => {
      const counts = new Map<string, number>();
      for (const f of s.feats ?? []) counts.set(f, (counts.get(f) ?? 0) + 1);
      const lines = [...counts].slice(0, i === 0 ? 3 : 2).map(([f, n]) => `${f}${n > 1 ? ` ×${n}` : ''}`);
      if (s.id === v.mvp) lines.unshift('MVP');
      if (!lines.length) lines.push(v.mode === 'goal-rush' ? `${s.goals} GOALS · ${s.saves} SAVES` : `${s.kills} KILLS · ${s.blocks} BLOCKS`);
      return lines.map((line, k) => {
        const d = (delay += .38) - .38;
        return `<section class="bs-panel${line === 'MVP' ? ' bs-mvp' : ''}${s.id === selfId ? ' bs-self' : ''}" style="--d:${d.toFixed(2)}s;--tint:${FIGHTERS[s.fighter].color};--slot:${i};--k:${k}">
          <span class="bs-face">${mangaPortrait(s.fighter)}</span><span><small>${esc(nameOf(s))}</small><b>${esc(line)}</b></span></section>`;
      });
    }).slice(0, 7).join('');
    const won = v.winner && v.winner !== 'draw' ? v.winner : team;
    this.podium.style.setProperty('--team', hex(BALL_TEAM_COLOURS[won]));
    this.podium.innerHTML = `<header class="bs-champs"><small>${v.mode === 'goal-rush' ? 'GOAL RUSH' : 'SKY SPIKE'} · ${v.score.red} – ${v.score.blue}</small><strong>${BALL_TEAM_NAMES[won]} WIN</strong></header><div class="bs-panels">${panels}</div>`;
    this.podium.hidden = false;
    this.restart(this.podium, 'bs-on');
  }

  /** The goal's hold (render/ball/GoalHold.ts): the frame just drawn, kept on the screen over the game's
   *  canvas - an exact copy, laid on it in the same place, under the HUD - until `null` lets the canvas show again. */
  holdFrame(source: HTMLCanvasElement | null) {
    if (!source) { if (this.held) { this.held.hidden = true; this.held.width = this.held.height = 1; } return; }
    const parent = source.parentElement;
    if (!parent) return;
    let held = this.held;
    if (!held) { held = this.held = document.createElement('canvas'); held.className = 'bs-held'; held.setAttribute('aria-hidden', 'true'); }
    if (held.parentElement !== parent || held.previousElementSibling !== source) source.after(held);
    held.width = source.width; held.height = source.height;
    // (Fixed where the canvas is on the screen; the HUD after it in the page stays over both.)
    const box = source.getBoundingClientRect();
    Object.assign(held.style, {left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px`});
    held.getContext('2d')?.drawImage(source, 0, 0);
    held.hidden = false;
  }

  private restart(el: HTMLElement, cls: string) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  clear() {
    clearTimeout(this.cutTimer);
    for (const el of [this.title, this.splash, this.skip, this.cut, this.podium]) { el.hidden = true; el.innerHTML = ''; }
    this.holdFrame(null);
    this.titleKey = this.splashKey = this.podiumKey = this.skipText = '';
    this.mode('');
  }
}
