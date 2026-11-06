import { describe, expect, it } from 'vitest';
import { finisherMirror, roundMirror } from '../src/originals/finisherMirror';

describe('the lock round mirror rule', () => {
  it('a no-mirror row covers every take of the second round, the finisher and Light 4-6 alike', () => {
    for (const slot of ['svanhild', 'strix', 'tempo', 'oyashio', 'hawser'] as const) {
      expect(roundMirror(slot, true)?.mirror, slot).toBe(false);
      expect(roundMirror(slot, false)?.mirror, slot).toBe(false);
    }
  });
  it('a mirror row is read at the finisher only', () => {
    for (const slot of ['hakushi', 'kubiwa', 'kuon'] as const) {
      expect(roundMirror(slot, true)?.mirror, slot).toBe(true);
      expect(roundMirror(slot, false), slot).toBeUndefined();
    }
  });
  it("a slot without a row keeps the earlier rule", () => {
    expect(finisherMirror('gummy')).toBeUndefined();
    expect(roundMirror('gummy', true)).toBeUndefined();
    expect(roundMirror('gummy', false)).toBeUndefined();
  });
});
