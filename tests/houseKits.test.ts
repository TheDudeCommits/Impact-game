import { afterEach, describe, expect, it, vi } from 'vitest';

/** House kits (src/engine/sim/houseKits.ts, docs/engine/AREA.md), with two entries made up for the test: Taisei and
 *  Ouga trade specials (a swap both ways, which must neither chain nor loop), Taisei takes Magatsu's area move with an
 *  Armory effect on it and wears an aura. The real data is checked in tests/areaSlotData.test.ts. */
vi.mock('../src/engine/sim/houseKits.json', () => ({ default: {
  taisei: { slots: { special: { from: 'ouga', fromSlot: 'special' }, area: { from: 'magatsu', fromSlot: 'area', fx: { effect: 'test-burst' } } }, aura: { effect: 'test-aura', scale: 1.2 } },
  ouga: { slots: { special: { from: 'taisei', fromSlot: 'special', tune: { power: 1.1 } } } },
} }));

import { ArenaSimulation } from '../src/game/simulation';
import { HOUSE_APPLIED, MOVES } from '../src/game/moves';
import { moveFor } from '../src/game/awakening';
import type { CombatEvent } from '../src/game/types';
import { budget, deriveSimSpec, forgeMoves, forgeProblems, houseForgeKit, ownKit, simSpec, type ForgeKit } from '../src/engine/sim';
import { areaMoveOf } from '../src/engine/sim/areaMoves';
import { tuneMove } from '../src/engine/sim/tune';
import { areaTotal } from '../src/engine/sim/areaDamage';
import { ForgeSession, moveSource, presentationKit, setActiveKit, slotFx } from '../src/engine/client';


afterEach(() => { setActiveKit(undefined, 'taisei'); });

describe('house kits in the simulation', () => {
  it('puts each pick into MOVES from the authored tables, so a swap both ways neither chains nor loops', () => {
    expect([...HOUSE_APPLIED].sort()).toEqual(['ouga.special', 'taisei.area', 'taisei.special']);
    // Taisei throws Ouga's own special (Throne Wave, 128); Ouga throws Taisei's own (Sunpalm Cannon, 122), tuned up by its pick.
    expect(MOVES.taisei.special).toMatchObject({ name: 'Throne Wave', damage: 128 });
    expect(MOVES.ouga.special).toMatchObject({ name: 'Sunpalm Cannon', damage: Math.round(122 * 1.1) });
    // Magatsu's area move, timed to the look the pick gives it (round 3): an unmeasured look strikes once, with all of it.
    expect(MOVES.taisei.area).toEqual(tuneMove(areaMoveOf('magatsu'), { fx: { effect: 'test-burst' } }));
    expect(MOVES.taisei.area).toMatchObject({ name: areaMoveOf('magatsu').name, area: { fx: 'test-burst' } });
    expect(MOVES.taisei.area.area?.strikes).toBeUndefined();
    expect(areaTotal(MOVES.taisei.area)).toBe(areaTotal(areaMoveOf('magatsu')));
    // Everything that reads a fighter's moves reads the house move: moveFor, the registry.
    expect(moveFor('taisei', 'special', false)).toBe(MOVES.taisei.special);
    expect(simSpec('taisei')!.kit.slots.special).toEqual(MOVES.taisei.special);
    expect(deriveSimSpec('ouga').kit.slots.special).toEqual(tuneMove(MOVES.ouga.special, {}));
  });

  it('throws the house move in a match', () => {
    const sim = new ArenaSimulation({ seed: 3, trainingBot: false });
    sim.addPlayer('g', 'taisei', 'Taisei', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('d', 'banjaku', 'Dummy', false, { x: 0, y: 0, z: 8 });
    sim.startMatch();
    const events: CombatEvent[] = [];
    let seq = 1;
    for (let i = 0; i < 90; i++) {
      sim.submitInput('g', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, targetId: 'd', ...(i === 70 ? { attack: 'special' } : {}) });
      sim.step(1 / 60);
      events.push(...sim.snapshot(true).events);
    }
    const cast = events.find(e => e.kind === 'cast' && e.actorId === 'g' && e.slot === 'special');
    expect(cast?.move).toBe(MOVES.taisei.special.name);
  });

  it("makes ORIGINAL the house version, and a player's kit overrides it slot by slot", () => {
    const own = ownKit('taisei');
    expect(forgeMoves(own).special).toEqual(MOVES.taisei.special);
    expect(budget(own)).toBeCloseTo(1, 10);
    const session = new ForgeSession();
    const before = MOVES.taisei.special;
    const kit: ForgeKit = { ...own, slots: { ...own.slots, special: { from: 'banjaku', fromSlot: 'special' } } };
    expect(session.apply(kit)).toEqual({ ok: true });
    expect(MOVES.taisei.special.name).toBe(simSpec('banjaku')!.kit.slots.special.name);
    expect(MOVES.taisei.area).toEqual(tuneMove(areaMoveOf('magatsu'), { fx: { effect: 'test-burst' } }));
    session.restore();
    expect(MOVES.taisei.special).toBe(before);
  });

  it('validates with forgeProblems like any kit', () => {
    expect(forgeProblems(houseForgeKit('taisei')!, { sandbox: true }).errors).toEqual([]);
    expect(forgeProblems(houseForgeKit('ouga')!, { sandbox: true }).errors).toEqual([]);
    expect(houseForgeKit('gummy')).toBeUndefined();
  });
});

describe('house kits on the page', () => {
  it('draws a house pick as the borrowed move it is: its source, its effect and the aura', () => {
    expect(moveSource({ fighter: 'taisei' }, 'special')).toEqual({ fighter: 'ouga', slot: 'special' });
    expect(moveSource({ fighter: 'taisei' }, 'area')).toEqual({ fighter: 'magatsu', slot: 'area' });
    expect(moveSource({ fighter: 'taisei' }, 'light')).toBeUndefined();
    expect(slotFx({ fighter: 'taisei' }, 'area')).toEqual({ effect: 'test-burst' });
    expect(slotFx({ fighter: 'taisei' }, 'body')).toEqual({ effect: 'test-aura', scale: 1.2 });
    // A fighter with no house kit and no kit of its own plays its own moves as authored, as before.
    expect(presentationKit({ fighter: 'gummy' })).toBeUndefined();
  });

  it("lays a player's kit over it slot by slot, its ORIGINAL picks staying the house's", () => {
    const own = ownKit('taisei');
    setActiveKit({ ...own, slots: { ...own.slots, light: { from: 'gummy', fromSlot: 'light' }, heavy: { from: 'ouga', fromSlot: 'special' },
      special: { from: 'taisei', fx: { effect: 'mine' } } }, aura: { effect: 'my-aura' } });
    expect(moveSource({ fighter: 'taisei' }, 'light')).toEqual({ fighter: 'gummy', slot: 'light' });
    // Ouga's special is Taisei's Sunpalm Cannon by his house kit: borrowed, it is drawn as what it is, once (no chain).
    expect(moveSource({ fighter: 'taisei' }, 'heavy')).toEqual({ fighter: 'taisei', slot: 'special' });
    expect(moveSource({ fighter: 'taisei' }, 'special')).toEqual({ fighter: 'ouga', slot: 'special' });
    expect(slotFx({ fighter: 'taisei' }, 'special')).toEqual({ effect: 'mine' });
    expect(slotFx({ fighter: 'taisei' }, 'area')).toEqual({ effect: 'test-burst' });
    expect(slotFx({ fighter: 'taisei' }, 'body')).toEqual({ effect: 'my-aura' });
  });
});
