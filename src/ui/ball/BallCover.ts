import { FIGHTERS } from '../../config';
import { BALL_ARENAS } from '../../game/ball/arenas';
import { BALL_TEAM_COLOURS, BALL_TEAM_NAMES, GOAL_RULES, SPIKE_RULES, type BallSeat, type BallView } from '../../game/ball/model';
import { posePoster } from '../HomePreview';
import { halves } from '../../couch/split';
import { SHELF, shelfHtml, type CoverFace } from './coverShelf';
import './ballCover.css';

/**
 * The final whistle's cover: the winning frame freezes into a volume cover - the title, the score, the MVP inked
 * large - and good ones go on your shelf. At the whistle the winning
 * frame - the one drawn as the clock ran out, or as the deciding goal or point went in (render/ball/BallCeremony.ts picks
 * it and copies it here as it is drawn) - freezes over the game's canvas, and a manga volume's cover is laid on it: the
 * frame's middle as the cover's art, the mode's title over it as a logo, the volume (this device's matches of the mode,
 * as the home's volumes are VOL.1, VOL.2), the score on a seal in the winners' colour, and the MVP drawn large (the
 * home's full-length figure of their fighter) with their name.
 *
 * The frame keeps its colours: the cover is furniture laid over a frozen frame, never a grade over play. It holds
 * COVER.seconds of the podium's own PODIUM.seconds and lifts off it - the results come when they always did - and the
 * podium's skip skips it with the podium (BallUI lifts it the moment the results are up). The shelf (coverShelf.ts)
 * keeps a still of the cover's art, and draws each kept cover with the same coverHtml over it.
 */
export const COVER = {
  /** Seconds the cover holds the screen from the whistle, and its fade off it (inside the podium's 7.4 s). */
  seconds: 2.4, out: .3,
  /** A volume's shape: width over height. */
  aspect: .68,
  /** Goal Rush: the clock's last seconds (a frame is drawn a tick or two behind the room) in which a frame of play may be
   *  the whistle's - the room ends the match the moment the ball is down once its clock has run out with the sides apart
   *  (BallMatch.timeUp) - and how near the floor the ball must be for it: this high (m), or falling onto it this soon (s). */
  lastLive: .15, ballDown: { high: .6, soon: .25 },
  /** While the next goal or point may end the match (Goal Rush's overtime, or after time; Sky Spike at match point),
   *  every this many frames is kept: the last before the deciding one is drawn is its picture. (The deciding one is
   *  printed: a goal's and a winning point's INK FLASH turn the screen two-tone from the frame they are drawn on.) And
   *  a kept frame older than this many seconds is not that picture: the deciding frame's own then, this long after it is
   *  drawn (a goal's net at its furthest stretch, as GoalHold holds it). */
  every: 2, fresh: 1, settle: .08,
  /** The still kept for the shelf (px), and its encodings' qualities, the smaller tried when the first is too big. */
  still: { width: 240, quality: [.74, .55] as readonly number[] },
} as const;

/** The cover is on everywhere; on this machine `?cover=0` turns it off, for a before and after on one build (the
 *  whistle, the podium and the results then run as they did without it). */
export function coverWanted(location?: { hostname: string; search: string }): boolean {
  if (!location) return true;
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  return !(local && new URLSearchParams(location.search).get('cover') === '0');
}

/** What a frame of a match not yet over may be to its cover (BallCeremony keeps the frames it says): 'live' - Goal
 *  Rush's clock about to run out with the sides apart and the ball down, so the last such frame is the whistle's; 'next'
 *  - the next goal or point may end it (Goal Rush in overtime or after time; Sky Spike with a side at match point,
 *  counting a FEVER point as two); 'decided' - the goal or point that ends it has been scored (as BallMatch.afterPoint
 *  and point() decide: Goal Rush's goal in overtime or after time, Sky Spike's side at its target two clear, or at the
 *  cap). Else null. */
