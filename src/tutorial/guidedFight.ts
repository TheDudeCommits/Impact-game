import type { CombatEvent, PlayerInput } from '../game/types';

export type StepId = 'move' | 'light' | 'heavy' | 'guard' | 'parry' | 'dash' | 'special' | 'technique' | 'ultimate' | 'fight';
/** What the dummy does while a step is on: stands, jabs at the player (the guard), swings a slow heavy (the parry), or
 *  fights as a gentle bot (the finish). */
export type DummyPlan = 'still' | 'jab' | 'swing' | 'fight';
export interface StepDef { id: StepId; title: string; dummy: DummyPlan; /** The ultimate's meter is filled as the step opens. */ fill?: boolean }
export const STEPS: readonly StepDef[] = [
  { id: 'move', title: 'MOVE & LOOK', dummy: 'still' },
  { id: 'light', title: 'LIGHT STRING', dummy: 'still' },
  { id: 'heavy', title: 'HEAVY', dummy: 'still' },
  { id: 'guard', title: 'GUARD', dummy: 'jab' },
  { id: 'parry', title: 'PERFECT PARRY', dummy: 'swing' },
  { id: 'dash', title: 'DASH', dummy: 'still' },
  { id: 'special', title: 'SPECIAL', dummy: 'still' },
  { id: 'technique', title: 'TECHNIQUE', dummy: 'still' },
  { id: 'ultimate', title: 'ULTIMATE', dummy: 'still', fill: true },
  { id: 'fight', title: 'REAL FIGHT', dummy: 'fight' },
];

/** Metres walked, and radians the view has turned (both ways counted), for MOVE & LOOK. */
export const MOVE_METRES = 3, LOOK_RADIANS = 1.2;
/** The light string: its third blow (the rush's stage 2), or three blows of one string. */
export const STRING_HITS = 3;
/** A done step's tick stays this long before the next step opens, fight seconds. */
export const BEAT = .9;
/** The real fight ends here even if the bot still stands, fight seconds: a new player is never stuck in it. */
export const FIGHT_SECONDS = 45;
/** The bot's health as the real fight opens, a share of its bar: a few strings put it down. */
export const FIGHT_HEALTH = .4;
/** The technique the step names (techniques.ts: away + light, a launcher; a deliberate press nobody makes by walking
 *  in), and the others that are as deliberate and count as well (the air's own launcher, the sidestep strike). */
export const TECHNIQUE = 'rise', TECHNIQUES: ReadonlySet<string> = new Set(['rise', 'airRise', 'slip']);

/** The player's state, as each HUD tick has it: where they stand, the view's heading (input.yaw), what they are doing. */
export interface LessonFrame { time: number; x: number; z: number; viewYaw: number; action: string; alive: boolean }
/** What the step's line adds under it: the half of MOVE & LOOK done, the string's count, why a guard or a parry did not count. */
export interface StepProgress { moved: boolean; looked: boolean; hits: number; miss?: 'hit' | 'blocked' | 'plain'; tries: number }
const fresh = (): StepProgress => ({ moved: false, looked: false, hits: 0, tries: 0 });

/** The lesson: which step is on, what is done or skipped, and what ticks the step on. Times are the fight's own clock
 *  (snapshot.serverTime), so a pause holds the lesson too. */
export class GuidedFight {
  index = 0;
  readonly done = new Set<StepId>();
  readonly skipped = new Set<StepId>();
  progress = fresh();
  /** When the step on now was done (its tick on screen for BEAT); undefined while it is still to do. */
  doneAt?: number;
  /** When the step on now opened, fight seconds (undefined until the first frame sees it). */
  openedAt?: number;
  /** Bumped on every change worth redrawing. */
  version = 0;
  private walked = 0; private turned = 0;
  private last?: { x: number; z: number; yaw: number };
  constructor(readonly self: string) {}
  get step(): StepDef | undefined { return STEPS[this.index]; }
  get over() { return this.index >= STEPS.length; }
  /** Finished, every step done or skipped (the real fight's time running out counts as done). */
  get completed() { return this.over && STEPS.every(s => this.done.has(s.id) || this.skipped.has(s.id)); }

