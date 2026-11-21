import { describe, expect, it } from 'vitest';
import { FRAME_MS, FrameGate } from '../src/render/frameClock';
import { BUDGET_MS, MIN_SCALE, STEP, STRONG_BUDGET_MS, UP_AFTER_DOWN_S, nextScale, strongGpu } from '../src/render/ResolutionGovernor';


/** Ten seconds of a display at `hz`, its requests jittered by 2%: the gaps between the frames the gate draws. */
function drawn(hz: number, slowEvery = 0, fps = 60) {
  const gate = new FrameGate(), gaps: number[] = [];
  let now = 0, previous = 0, seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < hz * 10; i++) {
    now += 1000 / hz * (1 + (random() - .5) * .04) + (slowEvery && i % slowEvery === 0 ? 25 : 0);
    if (!gate.draw(now, previous, fps)) continue;
    if (i > hz) gaps.push(now - previous);
    previous = now;
  }
  return gaps.sort((a, b) => a - b);
}

describe('the frame gate', () => {
  it('draws every frame of a 60, 75, 90 or 100 Hz display', () => {
    for (const hz of [60, 75, 90, 100]) {
      const gaps = drawn(hz);
      expect(gaps[gaps.length >> 1]).toBeCloseTo(1000 / hz, 0);
      expect(gaps.length).toBeGreaterThan(hz * 8.5);
    }
  });
  it('holds a high-refresh display to about sixty, evenly', () => {
    // (A 165 Hz display every other frame, 82: the count rounded to the nearest until now drew it every
    // third, 55, under the target - and a 100 Hz one every other, 50.)
    for (const [hz, every] of [[120, 2], [144, 2], [165, 2], [240, 4]] as const) {
      const gaps = drawn(hz), want = 1000 / hz * every;
      // Every drawn frame the same number of refreshes apart: no beat between two counts.
      expect(gaps[0]).toBeGreaterThan(want * .95);
      expect(gaps[gaps.length - 1]).toBeLessThan(want * 1.05);
    }
  });
  it('never draws under its target for the count\'s sake, at sixty or at thirty', () => {
    for (const [hz, fps] of [[60, 60], [75, 60], [100, 60], [120, 60], [144, 60], [165, 60], [175, 60], [200, 60], [240, 60], [360, 60],
      [60, 30], [100, 30], [120, 30], [144, 30], [165, 30], [240, 30]] as const) {
      const gaps = drawn(hz, 0, fps);
      // The median drawn gap within a refresh's jitter of the target's interval, or shorter.
      expect(gaps[gaps.length >> 1], `${hz} Hz at ${fps}`).toBeLessThan(1000 / fps * 1.03);
    }
  });
  it('FULL DETAIL on a desktop (no cap) draws every frame the display shows', () => {
    for (const hz of [60, 120, 144, 240]) {
      const gaps = drawn(hz, 0, Infinity);
      expect(gaps[gaps.length >> 1]).toBeCloseTo(1000 / hz, 0);
      expect(gaps.length).toBeGreaterThan(hz * 8.5);
    }
  });
  it('never holds back a page that is already running behind its display', () => {
    // A 120 Hz display whose page only manages a frame every 25 ms or so: each one is drawn.
    const gaps = drawn(40);
    expect(gaps[gaps.length >> 1]).toBeCloseTo(25, 0);
    // A slow frame now and then on a 60 Hz display does not cost the frame after it.
    const bumpy = drawn(60, 30);
    expect(bumpy.filter(gap => gap > FRAME_MS * 1.5).length).toBeLessThan(bumpy.length * .05);
  });
});

