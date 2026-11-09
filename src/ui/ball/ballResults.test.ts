import { describe, expect, it } from 'vitest';
import { rankNext } from './BallUI';
import { RANKED } from '../../game/ball/ranked';

/** The results say how near the next ranked stamp is. */
describe('the results\' next stamp', () => {
  it('reads the placements left, the points to the next stamp with a bar, and the top stamp', () => {
    expect(rankNext({ rating: 1010, games: 2, delta: 24 })).toContain(`${RANKED.placements - 2} MORE TO YOUR STAMP`);
    const inked = rankNext({ rating: 1084, games: 9, delta: 16 });
    expect(inked).toContain('<b>INKED</b>');
    expect(inked).toContain('66 TO TONED');
    expect(inked).toContain('width:56%');
    expect(inked).toContain('class="up">+16');
    expect(rankNext({ rating: 880, games: 12, delta: -12 })).toContain('20 TO PENCIL');
    expect(rankNext({ rating: 1500, games: 30 })).toContain('THE TOP STAMP');
  });
});
