import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CombatEvent } from '../src/game/types';
import { BEAT, dummyCommand, FIGHT_SECONDS, firstVisit, GuidedFight, LOOK_RADIANS, markTutorial, MOVE_METRES, STEPS, SWINGS, tutorialState, TUTORIAL_KEY, type LessonFrame, type StepId } from '../src/tutorial/guidedFight';
import { skipKey, stepFeedback, stepLine, stepNote } from '../src/tutorial/lessonCopy';
import { bindKey, resetBindings } from '../src/input/bindings';

/** LEARN TO FIGHT's rules (src/tutorial/guidedFight.ts): the steps, what ticks each, the beat, the skips, the dummy. */
const ME = 'you', BOT = 'sparring-bot';
let id = 0;
const ev = (e: Partial<CombatEvent> & Pick<CombatEvent, 'kind'>): CombatEvent => ({ id: ++id, serverTime: 0, actorId: ME, ...e }) as CombatEvent;
const frame = (time: number, f: Partial<LessonFrame> = {}): LessonFrame => ({ time, x: 0, z: 3, viewYaw: Math.PI, action: 'idle', alive: true, ...f });
/** A lesson moved on to `step` by skipping the ones before it, at fight time `t`. */
function at(step: StepId, t = 10) {
  const lesson = new GuidedFight(ME);
  while (lesson.step?.id !== step) lesson.skip(t);
  return lesson;
}

