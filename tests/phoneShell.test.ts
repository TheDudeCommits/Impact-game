import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { buzzFor, GAP, LONGEST, TouchHaptics } from '../src/input/haptics';
import { PhoneShell } from '../src/ui/phoneShell';

/** The phone pass (November 2026): what a phone's browser does around a fight. */
describe('the phone\'s buzz on the touch controls (input/haptics.ts)', () => {
  it('a pulse\'s strength is its length: short, never past LONGEST, nothing for a whisper', () => {
    expect(buzzFor({ strong: 0, weak: .22, ms: 40 })).toBeGreaterThan(8);
    expect(buzzFor({ strong: 0, weak: .22, ms: 40 })).toBeLessThan(20);
    expect(buzzFor({ strong: 1, weak: 1, ms: 700 })).toBe(LONGEST);
    expect(buzzFor({ strong: .05, weak: .1, ms: 50 })).toBe(0);
  });
  it('follows the VIBRATION setting, off at 0', () => {
    const pulse = { strong: .6, weak: .75, ms: 130 };
    expect(buzzFor(pulse, .5)).toBeLessThan(buzzFor(pulse, 1));
    expect(buzzFor(pulse, 0)).toBe(0);
  });
  it('sends the strongest of a frame\'s pulses, then waits out the buzz and a gap', () => {
    const sent: number[] = [], haptics = new TouchHaptics(ms => { sent.push(ms); return true; });
    haptics.add({ strong: 0, weak: .22, ms: 40 }); haptics.add({ strong: .5, weak: .6, ms: 140 });
    const first = haptics.flush(1000);
    expect(sent).toEqual([first]); expect(first).toBe(buzzFor({ strong: .5, weak: .6, ms: 140 }));
    haptics.add({ strong: 1, weak: 1, ms: 700 });
    expect(haptics.flush(1000 + first + GAP - 1)).toBe(0);   // dropped, not queued
    haptics.add({ strong: 1, weak: 1, ms: 700 });
    expect(haptics.flush(1000 + first + GAP)).toBe(LONGEST);
    expect(haptics.flush(5000)).toBe(0);
  });
  it('Input buzzes only while the touch controls are the controller, with the pad\'s VIBRATION scale', () => {
    const source = readFileSync(new URL('../src/input.ts', import.meta.url), 'utf8');
    expect(source).toMatch(/else if\(this\.mode==='touch'&&this\.focused\)\{this\.haptics\.scale=this\.rumble\.scale;this\.haptics\.add\(pulse\);\}/);
    expect(source).toMatch(/else if\(this\.mode==='touch'\)this\.haptics\.flush\(performance\.now\(\)\)/);
  });
});

describe('the screen kept on in a fight (ui/phoneShell.ts)', () => {
  afterEach(() => vi.unstubAllGlobals());
  const setup = () => {
    const events: string[] = [];
    const lock = { released: false, release: vi.fn(async () => { lock.released = true; events.push('release'); }), addEventListener: vi.fn() };
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) Mobile', wakeLock: { request: vi.fn(async () => { events.push('request'); lock.released = false; return lock; }) } });
    vi.stubGlobal('document', { hidden: false, addEventListener: vi.fn(), fullscreenElement: null });
    return { events, lock };
  };
  it('asks for the lock as a fight starts and lets it go on the pause menu or the home', async () => {
    const { events } = setup();
    const shell = new PhoneShell(true);
    shell.fighting(true); shell.fighting(true);
    await Promise.resolve(); await Promise.resolve();
    expect(events).toEqual(['request']);
    shell.fighting(false);
    await Promise.resolve();
    expect(events).toEqual(['request', 'release']);
  });
  it('does nothing on a desktop', async () => {
    const { events } = setup();
    const shell = new PhoneShell(false);
    shell.fighting(true);
    await Promise.resolve();
    expect(events).toEqual([]);
  });
});
