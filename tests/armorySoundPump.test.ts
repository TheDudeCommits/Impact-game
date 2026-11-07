import { describe, expect, it } from 'vitest';
import { PACE, PACE_GAP, RETRY, RUSH_PACE, SoundBank } from '../src/render/vfx/armory/sound';
import { ARMORY_SOUND_NAMES } from '../src/render/vfx/armory/vendor/sounds';
import type { ArmorySoundOut } from '../src/render/vfx/armory/soundOut';

/**
 * Launch day 7 (13 October 2026): when the Armory's sound for a room finished in the fight, its 200-400 files were handed to
 * the game's audio to fetch and decode in one frame (scripts/night/load_hitches.mjs royale: `audio` hitches, 204 and 398
 * decodes in one gap). The files are now handed over a few at a time, a pump a frame or so while some wait, more behind the
 * loading screen; one the game's audio never answered for is asked again after RETRY.
 */
describe('the files are handed to the game\'s audio a few at a time', () => {
  const stocked = (count: number) => {
    const bank = new SoundBank();
    const sound = Object.keys(ARMORY_SOUND_NAMES)[0];
    bank.provide({ sound, gain: 1 } as never, Array.from({ length: count }, (_, i) => `blob:test/${i}`));
    const held = new Map<string, number>(), asked: string[][] = [];
    const out: ArmorySoundOut = { sample() {}, preload: urls => { asked.push([...urls]); }, sampleSeconds: url => held.get(url) };
    return { bank, held, asked, out };
  };

  it('hands over PACE files, then waits for the next pump, not two hundred at once', () => {
    const { bank, asked, out } = stocked(200);
    bank.pump(out, 10);
    expect(asked).toHaveLength(1);
    expect(asked[0]).toHaveLength(PACE);
    // The next pump comes soon after while files wait, and not before.
    bank.pump(out, 10 + PACE_GAP / 2);
    expect(asked).toHaveLength(1);
    bank.pump(out, 10 + PACE_GAP * 1.1);
    expect(asked).toHaveLength(2);
    expect(asked[1]).toHaveLength(PACE);
    expect(new Set([...asked[0], ...asked[1]]).size).toBe(PACE * 2);
  });

  it('gets through the whole bank in a second or two of frames, each file once, and then stops asking', () => {
    const { bank, held, asked, out } = stocked(200);
    let now = 10, frames = 0;
    while (frames < 400 && !bank.settled(out)) {
      bank.pump(out, now);
      for (const url of asked.flat()) held.set(url, 1);
      now += 1 / 60; frames++;
    }
    expect(bank.settled(out)).toBe(true);
    expect(asked.flat()).toHaveLength(200);
    expect(new Set(asked.flat()).size).toBe(200);
    expect(Math.max(...asked.map(a => a.length))).toBeLessThanOrEqual(PACE);
    expect(frames / 60).toBeLessThan(3);
    const calls = asked.length;
    bank.pump(out, now + 5); bank.pump(out, now + 10);
    expect(asked).toHaveLength(calls);
  });

  it('while a room loads it hands over more at a time', () => {
    const { bank, asked, out } = stocked(200);
    bank.rushing++;
    bank.pump(out, 10);
    expect(asked[0]).toHaveLength(RUSH_PACE);
    bank.rushing--;
    bank.pump(out, 10 + PACE_GAP * 1.1);
    expect(asked[1]).toHaveLength(PACE);
  });

  it('asks again for a file the game never answered, after RETRY, and not before (it had no context yet)', () => {
    const { bank, asked, out } = stocked(3);
    bank.pump(out, 10);
    expect(asked.flat()).toHaveLength(3);
    bank.pump(out, 10 + 1);
    expect(asked.flat()).toHaveLength(3);
    bank.pump(out, 10 + RETRY + .6);
    expect(asked.flat()).toHaveLength(6);
  });

  it('files let go (a room past) are forgotten, and asked for at once if they come back, not after RETRY', () => {
    const { bank, held, asked, out } = stocked(4);
    const layer = { sound: Object.keys(ARMORY_SOUND_NAMES)[0], gain: 1 } as never;
    bank.pump(out, 10);
    expect(asked.flat()).toHaveLength(4);
    const released = bank.retain([]);
    expect(released).toHaveLength(4);
    for (const url of released) held.delete(url);
    bank.provide(layer, released);
    bank.pump(out, 10.6);
    expect(asked.flat()).toHaveLength(8);
  });
});
