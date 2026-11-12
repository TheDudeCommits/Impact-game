import { afterEach, describe, expect, it } from 'vitest';
import { FIGHTERS } from '../src/config';
import type { AttackSlot, FighterId, PlayerState } from '../src/game/types';
import { moveFor } from '../src/game/awakening';
import { MOVES } from '../src/game/moves';
import { ownKit, type ForgeKit } from '../src/engine/sim';
import { AREA_BY_ELEMENT, areaCardOf, areaEntry, areaMoveOf } from '../src/engine/sim/areaMoves';
import { AREA_CARD_MAX, moveProblems } from '../src/engine/sim/validate';
import { setActiveKit } from '../src/engine/client/forgeLive';
import { slotNames } from '../src/engine/client/transplant';
import { areaMoveCard } from '../src/ui/hud/cardNames';
import { ORIGINAL_AREAS } from '../src/originals/area';

const SHIDARE_CARD = (ORIGINAL_AREAS.shidare!.card ?? ORIGINAL_AREAS.shidare!.name).toUpperCase();

const kit = (body: FighterId, picks: Partial<Record<AttackSlot, ForgeKit['slots']['light']>>): ForgeKit =>
  ({ ...ownKit(body, 'Card'), slots: { ...ownKit(body).slots, ...picks } });
const player = (fighter: FighterId): PlayerState => ({
  id: 'p1', name: 'P1', fighter, x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 100, action: 'idle',
  actionStarted: 0, actionDuration: 0, actionTime: 0, target: null, alive: true, isBot: false, grounded: true, guarding: false,
  cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 },
});

afterEach(() => setActiveKit(undefined, 'bellows'));

describe('the G card names its area move in 16 characters or fewer', () => {
  it('every fighter, in either form', () => {
    const long: string[] = [];
    for (const id of Object.keys(FIGHTERS) as FighterId[]) for (const awakened of [false, true]) {
      const name = areaMoveCard(moveFor(id, 'area', awakened));
      if (!name.trim() || [...name].length > AREA_CARD_MAX) long.push(`${id}${awakened ? ' (awakened)' : ''}: ${name}`);
    }
    expect(long).toEqual([]);
  });

  it('by the name players know, where its own runs longer; the banner and the seal keep the full name', () => {
    expect(areaMoveCard(MOVES.shirokane.area)).toBe('DUST CURTAIN');
    expect(areaMoveCard(MOVES.gummy.area)).toBe('MONSOON');
    expect(areaMoveCard(MOVES.shidare.area)).toBe(SHIDARE_CARD);
    expect(MOVES.shirokane.area.name).toBe('Dust Curtain');
    // A short name is its own card.
    expect(areaMoveCard(MOVES.nigo.area)).toBe(MOVES.nigo.area.name.toUpperCase());
    for (const id of Object.keys(FIGHTERS) as FighterId[]) {
      const entry = areaEntry(id);
      if (entry?.name && [...entry.name].length > AREA_CARD_MAX) expect(entry.area?.card, id).toBeTruthy();
    }
  });

  it("an element's short card stays with its default name, never with a fighter's own", () => {
    // No fighter wears the black-flame default since Hikui's review (batch 10); the default keeps its card.
    expect(AREA_BY_ELEMENT.blackflame.name).toBe('Black Flame Bloom');
    expect(AREA_BY_ELEMENT.blackflame.area?.card).toBe('Black Flame');
    expect(areaCardOf(areaMoveOf('hikui'))).toBe('Sending Fire');
    for (const id of Object.keys(FIGHTERS) as FighterId[]) {
      const entry = areaEntry(id), move = areaMoveOf(id);
      if (entry?.name !== undefined && entry.area?.card === undefined) expect(move.area?.card, id).toBeUndefined();
    }
  });

  it('a borrowed area move carries its card too', () => {
    setActiveKit(kit('bellows', { area: { from: 'shirokane' } }));
    expect(slotNames(player('bellows'), 'area')).toMatchObject({ from: 'shirokane', short: 'DUST CURTAIN', name: MOVES.shirokane.area.name });
  });

  it('turns away a card over 16 characters', () => {
    const move = { ...MOVES.shirokane.area, area: { ...MOVES.shirokane.area.area!, card: 'A Card Name Far Too Long' } };
    expect(moveProblems(move, 'shirokane.area').errors.join(' ')).toContain('area.card');
    expect(moveProblems(MOVES.shirokane.area, 'shirokane.area').errors.filter(e => e.includes('area.card'))).toEqual([]);
  });
});
