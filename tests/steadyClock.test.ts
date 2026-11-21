import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STEADY_CLOCK, steadyStep } from '../src/render/frameClock';
import { InputClock } from '../src/game/inputClock';

/** The drawing clock of a fight on this device (render/frameClock.ts STEADY_CLOCK): main.ts's frame loop, modelled with
 *  the real input clock - the input pump on its jittered sixty a second and the frame's own command after the clock is
 *  read, the arena one tick per command - for `seconds` of a display at `hz`. `start` is where the clock begins, in ticks
 *  behind the newest; `steady` false is the free clock. Answers the lag behind the match's own clock (ticks) on each drawn
 *  frame after the first two seconds, and each frame's step of the drawn clock against the frame's own time. */
function session(seed: number, start: number, steady: boolean, hz = 60, seconds = 8) {
  let s = seed;
  const random = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const clock = new InputClock(), frameMs = 1000 / hz;
  let newest = 0, local = -start / 60, previous = 1000 + random() * frameMs, nextFrame = previous + frameMs, nextPump = 1000 + random() * 16;
  const lags: number[] = [], steps: number[] = [];
  let drawn = NaN;
  const pump = (now: number) => { newest += clock.advance(now) / 60; };
  pump(1000);
  while (nextFrame < 1000 + seconds * 1000) {
    if (nextPump < nextFrame) { pump(nextPump); nextPump += 1000 / 60 + (random() - .5) * 3; continue; }
    const now = nextFrame, rawDt = (now - previous) / 1000; previous = now; nextFrame += frameMs * (1 + (random() - .5) * .02);
    let next = local + rawDt;
    const matchClock = newest + clock.backlog + (now - clock.last) / 1000 * clock.rate;
    if (steady && clock.last > 0) next = steadyStep(next, matchClock, rawDt);
    local = Math.min(newest, Math.max(newest - 3 / 60, next));
    const shown = local - 1 / 60;
    if (now > 3000) { lags.push((matchClock - shown) * 60); if (Number.isFinite(drawn)) steps.push((shown - drawn) / rawDt); }
    drawn = shown;
    pump(now);
  }
  return { lags, steps };
}
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

describe('a fight on this device is drawn on one steady lag (STEADY_CLOCK)', () => {
  it('lands on the same lag whatever the session started at, on 60 and 120 Hz displays', () => {
    const means: number[] = [];
    for (const hz of [60, 120]) for (const [seed, start] of [[3, 0], [11, 1.5], [29, 3], [41, .4], [57, 2.6]] as const) means.push(mean(session(seed, start, true, hz).lags));
    const spread = Math.max(...means) - Math.min(...means);
    expect(spread).toBeLessThan(.25);
    // About two and a half ticks behind the match's own clock: `behind` and the tick the drawn state is blended across.
    for (const lag of means) expect(lag).toBeCloseTo(STEADY_CLOCK.behind * 60 + 1, 0);
  });
  it('keeps the frames even once it is on its lag: no jump, and the newest tick\'s clamp almost never touched', () => {
    // (A pump tick that lands just after a frame, its jitter flipping the order, can still put the target a hair past the
    // newest: about one frame in five hundred in this model, as `behind` was chosen - 1.2 ticks made 2-4% uneven live.)
    let uneven = 0, total = 0;
    for (const seed of [5, 17, 23, 31, 47]) for (const hz of [60, 120]) {
      const { steps } = session(seed, 3, true, hz);
      expect(Math.max(...steps)).toBeLessThan(1.15);
      uneven += steps.filter(step => step < .85).length; total += steps.length;
    }
    expect(uneven / total).toBeLessThan(.01);
  });
  it('the free clock keeps whatever lag a session began with', () => {
    // The clock the other modes had until now: no pull, so where it starts (the clamps' ends) is where it stays.
    const near = mean(session(3, 0, false).lags), far = mean(session(3, 2.9, false).lags);
    expect(far - near).toBeGreaterThan(1.5);
  });
  it('main.ts steers every local mode by it (not football\'s hit-stop, not the arcade\'s slow motion)', () => {
    const main = readFileSync('src/main.ts', 'utf8');
    expect(main).toContain('if(steadyClock&&!local.paused&&!hit&&scale===1&&inputClock.last>0)next=steadyStep(next,newest+inputClock.backlog+(now-inputClock.last)/1000*inputClock.rate,rawDt);');
    expect(main).not.toContain('network===localBall&&steadyBallClock');
  });
});
