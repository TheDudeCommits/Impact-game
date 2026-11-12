import fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MANIFEST from '../src/audio/data/ambience.json';
import { AMBIENCE_LEVEL, AMBIENCES, ambienceUrl, CHEER, filesOf, levelOf, loopOf, StageAmbience, type AmbienceFile } from '../src/audio/ambience';
import { STAGE_SPACES } from '../src/audio/space';
import { STAGES, type StageId } from '../src/game/stages';
import { bird, drone, room, seamless, surf, water, white } from '../scripts/audio/ambienceDsp';

/** The feel pass, iteration eight: the places are heard (src/audio/ambience.ts, built by
 *  scripts/audio/build_ambience.ts). */
describe('the places\' ambience: recipes and files', () => {
  it('gives every main-game stage a bed, and leaves arcade survival\'s rifts to their own', () => {
    for (const stage of Object.keys(STAGES) as StageId[]) {
      if (stage.startsWith('rift-')) expect(AMBIENCES[stage], stage).toBeUndefined();
      else expect(AMBIENCES[stage]?.beds.length, stage).toBeGreaterThan(0);
    }
    expect(Object.keys(AMBIENCES).sort()).toEqual(Object.keys(STAGE_SPACES).sort());
  });
  it('plays only files that were built, each levelled, and loops beds inside their periodic extension', () => {
    const files = new Set(Object.values(AMBIENCES).flatMap(recipe => filesOf(recipe!)));
    for (const file of files) {
      expect(fs.existsSync(`public${ambienceUrl(file)}`), file).toBe(true);
      const entry = MANIFEST.files[file];
      // At the manifest's level, or below it where the builder held a sparse recording's peaks under -1 dBFS.
      expect(entry.lufs, file).toBeLessThanOrEqual(MANIFEST.level + .6);
      expect(entry.lufs, file).toBeGreaterThan(-40);
      expect(levelOf(file), file).toBeGreaterThanOrEqual(.93);
    }
    for (const recipe of Object.values(AMBIENCES)) for (const bed of recipe!.beds) {
      const loop = loopOf(bed.file);
      expect(loop, bed.file).toBeDefined();
      const [start, end] = loop!, seconds = MANIFEST.files[bed.file].seconds;
      // The lead either side covers an AAC decoder's priming offset (~45 ms) many times over.
      expect(start).toBeGreaterThanOrEqual(.25); expect(seconds - end).toBeGreaterThanOrEqual(.25);
      expect(end - start, bed.file).toBeGreaterThanOrEqual(12);
    }
    // The one-shots are not looped.
    for (const file of ['bird-1', 'flag-1', 'crows'] as AmbienceFile[]) expect(loopOf(file), file).toBeUndefined();
  });
  it('puts the stands only where there are stands, and keeps a place under the fight', () => {
    const crowds = Object.entries(AMBIENCES).filter(([, recipe]) => recipe!.beds.some(bed => bed.crowd)).map(([stage]) => stage).sort();
    expect(crowds).toEqual(['ash-colosseum', 'ball-court', 'ball-pitch', 'scrap-pit', 'sunfall-arena', 'zenith-coliseum']);
    expect(AMBIENCE_LEVEL).toBeLessThanOrEqual(-8);
    for (const [stage, recipe] of Object.entries(AMBIENCES)) for (const bed of recipe!.beds) expect(bed.gain, `${stage} ${bed.file}`).toBeLessThanOrEqual(0);
    expect(CHEER.win).toBeGreaterThan(CHEER.blow);
  });
});

describe('the synthesised beds (scripts/audio/ambienceDsp.ts)', () => {
  const rate = 8000;
  it('are the same every build', () => {
    for (const make of [room, water, drone]) expect(Array.from(make(rate, 3, 5).subarray(0, 500))).toEqual(Array.from(make(rate, 3, 5).subarray(0, 500)));
    expect(Array.from(bird(rate, 4))).toEqual(Array.from(bird(rate, 4)));
  });
  it('close their loops without a seam', () => {
    const step = (x: Float32Array) => { let sum = 0; for (let i = 1; i < x.length; i++) sum += Math.abs(x[i] - x[i - 1]); return sum / (x.length - 1); };
    for (const [name, x] of [['room', room(rate, 4, 1)], ['water', water(rate, 4, 2)], ['surf', surf(rate, 8, 3, 2)], ['drone', drone(rate, 4, 4)]] as const) {
      expect(x.length, name).toBe(rate * (name === 'surf' ? 8 : 4));
      // Running from the last sample into the first is a step like any other in the loop.
      expect(Math.abs(x[0] - x[x.length - 1]), name).toBeLessThan(step(x) * 6);
    }
  });
  it('crossfades a loop\'s tail into its head with equal power', () => {
    const x = white(1200, 9), loop = seamless(x, 1000, 200);
    expect(loop.length).toBe(1000);
    expect(loop[999]).toBe(x[999]);
    // The head's first sample is almost all the tail's continuation: the sample after the loop's last.
    expect(Math.abs(loop[0] - x[1000])).toBeLessThan(Math.abs(x[1000]) * .01 + .01);
  });
  it('never leaves the surf silent between waves', () => {
    const x = surf(rate, 16, 3, 2), window = rate / 4;
    let quietest = Infinity, loudest = 0;
    for (let at = 0; at + window <= x.length; at += window) {
      let e = 0; for (let i = at; i < at + window; i++) e += x[i] ** 2;
      const level = Math.sqrt(e / window); quietest = Math.min(quietest, level); loudest = Math.max(loudest, level);
    }
    // A wave breaks well over the sea's bed, and the bed never drops out.
    expect(20 * Math.log10(loudest / quietest)).toBeGreaterThan(8);
    expect(20 * Math.log10(loudest / quietest)).toBeLessThan(30);
  });
});

