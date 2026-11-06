/** What each consumer of a render frame is handed, in seconds.
 *
 *  The world - the fighters' procedural layer, the effects - is clamped so a
 *  long frame cannot push a body through a wall or explode a spring. The
 *  camera is not: it bounds its own step and is built from smoothers in units
 *  a second, and handing it the clamped figure made the shot advance in slow
 *  motion while the fight did not - below 20 fps it fell metres behind. So
 *  did the local prediction's correction decay, which was banked at the
 *  snapshot rate and bled at the clamped one.
 *
 *  Pure, and the only place the policy lives, so a test can hold the
 *  render loop's call sites to it: a test that drives `FollowCamera` with the
 *  raw step directly proves nothing about what `main.ts` hands it. */
export const WORLD_MAX_STEP = .05;
export function frameSteps(rawDt: number) {
  const real = Number.isFinite(rawDt) && rawDt > 0 ? rawDt : 0;
  return { world: Math.min(WORLD_MAX_STEP, real), camera: real, correction: real };
}

export const FRAME_MS = 1000 / 60;
export class FrameGate {
  private readonly gaps = new Float64Array(15);
  private readonly sorted = new Float64Array(15);
  private count = 0;
  private lastRequest = 0;
  private skipped = 0;
  /** The display's interval, milliseconds, as the requests have shown it (a sixtieth until there are enough). */
  get interval() {
    if (this.count < this.gaps.length) return FRAME_MS;
    this.sorted.set(this.gaps); this.sorted.sort();
    return this.sorted[this.gaps.length >> 1];
  }
  /** Called for every animation frame requested at `now`; `previous` is when the last one drawn was. Answers whether
   *  this one is drawn. */
  draw(now: number, previous: number, fps=60) {
    if (this.lastRequest > 0) this.gaps[this.count++ % this.gaps.length] = now - this.lastRequest;
    this.lastRequest = now;
    const target=1000/fps,refresh = this.interval, every = Math.max(1, Math.round(target / refresh - .1));
    if (++this.skipped < every && now - previous < target - refresh * .5) return false;
    this.skipped = 0;
    return true;
  }
}