describe('LEARN TO FIGHT: the steps', () => {
  it('runs move, light, heavy, guard, parry, dash, special, technique, ultimate, then a real fight', () => {
    expect(STEPS.map(s => s.id)).toEqual(['move', 'light', 'heavy', 'guard', 'parry', 'dash', 'special', 'technique', 'ultimate', 'fight']);
    // The dummy stands for the attacks, swings for the defence, fights at the end; the ultimate's meter is filled for it.
    expect(STEPS.filter(s => s.dummy !== 'still').map(s => [s.id, s.dummy])).toEqual([['guard', 'jab'], ['parry', 'swing'], ['fight', 'fight']]);
    expect(STEPS.filter(s => s.fill).map(s => s.id)).toEqual(['ultimate']);
  });

  it('ticks MOVE & LOOK only once the player has walked and the view has turned, a reset not counting as a walk', () => {
    const lesson = new GuidedFight(ME);
    lesson.frame(frame(0));
    lesson.frame(frame(.1, { z: 3 + 5 })); // a respawn's jump: not walked
    expect(lesson.progress.moved).toBe(false);
    for (let i = 1; i <= 8; i++) lesson.frame(frame(.1 + i * .1, { z: 8 - i * MOVE_METRES / 7 }));
    expect(lesson.progress).toMatchObject({ moved: true, looked: false });
    expect(lesson.doneAt).toBeUndefined();
    // The view swung back and forth: both ways count, across the -pi / pi seam too.
    let yaw = Math.PI - .3;
    for (let i = 0; i < 8 && lesson.doneAt === undefined; i++) { yaw = i % 2 ? Math.PI - .3 : -Math.PI + .3; lesson.frame(frame(2 + i * .1, { viewYaw: yaw })); }
    expect(lesson.progress.looked).toBe(true);
    expect(lesson.done.has('move')).toBe(true);
    expect(LOOK_RADIANS).toBeGreaterThan(1);
  });

  it('holds a done step for its beat, ignoring what happens meanwhile, then opens the next', () => {
    const lesson = at('heavy');
    lesson.event(ev({ kind: 'hit', slot: 'heavy', targetId: BOT }), 20);
    expect(lesson.done.has('heavy')).toBe(true);
    expect(lesson.doneAt).toBe(20);
    lesson.event(ev({ kind: 'blocked', actorId: BOT, targetId: ME }), 20.2);  // the guard's tick, early: not counted
    lesson.frame(frame(20 + BEAT / 2));
    expect(lesson.step?.id).toBe('heavy');
    lesson.frame(frame(20 + BEAT));
    expect(lesson.step?.id).toBe('guard');
    expect(lesson.done.has('guard')).toBe(false);
    expect(lesson.openedAt).toBe(20 + BEAT);
  });

  it('counts the light string at its third blow, and only the player\'s own blows on the dummy', () => {
    const lesson = at('light');
    lesson.event(ev({ kind: 'hit', slot: 'light', chain: 2, actorId: BOT, targetId: ME }), 1);
    lesson.event(ev({ kind: 'hit', slot: 'heavy', combo: 3, targetId: BOT }), 1);
    expect(lesson.progress.hits).toBe(0);
    lesson.event(ev({ kind: 'hit', slot: 'light', chain: 0, combo: 1, targetId: BOT }), 1);
    lesson.event(ev({ kind: 'hit', slot: 'light', chain: 1, combo: 2, targetId: BOT }), 1.2);
    expect(lesson.progress.hits).toBe(2);
    expect(lesson.doneAt).toBeUndefined();
    lesson.event(ev({ kind: 'hit', slot: 'light', chain: 2, combo: 3, targetId: BOT }), 1.4);
    expect(lesson.done.has('light')).toBe(true);
  });

  it('ticks GUARD on a blow blocked, and says so when one gets through', () => {
    const lesson = at('guard');
    lesson.event(ev({ kind: 'hit', slot: 'light', actorId: BOT, targetId: ME }), 1);
    expect(lesson.progress.miss).toBe('hit');
    expect(stepFeedback('guard', lesson.progress, { device: 'keyboard', family: 'generic' })).toMatch(/BEFORE THE BLOW/);
    lesson.event(ev({ kind: 'blocked', actorId: BOT, targetId: ME }), 2);
    expect(lesson.done.has('guard')).toBe(true);
  });

  it('ticks PERFECT PARRY on a parry or a counter, never on a held block, and says which it was', () => {
    const lesson = at('parry');
    lesson.event(ev({ kind: 'blocked', actorId: BOT, targetId: ME }), 1);
    expect(lesson.progress).toMatchObject({ miss: 'blocked', tries: 1 });
    lesson.event(ev({ kind: 'hit', actorId: BOT, targetId: ME, slot: 'heavy' }), 3);
    expect(lesson.progress).toMatchObject({ miss: 'hit', tries: 2 });
    expect(lesson.doneAt).toBeUndefined();
    lesson.event(ev({ kind: 'just-guard', actorId: BOT, targetId: ME }), 5);
    expect(lesson.done.has('parry')).toBe(true);
    // The counter stance answering the blow counts as well.
    const other = at('parry');
    other.event(ev({ kind: 'counter', actorId: ME, targetId: BOT }), 1);
    expect(other.done.has('parry')).toBe(true);
    // The dummy parrying the player's blow is not the player's parry.
    const third = at('parry');
    third.event(ev({ kind: 'just-guard', actorId: ME, targetId: BOT }), 1);
    expect(third.doneAt).toBeUndefined();
  });

  it('ticks DASH from the player\'s state, SPECIAL and ULTIMATE from their casts', () => {
    const dash = at('dash'); dash.frame(frame(10)); dash.frame(frame(10.1, { action: 'dash' }));
    expect(dash.done.has('dash')).toBe(true);
    const special = at('special'); special.event(ev({ kind: 'cast', slot: 'special' }), 1);
    expect(special.done.has('special')).toBe(true);
    const ultimate = at('ultimate');
    ultimate.event(ev({ kind: 'cast', slot: 'special' }), 1);
    ultimate.event(ev({ kind: 'cast', slot: 'ultimate', actorId: BOT }), 1);
    expect(ultimate.doneAt).toBeUndefined();
    ultimate.event(ev({ kind: 'cast', slot: 'ultimate' }), 2);
    expect(ultimate.done.has('ultimate')).toBe(true);
  });

  it('ticks TECHNIQUE on a deliberate one (away + light), not on a plain light or a rush made walking in', () => {
    const lesson = at('technique');
    lesson.event(ev({ kind: 'hit', slot: 'light', chain: 0, targetId: BOT }), 1);
    expect(lesson.progress.miss).toBe('plain');
    lesson.event(ev({ kind: 'hit', slot: 'light', branch: 'rush' as never, targetId: BOT }), 2);
    expect(lesson.doneAt).toBeUndefined();
    lesson.event(ev({ kind: 'hit', slot: 'light', branch: 'rise' as never, targetId: BOT }), 3);
    expect(lesson.done.has('technique')).toBe(true);
  });

  it('ends the real fight when the bot goes down, or when its time is up', () => {
    const lesson = at('fight', 50);
    lesson.frame(frame(50));
    lesson.event(ev({ kind: 'eliminated', actorId: BOT, targetId: ME }), 52);  // the player falling does not end it
    expect(lesson.doneAt).toBeUndefined();
    lesson.event(ev({ kind: 'eliminated', actorId: ME, targetId: BOT }), 60);
    expect(lesson.done.has('fight')).toBe(true);
    lesson.frame(frame(60 + BEAT));
    expect(lesson.over).toBe(true);
    expect(lesson.completed).toBe(true);
    const slow = at('fight', 100);
    slow.frame(frame(100)); slow.frame(frame(100 + FIGHT_SECONDS - 1));
    expect(slow.doneAt).toBeUndefined();
    slow.frame(frame(100 + FIGHT_SECONDS));
    expect(slow.done.has('fight')).toBe(true);
  });

  it('skips a step at once (no beat), and END skips the rest', () => {
    const lesson = new GuidedFight(ME);
    lesson.skip(1);
    expect(lesson.step?.id).toBe('light');
    expect([...lesson.skipped]).toEqual(['move']);
    // A step already done and in its beat is not marked skipped by SKIP STEP: it just moves on.
    lesson.event(ev({ kind: 'hit', slot: 'light', chain: 2, targetId: BOT }), 2);
    lesson.skip(2.1);
    expect(lesson.skipped.has('light')).toBe(false);
    expect(lesson.step?.id).toBe('heavy');
    lesson.skipAll();
    expect(lesson.over).toBe(true);
    expect([...lesson.done]).toEqual(['light']);
    expect(lesson.skipped.size).toBe(STEPS.length - 1);
  });
});