class Param {
  value = 1; events: unknown[][] = [];
  setValueAtTime(...x: unknown[]) { this.events.push(['set', ...x]); return this; }
  linearRampToValueAtTime(...x: unknown[]) { this.events.push(['ramp', ...x]); return this; }
  setTargetAtTime(...x: unknown[]) { this.events.push(['target', ...x]); return this; }
  cancelScheduledValues(...x: unknown[]) { this.events.push(['cancel', ...x]); return this; }
}
class Node { gain = new Param(); pan = new Param(); frequency = new Param(); Q = new Param(); type = ''; links: Node[] = []; connect(to: Node) { this.links.push(to); return to; } disconnect() {} }
class Source extends Node {
  buffer?: { duration: number }; loop = false; loopStart = 0; loopEnd = 0; playbackRate = new Param(); started: unknown[][] = []; stopped: number[] = []; onended?: () => void;
  start(...x: unknown[]) { this.started.push(x); } stop(t: number) { this.stopped.push(t); }
}
class Context {
  currentTime = 5; state = 'running'; sources: Source[] = []; gains: Node[] = []; filters: Node[] = [];
  createGain() { const node = new Node(); this.gains.push(node); return node; }
  createStereoPanner() { return new Node(); }
  createBiquadFilter() { const node = new Node(); this.filters.push(node); return node; }
  createBufferSource() { const source = new Source(); this.sources.push(source); return source; }
}
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('the ambience player (StageAmbience)', () => {
  afterEach(() => { vi.useRealTimers(); });
  const make = () => {
    const ctx = new Context(), output = new Node(), released: string[] = [];
    const load = vi.fn(async (url: string) => ({ duration: MANIFEST.files[url.split('/').pop()!.replace('.m4a', '') as AmbienceFile].seconds }) as unknown as AudioBuffer);
    const player = new StageAmbience(ctx as unknown as BaseAudioContext, output as unknown as AudioNode, load, () => .5, url => released.push(url));
    return { ctx, output, load, player, released };
  };
  it('loops every bed of the place between its loop points, wide beds twice, and fades the place in under the fight', async () => {
    const { ctx, player, load } = make();
    player.set('harbor');
    await flush();
    expect(load).toHaveBeenCalledWith(ambienceUrl('surf'));
    const beds = ctx.sources.filter(source => source.loop);
    // Surf (wide: two copies) and wind.
    expect(beds).toHaveLength(3);
    for (const source of beds) {
      expect(source.loopEnd - source.loopStart).toBeGreaterThan(12);
      const [, offset] = source.started[0] as [number, number];
      expect(offset).toBeGreaterThanOrEqual(source.loopStart); expect(offset).toBeLessThan(source.loopEnd);
    }
    const fader = ctx.gains[0];
    expect(fader.gain.value).toBe(0);
    expect(fader.gain.events.find(e => e[0] === 'target')?.[1]).toBeCloseTo(10 ** (AMBIENCE_LEVEL / 20), 6);
  });
  it('fades the place out on leaving, stops its beds, and lets go of what the next place does not play', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { ctx, player, released } = make();
    player.set('hollowmere-quarry');
    await vi.advanceTimersByTimeAsync(1);
    const beds = ctx.sources.filter(source => source.loop), fader = ctx.gains[0];
    player.set('ashwood');
    expect(fader.gain.events.some(e => e[0] === 'target' && e[1] === 0)).toBe(true);
    for (const source of beds) expect(source.stopped.length).toBe(1);
    await vi.advanceTimersByTimeAsync(5000);
    // The wind plays on in the village; the fire, the crackle and the crows go.
    expect(released).toContain(ambienceUrl('fire'));
    expect(released).toContain(ambienceUrl('crows'));
    expect(released).not.toContain(ambienceUrl('wind'));
    player.dispose();
  });
  it('swells the stands for a big blow and more for the winner, and does nothing where there are none', async () => {
    const { ctx, player } = make();
    player.set('ashfall-weir'); await flush();
    const before = ctx.gains.map(node => node.gain.events.length);
    player.cheer(1);
    expect(ctx.gains.map(node => node.gain.events.length)).toEqual(before);
    player.set('ash-colosseum'); await flush();
    player.cheer(1);
    const swells = ctx.gains.filter(node => node.gain.events.some(e => e[0] === 'target' && (e[1] as number) > 2));
    expect(swells.length).toBe(1);
    const blow = swells[0].gain.events.find(e => e[0] === 'target' && (e[1] as number) > 2)![1] as number;
    player.cheer(1, true);
    const win = swells[0].gain.events.filter(e => e[0] === 'target' && (e[1] as number) > 2).pop()![1] as number;
    expect(20 * Math.log10(blow)).toBeCloseTo(CHEER.blow, 1);
    expect(win).toBeGreaterThan(blow);
  });
  it('plays its accents now and then, off centre, through the place\'s fader', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { ctx, player } = make();
    player.set('ashwood');
    await vi.advanceTimersByTimeAsync(1);
    const before = ctx.sources.length;
    await vi.advanceTimersByTimeAsync(30_000);
    const birds = ctx.sources.slice(before).filter(source => !source.loop);
    // Every 4-11 s, the first sooner: three or more in half a minute.
    expect(birds.length).toBeGreaterThanOrEqual(3);
    player.dispose();
    const after = ctx.sources.length;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(ctx.sources.length).toBe(after);
  });
});
