import { describe, expect, it } from 'vitest';
import { catchUp, INPUT_HZ, MAX_CATCH_UP, STALL_SECONDS } from '../src/game/catchUp';

/** The local copy of the simulation advances one tick per command sent, and
 *  commands go out on a 60 Hz timer the browser does not queue when it misses
 *  it. The server keeps applying the last command it received on every tick,
 *  so if the client cannot keep up the authoritative body moves at full speed
 *  and the predicted one does not - and every snapshot lands as a correction
 *  rather than as a confirmation. That is the body being tugged forward and
 *  dragged back, on a perfect network. */
const TICK = 1 / INPUT_HZ;

/** Run a whole second of callbacks at `fps` and report what fraction of the
 *  sixty ticks in that second the local copy actually got. */
function keptUp(fps: number) {
  const elapsed = 1 / fps;
  let backlog = 0, ticks = 0;
  for (let i = 0; i < fps; i++) { const due = catchUp(backlog, elapsed); backlog = due.backlog; ticks += due.steps; }
  return ticks / INPUT_HZ;
}

describe('the local copy keeps up with real time', () => {
  it.each([60, 30, 20, 10, 5])('runs every tick at %i frames a second', fps => {
    // The old five-tick ceiling gave 100% at 60, 83% at 10 and 42% at 5.
    const ratio = keptUp(fps);
    expect(ratio, `${fps} fps ran ${(ratio * 100).toFixed(0)}% of real time`).toBeGreaterThan(.98);
  });

  it('does not replay a tab that was away', () => {
    // A page hidden for a minute is not owed a minute of input. The test is
    // the interval, not the backlog: a long gap means away, a short one means
    // busy, and they need opposite answers.
    const due = catchUp(0, 60);
    expect(due.steps, 'a minute away replayed as input').toBe(1);
    expect(due.backlog).toBeLessThan(TICK);
  });

  it('never runs away with the main thread', () => {
    // Whatever arrives, one callback is bounded - the cost of a step is about
    // 0.12 ms with twelve actors and the real stage collision, so this is a
    // couple of milliseconds at worst.
    for (const elapsed of [0, .001, TICK, .1, STALL_SECONDS - .001, STALL_SECONDS + .001, 5])
      expect(catchUp(0, elapsed).steps).toBeLessThanOrEqual(MAX_CATCH_UP);
  });

  it('carries the remainder rather than dropping it', () => {
    // A 90 Hz display sends one and a half ticks' worth per callback; the half
    // has to survive, or the local copy loses a tick every other frame.
    let backlog = 0, ticks = 0;
    for (let i = 0; i < 90; i++) { const due = catchUp(backlog, 1 / 90); backlog = due.backlog; ticks += due.steps; }
    expect(ticks, `90 Hz ran ${ticks} ticks in a second`).toBe(INPUT_HZ);
  });
});
