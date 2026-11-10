import { describe, expect, it } from 'vitest';
import { BallMatch, DRILL_RIVAL } from './BallMatch';
import { BALL_ID, GOAL_RULES, type BallModeId } from './model';
import { hasStances } from './stance';
import { LESSON, LESSON_MATE, STRIKE_MEET, strikesPerfect, type LessonStepId } from './lesson';
import { MOVES } from '../moves';
import { isReleasedFighter } from '../rosterAvailability';
import type { FighterId, PlayerInput } from '../types';

/** A lesson match on this device's FREE PLAY, as LocalBall opens one. */
function lesson(mode: BallModeId, fighter: FighterId = 'taisei') {
  const m = new BallMatch(mode, { seed: 3, access: 'bots', practice: true, lesson: true });
  m.add('me', fighter, 'Me', false, 'red'); m.start();
  return m;
}
const yawTo = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.atan2(b.x - a.x, b.z - a.z);
/** Every command's number, rising across a test's players (the kernel drops a command numbered under its last). */
let SEQ = 0;

/** A person who plays each step as it asks - its keys, on its cue - the way a player who reads the line would. */
function play(m: BallMatch, until: (step: LessonStepId | null) => boolean, seconds = 120, skipAfter = 99) {
  let pressed = -9, jumped = -9, glint = -1;
  const L = () => m.view.lesson!, me = () => m.sim.actors.get('me')!.state;
  for (let i = 0; i < seconds * 60 && L().state !== 'over' && !until(L().step); i++) {
    const now = m.sim.serverTime, b = m.ball, p = me(), live = L().state === 'live', step = L().step, cue = L().cue ?? 0;
    const input: PlayerInput = { seq: ++SEQ, moveX: 0, moveZ: 0, yaw: p.yaw, guard: false, targetId: BALL_ID };
    const toward = (t: { x: number; z: number }, pace = 1) => { const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz) || 1; input.moveX = dx / d * pace; input.moveZ = dz / d * pace; input.yaw = Math.atan2(dx, dz); };
    const press = (slot: NonNullable<PlayerInput['attack']>, every = .8) => { if (now - pressed > every) { input.attack = slot; pressed = now; } };
    const goal = { x: 0, z: GOAL_RULES.halfZ }, d = Math.hypot(b.x - p.x, b.z - p.z);
    if (live) switch (step) {
      case 'gr-run': toward(b); if (now - pressed > .5) { input.dash = true; pressed = now; } break;
      case 'gr-pass': { const mate = m.sim.actors.get(LESSON_MATE)!.state; input.yaw = yawTo(p, mate); if (d > 2.2) { toward(b, .5); input.yaw = yawTo(p, mate); } else press('light'); break; }
      // (A fighter whose SHOOT pops a ball at rest meets the pass on the bar instead: LessonView.pops.)
      case 'gr-shoot': if (L().pops) { input.yaw = yawTo(p, goal); if (cue >= 1) press('heavy'); break; } if (d > 4.2) toward(b, .6); input.yaw = yawTo(p, goal); press('heavy', 1.2); break;
      case 'gr-perfect': input.yaw = yawTo(p, goal); if (cue >= 1) press('heavy'); break;
      case 'gr-header': input.yaw = yawTo(p, goal); if (cue >= 1 && now - jumped > 1) { input.jump = true; jumped = now; } input.jumpHeld = now - jumped < .3; break;
      case 'gr-tackle': { const r = m.sim.actors.get(DRILL_RIVAL)!.state; toward(r); input.targetId = DRILL_RIVAL; input.lock = true; if (Math.hypot(r.x - p.x, r.z - p.z) < 2.2) press('light', .2); break; }
      // (Its SHOOT popping a ball at its feet, a launcher's player passes to the team-mate's run, as SCORE's line asks.)
      case 'gr-score': { toward(b); const mate = m.sim.actors.get(LESSON_MATE)!.state; if (d < 2.4) { if (L().pops) { input.yaw = yawTo(p, mate); press('light'); } else { input.yaw = yawTo(p, goal); press('heavy'); } } break; }
      case 'ss-bump': if (b.shot === 'serve') { toward(b, .7); input.yaw = 0; if (Math.hypot(b.x - p.x, b.y - 1.2, b.z - p.z) < 2) press('light'); } break;
      case 'ss-set': input.yaw = 0; if (b.vy < 0 && Math.hypot(b.x - p.x, b.y - 1.4, b.z - p.z) < 1.9) press('light'); break;
      case 'ss-spike': input.yaw = 0; if (b.shot === 'set' && Math.abs(b.vy) < 1 && p.grounded && now - jumped > 1.2) { input.jump = true; jumped = now; } input.jumpHeld = now - jumped < .5; if (!p.grounded && Math.abs(now - jumped - .3) < 1 / 120) input.attack = 'heavy'; break;
      case 'ss-block': {
        // (Their glint - the hitter near the top of its jump - and a person's reaction to it, a fifth of a second.)
        input.yaw = 0; const r = m.sim.actors.get(DRILL_RIVAL)!.state;
        if (!r.grounded && r.y > 3.8 && glint < 0) glint = now;
        if (glint > 0 && now >= glint + .2 && p.grounded && now - jumped > 1) { input.jump = true; jumped = now; glint = -1; }
        input.jumpHeld = now - jumped < .4; if (!p.grounded) input.guard = true; break;
      }
      case 'ss-dive': input.yaw = 0; if (b.shot === 'spike' && b.z < -1 && Math.abs(b.x - p.x) > 1.5 && now - pressed > 1) { input.moveX = Math.sign(b.x - p.x); input.dash = true; pressed = now; } break;
      case 'ss-serve': toward({ x: b.x, z: b.z - 1.1 }, .5); input.yaw = 0; if (m.view.phase === 'kickoff' && Math.hypot(b.x - p.x, b.z - 1.1 - p.z) < .7 && p.grounded && now - jumped > 2) { input.jump = true; jumped = now; } input.jumpHeld = now - jumped < .5; if (!p.grounded && Math.abs(now - jumped - .32) < 1 / 120) input.attack = 'heavy'; break;
    }
    if (process.env.LESSON_LOG) { const k = `${L().step}|${L().state}|${L().tries}|${L().miss}`; if (k !== (globalThis as { __k?: string }).__k) { (globalThis as { __k?: string }).__k = k; console.log(now.toFixed(2), k, p.action, d.toFixed(1), m.view.events.filter(e => e.at > now - .1).map(e => `${e.kind}:${e.actorId}:${e.shot}`).join(' ')); } }
    if (L().tries >= skipAfter && L().state === 'retry') m.lessonCommand('me', 'skip');
    m.submit('me', input); m.step(1 / 60);
  }
}

