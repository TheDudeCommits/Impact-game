import * as THREE from 'three';
import { ballOf, type BallModeId, type BallView } from '../../game/ball/model';
import { CUE_LEAD, LESSON, type LessonView } from '../../game/ball/lesson';
import type { ModeHudFrame, HudLayoutId } from '../hud/modeHud';
import type { ModeHudHost } from '../hud/host';
import { isCapturingBinding } from '../../input/bindings';
import { hudView } from '../hud/hudView';
import { learnLine, learnNote, markLearn, SKIP_BUTTON, SKIP_KEY, skipKey, skipKeyFree, type LearnDevice } from './learnCopy';
import '../../tutorial/tutorial.css';
import './learnToPlay.css';

const SPOT = new THREE.Vector3();
/** `dodge`: your fighter's head over its feet (m: its name tag over that may go under the line); the gap kept
 *  from the line (px), and how much further you must be before it goes back (`hold`); how far either side of the line you
 *  count as over it (px); the lowest the line goes (px off the bottom: a desktop's key strip, a phone's edge) and the
 *  highest (a share of the screen: under the score bug and its strip). */
const DODGE = { head: 1.9, pad: 6, hold: 24, wide: 30, floor: 40, touchFloor: 12, ceiling: .17 } as const;

/** What the page lends the lesson (main.ts): the HUD's frames, a message to the match (LocalBall), and the way home. */
export interface LearnHost {
  /** #interface */
  root: HTMLElement;
  modes: ModeHudHost;
  send(type: string, payload?: unknown): void;
  leave(): void;
}

/**
 * LEARN TO PLAY in the page (game/ball/lesson.ts has the rules, LocalBall runs them on this device's FREE PLAY): the
 * lesson's checklist where LEARN TO FIGHT's stands (zone 8b), the step's line in the prompt lane (zone 6) with its keys
 * for the device in hand, the PERFECT STRIKE's and the HEADER's timing bar under it, the praise as a step is done, and
 * SKIP STEP (N, the D-pad's right, or tapped) and END. While it runs #interface[data-tutorial] is set, as LEARN TO
 * FIGHT's: the coach is quiet and the lesson has the lane (BallHud's own prompt and first-time hints step aside in FREE
 * PLAY anyway). The end - YOU'RE READY and the real match offered - is BallUI's card. Plain ink and ticks, as LEARN TO
 * FIGHT's: no effect of its own; the moments themselves (GOAL, PERFECT STRIKE, STUFF
 * BLOCK) are the match's own banners.
 */
export class LearnToPlay {
  private active = false;
  private mode: BallModeId = 'goal-rush';
  private view?: LessonView;
  private device: LearnDevice = { device: 'keyboard', family: 'generic', sport: { mode: 'goal-rush' } };
  private drawn = '';
  private over = false;
  private readonly panel = document.createElement('section');
  private readonly line = document.createElement('div');
  private raf = 0; private padWas = false;
  /** The timing bar's last reading and when (performance.now()): the HUD's frames come about fourteen a second, so the
   *  bar runs on between them at the cue's own rate, every animation frame. */
  private cue: { value: number; at: number } | null = null;
  /** How far the step's line stands off its place (screen px, down) so it is not over your own fighter. */
  private shift = 0;

  constructor(private readonly host: LearnHost) {
    this.panel.className = 'lesson-panel learn-panel'; this.panel.setAttribute('aria-label', 'Learn to play');
    this.line.className = 'lesson-line learn-line'; this.line.setAttribute('role', 'status'); this.line.setAttribute('aria-live', 'polite');
    this.panel.addEventListener('click', event => {
      const b = (event.target as HTMLElement).closest<HTMLElement>('[data-lesson]');
      if (b?.dataset.lesson === 'skip') this.skip(); else if (b?.dataset.lesson === 'end') this.end();
    });
    host.modes.listeners.push({ frame: (f, layout) => this.frame(f, layout), clear: () => this.stop(true) });
    window.addEventListener('keydown', event => {
      if (!this.active || event.code !== SKIP_KEY || event.repeat || isCapturingBinding() || !skipKeyFree() || !this.live()) return;
      if ((event.target as HTMLElement | null)?.matches?.('input,select,textarea')) return;
      event.preventDefault(); this.skip();
    });
    // A dev build lets a browser check read where the lesson stands (the capture scripts' way in).
    if (import.meta.env.DEV) (window as unknown as { __learn?: () => unknown }).__learn = () => ({ on: this.active, mode: this.mode, view: this.view && { ...this.view } });
  }
  get on() { return this.active; }

