import type { Settings } from '../config';
import { phone } from '../input/device';

/**
 * The rate a fight is drawn at, by the POWER USE setting (Settings.powerMode) and the device (the phone pass, November
 * 2026: a phone's heat and frame rate). The simulation, the input and the network never follow it: they keep their own
 * sixty a second (main.ts's input timer, the arenas' clocks); only the drawing does (FrameGate).
 *
 *   'cool' (Cooler): thirty everywhere.
 *   'full' (Full detail): sixty everywhere, a phone's included - the player's way to sixty whatever this decides.
 *   'auto' (Balanced): sixty on a desktop or a tablet. On a phone, sixty while it holds it; a phone that cannot - in a
 *     fight, STEP_SECONDS seconds in a row each with a quarter or more of its frames late (the second's 75th-percentile
 *     gap over LATE_MS: a vsync missed) - draws an even thirty from then on for the visit, every frame the same length,
 *     rather than a stutter between sixty and thirty (measured in a phone's profile: 44 fps with a p95 frame of 33 ms).
 *     A few long frames (a fight's first effects warming up) do not count: the percentile, not the average. Thirty frames
 *     also ask half the work of the GPU, and the heat with it. Choosing Balanced again in a menu gives sixty another try.
 */
export const LATE_MS = 22, STEP_SECONDS = 6;
export type PowerMode = NonNullable<Settings['powerMode']>;

export class FramePolicy {
  /** A phone on Balanced that could not hold sixty: thirty for the rest of the visit. */
  stepped = false;
  private mode: PowerMode | undefined;
  private seconds = 0;
  private readonly gaps: number[] = [];
  private lowFor = 0;
  /** `small`: a phone (input/device.ts), read once. */
  constructor(readonly small = phone()) {}

  /** The rate aimed at now, for the frame gate, the resolution governor and the quality watch. */
  target(mode: Settings['powerMode'] = 'auto'): 30 | 60 {
    this.follow(mode);
    if (mode === 'cool') return 30;
    if (mode === 'full') return 60;
    return this.small && this.stepped ? 30 : 60;
  }

  /** A drawn frame, `dt` seconds after the last one drawn; `watching`: a fight on screen and taking its frames (not a
   *  menu over it, not a hidden tab). Answers true on the frame it steps down to thirty (the renderer is rebudgeted). */
  frame(dt: number, watching: boolean, mode: Settings['powerMode'] = 'auto'): boolean {
    this.follow(mode);
    if (!this.small || this.stepped || mode !== 'auto' || !watching) { this.seconds = 0; this.gaps.length = 0; if (!watching) this.lowFor = 0; return false; }
    // A frame a quarter of a second or more after the last is a load or a tab put back, not the fight's rate.
    if (!(dt > 0) || dt >= .25) return false;
    this.seconds += dt; this.gaps.push(dt * 1000);
    if (this.seconds < 1) return false;
    const sorted = this.gaps.sort((a, b) => a - b), late = sorted[Math.floor(sorted.length * .75)] > LATE_MS;
    this.seconds = 0; this.gaps.length = 0;
    this.lowFor = late ? this.lowFor + 1 : 0;
    if (this.lowFor < STEP_SECONDS) return false;
    this.stepped = true; this.lowFor = 0;
    return true;
  }

  /** A POWER USE chosen anew starts the count again (Balanced picked again: sixty is tried again). */
  private follow(mode: Settings['powerMode']) {
    const m = mode ?? 'auto';
    if (m === this.mode) return;
    if (this.mode !== undefined) { this.stepped = false; this.lowFor = 0; this.seconds = 0; this.gaps.length = 0; }
    this.mode = m;
  }
}
