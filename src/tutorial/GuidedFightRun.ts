import type { ArenaSimulation } from '../game/simulation';
import type { CombatEvent, FighterId, GameSnapshot } from '../game/types';
import { techniqueName } from '../game/techniques';
import { displayMove } from '../originals/apply';
import type { ModeHudFrame, HudLayoutId } from '../ui/hud/modeHud';
import type { ModeHudHost } from '../ui/hud/host';
import { isCapturingBinding } from '../input/bindings';
import { dummyCommand, FIGHT_HEALTH, FIRST_SWING, GuidedFight, LESSON_END, markTutorial, STEPS, TECHNIQUE, type DummyCommand } from './guidedFight';
import { SKIP_BUTTON, SKIP_KEY, skipKey, skipKeyFree, stepLine, stepNote, type Device } from './lessonCopy';
import './tutorial.css';

/** What the page lends the lesson (main.ts): the HUD's frames and events, the offline Training's arena while it is the
 *  one being played, the view's heading, and the way home. */
export interface GuidedHost {
  /** #interface */
  root: HTMLElement;
  modes: ModeHudHost;
  sim(): ArenaSimulation | null;
  viewYaw(): number;
  leave(): void;
}
/** The end card's time on screen before the home, ms. */
const END_MS = 2600;

export class GuidedFightRun {
  private active = false;
  private lesson?: GuidedFight;
  /** The step whose dummy and meters were set up, and the dummy's swing clock. */
  private applied = -1;
  private readonly clock = { next: 0 };
  private fighter: FighterId = 'konta';
  private time = 0;
  private endAt?: number;
  private leaving = false;
  private drawn = '';
  private device: Device = { device: 'keyboard', family: 'generic' };
  private readonly panel = document.createElement('section');
  private readonly line = document.createElement('div');
  private readonly card = document.createElement('div');
  private raf = 0; private padWas = false;

  constructor(private readonly host: GuidedHost) {
    this.panel.className = 'lesson-panel'; this.panel.setAttribute('aria-label', 'Learn to fight');
    this.line.className = 'lesson-line'; this.line.setAttribute('role', 'status'); this.line.setAttribute('aria-live', 'polite');
    this.card.className = 'lesson-end'; this.card.innerHTML = "<b>YOU'RE READY</b><small>PICK A MODE · PRESS PLAY</small>";
    this.panel.addEventListener('click', event => {
      const b = (event.target as HTMLElement).closest<HTMLElement>('[data-lesson]');
      if (b?.dataset.lesson === 'skip') this.skip(); else if (b?.dataset.lesson === 'end') this.stop();
    });
    host.modes.listeners.push({ frame: (f, layout) => this.frame(f, layout), event: (e, s) => this.event(e, s), clear: () => this.end() });
    window.addEventListener('keydown', event => {
      if (!this.active || event.code !== SKIP_KEY || event.repeat || isCapturingBinding() || !skipKeyFree() || !this.live()) return;
      if ((event.target as HTMLElement | null)?.matches?.('input,select,textarea')) return;
      event.preventDefault(); this.skip();
    });
    // A dev build lets a browser check read where the lesson stands (the capture scripts' own way in, as trainingVictory).
    if (import.meta.env.DEV) (window as unknown as { __guided?: () => unknown }).__guided = () => {
      const sim = this.host.sim(), lesson = this.lesson, bot = sim?.actors.get('sparring-bot')?.state, me = lesson ? sim?.actors.get(lesson.self)?.state : undefined;
      return { on: this.active, index: lesson?.index, step: lesson?.step?.id, done: lesson ? [...lesson.done] : [], skipped: lesson ? [...lesson.skipped] : [], progress: lesson?.progress, ending: this.endAt !== undefined,
        bot: bot && { fighter: bot.fighter, action: bot.action, hp: bot.hp, maxHp: bot.maxHp, x: bot.x, z: bot.z }, me: me && { fighter: me.fighter, action: me.action, x: me.x, z: me.z, ultimate: me.ultimate, hp: me.hp } };
    };
  }
  get on() { return this.active; }

