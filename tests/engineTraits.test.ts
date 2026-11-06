import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { ArenaSimulation } from '../src/game/simulation';
import { AIR_NORMAL_FIGHTERS, MOVES } from '../src/game/moves';
import { AWAKENED_MOVES, moveFor } from '../src/game/awakening';
import { TIME_STOP_TOURS } from '../src/game/timeStopBarrage';
import type { AttackSlot, FighterId } from '../src/game/types';
import { BODY_TRAITS, FIGHTER_IDS, forgeMoves, ownKit, traitsOf, type ForgeKit } from '../src/engine/sim';
import { ForgeSession } from '../src/engine/client';

describe('body traits', () => {
  it('reproduce the lists the simulation used to keep by name', () => {
    const having = (key: keyof ReturnType<typeof traitsOf>) => FIGHTER_IDS.filter(id => traitsOf(id)[key] !== undefined).sort();
    expect(having('driveMelee')).toEqual(['kenzo', 'kosho', 'kusushi', 'kuzu', 'mikage', 'nigo', 'shakugo', 'shiden', 'shirokane', 'tempo', 'wataame']);
    expect(having('airNormals')).toEqual([...AIR_NORMAL_FIGHTERS].sort());
    expect(having('lockNearMeleeLunge')).toEqual(['taisei']);
    expect(having('quietMeleeRelease')).toEqual(['konta', 'taisei']);
    expect(having('awakenedOwnMoves')).toEqual(['koko']);
    expect(traitsOf('taisei').groundedOpeners).toBe('all');
    expect(traitsOf('oro').groundedOpeners).toEqual(['heavy']);
    expect(traitsOf('bellows')).toEqual({});
    for (const traits of Object.values(BODY_TRAITS)) expect(Object.isFrozen(traits)).toBe(true);
  });

  it("puts the move's own rules on the move: Thunder Lord's Arrow from the bow, Senpugan's palm and aim, and not Kurobi's", () => {
    expect(MOVES.shiden.ultimate.origin).toEqual({ right: .54, forward: .09, up: 2.94 });
    expect(MOVES.konta.heavy).toMatchObject({ name: 'Senpugan', palmHold: true, lockAim: true });
    expect(AWAKENED_MOVES.konta?.heavy).toMatchObject({ palmHold: undefined, lockAim: undefined });
    expect(moveFor('konta', 'heavy', true)).toMatchObject({ name: 'Homura Fang', palmHold: undefined, lockAim: undefined });
    const named = FIGHTER_IDS.flatMap(id => (['light', 'heavy', 'special', 'ultimate'] as const).filter(slot => MOVES[id][slot].palmHold || MOVES[id][slot].lockAim || MOVES[id][slot].origin).map(slot => `${id}:${slot}`));
    expect(named.sort()).toEqual(['konta:heavy', 'shiden:ultimate']);
  });

  it('leaves the simulation naming nobody in its rules', () => {
    const source = fs.readFileSync('src/game/simulation.ts', 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    const ids = FIGHTER_IDS.join('|');
    expect(source.match(new RegExp(`fighter\\s*[!=]==\\s*'(${ids})'`, 'g')) ?? []).toEqual([]);
    expect(source.match(new RegExp(`\\[\\s*'(${ids})'\\s*(,\\s*'(${ids})'\\s*)*\\]`, 'g')) ?? []).toEqual([]);
    expect(source).not.toMatch(/DRIVE_FIGHTERS|AIR_NORMAL_FIGHTERS\.includes/);
  });
});

describe('borrowed moves keep what they are (the Forge)', () => {
  const kit = (body: FighterId, slot: 'heavy' | 'ultimate', from: FighterId): ForgeKit => ({ ...ownKit(body, 'Borrower'), slots: { ...ownKit(body).slots, [slot]: { from } } });
  const duel = (body: FighterId, rival: FighterId, script: Record<number, AttackSlot>, ticks: number, meter = false) => {
    const sim = new ArenaSimulation({ trainingBot: false, seed: 11 });
    sim.addPlayer('a', body, 'A', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('b', rival, 'B', false, { x: 0, y: 0, z: 4 });
    if (meter) sim.trainingCommand('a', 'awakening');
    const events: { kind: string; actorId?: string; origin?: { y: number } }[] = [];
    const frozen: boolean[] = [];
    for (let tick = 0; tick < ticks; tick++) {
      sim.submitInput('a', { seq: tick, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack: script[tick] });
      sim.submitInput('b', { seq: tick, moveX: 0, moveZ: 0, yaw: Math.PI });
      sim.step();
      events.push(...(sim.snapshot(true).events ?? []) as typeof events);
      frozen.push(!!sim.getPlayer('b')!.timeStopped);
    }
    return { sim, events, frozen };
  };

  it("lets Thunder Lord's Arrow fly from the bow in any body", () => {
    const session = new ForgeSession();
    try {
      expect(session.apply(kit('bellows', 'ultimate', 'shiden'))).toEqual({ ok: true });
      const { events } = duel('bellows', 'tokan', { 5: 'ultimate' }, 120, true);
      const release = events.find(event => event.kind === 'release' && event.actorId === 'a');
      expect(release?.origin?.y).toBeCloseTo(2.94, 2);
    } finally { session.restore(); }
  });

  it("brings LORD ORO's tour with a borrowed THE HOUR, and the stop holds its victim", () => {
    const moves = forgeMoves(kit('bellows', 'ultimate', 'oro'));
    expect(moves.ultimate.timeStop?.tour).toEqual(TIME_STOP_TOURS.oro);
    expect(forgeMoves(ownKit('oro')).ultimate.timeStop?.tour).toBeUndefined();     // a body's own stop keeps its own table
    const session = new ForgeSession();
    try {
      session.apply(kit('bellows', 'ultimate', 'oro'));
      const { frozen } = duel('bellows', 'tokan', { 5: 'ultimate' }, 150, true);
      expect(frozen.some(Boolean)).toBe(true);
    } finally { session.restore(); }
  });

  it('keeps the palm out through a borrowed Senpugan', () => {
    expect(forgeMoves(kit('shirokane', 'heavy', 'konta')).heavy).toMatchObject({ name: 'Senpugan', palmHold: true, lockAim: true });
  });
});
