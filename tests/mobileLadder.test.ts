import { describe, expect, it } from 'vitest';
import { CHANGE_GAP_S, DOWN_WINDOWS, EffectsLadder, UP_WINDOWS, cutBudget, ladderFor, reallocates } from '../src/render/mobileLadder';
import { ResolutionGovernor, ladderWindow } from '../src/render/ResolutionGovernor';
import { FramePolicy, RECOVER_SECONDS, STEP_SECONDS } from '../src/render/framePolicy';
import { powerBudget } from '../src/render/powerBudget';

/** The adaptive ladder on phones and tablets. */
const LOW = powerBudget({ quality: 'low', powerMode: 'auto' }, false, false, true);
const MEDIUM = powerBudget({ quality: 'medium', powerMode: 'auto' }, false, false, true);
const HIGH = powerBudget({ quality: 'high', powerMode: 'auto' }, false, false, true);

describe('the steps each preset has (mobileLadder.ts)', () => {
  it('LOW (every phone on AUTO): the air, then the shadow at half rate - nothing that reallocates', () => {
    expect(ladderFor(LOW)).toEqual(['air', 'shadowRate']);
    expect(reallocates(LOW, 0, 2)).toBe(false);
  });
  it('MEDIUM and HIGH: the air, the shadow rate, the glow, the multisampling, the shadow map halved', () => {
    expect(ladderFor(MEDIUM)).toEqual(['air', 'shadowRate', 'bloom', 'msaa', 'shadowSize']);
    expect(ladderFor(HIGH)).toEqual(['air', 'shadowRate', 'bloom', 'msaa', 'shadowSize']);
    expect(reallocates(HIGH, 0, 3)).toBe(false);
    expect(reallocates(HIGH, 3, 4)).toBe(true);
    expect(reallocates(HIGH, 5, 3)).toBe(true);
  });
  it('tier 0 is the preset exactly; each tier takes one more step', () => {
    expect(cutBudget(HIGH, 0)).toEqual({ samples: HIGH.samples, bloom: true, shadowSize: HIGH.shadowSize, air: true, shadowEvery: 1, paint: false });
    expect(cutBudget(HIGH, 1).air).toBe(false);
    expect(cutBudget(HIGH, 2).shadowEvery).toBe(2);
    expect(cutBudget(HIGH, 3).bloom).toBe(false);
    expect(cutBudget(HIGH, 4).samples).toBe(0);
    expect(cutBudget(HIGH, 5).shadowSize).toBe(HIGH.shadowSize / 2);
    expect(cutBudget(LOW, 9)).toEqual({ samples: 0, bloom: false, shadowSize: 512, air: false, shadowEvery: 2, paint: false });
  });
});

describe('the film look\'s painting: the ladder\'s last step (mobileLadder.ts paint)', () => {
  const painted = (b: typeof HIGH) => ({ samples: b.samples, bloom: b.bloom, shadowSize: b.shadowSize, paint: true });
  it('a painted preset (a tablet on Medium or High in the film look) has it last, after the shadow map', () => {
    expect(ladderFor(painted(HIGH))).toEqual(['air', 'shadowRate', 'bloom', 'msaa', 'shadowSize', 'paint']);
    expect(ladderFor(painted(MEDIUM))).toEqual(['air', 'shadowRate', 'bloom', 'msaa', 'shadowSize', 'paint']);
  });
  it('no painting, no step: LOW, the modern look, a crowd fight', () => {
    expect(ladderFor({ ...painted(LOW), paint: false })).toEqual(['air', 'shadowRate']);
    expect(ladderFor(HIGH)).not.toContain('paint');
  });
  it('kept until every other step is spent, then taken; it reallocates nothing either way', () => {
    const b = painted(HIGH);
    for (let tier = 0; tier < 6; tier++) expect(cutBudget(b, tier).paint).toBe(true);
    expect(cutBudget(b, 6).paint).toBe(false);
    expect(reallocates(b, 5, 6)).toBe(false);
    expect(reallocates(b, 6, 5)).toBe(false);
  });
});

