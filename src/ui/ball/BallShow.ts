import { FIGHTERS } from '../../config';
import { BALL_ARENAS } from '../../game/ball/arenas';
import { BALL_TEAM_NAMES, BALL_TEAM_COLOURS, type BallSeat, type BallTeam, type BallView } from '../../game/ball/model';
import type { FighterId } from '../../game/types';
import { mangaPortrait } from '../MangaHome';
import { vsArt, vsFaceAt } from '../VsSplash';
import { brushStroke, inkSplats } from '../inkSplat';
import { bust, pictures } from '../hud/protos/proto';
import { mediaArt } from '../mediaArt';
import { DUEL } from '../../game/ball/superShots';
import type { BallEvent } from '../../game/ball/model';
import { SHOT_NAMES, SHOT_NAMES_URL, shotNameRow } from './shotNames';
import { VFX } from '../../render/vfxLevel';
import './ballShow.css';

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const nameOf = (seat: BallSeat) => (seat.bot || seat.name === 'Fighter' ? FIGHTERS[seat.fighter].name : seat.name).toUpperCase();
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const SEAM = brushStroke(11, .8), STROKE = brushStroke(7, .62);
/** The signature shot's spread, start to finish (ballShow.css runs its beats inside it). 0.9 s (the
 *  cut-in it replaced held 1.2). */
export const CUT_IN_SECONDS = .9;
/** How long a TECHNIQUE DUEL's face-off stays up once the beat is over, to show who was nearer the mark (s). */
export const FACE_OFF_AFTER = .5;
/** Where each fighter's eyes sit down their manga portrait (public/assets/home/portraits, 640 square),
 *  as a share of its height - read off a contact sheet of every portrait (the band .2 of the portrait's height round it,
 *  two thirds of its width across). Unlisted: EYES_DEFAULT. */
export const EYES_DEFAULT = .37;
export const EYES_AT: Readonly<Partial<Record<FighterId, number>>> = {
  adad: .34, akagane: .34, akaito: .35, akayuri: .38, amagoi: .36, ampere: .38, aqrab: .31, aquilo: .36, asahi: .38, barrow: .29,
  basilissa: .29, bellows: .32, bonsho: .31, bruin: .36, buria: .38, cardo: .36, chohan: .33, dorado: .29, 'full-beam': .28, gaku: .38,
  gaunt: .34, gohaku: .43, gosu: .36, gummy: .39, hagure: .4, hakushi: .29, haldor: .26, hawser: .36, highsun: .24, hikui: .36,
  hinomoto: .29, hisame: .36, imago: .38, ippon: .29, irbis: .41, jinlin: .35, jirenga: .32, kagari: .38, kenzo: .33, kinu: .42,
  koko: .35, konta: .36, kosho: .34, kubiwa: .36, kuon: .35, kusushi: .36, kuzu: .36, lanthorn: .36, levin: .38, madake: .33,
  magatsu: .35, mikage: .43, minase: .4, mizuhiki: .38, murex: .38, nigo: .46, onigawara: .34, oro: .36, ouga: .41, ovid: .42,
  oyashio: .33, psyche: .36, pyroclast: .38, rook: .36, rotfalke: .42, sashigane: .36, sekka: .43, senko: .33, setsu: .4,
  shakudo: .4, shakugo: .34, shanxiao: .38, shibuichi: .36, shidare: .36, shijima: .36, shirokane: .36, shiun: .36, sorayomi: .36,
  sorrel: .4, strix: .33, suzuran: .36, taisei: .39, tempo: .41, tobari: .42, tokan: .34, torsion: .36, tsubute: .38, ume: .4,
  unari: .36, vesper: .33, ward: .42, wataame: .4, wuming: .42, yodaka: .4,
} as Partial<Record<FighterId, number>>;
/** The eyes' strip: the portrait drawn 1.5 times the strip's width (two thirds of it across), the strip 10:3, so the
 *  band shown is .2 of the portrait's height; `background-position-y` (%) that puts the eyes on its middle line. */
export const eyesY = (fighter: FighterId) => { const e = EYES_AT[fighter] ?? EYES_DEFAULT; return Math.max(0, Math.min(100, (1.5 * e - .15) / 1.2 * 100)); };
const portraitArt = (fighter: FighterId) => mediaArt(`/assets/home/portraits/${fighter}.webp`);
/** What the show is doing, for the HUD's CSS (#interface[data-ball-show]): the intro, a goal's close-up, the podium. */
export type ShowMode = 'intro' | 'close' | 'podium' | '';

