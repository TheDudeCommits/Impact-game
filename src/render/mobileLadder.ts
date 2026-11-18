/** The adaptive ladder for phones and tablets: a phone that holds a steady frame rate keeps the full look; one that
 *  cannot steps its resolution and its heaviest effects down, and back up when it recovers.
 *
 *  This is not a second governor: it is the ResolutionGovernor's next rung, for phones and tablets only (input/device.ts
 *  `handheld`: the browser says mobile, an iPad, or a touch screen with no mouse). On those the order is:
 *    1. at most sixty frames a second on a 120 Hz screen (frameClock.ts FrameGate, as before);
 *    2. the resolution, a step at a time, never under one pixel a CSS pixel (ResolutionGovernor; it was three quarters);
 *    3. the effects below, one at a time, least visible first (this file);
 *    4. a phone on Balanced draws an even thirty (framePolicy.ts), now only once 2 and 3 have nothing left to give.
 *  Back up in the reverse order, each after a longer run of headroom than the step down took (the hysteresis), and no
 *  more than one change every few seconds. A quality or POWER USE the player chose is the preset these steps start from;
 *  FULL DETAIL (powerMode 'full') turns the steps off. A desktop never takes a step (GameRenderer: `handheld`).
 *
 *  The steps change no shader: none of them may link a program in a fight. The two that reallocate
 *  a GPU target (MSAA's samples, the shadow map's size) wait for a calm moment - no fight live: a countdown, the results,
 *  a menu - or LONGEST_WAIT_S, whichever comes first (GameRenderer `calm`). Pure data and arithmetic: the tests drive it. */
export type LadderStep = 'air' | 'shadowRate' | 'bloom' | 'msaa' | 'shadowSize' | 'paint';
/** What each step does, cheapest to see first (measured on emulated phones):
 *   air: the drifting air particles and the stage's motes (Atmosphere, StageLife) off - a few hundred instanced quads,
 *     blended over the whole screen;
 *   shadowRate: the sun's shadow map drawn every other frame (each caster drawn once more a frame: every fighter's
 *     skinned body again), kept still between - a moving shadow a sixtieth behind its body;
 *   bloom: the glow's pyramid off (Medium and High only: LOW has none) - the biggest fill after the scene;
 *   msaa: the scene's multisampling off (Medium's 2, High's 4) - reallocates the composer's targets;
 *   shadowSize: the shadow map halved, not under 512 - reallocates the map;
 *   paint: the film look's painting of the set off, with its ink on the set and its soft print (look/filmPaint.ts,
 *     LookPost) - LOW's film look: the set drawn once, straight into the frame, instead of on its own and painted at a
 *     fraction of the screen (a tablet on Medium or High in the film look only; a phone's LOW never paints). Last: the
 *     most visible step. Its targets stay made, so neither way allocates (GameRenderer keeps the preset's for the room). */
export const STEP_ORDER: readonly LadderStep[] = ['air', 'shadowRate', 'bloom', 'msaa', 'shadowSize', 'paint'];
export const allocates = (step: LadderStep) => step === 'msaa' || step === 'shadowSize';

export interface LadderBudget { samples: number; bloom: boolean; shadowSize: number; /** the film look paints the set */ paint?: boolean }
/** The steps a preset has to give, in order (a step that would change nothing is left out). */
export function ladderFor(budget: LadderBudget): LadderStep[] {
  return STEP_ORDER.filter(step => step === 'bloom' ? budget.bloom : step === 'msaa' ? budget.samples > 0 : step === 'shadowSize' ? budget.shadowSize > 512 : step === 'paint' ? !!budget.paint : true);
}
export interface LadderCut extends LadderBudget { air: boolean; shadowEvery: 1 | 2; paint: boolean }
/** The preset's budget with its first `tier` steps taken. */
export function cutBudget(budget: LadderBudget, tier: number): LadderCut {
  const taken = new Set(ladderFor(budget).slice(0, Math.max(0, tier)));
  return {
    samples: taken.has('msaa') ? 0 : budget.samples,
    bloom: budget.bloom && !taken.has('bloom'),
    shadowSize: taken.has('shadowSize') ? Math.max(512, budget.shadowSize >> 1) : budget.shadowSize,
    air: !taken.has('air'),
    shadowEvery: taken.has('shadowRate') ? 2 : 1,
    paint: !!budget.paint && !taken.has('paint'),
  };
}
/** Whether going from tier `a` to tier `b` takes or gives back a step that reallocates a target. */
export function reallocates(budget: LadderBudget, a: number, b: number) {
  const steps = ladderFor(budget), lo = Math.min(a, b), hi = Math.max(a, b);
  return steps.slice(lo, hi).some(allocates);
}