  private frame(f: ModeHudFrame, layout: HudLayoutId) {
    const v = ballOf(f.snapshot), lesson = v?.lesson;
    if (!v || !lesson || (layout !== 'goal-rush' && layout !== 'sky-spike')) { if (this.active) this.stop(true); return; }
    if (!this.active) this.start(v);
    this.view = lesson;
    const stance = this.host.root.dataset.ballStance === 'fight';
    this.device = { device: f.input, family: f.family, sport: { mode: v.mode, fight: v.mode === 'goal-rush' && stance } };
    for (const [node, zone] of [[this.panel, '8b'], [this.line, '6']] as const) {
      const at = this.host.root.querySelector<HTMLElement>(`.mode-hud [data-zone="${zone}"]`);
      if (at && node.parentElement !== at) at.append(node);
    }
    if (lesson.state === 'over') {
      if (!this.over) { this.over = true; markLearn(this.mode, 'done'); this.panel.hidden = true; this.line.classList.remove('on'); }
      return;
    }
    this.over = false; this.panel.hidden = false;
    this.cue = lesson.cue === null || lesson.state !== 'live' ? null : { value: lesson.cue, at: f.now };
    this.draw(lesson);
    this.dodge(f);
  }
  /** The step's line stays clear of your own fighter. It stands in the prompt lane all step long, and where the
   *  step puts you in that lane - Sky Spike's DIVE and JUMP SERVE in the back court on a desktop, the net on a phone, where
   *  the lane crosses the middle of the screen - it stood over you the whole step. Your fighter (feet to head) is
   *  projected through the camera each HUD frame; over the line's own place, the line moves just under your feet (under
   *  the meter, if that is where your feet are), or, with no room there, just over your head, and back once you are
   *  clear of its place. */
  private dodge(f: ModeHudFrame) {
    const camera = hudView.camera, line = this.line;
    if (!camera || !line.classList.contains('on') || !line.isConnected) { this.place(0, 1); return; }
    const p = f.self, w = window.innerWidth, h = window.innerHeight, size = p.size ?? 1;
    const screen = (y: number) => { SPOT.set(p.x, y, p.z).project(camera); return SPOT.z < 1 && SPOT.z > -1 ? { x: (SPOT.x + 1) / 2 * w, y: (1 - SPOT.y) / 2 * h } : null; };
    const feet = screen(p.y), tag = screen(p.y + DODGE.head * size);
    const r = line.getBoundingClientRect(), k = line.offsetHeight > 0 ? r.height / line.offsetHeight : 1;
    if (!feet || !tag || !(r.height > 0)) { this.place(0, k); return; }
    // (The line's own place: where it is drawn less the shift it stands at.)
    const top = r.top - this.shift, bottom = r.bottom - this.shift;
    const near = (margin: number) => feet.x > r.left - DODGE.wide && feet.x < r.right + DODGE.wide && tag.y < bottom + margin && feet.y > top - margin;
    if (!near(this.shift ? DODGE.pad + DODGE.hold : DODGE.pad)) { this.place(0, k); return; }
    const under = feet.y + DODGE.pad - top, over = tag.y - DODGE.pad - bottom;
    // (Under your feet - or, where that is over the meter under the play (zone 9), under the meter: over your head the
    // line stood where the ball comes at you, the set you jump into, the spike you dive for - and over your head only when
    // there is no room under at all.)
    const edge = h - (f.input === 'touch' ? DODGE.touchFloor : DODGE.floor), height = bottom - top;
    const meter = this.host.root.querySelector<HTMLElement>('.mode-hud [data-zone="9"]')?.getBoundingClientRect();
    let down = top + under;
    if (meter && meter.height > 0 && down < meter.bottom && down + height > meter.top) down = Math.max(down, meter.bottom + DODGE.pad);
    if (down + height <= edge) this.place(down - top, k);
    else this.place(top + over >= h * DODGE.ceiling ? over : 0, k);
  }
  /** The line moved `dy` screen px off its place (its zone may be scaled: `k`, screen px a CSS px). */
  private place(dy: number, k: number) {
    dy = Math.round(dy);
    if (Math.abs(dy - this.shift) < 2) return;
    this.shift = dy;
    this.line.style.translate = dy ? `0 ${(dy / (k || 1)).toFixed(1)}px` : '';
  }
  private start(v: BallView) {
    this.active = true; this.over = false; this.mode = v.mode; this.drawn = '';
    this.host.root.dataset.tutorial = '';
    this.raf = requestAnimationFrame(this.padLoop);
  }
  /** Out of the lesson's match (home, a new match): everything it put up comes down. Left before its end, the lesson
   *  counts as turned down (HOW TO PLAY still offers it). */
  private stop(left: boolean) {
    if (!this.active) return;
    if (left && !this.over) markLearn(this.mode, 'skipped');
    this.active = false; this.view = undefined; this.over = false;
    delete this.host.root.dataset.tutorial;
    cancelAnimationFrame(this.raf); this.raf = 0;
    this.panel.remove(); this.line.remove(); this.panel.hidden = false; this.line.classList.remove('on'); this.place(0, 1);
  }
  private live() { return !document.querySelector('.settings-scrim:not(.hidden), dialog[open]') && !!this.host.root.querySelector('.combat-hud:not(.hidden)'); }
  private skip() { if (this.view && this.view.state !== 'over') { this.host.send('ball-lesson', 'skip'); this.drawn = ''; } }
  /** END: the lesson left at once for home, remembered as turned down. */
  private end() { markLearn(this.mode, 'skipped'); this.host.send('ball-lesson', 'end'); this.stop(false); this.host.leave(); }

