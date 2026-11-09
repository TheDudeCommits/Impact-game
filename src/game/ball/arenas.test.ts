import {describe, expect, it} from 'vitest';
import {BallMatch} from './BallMatch';
import {BALL_ARENAS, MODE_ARENAS, arenaFor} from './arenas';
import {freshBall, stepBall} from './physics';

describe('Ball arenas', () => {
  it('each mode has three arenas of its own, its first the one it always had', () => {
    expect(MODE_ARENAS['goal-rush'][0]).toBe('ink-bowl');
    expect(MODE_ARENAS['sky-spike'][0]).toBe('sky-court');
    for (const [mode, list] of Object.entries(MODE_ARENAS)) {
      expect(list).toHaveLength(3);
      for (const id of list) expect(BALL_ARENAS[id].mode).toBe(mode);
    }
  });
  it('a match plays the arena it was given, or one of its own mode\'s in turn', () => {
    expect(new BallMatch('goal-rush', {seed: 3, arena: 'dust-yard'}).view.arena).toBe('dust-yard');
    // Another mode's arena is not this match's.
    expect(MODE_ARENAS['goal-rush']).toContain(new BallMatch('goal-rush', {seed: 3, arena: 'tide-court'}).view.arena);
    const seen = new Set(Array.from({length: 12}, (_, i) => arenaFor('sky-spike', i)));
    expect(seen.size).toBe(3);
  });
  it('only the host changes the arena, in the lobby, to one of the mode\'s', () => {
    const m = new BallMatch('sky-spike', {seed: 5, access: 'host', fillBots: false});
    m.add('host', 'taisei', 'Host', false, 'red'); m.add('guest', 'konta', 'Guest', false, 'blue');
    m.view.hostId = 'host';
    expect(m.setArena('guest', 'ember-rim')).toBe(false);
    expect(m.setArena('host', 'rain-roof')).toBe(false);
    expect(m.setArena('host', 'ember-rim')).toBe(true);
    expect(m.view.arena).toBe('ember-rim');
  });
  it('carries each twist to the ball: sand drags, rain runs, the sea wind blows, the rim starts hot', () => {
    const roll = (ground?: number) => {
      const b = freshBall(); b.held = false; b.y = .3; b.vx = 9; if (ground) b.ground = ground;
      for (let i = 0; i < 120; i++) stepBall('goal-rush', b, 1 / 60);
      return b.x;
    };
    const plain = roll(), sand = roll(BALL_ARENAS['dust-yard'].twist.groundFriction), wet = roll(BALL_ARENAS['rain-roof'].twist.groundFriction);
    expect(sand).toBeLessThan(plain);
    expect(wet).toBeGreaterThan(plain);
    const tide = new BallMatch('sky-spike', {seed: 9, arena: 'tide-court'}).ball;
    expect(Math.hypot(tide.windX ?? 0, tide.windZ ?? 0)).toBeCloseTo(BALL_ARENAS['tide-court'].twist.wind!, 5);
    expect(new BallMatch('sky-spike', {seed: 9, arena: 'ember-rim'}).ball.heat).toBe(BALL_ARENAS['ember-rim'].twist.startHeat);
    const ink = new BallMatch('goal-rush', {seed: 9, arena: 'ink-bowl'}).ball;
    expect(ink.ground ?? 1).toBe(1); expect(ink.windX ?? 0).toBe(0);
  });
});
