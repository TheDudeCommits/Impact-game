import { describe, expect, it } from 'vitest';
import { BallMatch } from './BallMatch';
import { FOOTBALL, FOOTBALL_SIZE, passMargin, personPass } from './football';
import { GOAL_RULES } from './model';
import { FOOT_PODIUM, PODIUM } from './ceremony';
import { finaleStateOf } from '../../ui/results/finale';
import type { PlayerInput, GameSnapshot } from '../types';

/** Football: a person's PASS that gets through (never rolled into a rival's feet, past
 *  the one pressing), a person's POKE that wins from in front and beside, keepers and aim by level, and PLAY AGAIN
 *  sooner (the finale's hold on football). */
let seq = 0;
type Keys = Partial<PlayerInput> & { lightHeld?: boolean; heavyHeld?: boolean };
const tick = (m: BallMatch, id: string, input: Keys) => { m.submit(id, { seq: ++seq, moveX: 0, moveZ: 0, yaw: 0, ...input }); m.step(1 / 60); };
const until = (m: BallMatch, done: () => boolean, seconds = 20) => { for (let i = 0; i < seconds * 60 && !done(); i++) m.step(1 / 60); return done(); };
const carry = (m: BallMatch, id: string, heading = 0) => (m as unknown as { startCarry(s: unknown, a: unknown, h: number): void }).startCarry(m.seats.get(id), m.sim.actors.get(id), heading);
const drop = (m: BallMatch) => (m as unknown as { drop(pop?: unknown, why?: string): void }).drop(undefined, 'check');
const mate = (id: string, x: number, z: number) => ({ id, x, z, vx: 0, vz: 0 });

/** Red's person 'p' with bots, blue's people 'b' and 'c' (their bodies stand where they are put), SPORT on, live. */
function match(difficulty: 'easy' | 'normal' | 'hard' = 'normal') {
  const m = new BallMatch('goal-rush', { seed: 5, access: 'host', fillBots: false, football: true, difficulty });
  m.add('p', 'konta', 'P', false, 'red'); m.add('q', 'taisei', 'Q', false, 'red'); m.add('b', 'kenzo', 'B', false, 'blue'); m.add('c', 'ume', 'C', false, 'blue');
  expect(m.start()).toBe(true);
  expect(until(m, () => m.view.phase === 'live')).toBe(true);
  return m;
}

describe("Goal Rush football: a person's PASS gets through", () => {
  it('reads a rival in the lane, or one near enough to run to it, as blocking; the one pressing at the ball not', () => {
    expect(passMargin({ x: 0, z: 0 }, { x: 0, z: 14 }, [{ x: .5, z: 7 }], false)).toBeLessThan(0);
    expect(passMargin({ x: 0, z: 0 }, { x: 0, z: 14 }, [{ x: 1.8, z: 9 }], false)).toBeLessThan(0);
    expect(passMargin({ x: 0, z: 0 }, { x: 0, z: 14 }, [{ x: 8, z: 7 }], false)).toBeGreaterThan(0);
    // (The presser stood right at the ball lets it by: it has left the foot.)
    expect(passMargin({ x: 0, z: 0 }, { x: 0, z: 14 }, [{ x: .6, z: .8 }], false)).toBeGreaterThan(0);
    // (Lofted: only a rival near where it lands.)
    expect(passMargin({ x: 0, z: 0 }, { x: 0, z: 14 }, [{ x: 0, z: 7 }], true)).toBeGreaterThan(0);
    expect(passMargin({ x: 0, z: 0 }, { x: 0, z: 14 }, [{ x: 1, z: 14 }], true)).toBeLessThan(0);
  });
  it('never rolls it into a rival in the lane: led round them or chipped over, else to the other team-mate who is clear', () => {
    const round = personPass({ x: 0, z: 0 }, 0, [mate('a', 0, 12)], [{ x: 0, z: 6 }]);
    expect(round.mate?.id).toBe('a');
    expect(round.lofted || passMargin({ x: 0, z: 0 }, round.mate!, [{ x: 0, z: 6 }], false) >= 0).toBe(true);
    expect(round.lofted || Math.abs(round.mate!.x) > 1).toBe(true);
    // (Team-mate 'a' hemmed in every way - straight, led round, chipped - and 'b' clear: 'b'.)
    const other = personPass({ x: 0, z: 0 }, 0, [mate('a', 0, 12), mate('b', 8, 8)], [{ x: 0, z: 6 }, { x: 2, z: 12 }, { x: -2, z: 12 }]);
    expect(other.mate?.id).toBe('b'); expect(other.lofted).toBe(false);
    // (Nobody clear at all: the stick's pick chipped, never rolled.)
    const chip = personPass({ x: 0, z: 0 }, 0, [mate('a', 0, 12)], [{ x: 0, z: 6 }, { x: 2, z: 12 }, { x: -2, z: 12 }, { x: 3, z: 7 }, { x: -3, z: 7 }]);
    expect(chip.mate?.id).toBe('a'); expect(chip.lofted).toBe(true);
  });
  it('a pass struck with a rival pressing at the ball is not taken off the boot', () => {
    for (const side of [-1, 1]) {
      const m = match();
      drop(m);
      m.put('p', 0, 0, 0); m.put('q', 0, 10, 0); m.put('b', side * .9, 1.1, Math.PI); m.put('c', 11, -14, 0);
      carry(m, 'p', 0);
      tick(m, 'p', { attack: 'light', lightHeld: true });
      tick(m, 'p', { lightHeld: false });
      let rival = false, received = false;
      for (let i = 0; i < 90 && !received; i++) { m.step(1 / 60); if (m.ball.carry === 'b' || m.ball.carry === 'c') rival = true; if (m.ball.carry === 'q') received = true; }
      expect(rival).toBe(false);
      expect(received).toBe(true);
    }
  });
  it("a person's pass along the floor leaves quicker than a bot's", () => {
    expect(FOOTBALL.fun3.pass.arrive).toBeGreaterThan(FOOTBALL.pass.arrive);
  });
});