  /** A HUD tick: the beat after a done step, MOVE & LOOK, DASH and the real fight's time. */
  frame(f: LessonFrame) {
    const step = this.step; if (!step) return;
    this.openedAt ??= f.time;
    if (this.doneAt !== undefined) { if (f.time - this.doneAt >= BEAT - 1e-9) this.next(f.time); this.last = undefined; return; }
    const last = this.last; this.last = { x: f.x, z: f.z, yaw: f.viewYaw };
    if (step.id === 'move' && last && f.alive) {
      // A step longer than 2 m in one tick is a reset or a respawn, not a walk.
      const d = Math.hypot(f.x - last.x, f.z - last.z); if (d < 2) this.walked += d;
      this.turned += Math.abs(Math.atan2(Math.sin(f.viewYaw - last.yaw), Math.cos(f.viewYaw - last.yaw)));
      const moved = this.walked >= MOVE_METRES, looked = this.turned >= LOOK_RADIANS;
      if (moved !== this.progress.moved || looked !== this.progress.looked) { this.progress = { ...this.progress, moved, looked }; this.version++; }
      if (moved && looked) this.tick(f.time);
    }
    if (step.id === 'dash' && f.action === 'dash') this.tick(f.time);
    if (step.id === 'fight' && f.time - this.openedAt >= FIGHT_SECONDS - 1e-9) this.tick(f.time);
  }

  /** A combat event from the fight, at `time` (fight seconds). */
  event(e: CombatEvent, time: number) {
    const step = this.step; if (!step || this.doneAt !== undefined) return;
    const mine = e.actorId === this.self, onMe = e.targetId === this.self, onThem = !!e.targetId && !onMe;
    const miss = (why: StepProgress['miss']) => { this.progress = { ...this.progress, miss: why, tries: this.progress.tries + 1 }; this.version++; };
    switch (step.id) {
      case 'light':
        if (mine && onThem && e.kind === 'hit' && e.slot === 'light') {
          const hits = Math.max(e.combo ?? 0, (e.chain ?? 0) + 1);
          if (hits !== this.progress.hits) { this.progress = { ...this.progress, hits }; this.version++; }
          if (hits >= STRING_HITS) this.tick(time);
        }
        break;
      case 'heavy': if (mine && onThem && e.kind === 'hit' && e.slot === 'heavy') this.tick(time); break;
      case 'guard':
        if (onMe && (e.kind === 'blocked' || e.kind === 'just-guard')) this.tick(time);
        else if (onMe && e.kind === 'hit') miss('hit');
        break;
      case 'parry':
        // A Perfect Parry (just-guard), the counter stance answering the blow, or the vanish a parry steps out of.
        if (onMe && e.kind === 'just-guard' || mine && (e.kind === 'counter' || e.kind === 'vanish')) this.tick(time);
        else if (onMe && e.kind === 'blocked') miss('blocked');
        else if (onMe && e.kind === 'hit') miss('hit');
        break;
      case 'special': if (mine && (e.kind === 'cast' || e.kind === 'hit') && e.slot === 'special') this.tick(time); break;
      case 'technique':
        if (mine && (e.kind === 'cast' || e.kind === 'hit') && e.branch && TECHNIQUES.has(e.branch)) this.tick(time);
        else if (mine && onThem && e.kind === 'hit' && e.slot === 'light' && !e.branch && this.progress.miss !== 'plain') miss('plain');
        break;
      case 'ultimate': if (mine && e.kind === 'cast' && e.slot === 'ultimate') this.tick(time); break;
      case 'fight': if (e.kind === 'eliminated' && onThem) this.tick(time); break;
    }
  }

  /** SKIP STEP: the step is passed over at once, without its beat. */
  skip(time: number) {
    const step = this.step; if (!step) return;
    if (this.doneAt === undefined) this.skipped.add(step.id);
    this.next(time);
  }
  /** END: every step left is skipped. */
  skipAll() { for (const step of STEPS.slice(this.index)) if (!this.done.has(step.id)) this.skipped.add(step.id); this.index = STEPS.length; this.doneAt = undefined; this.version++; }

