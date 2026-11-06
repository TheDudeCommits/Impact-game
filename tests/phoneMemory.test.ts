import { afterEach, describe, expect, it, vi } from 'vitest';
import { LIBRARY, LIBRARY_PHONE, LIBRARY_STRONG, libraryCap } from '../src/loading/retention';
import { audioContext, PHONE_SAMPLE_RATE } from '../src/audio/contextRate';
import { aacWindow } from '../src/audio/aacTrim';
import { FighterLibrary } from '../src/render/Fighter';

/** The phone pass (November 2026): what a phone's tab holds. */
describe('a phone\'s library keeps six fighters whole between rooms', () => {
  it('six on a phone, sixteen elsewhere, twenty-four on a strong machine', () => {
    expect(libraryCap(false, true)).toBe(LIBRARY_PHONE);
    expect(LIBRARY_PHONE).toBe(6);
    expect(libraryCap(false, false)).toBe(LIBRARY);
    expect(libraryCap(true, false)).toBe(LIBRARY_STRONG);
  });
  it('the room\'s own fighters stay whatever the cap', () => {
    const library = new FighterLibrary() as unknown as { sources: Map<string, unknown>; loaded: Set<string>; used: Map<string, number>; queue: { completed: Set<string> }; evict(keep: ReadonlySet<string>, most: number): void; has(id: string): boolean; loadedCount: number };
    const roster = Array.from({ length: 20 }, (_, i) => `f${i}`);
    roster.forEach((id, i) => { library.sources.set(id, { scene: { traverse() {} } }); library.loaded.add(id); library.queue.completed.add(id); library.used.set(id, i + 1); });
    const room = new Set(roster.slice(8, 20));
    library.evict(room, libraryCap(false, true));
    expect(library.loadedCount).toBe(12);
    library.evict(new Set(['f19']), libraryCap(false, true));
    expect(library.loadedCount).toBe(LIBRARY_PHONE);
    expect(library.has('f19')).toBe(true);
  });
});

describe('a phone decodes and mixes its sound at 32 kHz (audio/contextRate.ts)', () => {
  afterEach(() => vi.unstubAllGlobals());
  const contexts: { latencyHint?: string; sampleRate?: number }[] = [];
  class Stub { sampleRate: number; constructor(o: { latencyHint?: string; sampleRate?: number } = {}) { contexts.push(o); this.sampleRate = o.sampleRate ?? 48000; } }
  it('asks a phone\'s context for 32 kHz and leaves every other device its own rate', () => {
    vi.stubGlobal('AudioContext', Stub);
    expect((audioContext('interactive', true) as unknown as Stub).sampleRate).toBe(PHONE_SAMPLE_RATE);
    expect(contexts.at(-1)).toEqual({ latencyHint: 'interactive', sampleRate: PHONE_SAMPLE_RATE });
    expect((audioContext('playback', false) as unknown as Stub).sampleRate).toBe(48000);
    expect(contexts.at(-1)).toEqual({ latencyHint: 'playback' });
  });
  it('a browser that refuses the rate gets its own', () => {
    vi.stubGlobal('AudioContext', class extends Stub { constructor(o: { latencyHint?: string; sampleRate?: number } = {}) { if (o.sampleRate) throw new DOMException('rate', 'NotSupportedError'); super(o); } });
    expect((audioContext('interactive', true) as unknown as Stub).sampleRate).toBe(48000);
  });
  it('the AAC copies are still trimmed right when decoded at 32 kHz', () => {
    // A clip of 48,000 frames at 48 kHz: trimmed by the browser it comes back one second long at the context's rate.
    expect(aacWindow(32000, 32000, [48000, 48000])).toEqual({ start: 0, length: 32000 });
    // Untrimmed (Firefox), the encoder's delay is read at the context's rate.
    const untrimmed = Math.round(Math.ceil((48000 + 2112) / 1024) * 1024 * 32000 / 48000);
    expect(aacWindow(untrimmed, 32000, [48000, 48000])).toEqual({ start: 1408, length: 32000 });
  });
});
