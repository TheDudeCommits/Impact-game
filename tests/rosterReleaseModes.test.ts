import { afterEach, describe, expect, it } from 'vitest';
import { LocalTraining } from '../src/network';
import { LocalDuel } from '../src/game/duel/LocalDuel';
import { LocalRoyale } from '../src/game/LocalRoyale';
import { LocalObjective } from '../src/game/objectives/LocalObjective';
import { LocalRift } from '../src/game/moba/LocalRift';
import { LocalArena } from '../src/survival/LocalArena';
import { mayPlay, lockedOut } from '../src/game/economy/fighters';
import { factionOf } from '../src/game/objectives/model';
import type { GameSnapshot } from '../src/game/types';
import { fighterShown } from '../src/originals/launch';
import type { FighterId } from '../src/game/types';
import { ORIGINALS } from '../src/originals/roster';

const rooms: { leave(): Promise<void> }[] = [];
afterEach(async () => { for (const room of rooms.splice(0)) await room.leave(); });
function own<T extends { leave(): Promise<void> }>(room: T): T { rooms.push(room); return room; }
function advance(room: { send(input: { seq: number; moveX: number; moveZ: number; yaw: number }): unknown; snapshot: GameSnapshot | null; id: string }, fighter: string) {
  for (let seq = 1; seq <= 240; seq++) room.send({ seq, moveX: 0, moveZ: 1, yaw: 0 });
  const player = room.snapshot?.players.find(p => p.id === room.id);
  expect(player?.fighter).toBe(fighter);
  expect(Number.isFinite(player?.x)).toBe(true);
  expect(Number.isFinite(player?.hp)).toBe(true);
}

describe.each(['shanxiao', 'ampere', 'pyroclast', 'full-beam', 'tancho', 'bellows', 'akaito', 'mikage', 'tempo', 'shijima', 'senko', 'adad', 'buna', 'strappado', 'tokan', 'hikui', 'ume', 'lanthorn', 'highsun', 'torsion', 'kubiwa', 'onigawara', 'minase', 'shakudo', 'amagoi', 'hinomoto', 'shidare', 'irbis', 'shibuichi', 'rakucho', 'hisame', 'mizuhiki', 'bonsho', 'akayuri', 'madake', 'psyche', 'rotfalke', 'kinu', 'hawser', 'murex', 'hagure', 'ovid', 'yodaka', 'tsubute', 'aqrab', 'chohan', 'cardo', 'bruin', 'aquilo', 'svanhild'] as const)('%s production mode admission', fighter => {
  it('is played without a laboratory URL once the account owns them, and locked until then', () => {
    if (!fighterShown(fighter)) {
      for (const owner of [{ items: { [`fighter-${fighter}`]: { at: 0 } } }, undefined]) {
        expect(mayPlay(fighter, owner)).toBe(false);
        expect(lockedOut(fighter, owner)).toMatch(new RegExp(`^${(ORIGINALS[fighter as FighterId]?.name ?? 'This fighter').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} is not out yet\\.`));
      }
      return;
    }
    expect(mayPlay(fighter, { items: { [`fighter-${fighter}`]: { at: 0 } } })).toBe(true);
    expect(lockedOut(fighter, { items: { [`fighter-${fighter}`]: { at: 0 } } })).toBeUndefined();
    expect(mayPlay(fighter, undefined)).toBe(false);
    expect(lockedOut(fighter, undefined)).toMatch(/is locked: unlock them in Account/);
  });
  it('starts normal Training, Duel and Battle Royale with the actual kit', async () => {
    const training = own(new LocalTraining()); await training.connect(fighter, 'Release QA'); advance(training, fighter);
    const duel = own(new LocalDuel()); await duel.connect(fighter, 'Release QA', fighter === 'ampere' ? 'shanxiao' : 'ampere'); advance(duel, fighter);
    expect(duel.snapshot?.players).toHaveLength(2);
    const royale = own(new LocalRoyale()); await royale.connect(fighter, 'Release QA', 4); advance(royale, fighter);
    expect(royale.snapshot?.players).toHaveLength(4);
  });
  it.each(['last-stand', 'bad-blood'] as const)('starts %s with a valid faction and steps the real simulation', async kind => {
    const room = own(new LocalObjective()); await room.connect(fighter, 'Release QA', kind, 'bots'); advance(room, fighter);
    expect(room.match?.seats.get(room.id)?.fighter).toBe(fighter);
    if (kind === 'bad-blood') expect(room.match?.seats.get(room.id)?.team).toBe(factionOf(fighter));
  });
  it('starts Rift War on its own faction and fills all ten seats', async () => {
    const room = own(new LocalRift()); await room.connect(fighter, 'Release QA'); advance(room, fighter);
    expect(room.match?.seats.get(room.id)?.team).toBe(factionOf(fighter));
    expect(room.match?.seats.size).toBe(10);
  });
  it('starts Arcade Survival through the normal offline entry', async () => {
    const room = own(new LocalArena()); await room.connect(fighter, 'match', 'Release QA', { seed: 441, wave: 1 }); advance(room, fighter);
    expect(room.game).not.toBeNull();
  });
});
