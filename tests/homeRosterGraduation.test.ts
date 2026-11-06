import { describe, expect, it } from 'vitest';
import type { FighterId } from '../src/game/types';
import { HOME_BASELINE_FIGHTERS, HOME_EXPANSION_FIGHTERS, HOME_GRADUATED_FIGHTERS, homeRosterPages, homeRosterWip, homeWipStamp } from '../src/ui/HomeRosterOrder';

describe('graduating an expansion fighter from the WIP stamp', () => {
  it('stamps every expansion fighter that has not graduated, and no other', () => {
    for (const id of HOME_EXPANSION_FIGHTERS) expect(homeWipStamp(id), id).toBe(true);
    for (const id of HOME_BASELINE_FIGHTERS) expect(homeWipStamp(id), id).toBe(false);
  });
  it('takes the stamp off a graduate and leaves it in the expansion', () => {
    const graduated = new Set<FighterId>(['chohan', 'yodaka']);
    expect(homeWipStamp('chohan', graduated)).toBe(false);
    expect(homeWipStamp('yodaka', graduated)).toBe(false);
    expect(homeWipStamp('tsubute', graduated)).toBe(true);
    // Still one of the expansion: the roster's order and whatever asks for the sixty (the staged effects' baseline) do not move.
    expect(homeRosterWip('chohan')).toBe(true);
    expect(HOME_EXPANSION_FIGHTERS).toContain('chohan');
    expect(homeRosterPages([...HOME_BASELINE_FIGHTERS, ...HOME_EXPANSION_FIGHTERS]).flatMap(page => page.fighters)).toContain('chohan');
  });
  it('never stamps an original however the list is written', () => {
    expect(homeWipStamp('taisei', new Set<FighterId>())).toBe(false);
    expect(homeWipStamp('taisei', new Set<FighterId>(['taisei']))).toBe(false);
  });
  it('names only expansion fighters, each once', () => {
    expect(new Set(HOME_GRADUATED_FIGHTERS).size).toBe(HOME_GRADUATED_FIGHTERS.length);
    for (const id of HOME_GRADUATED_FIGHTERS) expect(HOME_EXPANSION_FIGHTERS, id).toContain(id);
  });
});
