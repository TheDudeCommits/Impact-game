import { describe, expect, it } from 'vitest';
import { FramePolicy, STEP_SECONDS } from '../src/render/framePolicy';
import { CPU_SHARE, cpuLimited, nextScale, STEP } from '../src/render/ResolutionGovernor';
import { PHONE_RATIO, phoneSharpness, powerBudget } from '../src/render/powerBudget';

/** The phone pass (November 2026): a phone's frame rate, heat and resolution. */
const run = (policy: FramePolicy, seconds: number, fps: number, watching = true, mode: 'auto' | 'cool' | 'full' = 'auto') => {
  let stepped = 0;
  for (let i = 0; i < seconds * fps; i++) if (policy.frame(1 / fps, watching, mode)) stepped++;
  return stepped;
};
/** A display at sixty where every `every`th frame misses its vsync (drawn a sixtieth later). */
const uneven = (policy: FramePolicy, seconds: number, every: number) => {
  let stepped = 0;
  for (let i = 0; i < seconds * 60; i++) if (policy.frame((i % every === 0 ? 2 : 1) / 60, true, 'auto')) stepped++;
  return stepped;
};

describe('Balanced on a phone: sixty while it holds, an even thirty when it cannot (framePolicy.ts)', () => {
  it('a phone that cannot hold sixty steps to thirty after STEP_SECONDS, once', () => {
    const policy = new FramePolicy(true);
    expect(policy.target('auto')).toBe(60);
    expect(run(policy, STEP_SECONDS - 1.5, 44)).toBe(0);
    expect(policy.target('auto')).toBe(60);
    expect(run(policy, 3, 44)).toBe(1);
    expect(policy.target('auto')).toBe(30);
    expect(run(policy, 30, 25)).toBe(0);   // once stepped, nothing more to do
  });
  it('holds sixty where sixty is (nearly) held, and a good second starts the count again', () => {
    const policy = new FramePolicy(true);
    expect(uneven(policy, 60, 10)).toBe(0);   // one late frame in ten: sixty holds
    run(policy, STEP_SECONDS - 2, 40); run(policy, 1.2, 60);
    expect(run(policy, STEP_SECONDS - 2, 40)).toBe(0);
    expect(policy.target('auto')).toBe(60);
  });
  it('steps for a stutter between sixty and thirty, not for a few long frames', () => {
    expect(uneven(new FramePolicy(true), STEP_SECONDS + 2, 3)).toBe(1);   // every third frame late: 45 fps, uneven
    // A fight's warm-up: three 150 ms frames a second among sixties - a low average, a steady 75th percentile.
    const policy = new FramePolicy(true);
    let stepped = 0;
    for (let s = 0; s < 10; s++) for (let i = 0; i < 52; i++) if (policy.frame(i % 17 === 0 ? .15 : 1 / 60, true, 'auto')) stepped++;
    expect(stepped).toBe(0);
  });
  it('counts only a fight it is watching, and never a load\'s long frames', () => {
    const policy = new FramePolicy(true);
    expect(run(policy, 60, 30, false)).toBe(0);
    for (let i = 0; i < 200; i++) policy.frame(.4, true, 'auto');
    expect(policy.target('auto')).toBe(60);
  });
  it('never on a desktop or a tablet: Balanced is sixty there', () => {
    const policy = new FramePolicy(false);
    expect(run(policy, 60, 30)).toBe(0);
    expect(policy.target('auto')).toBe(60);
  });
  it('POWER USE decides: Cooler thirty, Full detail sixty on a phone too, and Balanced chosen again tries sixty again', () => {
    const policy = new FramePolicy(true);
    expect(policy.target('cool')).toBe(30);
    expect(policy.target('full')).toBe(60);
    expect(run(policy, 30, 30, true, 'full')).toBe(0);
    expect(policy.target('full')).toBe(60);
    expect(run(policy, STEP_SECONDS + 1, 40)).toBe(1);
    expect(policy.target('auto')).toBe(30);
    expect(policy.target('full')).toBe(60);
    expect(policy.target('auto')).toBe(60);
  });
});