describe('the ladder\'s judgement: slow down, slower up, one change at a time', () => {
  const windows = (ladder: EffectsLadder, n: number, w: { over: boolean; room: boolean; spent?: boolean }, t: { now: number }) => {
    const moves: number[] = [];
    for (let i = 0; i < n; i++) { t.now += 1000; const m = ladder.judge({ spent: true, ...w, now: t.now }); if (m) moves.push(m); }
    return moves;
  };
  it('a step down after DOWN_WINDOWS late windows with the resolution spent, not before', () => {
    const ladder = new EffectsLadder(); ladder.reset(2); const t = { now: 0 };
    expect(windows(ladder, DOWN_WINDOWS - 1, { over: true, room: false }, t)).toEqual([]);
    expect(windows(ladder, 1, { over: true, room: false }, t)).toEqual([1]);
    expect(ladder.tier).toBe(1);
  });
  it('no step while the resolution can still come down', () => {
    const ladder = new EffectsLadder(); ladder.reset(2); const t = { now: 0 };
    expect(windows(ladder, 20, { over: true, room: false, spent: false }, t)).toEqual([]);
  });
  it('never two changes within CHANGE_GAP_S, and never past the last step', () => {
    const ladder = new EffectsLadder(); ladder.reset(2); const t = { now: 0 };
    const moves = windows(ladder, 30, { over: true, room: false }, t);
    expect(moves).toEqual([1, 1]);
    expect(ladder.spent).toBe(true);
  });
  it('a step back after UP_WINDOWS windows of room - four times the run a step down takes', () => {
    const ladder = new EffectsLadder(); ladder.reset(2); const t = { now: 0 };
    windows(ladder, DOWN_WINDOWS, { over: true, room: false }, t);
    expect(windows(ladder, UP_WINDOWS - 1, { over: false, room: true }, t)).toEqual([]);
    expect(windows(ladder, 1, { over: false, room: true }, t)).toEqual([-1]);
    expect(ladder.tier).toBe(0);
    expect(UP_WINDOWS).toBeGreaterThanOrEqual(DOWN_WINDOWS * 4);
    expect(CHANGE_GAP_S).toBeGreaterThan(1);
  });
  it('a window neither late nor with room holds, and breaks both runs', () => {
    const ladder = new EffectsLadder(); ladder.reset(2); const t = { now: 0 };
    windows(ladder, DOWN_WINDOWS - 1, { over: true, room: false }, t);
    windows(ladder, 1, { over: false, room: false }, t);
    expect(windows(ladder, DOWN_WINDOWS - 1, { over: true, room: false }, t)).toEqual([]);
  });
  it('a relapse soon after a give-back doubles the run of room the next give-back needs', () => {
    const ladder = new EffectsLadder(); ladder.reset(2); const t = { now: 0 };
    windows(ladder, DOWN_WINDOWS, { over: true, room: false }, t);
    windows(ladder, UP_WINDOWS, { over: false, room: true }, t);
    expect(ladder.tier).toBe(0);
    windows(ladder, CHANGE_GAP_S + DOWN_WINDOWS, { over: true, room: false }, t);
    expect(ladder.tier).toBe(1);
    expect(ladder.up).toBe(UP_WINDOWS * 2);
    expect(windows(ladder, UP_WINDOWS, { over: false, room: true }, t)).toEqual([]);
    expect(windows(ladder, UP_WINDOWS, { over: false, room: true }, t)).toEqual([-1]);
  });
  it('settled: spent, and the last step given CHANGE_GAP_S before anything after it (the thirty, a preset) is taken', () => {
    const ladder = new EffectsLadder(); ladder.reset(1); const t = { now: 0 };
    windows(ladder, DOWN_WINDOWS, { over: true, room: false }, t);
    expect(ladder.spent).toBe(true);
    expect(ladder.settled(t.now)).toBe(false);
    expect(ladder.settled(t.now + CHANGE_GAP_S * 1000)).toBe(true);
  });
  it('a preset with no steps (FULL DETAIL, a quality chosen) never moves', () => {
    const ladder = new EffectsLadder(); ladder.reset(0); const t = { now: 0 };
    expect(windows(ladder, 30, { over: true, room: false }, t)).toEqual([]);
    expect(ladder.spent).toBe(true);
  });
});