/** Judged once a window (ResolutionGovernor WINDOW_S, a second): a step down after DOWN_WINDOWS late windows in a row,
 *  with the resolution already at its floor (or the CPU the limit, which no resolution buys back); a step back up after
 *  `up` windows in a row with room. Never two changes within CHANGE_GAP_S. A step given back that has to be taken again
 *  within RELAPSE_S doubles the run of room the next give-back needs (up to UP_MOST windows): a phone on the edge
 *  settles instead of flickering between two looks. */
export const DOWN_WINDOWS = 3, UP_WINDOWS = 12, UP_MOST = 96, CHANGE_GAP_S = 5, RELAPSE_S = 45;
/** The longest a reallocating step (a pixel ratio, MSAA, the shadow map's size) waits for a calm moment, seconds. */
export const LONGEST_WAIT_S = 12;

export interface LadderWindow {
  /** The window's frames were late (the governor's own test: its 75th percentile over the frame aimed at). */
  over: boolean;
  /** The window had room (its 90th percentile inside the frame aimed at, and the GPU inside its budget where timed). */
  room: boolean;
  /** The resolution has nothing left to give: at its floor, or the frame is the CPU's. */
  spent: boolean;
  /** performance.now() of the judgement. */
  now: number;
}
export class EffectsLadder {
  tier = 0;
  /** The steps the preset has (ladderFor().length). */
  max = 0;
  private overRun = 0;
  private roomRun = 0;
  private changedAt = -1e9;
  private gaveBackAt = -1e9;
  up = UP_WINDOWS;
  /** One judged window. Answers the change: -1 a step given back, 1 a step taken, 0 none. */
  judge({ over, room, spent, now }: LadderWindow): -1 | 0 | 1 {
    this.overRun = over ? this.overRun + 1 : 0;
    this.roomRun = room ? this.roomRun + 1 : 0;
    if (this.tier > this.max) this.tier = this.max;
    if ((now - this.changedAt) / 1000 < CHANGE_GAP_S) return 0;
    if (over && spent && this.overRun >= DOWN_WINDOWS && this.tier < this.max) {
      if ((now - this.gaveBackAt) / 1000 < RELAPSE_S) this.up = Math.min(UP_MOST, this.up * 2);
      this.tier++; this.overRun = 0; this.roomRun = 0; this.changedAt = now;
      return 1;
    }
    if (this.tier > 0 && this.roomRun >= this.up) {
      this.tier--; this.roomRun = 0; this.overRun = 0; this.changedAt = now; this.gaveBackAt = now;
      return -1;
    }
    // A long settled stretch forgets the relapses.
    if (this.up > UP_WINDOWS && (now - this.changedAt) / 1000 > RELAPSE_S * 4) this.up = UP_WINDOWS;
    return 0;
  }
  /** A new preset (a quality, a POWER USE, a frame rate): its own steps, from its full look. */
  reset(max: number) { this.max = max; this.tier = 0; this.overRun = 0; this.roomRun = 0; this.changedAt = -1e9; this.up = UP_WINDOWS; }
  /** The ladder's runs only (a load, a tab put back): the tier is kept. */
  rest() { this.overRun = 0; this.roomRun = 0; }
  get spent() { return this.tier >= this.max; }
  /** Spent, and the last step has had CHANGE_GAP_S to show what it buys (the frame policy's thirty, the quality watch's
   *  preset, come after it - not on the frame after it). */
  settled(now: number) { return this.spent && (now - this.changedAt) / 1000 >= CHANGE_GAP_S; }
}
