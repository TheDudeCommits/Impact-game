import { describe, expect, it } from 'vitest';
import { HOME_FIGHTERS } from '../src/ui/MangaHome';
import { comboMove, type ComboKey, type EnderKey } from '../src/game/combos';
import { CADENCE_STRINGS, CADENCES, lands } from '../scripts/combos/cadence.mts';

/** Round 4b (COMBAT): every Vol.1 string into every ender, at a player's rhythm - 250, 300 and 350 ms between presses -
 *  against the passive training bot. Every one must connect. The blind critic found Setsu's Light x3 enders whiffing
 *  at a normal 300 ms rhythm (his Snowdrift Dance popped the target, which landed into the knockdown's evade) and
 *  connecting at 220. The strings are scripts/combos/cadence.mts's (Jump + Heavy ends the air string; Jump + Special
 *  is the ground smash beside a body on the floor). */
describe('every string into every ender at a player\'s rhythm', () => {
  for (const fighter of HOME_FIGHTERS) {
    it(`${fighter}: connects every ender at 250, 300 and 350 ms`, () => {
      const missed: string[] = [];
      for (const cadence of CADENCES) for (const key of Object.keys(CADENCE_STRINGS) as EnderKey[]) {
        const result = lands(fighter, key, cadence);
        if (result !== 'hit') missed.push(`${key}@${cadence * 1000}ms: ${result} (${comboMove(fighter, key)!.name})`);
      }
      expect(missed, `${fighter}'s enders that did not connect`).toEqual([]);
    });
  }
});
