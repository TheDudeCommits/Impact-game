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

/** A fight on this device (Duel, Training, the arcade, the ball matches: every mode whose arena runs in the page) is drawn
 *  on a clock steered onto one steady lag behind the match. A free clock runs between its two clamps (newest-3 ticks,
 *  newest), so whichever end a session drifted to it stayed at - measured 2 to 4 ticks behind from one session to the
 *  next, a press timed by eye landing in one and late in the next. This one is pulled onto `behind` the match's own clock
 *  (its newest tick plus the time the input clock has banked toward the next: smooth, real time) - gently (`gain` a
 *  second, never more than `pace` of the frame's time a frame, so the frames stay even), or at once past `snap` (a stall,
 *  the start). `behind` leaves the frame's own tick, sent after the clock is read, half a tick of room before the clamp
 *  at the newest (1.2 ticks hit it and doubled the uneven frames). Measured: 2.1-2.5 ticks behind the newest over five
 *  sessions, no frame uneven or stalled. */
export const STEADY_CLOCK = { behind: 1.5 / 60, gain: 4, pace: .08, snap: 3 / 60 } as const;
/** The drawing clock's next value: `next` (the free clock's step, arena seconds) pulled toward `behind` the match's
 *  continuous clock `matchClock` (its newest tick plus the time banked toward the next), over a frame of `rawDt` seconds. */
export function steadyStep(next: number, matchClock: number, rawDt: number) {
  const err = matchClock - STEADY_CLOCK.behind - next;
  if (Math.abs(err) > STEADY_CLOCK.snap) return next + err;
  return next + Math.max(-rawDt * STEADY_CLOCK.pace, Math.min(rawDt * STEADY_CLOCK.pace, err * Math.min(1, rawDt * STEADY_CLOCK.gain)));
}

/** The fight is drawn at no more than about sixty frames a second unless a desktop's player asked for every frame. The
 *  display's own interval is the median of the last requests' gaps; every `every`th request is drawn, the count the most
 *  refreshes that still keep the target: a 60, 90 or 100 Hz display draws every frame, a 120 Hz one every other (60), a
 *  144 Hz one every other (72), a 165 Hz one every other (82) and a 240 Hz one every fourth (60). COUNT_SLACK of a refresh
 *  keeps an exact ratio - 120 Hz against sixty - from flipping between two counts on jitter. A request that comes most of
 *  a target's interval after the last frame drawn is drawn whatever the count, so a page running behind its display is
 *  never held back further. `fps` Infinity draws every request (FULL DETAIL on a desktop: FramePolicy.drawRate). */
export const COUNT_SLACK = .08;
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
    const target=1000/fps,refresh = this.interval, every = Math.max(1, Math.floor(target / refresh + COUNT_SLACK));
    if (++this.skipped < every && now - previous < target - refresh * .5) return false;
    this.skipped = 0;
    return true;
  }
}