describe('the resolution governor', () => {
  const window = (ms: number, n = 60) => Array.from({length: n}, (_, i) => ms * (.9 + .2 * i / n));
  it('steps down while the GPU is over its budget, and two steps when far over', () => {
    expect(nextScale({scale: 1, sinceDown: 99, samples: window(BUDGET_MS * 1.15), timed: true})).toBeCloseTo(1 - STEP, 6);
    expect(nextScale({scale: 1, sinceDown: 99, samples: window(BUDGET_MS * 1.6), timed: true})).toBeCloseTo(1 - 2 * STEP, 6);
  });
  it('holds inside its budget, and steps up only with room and a while after a step down', () => {
    expect(nextScale({scale: .8, sinceDown: 99, samples: window(BUDGET_MS * .85), timed: true})).toBeCloseTo(.8, 6);
    expect(nextScale({scale: .8, sinceDown: 99, samples: window(BUDGET_MS * .5), timed: true})).toBeCloseTo(.8 + STEP, 6);
    expect(nextScale({scale: .8, sinceDown: UP_AFTER_DOWN_S - 1, samples: window(BUDGET_MS * .5), timed: true})).toBeCloseTo(.8, 6);
  });
  it('stays between its floor and the quality\'s own resolution', () => {
    expect(nextScale({scale: MIN_SCALE, sinceDown: 99, samples: window(BUDGET_MS * 3), timed: true})).toBeCloseTo(MIN_SCALE, 6);
    expect(nextScale({scale: 1, sinceDown: 99, samples: window(1), timed: true})).toBe(1);
  });
  it('keeps to the floor the renderer sets', () => {
    expect(nextScale({scale: .7, floor: 1 / 1.5, sinceDown: 99, samples: window(BUDGET_MS * 3), timed: true})).toBeCloseTo(1 / 1.5, 6);
    expect(nextScale({scale: .75, floor: .75, sinceDown: 99, samples: window(BUDGET_MS * 3), timed: true})).toBeCloseTo(.75, 6);
  });
  it('judges nothing on a handful of frames', () => {
    expect(nextScale({scale: 1, sinceDown: 99, samples: window(BUDGET_MS * 3, 5), timed: true})).toBe(1);
  });
  it('without a GPU timer, reads frames that keep missing their sixtieth', () => {
    expect(nextScale({scale: 1, sinceDown: 99, samples: window(FRAME_MS), timed: false})).toBe(1);
    expect(nextScale({scale: 1, sinceDown: 99, samples: window(28), timed: false})).toBeLessThan(1);
  });
});

describe('a strong machine keeps its sharpness', () => {
  it('knows a strong GPU by name', () => {
    for (const name of ['ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)', 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Max, Unspecified Version)',
      'ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro, Unspecified Version)', 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0, D3D11)', 'ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0, D3D11)'])
      expect(strongGpu(name), name).toBe(true);
    for (const name of ['ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)', 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)',
      'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)', 'ANGLE (NVIDIA, NVIDIA GeForce MX250 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)', 'Apple GPU', 'Mali-G78', 'Adreno (TM) 740'])
      expect(strongGpu(name), name).toBe(false);
  });
  it('holds full resolution through a frame that would have stepped an ordinary one down', () => {
    const busy = Array.from({length: 60}, (_, i) => BUDGET_MS * 1.1 * (.9 + .2 * i / 60));
    expect(nextScale({scale: 1, sinceDown: 99, samples: busy, timed: true})).toBeLessThan(1);
    expect(nextScale({scale: 1, strong: true, sinceDown: 99, samples: busy, timed: true})).toBe(1);
  });
  it('steps down as soon as more than the odd frame would miss its sixtieth', () => {
    // Most frames easy, one in ten over the strong budget: an ordinary machine holds (its 75th percentile is easy),
    // a strong one does not keep its extra resolution at that price.
    const spiky = Array.from({length: 60}, (_, i) => i % 10 === 0 ? STRONG_BUDGET_MS * 1.2 : 7);
    expect(nextScale({scale: 1, strong: true, sinceDown: 99, samples: spiky, timed: true})).toBeLessThan(1);
    const over = Array.from({length: 60}, () => STRONG_BUDGET_MS * 1.2);
    expect(nextScale({scale: 1, strong: true, sinceDown: 99, samples: over, timed: true})).toBeLessThan(1);
  });
});