  private tick(time: number) { const step = this.step; if (!step || this.doneAt !== undefined) return; this.done.add(step.id); this.doneAt = time; this.version++; }
  private next(time: number) {
    this.index++; this.doneAt = undefined; this.openedAt = time; this.progress = fresh(); this.walked = this.turned = 0; this.last = undefined; this.version++;
  }
}

/** The dummy's command, as Training's lab sends one (game/training/TrainingLab.ts `script`). */
export type DummyCommand = Omit<PlayerInput, 'seq'>;
/** The guard's jab and the parry's slow heavy: which button, how often (fight seconds), from how near (m). */
export const SWINGS: Readonly<Record<'jab' | 'swing', { slot: 'light' | 'heavy'; every: number; reach: number }>> = {
  jab: { slot: 'light', every: 1.8, reach: 2.1 },
  swing: { slot: 'heavy', every: 2.7, reach: 2.2 },
};
/** The dummy's pace walking in to swing (a share of a run): slow enough to read. */
export const DUMMY_PACE = .55;
/** The first swing waits this long after its step opens, so the line is read first. */
export const FIRST_SWING = 1.4;
export interface DummyBody { x: number; z: number; /** In a move, a reaction or a stun: it cannot swing now. */ busy: boolean }
export interface LessonBody { id: string; x: number; z: number; alive: boolean }

/** What the dummy does this tick for a plan: faces the player and stands; walks in and swings on its clock (`clock.next`,
 *  fight seconds, moved on by each swing); or, for the real fight, nothing (undefined: the bot's own mind decides). */
export function dummyCommand(plan: DummyPlan, bot: DummyBody, human: LessonBody, time: number, clock: { next: number }): DummyCommand | undefined {
  if (plan === 'fight') return undefined;
  const dx = human.x - bot.x, dz = human.z - bot.z, d = Math.hypot(dx, dz);
  const base: DummyCommand = { moveX: 0, moveZ: 0, yaw: d > 1e-6 ? Math.atan2(dx, dz) : 0, targetId: human.id, lock: true };
  if (plan === 'still' || !human.alive) return base;
  const swing = SWINGS[plan];
  if (d > swing.reach) return { ...base, moveX: dx / d * DUMMY_PACE, moveZ: dz / d * DUMMY_PACE };
  if (bot.busy || time < clock.next) return base;
  clock.next = time + swing.every;
  return { ...base, attack: swing.slot };
}

/** Sent on #interface as the lesson ends (GuidedFightRun): `done` when it was finished - the home then says YOU'RE
 *  READY over PLAY (LearnOffer). */
export const LESSON_END = 'guided-fight-end';
/** What this device remembers (localStorage `rift-tutorial`): 'done' once the lesson was finished, 'skipped' once it
 *  was offered and turned down or left early. Neither, and the home offers it (LearnOffer.ts). 'done' is kept. */
export const TUTORIAL_KEY = 'rift-tutorial';
export type TutorialState = 'new' | 'done' | 'skipped';
export function tutorialState(): TutorialState {
  try { const v = globalThis.localStorage?.getItem(TUTORIAL_KEY); return v === 'done' || v === 'skipped' ? v : 'new'; } catch { return 'new'; }
}
export function markTutorial(state: 'done' | 'skipped') {
  if (state === 'skipped' && tutorialState() === 'done') return;
  try { globalThis.localStorage?.setItem(TUTORIAL_KEY, state); } catch { /* the visit keeps it */ }
}
/** A first visit: the lesson never finished or turned down, and no mode's first-time explainer read yet (ui/modes/prefs.ts
 *  `rift-modes-seen`): someone who has played before is not offered it on the home (HOW TO PLAY still is). */
export function firstVisit(): boolean {
  if (tutorialState() !== 'new') return false;
  try { const seen = globalThis.localStorage?.getItem('rift-modes-seen'); return !seen || seen === '{}'; } catch { return true; }
}