export function winningMoment(view: BallView): 'live' | 'next' | 'decided' | null {
  if (view.practice) return null;
  const { red, blue } = view.score, playing = view.phase === 'live' || view.phase === 'kickoff';
  if (view.mode === 'goal-rush') {
    const b = view.ball, high = b.y - GOAL_RULES.ballRadius * (b.size || 1), down = high <= COVER.ballDown.high || (b.vy < 0 && high <= -b.vy * COVER.ballDown.soon);
    if (view.phase === 'live' && !view.overtime && red !== blue && view.clock <= COVER.lastLive && down) return 'live';
    if (playing && (view.overtime || view.clock <= 0)) return 'next';
    return view.phase === 'scored' && (view.overtime || view.clock <= 0) && red !== blue ? 'decided' : null;
  }
  const target = view.target, cap = Math.max(target, SPIKE_RULES.cap + (target - SPIKE_RULES.target));
  const won = (s: number, o: number) => s >= cap || (s >= target && s - o >= 2);
  if (view.phase === 'scored') return won(red, blue) || won(blue, red) ? 'decided' : null;
  const worth = view.fever ? 2 : 1;
  return playing && (won(red + worth, blue) || won(blue + worth, red)) ? 'next' : null;
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
/** A seat as the cover names it: a bot, and a person who kept the default name, by their fighter's name. */
export const coverName = (seat: BallSeat) => (seat.bot || seat.name === 'Fighter' ? FIGHTERS[seat.fighter].name : seat.name).toUpperCase();

/** What the cover of a match that is over shows. `vol`: its volume. The MVP is the room's; a match with none names the
 *  winners' best. */
export function coverFace(view: BallView, vol: number): CoverFace {
  const won = view.winner && view.winner !== 'draw' ? view.winner : 'draw';
  const best = view.seats.find(s => s.id === view.mvp) ?? [...view.seats].filter(s => won === 'draw' || s.team === won).sort((a, b) => b.points - a.points)[0];
  return { mode: view.mode, vol, arena: view.arena, score: { red: view.score.red, blue: view.score.blue }, winner: won,
    mvp: best ? { name: coverName(best), fighter: best.fighter, team: best.team } : null };
}

/** The cover as drawn, at any size (every length in it is a share of its width): `art` is what fills it - the frozen
 *  frame at the whistle, a kept still on the shelf. */
export function coverHtml(face: CoverFace, art: string): string {
  const title = face.mode === 'goal-rush' ? ['GOAL', 'RUSH'] : ['SKY', 'SPIKE'];
  const won = face.winner === 'draw' ? null : face.winner, mvp = face.mvp;
  const place = face.arena ? BALL_ARENAS[face.arena]?.name.toUpperCase() ?? '' : '';
  const fighter = mvp ? FIGHTERS[mvp.fighter]?.name.toUpperCase() ?? '' : '';
  // The name as large as its length lets it be (a person's may be 16 letters).
  const n = mvp?.name.length ?? 0, size = n <= 6 ? 17 : n <= 8 ? 14 : n <= 11 ? 11 : 8.5;
  // (No span or small in it: the home sets its own face on those under it, and the shelf is drawn there.)
  return `<div class="bc-cover" data-mode="${face.mode}" style="--won:${hex(BALL_TEAM_COLOURS[won ?? mvp?.team ?? 'red'])}"><div class="bc-page">
    <div class="bc-art">${art}</div><i class="bc-hinge"></i>
    <header class="bc-mast"><b class="bc-vol">VOL.<i>${face.vol}</i></b><strong class="bc-title"><b>${title[0]}</b><b>${title[1]}</b></strong>${place ? `<em class="bc-place">${esc(place)}</em>` : ''}</header>
    ${mvp ? `<img class="bc-hero" alt="" src="${posePoster(mvp.fighter)}" decoding="async" draggable="false">` : ''}
    <div class="bc-seal"><b><i class="red">${face.score.red}</i><i class="bc-dash">–</i><i class="blue">${face.score.blue}</i></b><em>${won ? `${BALL_TEAM_NAMES[won]} WIN` : 'DRAW'}</em></div>
    ${mvp ? `<footer class="bc-name" style="--name:${size}cqw"><em>MVP${fighter && fighter !== mvp.name ? ` · ${esc(fighter)}` : ''}</em><strong>${esc(mvp.name)}</strong></footer>` : ''}
  </div></div>`;
}

/** The shelf for Account (coverShelf.ts shelfHtml, drawn with this file's cover): empty when nothing is kept. */
export const coverShelf = () => shelfHtml(coverHtml);

/** The one cover layer on the page, for BallUI to lift when the results come up. */
let current: BallCover | null = null;
/** The results are up (the podium was skipped, or it ended): the cover goes with it. */
export function liftCover() { current?.lift(); }

/**
 * The cover on the page: the frozen frame and the cover over it, a layer of its own over the show (ui/ball/BallShow.ts)
 * and under the results. BallCeremony copies the frame into it as it is drawn (capture), shows it at the whistle and
 * tells it the page's time each frame; BallUI lifts it when the results are up. Nothing allocates in a frame but
 * capture's copy (a GPU blit) on the frames it is asked for.
 */
export class BallCover {
  readonly root: HTMLElement;
  /** The frozen frame: the whole frame as drawn, laid over the game's canvas where it is (as the goal's hold is). */
  private readonly frame: HTMLCanvasElement;
  private readonly stage: HTMLElement;
  /** Which match the frame held is from (BallCeremony's key), and when the cover went up / starts to lift (page s). */
  private frameKey = ''; private shownAt = -1; private lifting = -1;
  private art: HTMLCanvasElement | null = null;
  constructor(host: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'ball-cover'; this.root.hidden = true; this.root.setAttribute('aria-hidden', 'true');
    this.frame = document.createElement('canvas'); this.frame.className = 'bc-frozen'; this.frame.width = this.frame.height = 1;
    this.stage = document.createElement('div'); this.stage.className = 'bc-stage';
    this.root.append(this.frame, this.stage);
    host.append(this.root);
    current = this;
  }

  /** Is a frame of match `key` held? */
  holds(key: string) { return this.frameKey === key; }
  /** Up on the screen (BallCeremony holds the podium's panels back meanwhile). */
  get up() { return !this.root.hidden; }

  /** The frame just drawn (main.ts draws, then BallCeremony.afterDraw: the canvas still holds it, in the same task), kept
   *  as match `key`'s - a later call replaces it. */
  capture(source: HTMLCanvasElement, key: string) {
    const f = this.frame;
    if (f.width !== source.width || f.height !== source.height) { f.width = source.width; f.height = source.height; }
    const g = f.getContext('2d');
    if (!g) return;
    g.drawImage(source, 0, 0);
    this.frameKey = key;
  }

  /** The whistle: the frame held, frozen where the game's canvas is, and the cover laid on it. `source`: the game's
   *  canvas, for where it is on the screen. `page`: the page's clock (s). `half`: a couch's split screen's half to take
   *  the art from (0 Player 1's, the left or the top; 1 Player 2's): the middle of the whole would be cut by the seam. */
  show(face: CoverFace, source: HTMLCanvasElement, page: number, half: 0 | 1 = 0) {
    const f = this.frame, box = source.getBoundingClientRect();
    Object.assign(f.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
    this.stage.innerHTML = coverHtml(face, '<canvas class="bc-art-frame"></canvas>');
    // The cover's art: the frame's middle (a couch split's half's, either way it is cut), as tall as it, at the volume's shape.
    const body = document.body.classList, split = body.contains('couch-split-v') ? 'split-v' : body.contains('couch-split-h') ? 'split-h' : null;
    const r = split ? halves(split, f.width, f.height)[half] : { x: 0, y: 0, w: f.width, h: f.height };
    const art = this.art = this.stage.querySelector<HTMLCanvasElement>('canvas.bc-art-frame'), w = Math.max(1, Math.round(Math.min(r.w, r.h * COVER.aspect))), h = Math.max(1, Math.round(w / COVER.aspect));
    if (art) { art.width = w; art.height = h; art.getContext('2d')?.drawImage(f, Math.round(r.x + (r.w - w) / 2), Math.round(r.y + Math.max(0, r.h - h) / 2), w, Math.min(h, r.h), 0, 0, w, Math.min(h, r.h)); }
    this.root.classList.remove('bc-out');
    this.root.hidden = false;
    this.restart(this.stage, 'bc-on');
    this.shownAt = page; this.lifting = -1;
  }

  /** Every frame (BallCeremony): lifts the cover once it has held COVER.seconds. */
  tick(page: number) {
    if (this.root.hidden) return;
    if (this.lifting < 0 && page - this.shownAt >= COVER.seconds) { this.lifting = page; this.root.classList.add('bc-out'); }
    if (this.lifting >= 0 && page - this.lifting >= COVER.out) this.hide();
  }
  /** Off the screen at once (the results are up). */
  lift() { if (!this.root.hidden) this.hide(); }

  /** The still the shelf keeps: the cover's art, small, as a data: address within SHELF.stillMost (WebP where the
   *  browser writes it, else JPEG), or null. Taken while the cover is up. */
  async still(): Promise<string | null> {
    const art = this.art;
    if (!art || art.width < 2) return null;
    const small = document.createElement('canvas'), w = COVER.still.width, h = Math.round(w / COVER.aspect);
    small.width = w; small.height = h;
    const g = small.getContext('2d');
    if (!g) return null;
    g.imageSmoothingQuality = 'high'; g.drawImage(art, 0, 0, w, h);
    for (const quality of COVER.still.quality) {
      let blob = await new Promise<Blob | null>(done => small.toBlob(done, 'image/webp', quality));
      if (blob && blob.type !== 'image/webp') blob = await new Promise<Blob | null>(done => small.toBlob(done, 'image/jpeg', quality));
      if (!blob) return null;
      const data = await new Promise<string | null>(done => { const r = new FileReader(); r.onload = () => done(typeof r.result === 'string' ? r.result : null); r.onerror = () => done(null); r.readAsDataURL(blob); });
      if (data && data.length <= SHELF.stillMost) return data;
    }
    return null;
  }

  private hide() {
    this.root.hidden = true; this.root.classList.remove('bc-out'); this.stage.replaceChildren(); this.art = null; this.shownAt = this.lifting = -1;
    // (The frame's memory let go: a full frame is megabytes.)
    this.frame.width = this.frame.height = 1; this.frameKey = '';
  }
  /** Leaving the match: everything put away. */
  clear() { this.hide(); }
  private restart(el: HTMLElement, cls: string) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  dispose() { this.clear(); this.root.remove(); if (current === this) current = null; }
}