describe('the resolution governor without a GPU timer keeps the pixels a busy CPU cannot use', () => {
  const frames = (ms: number, n = 60) => Array.from({ length: n }, (_, i) => ms * (.9 + .2 * i / n));
  it('steps down for slow frames the main thread does not fill', () => {
    expect(nextScale({ scale: 1, sinceDown: 99, samples: frames(28), timed: false, cpu: frames(6) })).toBeLessThan(1);
    expect(nextScale({ scale: 1, sinceDown: 99, samples: frames(28), timed: false })).toBeLessThan(1);
  });
  it('holds when the main thread alone fills the frame aimed at', () => {
    const busy = frames(1000 / 60 * CPU_SHARE * 1.15);
    expect(cpuLimited(busy)).toBe(true);
    expect(nextScale({ scale: 1, sinceDown: 99, samples: frames(28), timed: false, cpu: busy })).toBe(1);
    // At thirty frames a second the frame aimed at is twice as long: the same work leaves room.
    expect(cpuLimited(busy, 1000 / 30)).toBe(false);
  });
  it('a phone drawing above one pixel a CSS pixel climbs only while the CPU has room (cpuGate)', () => {
    const steady = Array(40).fill(1000 / 30), busy = Array(40).fill(1000 / 30 * CPU_SHARE * 1.1), idle = Array(40).fill(8);
    expect(nextScale({ scale: .7, floor: .5, sinceDown: 99, samples: steady, timed: false, frameMs: 1000 / 30, cpu: busy, cpuGate: true })).toBeCloseTo(.7, 6);
    expect(nextScale({ scale: .7, floor: .5, sinceDown: 99, samples: steady, timed: false, frameMs: 1000 / 30, cpu: idle, cpuGate: true })).toBeCloseTo(.75, 6);
    // Without the gate (every other governor) the CPU never holds a climb.
    expect(nextScale({ scale: .7, floor: .5, sinceDown: 99, samples: steady, timed: false, frameMs: 1000 / 30, cpu: busy })).toBeCloseTo(.75, 6);
  });
  it('a GPU timer decides where there is one, whatever the CPU', () => {
    const busy = frames(20);
    expect(nextScale({ scale: 1, sinceDown: 99, samples: frames(16), timed: true, cpu: busy })).toBeLessThan(1);
  });
});

describe('a phone with room draws above one pixel a CSS pixel (powerBudget.ts phoneSharpness)', () => {
  const phone = { phone: true, quality: 'low' as const, powerMode: 'auto' as const, economical: false, dpr: 3, timed: false, fps: 30 };
  it('from one, up to PHONE_RATIO, its floor three quarters of a pixel', () => {
    const sharp = phoneSharpness(phone)!;
    expect(sharp.cap).toBe(PHONE_RATIO);
    expect(sharp.cap * sharp.start).toBeCloseTo(1, 6);
    expect(sharp.cap * sharp.floor).toBeCloseTo(.75, 6);
    expect(phoneSharpness({ ...phone, dpr: 2 })!.cap).toBe(1.5);
  });
  it('only at the even thirty: at sixty a phone keeps one pixel a CSS pixel, timer or not', () => {
    expect(phoneSharpness({ ...phone, fps: 60 })).toBeUndefined();
    expect(phoneSharpness({ ...phone, fps: 60, timed: true })).toBeUndefined();
    expect(phoneSharpness({ ...phone, fps: 30, timed: true })).toBeDefined();
  });
  it('never on a desktop, a tablet, a preset the player picked above LOW, Cooler, a crowd fight\'s economy or a low-density screen', () => {
    expect(phoneSharpness({ ...phone, phone: false })).toBeUndefined();
    expect(phoneSharpness({ ...phone, quality: 'medium' })).toBeUndefined();
    expect(phoneSharpness({ ...phone, powerMode: 'cool' })).toBeUndefined();
    expect(phoneSharpness({ ...phone, economical: true })).toBeUndefined();
    expect(phoneSharpness({ ...phone, dpr: 1.5 })).toBeUndefined();
    expect(powerBudget({ quality: 'low', powerMode: 'auto' }, false, true, true).economical).toBe(true);
  });
  it('the governor keeps its start and floor off the step grid exactly, and never goes under the floor', () => {
    const sharp = phoneSharpness(phone)!, steady = Array.from({ length: 60 }, () => 1000 / 30);
    // A window that neither steps down nor up (up waits after a step down) keeps the start exactly.
    expect(nextScale({ scale: sharp.start, floor: sharp.floor, sinceDown: 1, samples: steady, timed: false, frameMs: 1000 / 30 })).toBe(sharp.start);
    expect(nextScale({ scale: sharp.start, floor: sharp.floor, sinceDown: 99, samples: steady, timed: false, frameMs: 1000 / 30 })).toBeCloseTo(.7, 6);
    let scale = 1;
    for (let i = 0; i < 20; i++) scale = nextScale({ scale, floor: sharp.floor, sinceDown: 99, samples: Array(60).fill(90), timed: false, frameMs: 1000 / 30 });
    expect(scale).toBeCloseTo(sharp.floor, 6);
    expect(scale * sharp.cap).toBeCloseTo(.75, 6);
    expect(STEP).toBe(.05);
  });
});

describe('the render loop follows the policy (main.ts)', () => {
  it('gates its frames, judges the step and rebudgets the renderer by the frame policy; the simulation keeps its own clock', async () => {
    const { readFileSync } = await import('node:fs');
    const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
    expect(main).toContain('gate.draw(now,previous,view.frames.target(settings.powerMode))');
    expect(main).toMatch(/if\(view\.frames\.frame\(rawDt,started&&!hud\.settingsOpen&&!document\.hidden,settings\.powerMode\)\)\{view\.applySettings\(settings\);/);
    // The input is still sent on its own timer, whatever the frames drawn.
    expect(main).toContain('inputTimer=setInterval(pushInput,1000/INPUT_HZ)');
    const renderer = readFileSync(new URL('../src/render/GameRenderer.ts', import.meta.url), 'utf8');
    expect(renderer).toContain('this.governor.frameMs=1000/fps');
  });
});