/**
 * The ball modes' spectacle on the page, drawn in the VS splash's ink, paper
 * and red. BallCeremony (render/ball) times it from the room's clock; this only draws:
 *
 * - the intro's title over the flyover (the arena, the mode), its splash page - both sides of three as a manga page, the
 *   VS stamped on the seam - and its skip prompt with the vote;
 * - a SUPER SHOT's spread (it replaced the earlier cut-in): a drawn page with the striker's ink portrait, a
 *   panel cut in it for the shot's flight and the shot's name brushed across its foot, 0.9 s;
 * - a TECHNIQUE DUEL's face-off - the two fighters' eyes, the ball white-hot between them and the mark;
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
  private readonly duel: HTMLElement;
  private titleKey = ''; private splashKey = ''; private podiumKey = ''; private skipText = '';
  private cutTimer = 0;
  /** The goal's held picture, laid over the game's canvas while it holds (holdFrame). */
  private held: HTMLCanvasElement | null = null;
  constructor(private readonly host: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'ball-show';
    this.root.setAttribute('aria-hidden', 'true');
    this.title = this.layer('bs-title'); this.splash = this.layer('bs-splash'); this.skip = this.layer('bs-skip');
    this.cut = this.layer('bs-cut'); this.podium = this.layer('bs-podium'); this.duel = this.layer('bs-duel');
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

  /** A SUPER SHOT's spread (it replaced the earlier cut-in): a drawn page across the whole screen for
   *  CUT_IN_SECONDS - paper, the striker's ink portrait bleeding off their side, the speed lines - with a panel cut in
   *  it where the match goes on (the shot's flight is never hidden), and the shot's name brushed across its foot
   *  (shotNames.ts: a signature shot's own name, else SUPER SHOT), then it is torn away and the shot is the screen's.
   *  `own`: the page's own side's (the art on the left; the other side's on the right). In a couch split screen
   *  (`couch`) only the name is laid, under each half's own lens. */
  cutIn(fighter: FighterId, name: string, kicker: string, team: BallTeam, own: boolean, signature: boolean, couch = false) {
    if (VFX.level === 'minimal') return;
    clearTimeout(this.cutTimer);
    const colour = FIGHTERS[fighter].color, row = shotNameRow(name);
    this.cut.className = `bs-cut ${own ? 'bs-mine' : 'bs-theirs'}${signature ? ' bs-sig' : ''}${couch ? ' bs-couch' : ''}${VFX.level === 'reduced' ? ' bs-soft' : ''}`;
    this.cut.style.setProperty('--tint', colour); this.cut.style.setProperty('--team', hex(BALL_TEAM_COLOURS[team]));
    this.cut.style.setProperty('--row', `${row / (SHOT_NAMES.length - 1) * 100}%`); this.cut.style.setProperty('--rows', `${SHOT_NAMES.length * 100}%`);
    this.cut.style.setProperty('--names', `url("${SHOT_NAMES_URL}")`);
    this.cut.innerHTML = `<div class="bs-cut-page"><div class="bs-cut-lines"></div><div class="bs-cut-art"><img alt="" decoding="async" draggable="false"></div><div class="bs-cut-tone"></div></div>
      <svg class="bs-cut-frame" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${own ? 'M41 11L97 7L93 70L45 74Z' : 'M3 7L59 11L55 74L7 70Z'}"/></svg>
      <div class="bs-cut-name"><small>${esc(kicker)}</small><svg viewBox="0 0 1000 200" preserveAspectRatio="none"><path d="${STROKE}"/></svg>
        <div class="bs-cut-word" role="img" aria-label="${esc(name)}"><i class="bs-ink"></i><i class="bs-fill"></i></div></div>`;
    // The manga portrait (the ink the page is drawn in), else the HUD's pictures.
    const img = this.cut.querySelector('img')!, art = [portraitArt(fighter), ...pictures(fighter, false)];
    let at = 0; img.addEventListener('error', () => { if (++at < art.length) img.src = art[at]; else img.remove(); });
    img.src = art[0];
    this.cut.hidden = false;
    this.restart(this.cut, 'bs-on');
    this.cutTimer = window.setTimeout(() => { this.cut.hidden = true; this.cut.innerHTML = ''; }, CUT_IN_SECONDS * 1000);
  }
  /** The brushed names' atlas, asked for once a ball match starts so the first SUPER SHOT's name is there in time. */
  preloadNames() { if (this.namesAsked || VFX.level === 'minimal') return; this.namesAsked = true; const img = new Image(); img.decoding = 'async'; img.src = SHOT_NAMES_URL; }
  private namesAsked = false;

  /** A TECHNIQUE DUEL's face-off, the picture of its beat. Two strips of the two fighters' eyes
   *  (their manga portraits, EYES_AT) slam in across the screen, the page's own side's below; between them the ball,
   *  white-hot, and the mark: a ring closing on the ball that meets its edge at the mark (DUEL.mark), as the page draws
   *  the beat (duelBeat) - the moment the room judges a press against. `selves`: the people on this page (a couch split
   *  screen's two, each half its own panel, its own prompt). */
  faceOff(view: BallView, e: BallEvent, selves: readonly string[], split: boolean) {
    const keeper = view.seats.find(s => s.id === e.actorId), striker = view.seats.find(s => s.id === e.targetId);
    if (!keeper) return;
    this.duelAt = e.at; this.duelEnd = Infinity; this.duelKey = e.id;
    const halves = split && selves.length > 1 ? selves : [selves[0]];
    const strip = (seat: BallSeat | undefined, role: 'keeper' | 'striker', low: boolean) => {
      const f = seat?.fighter, team = seat?.team ?? (role === 'keeper' ? 'blue' : 'red');
      const eyes = f ? `background-image:url('${portraitArt(f)}'),url('${bust(f, false)}');background-position:50% ${eyesY(f).toFixed(1)}%,50% 30%` : '';
      return `<div class="bs-duel-strip ${low ? 'bs-low' : 'bs-high'}" data-role="${role}" style="--team:${hex(BALL_TEAM_COLOURS[team])};--tint:${f ? FIGHTERS[f].color : '#888'}">
        <div class="bs-duel-eyes" style="${eyes}"></div><div class="bs-duel-tone"></div>
        <div class="bs-duel-tag"><small>${role === 'keeper' ? 'THE GUARD' : 'THE SHOT'}</small><b>${seat ? esc(nameOf(seat)) : ''}</b><em></em></div></div>`;
    };
    const prompt = this.touch ? 'TAP DUEL ON THE MARK' : 'STRIKE ON THE MARK';
    this.duel.innerHTML = halves.map((self, i) => {
      const mine = self === keeper.id ? 'keeper' : self === striker?.id ? 'striker' : '';
      const ownTeam = view.seats.find(s => s.id === self)?.team;
      // (The page's own side's strip is the lower one.)
      const keeperLow = ownTeam ? ownTeam === keeper.team : true;
      return `<div class="bs-duel-half" data-half="${halves.length > 1 ? i : ''}">${strip(striker, 'striker', !keeperLow)}${strip(keeper, 'keeper', keeperLow)}
        <div class="bs-duel-core"><i class="bs-duel-ball"></i><i class="bs-duel-ring"></i><b class="bs-duel-word">TECHNIQUE DUEL</b><small class="bs-duel-prompt">${mine ? prompt : ''}</small><strong class="bs-duel-stamp"></strong></div></div>`;
    }).join('');
    this.duel.className = `bs-duel${split && halves.length > 1 ? ' bs-split' : ''}${VFX.level === 'reduced' ? ' bs-soft' : ''}`;
    this.rings = [...this.duel.querySelectorAll<HTMLElement>('.bs-duel-ring')];
    this.duel.hidden = false; this.host.dataset.ballDuel = '';
    this.restart(this.duel, 'bs-on');
  }
  /** Each frame, the face-off's beat on the page's drawn clock (`now`, room seconds): the ring closing to the ball's edge
   *  at the mark, on past it, and the face-off taken down FACE_OFF_AFTER after its end. */
  duelBeat(now: number) {
    if (this.duel.hidden) return;
    if (now >= this.duelEnd + FACE_OFF_AFTER || now < this.duelAt - 1) { this.closeDuel(); return; }
    const t = now - this.duelAt, k = t <= DUEL.mark ? 1 + 2.2 * (1 - t / DUEL.mark) : Math.max(.55, 1 - (t - DUEL.mark) / (DUEL.hold - DUEL.mark) * .45);
    for (const ring of this.rings) { ring.style.scale = k.toFixed(3); ring.classList.toggle('bs-at', Math.abs(t - DUEL.mark) < .04); }
  }
  /** The duel's end (its 'duel-won' event): the winner's strip flares, the other greys, each says how near it pressed. */
  faceOffEnd(e: BallEvent) {
    if (this.duel.hidden) return;
    this.duelEnd = e.at;
    const won = e.text === 'SHOT STOPPED' ? 'keeper' : 'striker';
    const said = (ms: number | undefined) => ms === undefined ? 'MISSED' : Math.abs(ms) <= 30 ? 'ON THE MARK' : `${Math.abs(ms)} MS ${ms < 0 ? 'EARLY' : 'LATE'}`;
    for (const strip of this.duel.querySelectorAll<HTMLElement>('.bs-duel-strip')) {
      const role = strip.dataset.role as 'keeper' | 'striker';
      strip.classList.add(role === won ? 'bs-won' : 'bs-lost');
      strip.querySelector('em')!.textContent = said(e.presses?.[role]);
    }
    for (const stamp of this.duel.querySelectorAll<HTMLElement>('.bs-duel-stamp')) stamp.textContent = won === 'keeper' ? 'STOPPED!' : 'THROUGH!';
    this.duel.classList.add('bs-done');
  }
  private closeDuel() { delete this.host.dataset.ballDuel; this.duel.hidden = true; this.duel.innerHTML = ''; this.rings = []; this.duelKey = -1; }
  /** The duel the face-off is up for (its event's id; -1: none). */
  duelKey = -1;
  private duelAt = 0; private duelEnd = Infinity; private rings: HTMLElement[] = [];

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
    this.closeDuel();
    this.holdFrame(null);
    this.titleKey = this.splashKey = this.podiumKey = this.skipText = '';
    this.mode('');
  }
}