  /** The offline Training session just started for the lesson (main.ts, after LocalTraining.connect). */
  begin(fighter: FighterId) {
    this.end(false);
    this.active = true; this.leaving = false; this.fighter = fighter; this.lesson = undefined; this.applied = -1; this.endAt = undefined; this.drawn = '';
    this.host.root.dataset.tutorial = '';
    const sim = this.host.sim();
    if (sim) sim.trainingLab.script = (s, id) => this.dummy(s, id);
    this.raf = requestAnimationFrame(this.padLoop);
  }

  private frame(f: ModeHudFrame, layout: HudLayoutId) {
    if (!this.active || layout !== 'training') return;
    const sim = this.host.sim(); if (!sim) return;
    this.device = { device: f.input, family: f.family };
    for (const [node, zone] of [[this.panel, '8b'], [this.line, '6'], [this.card, '7']] as const) {
      const at = this.host.root.querySelector<HTMLElement>(`.mode-hud [data-zone="${zone}"]`);
      if (at && node.parentElement !== at) at.append(node);
    }
    if (f.phase !== 'active') return;
    const lesson = this.lesson ??= new GuidedFight(f.self.id);
    this.fighter = f.self.fighter; this.time = f.snapshot.serverTime;
    if (this.endAt !== undefined) { if (f.now - this.endAt >= END_MS) this.finish(true); return; }
    lesson.frame({ time: this.time, x: f.self.x, z: f.self.z, viewYaw: this.host.viewYaw(), action: f.self.action, alive: f.self.alive });
    if (lesson.over) { this.over(f.now); return; }
    if (this.applied !== lesson.index) this.setUp(sim, lesson);
    // The real fight is the bot's own mind: kept on, whatever else asked for the dummy (the mode's default on mount).
    if (lesson.step?.dummy === 'fight' && sim.trainingBotMode !== 'combat') sim.trainingCommand(lesson.self, 'combat');
    this.draw();
  }
  private event(e: CombatEvent, s: GameSnapshot) {
    if (!this.active || !this.lesson || this.endAt !== undefined) return;
    this.lesson.event(e, s.serverTime);
  }

  /** A step opening: the dummy's clock and health, the meter the ultimate needs, the gentle bot for the real fight. */
  private setUp(sim: ArenaSimulation, lesson: GuidedFight) {
    this.applied = lesson.index;
    const step = lesson.step!, me = sim.actors.get(lesson.self), bot = sim.actors.get('sparring-bot');
    this.clock.next = sim.serverTime + FIRST_SWING;
    if (step.dummy === 'fight') {
      if (bot) { bot.botSkill = 0; if (bot.state.alive) bot.state.hp = Math.max(1, Math.round(bot.state.maxHp * FIGHT_HEALTH)); }
      if (me?.state.alive) me.state.hp = me.state.maxHp;
      sim.trainingCommand(lesson.self, 'combat');
      return;
    }
    if (sim.trainingBotMode !== 'passive') sim.trainingCommand(lesson.self, 'passive');
    if (bot?.state.alive) bot.state.hp = bot.state.maxHp;
    if (step.fill && me) me.state.ultimate = 100;
  }
  /** The dummy's command for the tick (TrainingLab `script`), from the step's plan. */
  private dummy(sim: ArenaSimulation, id: string): DummyCommand | undefined {
    const lesson = this.lesson, plan = lesson?.over ? 'still' : lesson?.step?.dummy ?? 'still';
    const bot = sim.actors.get(id), me = lesson ? sim.actors.get(lesson.self) : [...sim.actors.values()].find(a => !a.state.isBot);
    if (!bot || !me) return undefined;
    const busy = !!bot.cast || sim.serverTime < bot.stunUntil || !bot.state.alive;
    return dummyCommand(plan, { x: bot.state.x, z: bot.state.z, busy }, { id: me.state.id, x: me.state.x, z: me.state.z, alive: me.state.alive }, sim.serverTime, this.clock);
  }

