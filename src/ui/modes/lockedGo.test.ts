import { describe, expect, it } from 'vitest';
import { goLabel } from './lockedGo';

describe('GO with a locked fighter (overnight UX, 8 October 2026)', () => {
  it('says UNLOCK and where, never FIGHT, when the start would open the shop', () => {
    expect(goLabel('duel', 'FIGHT', 'Gorai', true)).toEqual({ label: 'UNLOCK GORAI', note: 'IN ACCOUNT · OR TRY IN TRAINING' });
    expect(goLabel('royale', 'FIND MATCH', 'Dorado', true).label).toBe('UNLOCK DORADO');
    expect(goLabel('bad-blood', 'HOST ROOM', 'Shiun', true).label).not.toMatch(/HOST|FIGHT/);
  });
  it('keeps the way to play when the fighter is the account\'s, and in Training, which takes every fighter', () => {
    expect(goLabel('duel', 'FIGHT', 'Konta', false)).toEqual({ label: 'FIGHT' });
    expect(goLabel('training', 'TRAIN', 'Gorai', true)).toEqual({ label: 'TRAIN' });
  });
});

describe("GO opened by a friend's invite (overnight UX, 9 October 2026)", () => {
  it('joins the room in the code field, never HOST ROOM', () => {
    expect(goLabel('royale', 'HOST ROOM', 'Konta', false, '276996')).toEqual({ label: 'JOIN ROOM', note: "YOUR FRIEND'S ROOM · 276996" });
    expect(goLabel('duel', 'HOST ROOM', 'Konta', false, '')).toEqual({ label: 'JOIN ROOM', note: "YOUR FRIEND'S ROOM" });
  });
  it('a locked fighter still says UNLOCK first: the start would open the shop', () => {
    expect(goLabel('royale', 'HOST ROOM', 'Gorai', true, '276996').label).toBe('UNLOCK GORAI');
  });
});
