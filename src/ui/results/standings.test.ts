import { describe, expect, it } from 'vitest';
import type { PlayerState } from '../../game/types';
import { standingNames } from '../MatchResults';
import { FIGHTERS } from '../../config';

const p = (name: string, fighter: string, isBot: boolean) => ({ name, fighter, isBot }) as unknown as PlayerState;

describe('the full standings (overnight UX, 8 October 2026)', () => {
  it("names a bot on this device by its fighter, never by its id in lower case", () => {
    expect(standingNames(p('jinlin', 'jinlin', true))).toEqual([FIGHTERS['jinlin'].name, 'BOT']);
    expect(standingNames(p('gaku', 'gaku', true))).toEqual([FIGHTERS.gaku.name, 'BOT']);
    expect(standingNames(p('magatsu', 'magatsu', true))[1]).toBe('BOT');
  });
  it("keeps a room bot's own name and a player's", () => {
    expect(standingNames(p('Rival', 'akagane', true))).toEqual(['Rival', `${FIGHTERS.akagane.name} · BOT`]);
    expect(standingNames(p('Thunder Hawk', 'konta', false))).toEqual(['Thunder Hawk', FIGHTERS.konta.name]);
  });
  it('a player who kept the default name reads as their fighter, never FIGHTER', () => {
    expect(standingNames(p('Fighter', 'konta', false))).toEqual([FIGHTERS.konta.name, 'PLAYER']);
    expect(standingNames(p('', 'taisei', false))).toEqual([FIGHTERS.taisei.name, 'PLAYER']);
  });
});
