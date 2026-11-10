import { describe, expect, it } from 'vitest';
import { BALL_ARENAS, type BallArenaId } from '../../game/ball/arenas';
import { INTRO } from '../../game/ball/ceremony';
import { INTRO_SHOTS, introLens } from './ceremonyShots';

describe('the intro\'s flyover', () => {
  it('gives every arena two or three moves, then the splash page\'s shot of both sides', () => {
    for (const arena of Object.keys(BALL_ARENAS) as BallArenaId[]) {
      const shots = INTRO_SHOTS[arena];
      expect(shots.length, arena).toBeGreaterThanOrEqual(2);
      expect(shots.length, arena).toBeLessThanOrEqual(3);
      const lens = { eye: [0, 0, 0] as [number, number, number], look: [0, 0, 0] as [number, number, number], fov: 0 }, seen: number[] = [];
      for (let t = 0; t <= INTRO.seconds; t += .05) {
        const i = introLens(arena, BALL_ARENAS[arena].mode, t, lens);
        if (seen.at(-1) !== i) seen.push(i);
        expect(lens.eye.every(Number.isFinite) && lens.look.every(Number.isFinite), `${arena} ${t}`).toBe(true);
        expect(lens.eye[1], `${arena} ${t}`).toBeGreaterThan(.8);
        expect(lens.fov).toBeGreaterThan(30);
      }
      // Each move once, in order, then the splash's.
      expect(seen).toEqual([...shots.map((_, i) => i), -1]);
    }
  });
  it('holds each shot still under reduced motion', () => {
    const a = { eye: [0, 0, 0] as [number, number, number], look: [0, 0, 0] as [number, number, number], fov: 0 }, b = { ...a, eye: [0, 0, 0] as [number, number, number], look: [0, 0, 0] as [number, number, number] };
    introLens('ink-bowl', 'goal-rush', .1, a, true); introLens('ink-bowl', 'goal-rush', 1.2, b, true);
    expect(a.eye).toEqual(b.eye);
  });
});
