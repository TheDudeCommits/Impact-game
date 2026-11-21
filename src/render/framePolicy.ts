import type { Settings } from '../config';
import { handheld, phone } from '../input/device';

/**
 * The rate a fight is drawn at, by the POWER USE setting (Settings.powerMode) and the device (the phone pass, November
 * 2026: a phone's heat and frame rate). The simulation, the input and the network never follow it: they keep their own
 * sixty a second (main.ts's input timer, the arenas' clocks); only the drawing does (FrameGate).
 *
 *   'cool' (Cooler): thirty everywhere.
 *   'full' (Full detail): sixty everywhere, a phone's included - the player's way to sixty whatever this decides. On a
 *     desktop (no phone, no tablet) it is drawn at the display's own rate (drawRate: a
 *     144 Hz monitor's player who picked FULL DETAIL asked for every frame it shows); its budget (target: the resolution
 *     governor's, the quality watch's) stays sixty, so nothing is given up in pixels to chase the higher rate.
 *   'auto' (Balanced): sixty on a desktop or a tablet. On a phone, sixty while it holds it; a phone that cannot - in a
 *     fight, STEP_SECONDS seconds in a row each with a quarter or more of its frames late (the second's 75th-percentile
 *     gap over LATE_MS: a vsync missed) - draws an even thirty from then on for the visit, every frame the same length,
 *     rather than a stutter between sixty and thirty (measured in a phone's profile: 44 fps with a p95 frame of 33 ms).
 *     A few long frames (a fight's first effects warming up) do not count: the percentile, not the average. Thirty frames
 *     also ask half the work of the GPU, and the heat with it. Choosing Balanced again in a menu gives sixty another try.
 *
 * The adaptive ladder: the step to thirty is the last rung, taken only once the
 * resolution and the effects (render/mobileLadder.ts) have nothing left to give (`spent`); and it is no longer for the
 * whole visit. At thirty, RECOVER_SECONDS in a row whose frames' main-thread time (the 75th percentile) is under
 * RECOVER_SHARE of a sixtieth - room to draw sixty with a third to spare - make sixty due, taken at the next calm moment
 * (no fight live: the results, a countdown, a menu), so the rate never changes under a thumb. A sixty that has to step
 * down again within RELAPSE_SECONDS of being given back doubles the run the next try needs (up to RECOVER_MOST).
 */
export const LATE_MS = 22, STEP_SECONDS = 6;
export const RECOVER_SHARE = .5, RECOVER_SECONDS = 20, RECOVER_MOST = 160, RELAPSE_SECONDS = 90;
export type PowerMode = NonNullable<Settings['powerMode']>;

export class FramePolicy {
  /** A phone on Balanced that could not hold sixty: thirty for the rest of the visit. */
  stepped = false;
  private mode: PowerMode | undefined;
  private seconds = 0;
  private readonly gaps: number[] = [];
  private readonly cpu: number[] = [];
  private roomFor = 0;
  /** Seconds of room at thirty that make sixty due, and when sixty was last given back (performance-clock seconds). */
  recoverAfter = RECOVER_SECONDS;
  private recoveredAt = -1e9;
  private clock = 0;
  /** Sixty is due: taken at the next calm moment. */
  due = false;
  private lowFor = 0;
  /** `small`: a phone (input/device.ts), read once; `desk`: neither a phone nor a tablet. */
  constructor(readonly small = phone(), readonly desk = !small && !handheld()) {}

  /** The rate aimed at now, for the frame gate, the resolution governor and the quality watch. */
  target(mode: Settings['powerMode'] = 'auto'): 30 | 60 {
    this.follow(mode);
    if (mode === 'cool') return 30;
    if (mode === 'full') return 60;
    return this.small && this.stepped ? 30 : 60;
  }

  /** The most frames a second the fight is drawn at (FrameGate): the target, but FULL DETAIL on a desktop draws every
   *  frame the display shows (Infinity). The rest of the page budgets for `target`. */
  drawRate(mode: Settings['powerMode'] = 'auto'): number {
    const target = this.target(mode);
    return mode === 'full' && this.desk ? Infinity : target;
  }

  /** A drawn frame, `dt` seconds after the last one drawn; `watching`: a fight on screen and taking its frames (not a
   *  menu over it, not a hidden tab); `spent`: the resolution and the effects have nothing left to give (the renderer's
   *  resolutionSpent); `cpuMs`: the frame's main-thread time, where known; `calm`: no fight live. Answers true on the
   *  frame the rate changes - down to thirty, or back to sixty (`stepped` says which) - and the renderer is rebudgeted. */
  frame(dt: number, watching: boolean, mode: Settings['powerMode'] = 'auto', spent = true, cpuMs?: number, calm = false): boolean {
    this.follow(mode);
    if (dt > 0 && dt < 1) this.clock += dt;
    if (this.small && this.stepped && mode === 'auto' && this.due && calm) {
      this.stepped = false; this.due = false; this.recoveredAt = this.clock; this.roomFor = 0; this.lowFor = 0;
      return true;
    }
    if (!this.small || mode !== 'auto' || !watching) { this.seconds = 0; this.gaps.length = 0; this.cpu.length = 0; if (!watching) this.lowFor = 0; return false; }
    // A frame a quarter of a second or more after the last is a load or a tab put back, not the fight's rate.
    if (!(dt > 0) || dt >= .25) return false;
    this.seconds += dt; this.gaps.push(dt * 1000);
    if (cpuMs !== undefined && cpuMs >= 0 && cpuMs < 250) this.cpu.push(cpuMs);
    if (this.seconds < 1) return false;
    const sorted = this.gaps.sort((a, b) => a - b), late = sorted[Math.floor(sorted.length * .75)] > LATE_MS;
    const cpu = this.cpu.sort((a, b) => a - b), busy = cpu.length >= 10 ? cpu[Math.floor(cpu.length * .75)] : Infinity;
    this.seconds = 0; this.gaps.length = 0; this.cpu.length = 0;
    if (this.stepped) {
      // At thirty: a run of seconds with the main thread's frame well inside a sixtieth makes sixty due.
      this.roomFor = busy < RECOVER_SHARE * 1000 / 60 ? this.roomFor + 1 : 0;
      if (this.roomFor >= this.recoverAfter) this.due = true;
      return false;
    }
    this.lowFor = late ? this.lowFor + 1 : 0;
    if (this.lowFor < STEP_SECONDS || !spent) return false;
    if (this.clock - this.recoveredAt < RELAPSE_SECONDS) this.recoverAfter = Math.min(RECOVER_MOST, this.recoverAfter * 2);
    this.stepped = true; this.lowFor = 0; this.roomFor = 0; this.due = false;
    return true;
  }

  /** A POWER USE chosen anew starts the count again (Balanced picked again: sixty is tried again). */
  private follow(mode: Settings['powerMode']) {
    const m = mode ?? 'auto';
    if (m === this.mode) return;
    if (this.mode !== undefined) { this.stepped = false; this.lowFor = 0; this.seconds = 0; this.gaps.length = 0; this.cpu.length = 0; this.due = false; this.roomFor = 0; this.recoverAfter = RECOVER_SECONDS; }
    this.mode = m;
  }
}