  private live() {
    return !document.querySelector('.settings-scrim:not(.hidden), dialog[open]') && !!this.host.root.querySelector('.combat-hud:not(.hidden)');
  }
  private skip() { if (!this.lesson || this.endAt !== undefined) return; this.lesson.skip(this.time); this.drawn = ''; }
  /** END: the lesson left at once, home, remembered as turned down (HOW TO PLAY still offers it). */
  private stop() { this.lesson?.skipAll(); this.finish(false); }
  private over(now: number) {
    if (!this.lesson?.completed) { this.finish(false); return; }
    this.endAt = now; this.drawn = '';
    this.panel.hidden = true; this.line.classList.remove('on'); this.card.classList.add('on');
  }
  private finish(done: boolean) {
    if (!this.active || this.leaving) return;
    this.leaving = true;
    markTutorial(done ? 'done' : 'skipped');
    this.host.root.dispatchEvent(new CustomEvent(LESSON_END, { detail: { done } }));
    this.host.leave();
    this.end(false);
  }
  /** Home by any way (the menu's QUIT, a finish, END): everything the lesson put up comes down. Left before its end, it
   *  counts as turned down. */
  private end(mark = true) {
    if (!this.active) return;
    if (mark && !this.leaving) { markTutorial('skipped'); this.host.root.dispatchEvent(new CustomEvent(LESSON_END, { detail: { done: false } })); }
    this.active = false; this.lesson = undefined; this.endAt = undefined;
    const sim = this.host.sim(); if (sim) sim.trainingLab.script = undefined;
    delete this.host.root.dataset.tutorial;
    cancelAnimationFrame(this.raf); this.raf = 0;
    for (const node of [this.panel, this.line, this.card]) node.remove();
    this.panel.hidden = false; this.line.classList.remove('on'); this.card.classList.remove('on');
  }

  /** SKIP STEP on a pad: the D-pad's right, read every frame while the lesson runs (a tap is shorter than a HUD tick). */
  private readonly padLoop = () => {
    this.raf = requestAnimationFrame(this.padLoop);
    const pad = typeof navigator.getGamepads === 'function' ? [...navigator.getGamepads()].find(p => p?.connected && p.mapping === 'standard') : undefined;
    const down = !!pad?.buttons[SKIP_BUTTON]?.pressed;
    if (down && !this.padWas && this.live()) this.skip();
    this.padWas = down;
  };

  private draw() {
    const lesson = this.lesson; if (!lesson) return;
    const step = lesson.step; if (!step) return;
    const locked = document.pointerLockElement instanceof HTMLCanvasElement;
    const key = `${lesson.version}|${this.device.device}|${this.device.family}|${locked}|${this.fighter}`;
    if (key === this.drawn) return;
    this.drawn = key;
    const skip = skipKey(this.device);
    const items = STEPS.map((s, i) => {
      const state = lesson.done.has(s.id) ? 'done' : lesson.skipped.has(s.id) ? 'skipped' : i === lesson.index ? 'now' : 'next';
      return `<li data-state="${state}"><i aria-hidden="true">${state === 'done' ? '✓' : state === 'skipped' ? '–' : state === 'now' ? '▸' : '·'}</i>${s.title}</li>`;
    }).join('');
    this.panel.innerHTML = `<header><b>LEARN TO FIGHT</b><small>${Math.min(lesson.index + 1, STEPS.length)} / ${STEPS.length}</small></header>
      <ol>${items}</ol>
      <nav><button type="button" data-lesson="skip">${skip}<span>SKIP STEP</span></button><button type="button" data-lesson="end"><span>END</span><i aria-hidden="true">✕</i></button></nav>`;
    const done = lesson.doneAt !== undefined;
    const note = done ? '' : stepNote(step.id, lesson.progress, this.device);
    this.line.innerHTML = done
      ? `<div class="lesson-now" data-done><span class="ux-prompt" data-keyless><b>✓ ${step.title}</b></span></div>`
      : `<div class="lesson-now">${stepLine(step.id, this.device, displayMove(this.fighter, techniqueName(this.fighter, TECHNIQUE)), locked)}</div>${note ? `<p class="lesson-note">${note}</p>` : ''}`;
    this.line.classList.add('on');
  }
}