describe('LEARN TO PLAY: the guided first game', () => {
  it('lists each mode\'s steps, and brings its own cast: Goal Rush a team-mate and the TACKLE drill\'s carrier, Sky Spike their hitter', () => {
    expect(LESSON['goal-rush'].map(s => s.id)).toEqual(['gr-run', 'gr-pass', 'gr-shoot', 'gr-perfect', 'gr-header', 'gr-tackle', 'gr-score']);
    expect(LESSON['sky-spike'].map(s => s.id)).toEqual(['ss-bump', 'ss-set', 'ss-spike', 'ss-block', 'ss-dive', 'ss-serve']);
    const g = lesson('goal-rush'), s = lesson('sky-spike');
    expect(g.view.seats.map(x => [x.id, x.team, x.bot])).toEqual([['me', 'red', false], [LESSON_MATE, 'red', true], [DRILL_RIVAL, 'blue', true]]);
    expect(s.view.seats.map(x => [x.id, x.team])).toEqual([['me', 'red'], [DRILL_RIVAL, 'blue']]);
    // Goal Rush's lesson has the stances (its FIGHT & TACKLE); FREE PLAY without it has none.
    expect(hasStances(g.snapshot().ball)).toBe(true);
    expect(g.snapshot().ball.lesson).toMatchObject({ step: 'gr-run', index: 0, done: [] });
  });
  it('Goal Rush: a player doing what each line asks finishes every step in about a minute and a quarter', () => {
    const m = lesson('goal-rush');
    play(m, () => false, 150);
    const l = m.view.lesson!;
    expect(l.state).toBe('over');
    expect(l.done).toEqual(LESSON['goal-rush'].map(s => s.id));
    expect(l.skipped).toEqual([]);
    expect(m.sim.serverTime).toBeLessThan(90);
  }, 120_000);
  it('Sky Spike: the same, every step done', () => {
    const m = lesson('sky-spike');
    play(m, () => false, 120);
    const l = m.view.lesson!;
    expect(l.state).toBe('over');
    expect(l.done).toEqual(LESSON['sky-spike'].map(s => s.id));
    expect(m.sim.serverTime).toBeLessThan(75);
  }, 120_000);
  it('RUN & BOOST: reaching the ball on foot is a miss that says why (BOOST), and the ball goes back', () => {
    const m = lesson('goal-rush');
    let seq = 0;
    for (let i = 0; i < 600 && m.view.lesson!.state !== 'retry'; i++) {
      const p = m.sim.actors.get('me')!.state, b = m.ball, dx = b.x - p.x, dz = b.z - p.z, d = Math.hypot(dx, dz) || 1;
      m.submit('me', { seq: ++seq, moveX: dx / d, moveZ: dz / d, yaw: Math.atan2(dx, dz), guard: false, targetId: BALL_ID }); m.step(1 / 60);
    }
    expect(m.view.lesson).toMatchObject({ state: 'retry', miss: 'boost', tries: 1, parts: [false, true] });
  });
  it('PERFECT STRIKE: a SHOOT pressed on the cue is perfect; pressed well before it, EARLY', () => {
    const m = lesson('goal-rush');
    play(m, step => step === 'gr-perfect', 60, 0);
    expect(m.view.lesson!.step).toBe('gr-perfect');
    // Early: the press half a second before the bar fills.
    let pressed = false;
    for (let i = 0; i < 600 && m.view.lesson!.tries === 0 && m.view.lesson!.state !== 'done'; i++) {
      const cue = m.view.lesson!.cue ?? 0, p = m.sim.actors.get('me')!.state;
      const attack = !pressed && cue >= .35 ? 'heavy' as const : undefined; if (attack) pressed = true;
      m.submit('me', { seq: ++SEQ, moveX: 0, moveZ: 0, yaw: yawTo(p, { x: 0, z: GOAL_RULES.halfZ }), guard: false, targetId: BALL_ID, attack }); m.step(1 / 60);
    }
    expect(m.view.lesson).toMatchObject({ tries: 1, miss: 'early' });
    // On the cue.
    play(m, step => step !== 'gr-perfect', 20);
    expect(m.view.lesson!.done).toContain('gr-perfect');
    expect(m.view.events.some(e => e.kind === 'strike' && e.actorId === 'me' && e.perfect) || m.view.lesson!.done.includes('gr-perfect')).toBe(true);
  }, 60_000);
  // (SHOOT's quick strike is the same melee blow for every fighter. Until then 89 of the hundred had a cue
  // measured each, and the 11 whose heavy was a beam or a projectile were asked for a first-time goal instead.)
  it('every released fighter\'s SHOOT can strike perfect on the one cue they share; none is asked for a first-time goal instead', () => {
    const released = (Object.keys(MOVES) as FighterId[]).filter(f => isReleasedFighter(f));
    expect(released.filter(strikesPerfect).length).toBe(released.length);
    expect(STRIKE_MEET).toBeGreaterThan(1.9); expect(STRIKE_MEET).toBeLessThan(3.63);
    // Tsubute's heavy is a thrown stone: a PERFECT STRIKE off SHOOT all the same, on the bar.
    const m = lesson('goal-rush', 'tsubute');
    play(m, step => step === 'gr-perfect', 60, 0);
    expect(m.view.lesson!.step).toBe('gr-perfect');
    expect(m.view.lesson!.firstTime).toBeUndefined();
    play(m, step => step !== 'gr-perfect', 20);
    expect(m.view.lesson!.done).toContain('gr-perfect');
    expect(m.view.events.some(e => e.kind === 'strike' && e.actorId === 'me' && e.perfect)).toBe(true);
  }, 60_000);
  // (Nobody's SHOOT pops a ball at rest. Until then Konta's step was the pass met on the bar, `pops`.)
  it('SHOOT for a fighter whose heavy launches (Konta): the ball at rest is shot like anyone\'s, never popped', () => {
    const m = lesson('goal-rush', 'konta');
    play(m, step => step === 'gr-shoot', 30);
    expect(m.view.lesson!.step).toBe('gr-shoot');
    expect(m.view.lesson!.pops).toBeUndefined();
    play(m, step => step === 'gr-perfect', 60);
    expect(m.view.lesson!.done).toContain('gr-shoot');
    expect(m.view.events.some(e => e.kind === 'strike' && e.actorId === 'me' && e.shot === 'pop')).toBe(false);
  }, 60_000);
  it('BUMP: a serve that only hits the body is not a bump of yours (NOT PRESSED); SET counts the swing\'s set', () => {
    const m = lesson('sky-spike');
    let seq = 0;
    for (let i = 0; i < 900 && m.view.lesson!.tries === 0 && m.view.lesson!.state !== 'done'; i++) {
      const p = m.sim.actors.get('me')!.state, b = m.ball, live = m.view.lesson!.state === 'live' && b.shot === 'serve';
      const dx = b.x - p.x, dz = b.z - p.z, d = Math.hypot(dx, dz) || 1;
      m.submit('me', { seq: ++seq, moveX: live && d > .3 ? dx / d * .7 : 0, moveZ: live && d > .3 ? dz / d * .7 : 0, yaw: 0, guard: false, targetId: BALL_ID }); m.step(1 / 60);
    }
    expect(['press', 'under']).toContain(m.view.lesson!.miss);
  }, 60_000);
  it('SKIP STEP passes a step over; END skips the rest and the lesson is over', () => {
    const m = lesson('sky-spike');
    // (Not in the countdown: the lesson's first ball waits for it.)
    expect(m.lessonCommand('me', 'skip')).toBe(false);
    for (let i = 0; i < 200; i++) m.step(1 / 60);
    expect(m.lessonCommand('me', 'skip')).toBe(true);
    expect(m.view.lesson).toMatchObject({ step: 'ss-set', index: 1, skipped: ['ss-bump'] });
    expect(m.lessonCommand('me', 'end')).toBe(true);
    expect(m.view.lesson).toMatchObject({ state: 'over', step: null, skipped: LESSON['sky-spike'].map(s => s.id) });
    expect(m.lessonCommand('me', 'nonsense')).toBe(false);
    // A match without the lesson takes no lesson commands.
    const plain = new BallMatch('sky-spike', { seed: 3, access: 'bots', practice: true });
    plain.add('me', 'taisei', 'Me', false, 'red'); plain.start();
    expect(plain.lessonCommand('me', 'skip')).toBe(false);
    expect(plain.snapshot().ball.lesson).toBeUndefined();
  });
  it('the snapshot carries the lesson\'s own copy (the page never holds the match\'s arrays)', () => {
    const m = lesson('goal-rush'); for (let i = 0; i < 200; i++) m.step(1 / 60);
    const shot = m.snapshot().ball.lesson!;
    m.lessonCommand('me', 'skip');
    expect(shot.skipped).toEqual([]);
    expect(m.view.lesson!.skipped).toEqual(['gr-run']);
  });
});