  /** SKIP STEP on a pad: the D-pad's right, read every frame while the lesson runs. */
  private readonly padLoop = () => {
    this.raf = requestAnimationFrame(this.padLoop);
    const pad = typeof navigator.getGamepads === 'function' ? [...navigator.getGamepads()].find(p => p?.connected && p.mapping === 'standard') : undefined;
    const down = !!pad?.buttons[SKIP_BUTTON]?.pressed;
    if (down && !this.padWas && this.live()) this.skip();
    this.padWas = down;
    const bar = this.cue && this.line.querySelector<HTMLElement>('.learn-cue');
    if (bar && this.cue) {
      const k = this.cue.value + (performance.now() - this.cue.at) / 1000 / CUE_LEAD, now = k >= .97 && k < 1.25;
      bar.querySelector<HTMLElement>('i')!.style.width = `${Math.round(Math.min(1, k) * 100)}%`;
      if (bar.classList.contains('now') !== now) { bar.classList.toggle('now', now); bar.querySelector('b')!.textContent = now ? 'NOW' : ''; }
    }
  };

  private draw(v: LessonView) {
    const d = this.device, steps = LESSON[this.mode];
    const key = `${v.index}|${v.state}|${v.tries}|${v.miss}|${v.parts.join()}|${v.praise}|${v.cue === null}|${v.firstTime}|${d.device}|${d.family}|${d.sport.fight}`;
    if (key === this.drawn) return;
    const panelKey = `${v.index}|${v.done.join()}|${v.skipped.join()}|${d.device}|${d.family}`;
    if (!this.drawn.startsWith(`${v.index}|`) || this.panel.dataset.key !== panelKey) {
      this.panel.dataset.key = panelKey;
      const items = steps.map((s, i) => {
        const state = v.done.includes(s.id) ? 'done' : v.skipped.includes(s.id) ? 'skipped' : i === v.index ? 'now' : 'next';
        return `<li data-state="${state}"><i aria-hidden="true">${state === 'done' ? '✓' : state === 'skipped' ? '–' : state === 'now' ? '▸' : '·'}</i>${s.title}</li>`;
      }).join('');
      this.panel.innerHTML = `<header><b>LEARN TO PLAY</b><small>${Math.min(v.index + 1, steps.length)} / ${steps.length}</small></header>
        <ol>${items}</ol>
        <nav><button type="button" data-lesson="skip">${skipKey(d)}<span>SKIP STEP</span></button><button type="button" data-lesson="end"><span>END</span><i aria-hidden="true">✕</i></button></nav>`;
    }
    this.drawn = key;
    if (v.state === 'done') {
      this.line.innerHTML = `<div class="lesson-now" data-done><span class="ux-prompt" data-keyless><b>✓ ${v.praise}</b></span></div>`;
    } else {
      const note = learnNote(v, d);
      // The timing bar (PERFECT STRIKE, HEADER): it fills as the ball comes, full at the moment to press.
      const bar = v.cue === null ? '' : '<div class="learn-cue" aria-hidden="true"><i style="width:0%"></i><b></b></div>';
      this.line.innerHTML = `<div class="lesson-now">${learnLine(v, d)}</div>${bar}${note ? `<p class="lesson-note">${note}</p>` : ''}`;
    }
    this.line.classList.add('on');
  }
}
