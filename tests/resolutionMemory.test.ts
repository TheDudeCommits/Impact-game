import { beforeEach, describe, expect, it } from 'vitest';
import { recallSettled, rememberSettled, settledKey, SettleWatch, SETTLE_S } from '../src/render/resolutionMemory';

/** A page's storage, for the node environment. */
function fakeStorage() {
  const data = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, String(v)); }, removeItem: k => { data.delete(k); },
    clear: () => data.clear(), key: i => [...data.keys()][i] ?? null, get length() { return data.size; },
  } as Storage;
  return data;
}

describe('the settled resolution (resolutionMemory.ts)', () => {
  beforeEach(() => { fakeStorage(); });

  it('keeps a share per GPU, budget and window size', () => {
    const a = settledKey('Apple M4', 'high:auto:0:true:60:1.5', 1920, 1080), b = settledKey('Apple M4', 'high:auto:0:true:60:1.5', 1470, 956);
    expect(a).not.toBe(b);
    expect(settledKey('Apple M4', 'high:auto:0:true:60:1.5', 1925, 1083)).toBe(a);
    rememberSettled(a, .8);
    expect(recallSettled(a)).toBe(.8);
    expect(recallSettled(b)).toBeUndefined();
  });

  it('keeps only the dozen most recent keys', () => {
    for (let i = 0; i < 15; i++) rememberSettled(`k${i}`, .7, 1000 + i);
    expect(recallSettled('k0')).toBeUndefined();
    expect(recallSettled('k2')).toBeUndefined();
    expect(recallSettled('k3')).toBe(.7);
    expect(recallSettled('k14')).toBe(.7);
  });

  it('ignores a broken or out-of-range entry', () => {
    localStorage.setItem('rift-resolution-settled', JSON.stringify({ x: { s: 3, t: 1 }, y: { s: 'a', t: 1 } }));
    expect(recallSettled('x')).toBeUndefined();
    expect(recallSettled('y')).toBeUndefined();
    localStorage.setItem('rift-resolution-settled', '{not json');
    expect(recallSettled('x')).toBeUndefined();
  });

  it('takes a share only after it held through SETTLE_S seconds of fighting', () => {
    const watch = new SettleWatch();
    const run = (seconds: number, scale: number, calm = false) => {
      let kept: number | undefined;
      for (let t = 0; t < seconds; t += 1 / 60) kept = watch.frame(1 / 60, scale, calm) ?? kept;
      return kept;
    };
    expect(run(4, 1)).toBeUndefined();           // walking down: each share held a moment
    expect(run(SETTLE_S - 1, .8)).toBeUndefined();
    expect(run(30, .8, true)).toBeUndefined();   // menus and intros do not count
    expect(run(2, .8)).toBe(.8);                 // ... the fight's own seconds do
    expect(run(30, .8)).toBeUndefined();         // kept once
    expect(run(SETTLE_S + 1, .85)).toBe(.85);    // a new share, held, is kept again
  });

  it('a share recalled at the start is not kept again unchanged', () => {
    const watch = new SettleWatch(); watch.reset(.8);
    let kept: number | undefined;
    for (let t = 0; t < 20; t += 1 / 60) kept = watch.frame(1 / 60, .8, false) ?? kept;
    expect(kept).toBeUndefined();
  });
});