describe('LEARN TO FIGHT: the dummy', () => {
  const me = { id: ME, x: 0, z: 3, alive: true };
  it('stands facing the player for the attack steps, and leaves the real fight to the bot\'s own mind', () => {
    const clock = { next: 0 };
    const still = dummyCommand('still', { x: 0, z: 0, busy: false }, me, 5, clock)!;
    expect(still).toMatchObject({ moveX: 0, moveZ: 0, targetId: ME, lock: true });
    expect(still.attack).toBeUndefined();
    expect(still.yaw).toBeCloseTo(0);
    expect(dummyCommand('fight', { x: 0, z: 0, busy: false }, me, 5, clock)).toBeUndefined();
  });
  it('walks in from out of reach, then swings on its clock and only when free', () => {
    const clock = { next: 2 };
    const far = dummyCommand('jab', { x: 0, z: -6, busy: false }, me, 5, clock)!;
    expect(far.attack).toBeUndefined();
    expect(far.moveZ).toBeGreaterThan(0);
    const near = { x: 0, z: 3 - SWINGS.jab.reach + .1, busy: false };
    expect(dummyCommand('jab', near, me, 1, clock)!.attack).toBeUndefined();          // its clock: not yet
    expect(dummyCommand('jab', { ...near, busy: true }, me, 3, clock)!.attack).toBeUndefined(); // in a move: not now
    expect(dummyCommand('jab', near, me, 3, clock)!.attack).toBe('light');
    expect(clock.next).toBeCloseTo(3 + SWINGS.jab.every);
    expect(dummyCommand('jab', near, me, 3.5, clock)!.attack).toBeUndefined();
    expect(dummyCommand('swing', near, me, 10, clock)!.attack).toBe('heavy');
    expect(dummyCommand('swing', near, { ...me, alive: false }, 20, clock)!.attack).toBeUndefined();
  });
});

describe('LEARN TO FIGHT: what the device remembers, and the words', () => {
  const store = new Map<string, string>();
  const kept = (globalThis as { localStorage?: Storage }).localStorage;
  beforeEach(() => {
    store.clear();
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
  });
  afterEach(() => { (globalThis as { localStorage?: unknown }).localStorage = kept; resetBindings('keyboard'); });

  it('offers the lesson on a first visit only, and keeps "done" over a later skip', () => {
    expect(tutorialState()).toBe('new');
    expect(firstVisit()).toBe(true);
    store.set('rift-modes-seen', JSON.stringify({ royale: 3 }));
    expect(firstVisit()).toBe(false);                // played before: not offered on the home
    store.delete('rift-modes-seen');
    markTutorial('skipped');
    expect(firstVisit()).toBe(false);
    markTutorial('done');
    markTutorial('skipped');
    expect(store.get(TUTORIAL_KEY)).toBe('done');
  });

  it('names each device\'s own controls: the bindings, the pad\'s glyphs, the touch buttons', () => {
    const kb = { device: 'keyboard', family: 'generic' } as const, ps = { device: 'controller', family: 'playstation' } as const, xbox = { device: 'controller', family: 'xbox' } as const, touch = { device: 'touch', family: 'generic' } as const;
    expect(stepLine('light', kb, 'Rising Strike')).toContain('<kbd>J</kbd>');
    bindKey('light', 0, 'KeyU');
    expect(stepLine('light', kb, 'Rising Strike')).toContain('<kbd>U</kbd>');
    expect(stepLine('guard', ps, 'x')).toContain('L1');
    expect(stepLine('guard', xbox, 'x')).toContain('LB');
    expect(stepLine('guard', touch, 'x')).toContain('<kbd class="touch-key">GUARD</kbd>');
    expect(stepLine('guard', touch, 'x')).not.toContain('<b>GUARD</b>');   // the button says it: not twice
    expect(stepLine('guard', kb, 'x')).toContain('<i>HOLD</i><kbd>F</kbd><b>GUARD</b>');
    expect(stepLine('move', kb, 'x')).toContain('<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>');
    expect(stepLine('move', kb, 'x', false)).toContain('Click');
    expect(stepLine('move', xbox, 'x')).toContain('R STICK');
    expect(stepLine('move', touch, 'x')).toContain('DRAG THE RIGHT SIDE');
    const technique = stepLine('technique', kb, 'Rising Strike');
    expect(technique).toContain('<kbd>S</kbd>'); expect(technique).toContain('RISING STRIKE');
    expect(stepNote('technique', { moved: false, looked: false, hits: 0, tries: 0 }, touch)).toMatch(/STICK AWAY \+ LIGHT/);
    expect(skipKey(kb)).toBe('<kbd>N</kbd>');
    expect(skipKey(xbox)).toContain('D →');
    expect(skipKey(touch)).toBe('');                 // tapped where it is drawn
    bindKey('dash', 0, 'KeyN');
    expect(skipKey(kb)).toBe('');                    // a fight action has N: only the button skips
  });
});