describe("Goal Rush football: a person's POKE", () => {
  /** 'b' carries along +z from (0, 0); 'p' pokes from `angle` degrees off b's run, 1.5 m from the ball. */
  function poke(angle: number, difficulty: 'easy' | 'normal' | 'hard' = 'normal') {
    const m = match(difficulty);
    drop(m);
    m.put('b', 0, 0, 0); m.put('q', -10, -10, 0); m.put('c', 11, -14, 0);
    carry(m, 'b', 0);
    // (Past the ball's first moments a person's carry is theirs - FOOTBALL.fun.fresh.)
    for (let i = 0; i < 70; i++) m.step(1 / 60);
    // (Stood `angle` round the carrier's run, 1.5 m from the ball: in reach from any side.)
    const b = m.sim.actors.get('b')!.state, a = angle * Math.PI / 180;
    let d = .5; while (d < 4 && Math.hypot(b.x + Math.sin(a) * d - m.ball.x, b.z + Math.cos(a) * d - m.ball.z) < 1.5) d += .02;
    m.put('p', b.x + Math.sin(a) * d, b.z + Math.cos(a) * d, a + Math.PI);
    tick(m, 'p', { guard: true });
    for (let i = 0; i < 30; i++) tick(m, 'p', { guard: false });
    return m.ball.carry === 'p';
  }
  it('wins from in front and from beside the carrier, not from behind', () => {
    expect(poke(10)).toBe(true);
    expect(poke(95)).toBe(true);
    expect(poke(-110)).toBe(true);
    expect(poke(165)).toBe(false);
  });
  it('reaches further and wins wider on EASY than on HARD', () => {
    const T = FOOTBALL.fun3.tackle;
    expect(T.reach.easy).toBeGreaterThan(T.reach.normal); expect(T.reach.normal).toBeGreaterThan(T.reach.hard);
    expect(T.front.easy).toBeGreaterThan(T.front.normal); expect(T.front.normal).toBeGreaterThan(T.front.hard);
    expect(poke(115, 'normal')).toBe(true);
    expect(poke(115, 'hard')).toBe(false);
  });
});

describe('Goal Rush football: keepers and aim by level', () => {
  it('a keeper dives further on HARD, and a person is put less deep in the corner against it', () => {
    const K = FOOTBALL.fun2.keeper.dive, A = FOOTBALL.fun3.aim;
    expect(K.easy).toBeLessThan(K.normal); expect(K.normal).toBeLessThan(K.hard);
    expect(A.easy).toBeLessThan(A.normal); expect(A.normal).toBeLessThan(A.hard);
    // (A placed corner against a keeper on its middle - the dive's reach from its body (BallMatch footDive) against the
    // corner the person's SHOOT is put in: EASY and NORMAL beat it; HARD only a keeper drawn off its middle, by under a
    // metre.)
    const r = GOAL_RULES.ballRadius * FOOTBALL_SIZE, reach = (lv: 'easy' | 'normal' | 'hard') => .45 + r + FOOTBALL.keeper.reach + K[lv], corner = (lv: 'easy' | 'normal' | 'hard') => GOAL_RULES.goalHalfWidth - r - FOOTBALL.shot.inset - A[lv];
    expect(reach('easy')).toBeLessThan(corner('easy'));
    expect(reach('normal')).toBeLessThan(corner('normal'));
    expect(reach('hard')).toBeGreaterThan(corner('hard'));
    expect(reach('hard') - corner('hard')).toBeLessThan(1);
  });
});

describe('Goal Rush football: PLAY AGAIN sooner', () => {
  it("holds the results FOOT_PODIUM.seconds on football's end, the podium's own elsewhere", () => {
    const snap = (football: boolean) => ({ roomMode: 'match', status: 'finished', serverTime: 0, players: [], ball: { mode: 'goal-rush', phase: 'over', round: 1, endsAt: 1, winner: 'red', seats: [], football } } as unknown as GameSnapshot);
    expect(finaleStateOf(snap(true), () => false, () => undefined).end?.hold).toBe(FOOT_PODIUM.seconds);
    expect(finaleStateOf(snap(false), () => false, () => undefined).end?.hold).toBe(PODIUM.seconds);
    expect(FOOT_PODIUM.seconds).toBeLessThanOrEqual(3);
  });
});
