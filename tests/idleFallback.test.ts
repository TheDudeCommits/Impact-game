import { afterEach, describe, expect, it, vi } from 'vitest';
import { idle } from '../src/render/vfx/armory/sound';

/** Safari has no requestIdleCallback (s15perf section 4, item 11): the Armory sound bank's slices waited a bare 16 ms
 *  timer, landing anywhere in a frame. Without it they wait for the moment just after a frame. */
describe("the sound bank's idle wait without requestIdleCallback", () => {
  const g = globalThis as unknown as Record<string, unknown>, saved = { ric: g.requestIdleCallback, raf: g.requestAnimationFrame };
  afterEach(() => { g.requestIdleCallback = saved.ric; g.requestAnimationFrame = saved.raf; vi.useRealTimers(); });
  it('resumes just after the next frame, not on a timer of its own', async () => {
    vi.useFakeTimers(); delete g.requestIdleCallback;
    const frames: (() => void)[] = []; g.requestAnimationFrame = (fn: () => void) => frames.push(fn);
    let over = false; void idle().then(() => { over = true; });
    await vi.advanceTimersByTimeAsync(60); expect(over, 'no frame yet: still waiting (a 16 ms timer was over by now)').toBe(false);
    frames.shift()!(); await vi.advanceTimersByTimeAsync(0); expect(over).toBe(true);
  });
  it('a page drawing no frames still gets there, at 120 ms', async () => {
    vi.useFakeTimers(); delete g.requestIdleCallback; g.requestAnimationFrame = () => 0;
    let over = false; void idle().then(() => { over = true; });
    await vi.advanceTimersByTimeAsync(119); expect(over).toBe(false);
    await vi.advanceTimersByTimeAsync(2); expect(over).toBe(true);
  });
});