describe('the governor\'s window for the ladder (ResolutionGovernor ladderWindow)', () => {
  const many = (ms: number, n = 40) => Array.from({ length: n }, () => ms);
  it('late frames are late whether the CPU or the GPU is the cause; on time with room is room', () => {
    expect(ladderWindow(many(28), undefined)).toEqual({ over: true, room: false });
    expect(ladderWindow(many(16.7), undefined)).toEqual({ over: false, room: true });
    expect(ladderWindow(many(19), undefined)).toEqual({ over: false, room: false });
  });
  it('timed: the GPU over its budget is late even at sixty; room needs the GPU inside ROOM of it', () => {
    expect(ladderWindow(many(16.7), many(14)).over).toBe(true);
    expect(ladderWindow(many(16.7), many(10)).room).toBe(false);
    expect(ladderWindow(many(16.7), many(6)).room).toBe(true);
  });
  it('at thirty, a thirtieth is on time', () => {
    expect(ladderWindow(many(33.4), undefined, { frameMs: 1000 / 30 })).toEqual({ over: false, room: true });
  });
  it('too few frames judge nothing', () => {
    expect(ladderWindow(many(50, 5), undefined)).toEqual({ over: false, room: false });
  });
});

/** A WebGL2 stand-in with no GPU timer (an iPhone's every browser). */
const gl = { getExtension: () => null, getParameter: () => 'Apple GPU', RENDERER: 0 } as unknown as WebGL2RenderingContext;
const drive = (governor: ResolutionGovernor, seconds: number, frameMs: number, t: { now: number }, cpu = frameMs * .3) => {
  let moved = 0;
  for (let i = 0; i < seconds * 1000 / frameMs; i++) { t.now += frameMs; if (governor.update(t.now, false, cpu)) moved++; }
  return moved;
};

describe('the governor with a phone\'s ladder: resolution first, then effects; back up in the reverse order', () => {
  it('a phone at one pixel a CSS pixel (floor 1): no resolution to give, so the effects step down', () => {
    const governor = new ResolutionGovernor(gl); governor.ladder = new EffectsLadder(); governor.ladder.reset(2); governor.floor = 1;
    const t = { now: 0 };
    drive(governor, 30, 40, t);
    expect(governor.scale).toBe(1);
    expect(governor.ladder.tier).toBe(2);
    expect(governor.ladderMoved).toBe(true);
    // Back: fast frames give the effects back, one at a time, slower than they went.
    governor.ladderMoved = false;
    drive(governor, UP_WINDOWS + 2, 16.6, t);
    expect(governor.ladder.tier).toBe(1);
    drive(governor, UP_WINDOWS + CHANGE_GAP_S + 2, 16.6, t);
    expect(governor.ladder.tier).toBe(0);
  });
  it('a tablet above one pixel: the resolution comes down to one first, the effects after; up, effects first', () => {
    const governor = new ResolutionGovernor(gl); governor.ladder = new EffectsLadder(); governor.ladder.reset(5); governor.floor = 1 / 1.15;
    const t = { now: 0 };
    drive(governor, 2, 40, t);
    expect(governor.ladder.tier, 'no effect off while the resolution can come down').toBe(0);
    drive(governor, 40, 40, t);
    expect(governor.scale).toBeCloseTo(1 / 1.15, 5);
    expect(governor.ladder.tier).toBeGreaterThan(0);
    const tier = governor.ladder.tier, scale = governor.scale;
    drive(governor, 8, 16.6, t);
    expect(governor.scale, 'the resolution holds while effects are off').toBe(scale);
    expect(governor.ladder.tier).toBe(tier);
  });
  it('the debug switch drives both directions whatever the real frames are', () => {
    const governor = new ResolutionGovernor(gl); governor.ladder = new EffectsLadder(); governor.ladder.reset(2); governor.floor = 1;
    const t = { now: 0 };
    governor.debugFrameMs = 40;
    drive(governor, 20, 16.6, t);
    expect(governor.ladder.tier).toBe(2);
    governor.debugFrameMs = 10;
    drive(governor, 60, 40, t);
    expect(governor.ladder.tier).toBe(0);
  });
  it('no fight live (a load, a countdown, the results): the ladder counts nothing, whatever the frames', () => {
    const governor = new ResolutionGovernor(gl); governor.ladder = new EffectsLadder(); governor.ladder.reset(2); governor.floor = 1;
    const t = { now: 0 };
    governor.ladderRest = true;
    drive(governor, 30, 40, t);
    expect(governor.ladder.tier).toBe(0);
    governor.ladderRest = false;
    drive(governor, 30, 40, t);
    expect(governor.ladder.tier).toBe(2);
  });
  it('a desktop (no ladder) judges exactly as before: the gaps are not even kept', () => {
    const governor = new ResolutionGovernor(gl); governor.floor = .75;
    const t = { now: 0 };
    drive(governor, 10, 40, t);
    expect(governor.scale).toBeLessThan(1);
    expect(governor.ladderMoved).toBe(false);
    expect((governor as unknown as { gaps: number[] }).gaps.length).toBe(0);
  });
});

