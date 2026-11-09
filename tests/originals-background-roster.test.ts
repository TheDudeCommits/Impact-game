import { afterEach, describe, expect, it, vi } from 'vitest';
import { BACKGROUND_ROSTER_MBPS, backgroundRoster, lineMbps, type DeviceSignals } from '../src/loading/backgroundPolicy';

/** The home's background volume (40-60 MB of fighters) is held back on a slow line
 *  or one that saves data, and each fighter comes when it is picked or a room has it (src/loading/backgroundPolicy.ts). */
const desk: DeviceSignals = { handheld: false, strongMachine: true, deviceMemory: 8, effectiveType: '4g', downlink: 10, measured: 40, line: 80 };

describe('the background roster on a strong desktop', () => {
  it('is fetched on a fast line', () => {
    expect(backgroundRoster(desk)).toEqual({ allowed: true, reason: 'a strong machine on a fast connection' });
    expect(backgroundRoster({ ...desk, line: BACKGROUND_ROSTER_MBPS })).toMatchObject({ allowed: true });
  });
  it('is held where data is saved, whatever the line', () => {
    expect(backgroundRoster({ ...desk, saveData: true })).toEqual({ allowed: false, reason: 'data saver is on' });
  });
  it('is held on a line slower than a volume takes with ease (20 Mbit/s and a 4G line at 9 read 14-17 and 5.6)', () => {
    expect(backgroundRoster({ ...desk, line: 15.2, measured: 7.8 })).toEqual({ allowed: false, reason: 'a slow connection (15.2 Mbit/s)' });
    expect(backgroundRoster({ ...desk, line: 5.6, measured: 3.4 }).allowed).toBe(false);
    expect(backgroundRoster({ ...desk, line: BACKGROUND_ROSTER_MBPS - .1 }).allowed).toBe(false);
    // (The whole line decides where it is known: a fast one whose files each came slowly while they shared it is fast.)
    expect(backgroundRoster({ ...desk, line: 48, measured: 19.6 }).allowed).toBe(true);
  });
  it('is held where the browser reads the line as slow, even when the page measured it fast', () => {
    for (const effectiveType of ['slow-2g', '2g', '3g']) expect(backgroundRoster({ ...desk, effectiveType })).toEqual({ allowed: false, reason: `a slow connection (${effectiveType})` });
  });
  it('goes by the fastest file, then the browser estimate, before a megabyte has come (a return visit from the cache), as before', () => {
    expect(backgroundRoster({ ...desk, line: undefined, measured: 6 }).allowed).toBe(true);
    expect(backgroundRoster({ ...desk, line: undefined, measured: 4 }).allowed).toBe(false);
    expect(backgroundRoster({ ...desk, line: undefined, measured: undefined }).allowed).toBe(true);
    expect(backgroundRoster({ ...desk, line: undefined, measured: undefined, downlink: 1.5 }).allowed).toBe(false);
  });
  it('stays off on phones, cellular links, weaker machines and small memory, as before', () => {
    expect(backgroundRoster({ ...desk, handheld: true }).allowed).toBe(false);
    expect(backgroundRoster({ ...desk, type: 'cellular' }).allowed).toBe(false);
    expect(backgroundRoster({ ...desk, strongMachine: false }).allowed).toBe(false);
    expect(backgroundRoster({ ...desk, deviceMemory: 4 }).allowed).toBe(false);
  });
});

describe('the line as the page has been sent it (lineMbps)', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  const timing = (entries: Partial<PerformanceResourceTiming>[]) => vi.stubGlobal('performance', { getEntriesByType: () => entries });
  it('counts every byte over the time something was arriving, not each file alone', () => {
    // Four 500 KB files sharing one second: each read alone is 4 Mbit/s, the line 16.
    timing([0, 1, 2, 3].map(() => ({ transferSize: 500_100, encodedBodySize: 500_000, responseStart: 1000, responseEnd: 2000 })));
    expect(lineMbps()).toBeCloseTo(16, 5);
    // Two bursts with an idle second between them: the idle time is not the line's.
    timing([{ transferSize: 1, encodedBodySize: 1_000_000, responseStart: 0, responseEnd: 500 }, { transferSize: 1, encodedBodySize: 1_000_000, responseStart: 1500, responseEnd: 2000 }]);
    expect(lineMbps()).toBeCloseTo(16, 5);
  });
  it('knows nothing under a megabyte, or of what came from the cache', () => {
    timing([{ transferSize: 1, encodedBodySize: 900_000, responseStart: 0, responseEnd: 100 }, { transferSize: 0, encodedBodySize: 5_000_000, responseStart: 0, responseEnd: 10 }]);
    expect(lineMbps()).toBeUndefined();
  });
});
