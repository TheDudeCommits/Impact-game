import { describe, expect, it } from 'vitest';
import { previewRun } from './previewHarness';

/** online, the local fighter's blows on a body that cannot get out of their way are heard,
 *  felt and sparked on the tick the local copy lands them (Prediction.takeImpacts), every light, heavy and special -
 *  where only Konta's Kazeyose was, and the rest waited a round trip for the server's event. A server with a bot for the
 *  foe and a page 60-200 ms away (tests/previewHarness.ts). Measured over the released roster at 60, 120 and 200 ms,
 *  90 s each: about half the server's hits presented early, 0-1% of those never landed by the server. */
describe('the local fighter\'s blows on a committed body, ahead of the server', () => {
  it('presents a string\'s follow-up blows early and almost never one the server does not land, each answered once', { timeout: 60_000 }, () => {
    let presented = 0, phantoms = 0, landed = 0, echoes = 0;
    for (const [fighter, foe, rtt, seed] of [['taisei', 'gummy', 120, 11], ['kenzo', 'nigo', 200, 108], ['gummy', 'ouga', 60, 205]] as const) {
      const run = previewRun(fighter, foe, rtt, 30, seed);
      presented += run.presented; phantoms += run.phantoms; landed += run.landed; echoes += run.echoes;
    }
    expect(presented / landed, 'share of the server\'s hits presented early').toBeGreaterThan(.3);
    expect(phantoms / presented, 'presented, never landed').toBeLessThan(.03);
    expect(echoes, 'a presented blow\'s own event not recognised as shown').toBe(0);
  });
});