describe('the frame policy at the end of the ladder (framePolicy.ts)', () => {
  const run = (policy: FramePolicy, seconds: number, fps: number, o: { spent?: boolean; cpu?: number; calm?: boolean } = {}) => {
    let changed = 0;
    for (let i = 0; i < seconds * fps; i++) if (policy.frame(1 / fps, true, 'auto', o.spent ?? true, o.cpu, o.calm ?? false)) changed++;
    return changed;
  };
  it('a phone steps to thirty only once the resolution and the effects are spent', () => {
    const policy = new FramePolicy(true);
    expect(run(policy, STEP_SECONDS + 4, 44, { spent: false })).toBe(0);
    expect(policy.target('auto')).toBe(60);
    expect(run(policy, 2, 44, { spent: true })).toBe(1);
    expect(policy.target('auto')).toBe(30);
  });
  it('back to sixty after RECOVER_SECONDS of room, at a calm moment only', () => {
    const policy = new FramePolicy(true);
    run(policy, STEP_SECONDS + 1, 44);
    expect(policy.stepped).toBe(true);
    expect(run(policy, RECOVER_SECONDS - 2, 30, { cpu: 5 })).toBe(0);
    expect(run(policy, 4, 30, { cpu: 5 })).toBe(0);
    expect(policy.due).toBe(true);
    expect(policy.target('auto'), 'not under a thumb').toBe(30);
    expect(run(policy, 1, 30, { cpu: 5, calm: true })).toBe(1);
    expect(policy.target('auto')).toBe(60);
  });
  it('a busy main thread at thirty is never room; without the frame\'s time it stays at thirty (as before)', () => {
    const policy = new FramePolicy(true);
    run(policy, STEP_SECONDS + 1, 44);
    run(policy, RECOVER_SECONDS * 3, 30, { cpu: 12, calm: true });
    expect(policy.stepped).toBe(true);
    run(policy, RECOVER_SECONDS * 3, 30, { calm: true });
    expect(policy.stepped).toBe(true);
  });
  it('sixty lost again soon after doubles the room the next try needs', () => {
    const policy = new FramePolicy(true);
    run(policy, STEP_SECONDS + 1, 44);
    run(policy, RECOVER_SECONDS + 1, 30, { cpu: 5 }); run(policy, 1, 30, { cpu: 5, calm: true });
    expect(policy.stepped).toBe(false);
    run(policy, STEP_SECONDS + 1, 44);
    expect(policy.stepped).toBe(true);
    expect(policy.recoverAfter).toBe(RECOVER_SECONDS * 2);
  });
  it('a desktop never moves', () => {
    const policy = new FramePolicy(false);
    expect(run(policy, 20, 30)).toBe(0);
    expect(policy.target('auto')).toBe(60);
  });
});
