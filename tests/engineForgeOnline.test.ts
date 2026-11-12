import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Client, Room } from 'colyseus';
import { ROSTER_PROTOCOL } from '../src/game/rosterProtocol';
import { ArenaRoom, PrivateArenaRoom } from '../src/server/ArenaRoom';
import { ArenaSimulation } from '../src/game/simulation';
import { Economy } from '../src/server/economy/api';
import { RoomRewards } from '../src/server/economy/RoomRewards';
import { MOVES } from '../src/game/moves';
import type { FighterId } from '../src/game/types';
import {
  encodeForge, forgeMoves, forgedMoveFor, forgedMoves, forgetForgeKits, ownKit, rememberForgeKits, shortForgeHash, type ForgeKit,
} from '../src/engine/sim';

afterEach(() => { vi.restoreAllMocks(); forgetForgeKits(); });
const TOKEN = '01234567-89ab-cdef-0123-456789abcdef';
const kit = (body: FighterId, special: FighterId, name = 'Flame Hero'): ForgeKit => ({ ...ownKit(body, name), slots: { ...ownKit(body).slots, special: { from: special } } });

async function room<T extends ArenaRoom>(made: T, options: object) {
  const base = made as unknown as Room;
  vi.spyOn(base, 'onMessage').mockImplementation((() => () => {}) as never);
  vi.spyOn(base, 'setPrivate').mockResolvedValue(undefined); vi.spyOn(base, 'setMetadata').mockResolvedValue(undefined);
  const broadcast = vi.spyOn(base, 'broadcast').mockImplementation(() => {});
  vi.spyOn(base, 'lock').mockResolvedValue(undefined); vi.spyOn(base, 'unlock').mockResolvedValue(undefined);
  vi.spyOn(base, 'setFixedTimestep').mockImplementation(() => {});
  await (made as unknown as { onCreate(options: unknown): Promise<void> }).onCreate({ rosterProtocol: ROSTER_PROTOCOL, ...options });
  const join = (id: string, options: object = {}) => {
    const c = { sessionId: id, leave: vi.fn(), sendBytes: vi.fn(), send: vi.fn() } as unknown as Client & { send: ReturnType<typeof vi.fn> };
    made.clients.push(c); made.onJoin(c, { rosterProtocol: ROSTER_PROTOCOL, fighter: 'shirokane', name: id, creationToken: TOKEN, ...options } as never);
    return c;
  };
  return { room: made, join, broadcast };
}

// (A body of the first volume's sixteen: every other fighter is sold since 28 October 2026, and a room asks the
// account that owns them.)
describe('forged fighters in private rooms', () => {
  it('puts a checked kit in play for its player, and sends every page each kit once', async () => {
    const forged = kit('shirokane', 'taisei'), code = encodeForge(forged), hash = shortForgeHash(forged);
    const { room: r, join, broadcast } = await room(new PrivateArenaRoom(), { creationToken: TOKEN, players: 4 });
    join('host', { forge: code });
    expect(r.simulation.getPlayer('host')!.forge).toBe(hash);
    expect(broadcast).toHaveBeenCalledWith('forge-kits', { [hash]: code });
    const late = join('friend', { fighter: 'shiden' });                                   // a friend without one
    expect(late.send).toHaveBeenCalledWith('forge-kits', { [hash]: code });               // still gets every kit, once
    expect(r.simulation.getPlayer('friend')!.forge).toBeUndefined();
    expect(MOVES.shirokane.special.name).toBe('Static Decoy');                          // nothing global changed
  });

  it("refuses a kit anywhere but a private room, in another body, past the budget or damaged", async () => {
    const forged = kit('shirokane', 'taisei');
    const open = await room(new ArenaRoom(), { mode: 'match' });
    expect(() => open.join('a', { forge: encodeForge(forged) })).toThrow(/private rooms only/);
    const { join } = await room(new PrivateArenaRoom(), { creationToken: TOKEN, players: 4 });
    expect(() => join('b', { fighter: 'shiden', forge: encodeForge(forged) })).toThrow(/body it was made for/);
    const greedy: ForgeKit = { ...forged, slots: { ...forged.slots, light: { from: 'konta', tune: { power: 1.2 } }, heavy: { from: 'ippon', tune: { power: 1.2 } } } };
    expect(() => join('c', { forge: encodeForge({ ...greedy, slots: { ...greedy.slots, ultimate: { from: 'kagari', tune: { power: 1.2 } } } }) })).toThrow(/can't play/);
    expect(() => join('d', { forge: 'JF1.garbage.00000000' })).toThrow();
    expect(() => join('e', { forge: 42 })).toThrow(/isn't a Forge code/);
    expect(() => join('f', { forge: encodeForge(kit('shirokane', 'taisei', 'Official Admin')) })).toThrow(/name is not allowed/);
  });

  it('pays a forged fighter nothing for the match, and the same win unforged as before', () => {
    const settle = (forge: boolean) => {
      const e = new Economy({ dir: false }), sim = new ArenaSimulation({ roomMode: 'match' });
      try {
        const token = () => (e.hello(undefined) as unknown as { token: string }).token, a = token(), b = token(), r = new RoomRewards(() => e);
        sim.addPlayer('a', 'bellows', 'A'); sim.addPlayer('b', 'taisei', 'B');
        const forged = kit('bellows', 'taisei');
        if (forge) sim.forge('a', forgeMoves(forged), shortForgeHash(forged));
        r.bind('a', a); r.bind('b', b);
        sim.startMatch(); r.observe(sim.snapshot()); r.input('a', { seq: 1, moveX: 1, moveZ: 0, yaw: 0 });
        sim.serverTime = 35; sim.damage('b', 1e6, 'a', 'KO'); sim.step(); r.observe(sim.snapshot());
        return { reward: r.forOwner(sim.snapshot(), 'a').reward, balance: e.book.find(a)!.balance };
      } finally { sim.dispose(); e.close(); }
    };
    const plain = settle(false), forged = settle(true);
    expect(plain.reward?.settlement.total).toBeGreaterThan(0); expect(plain.balance).toBeGreaterThan(0);
    expect(forged.reward).toBeUndefined(); expect(forged.balance).toBe(0);
  });
});

describe('a forged fighter in the simulation', () => {
  const duel = (forge: boolean) => {
    const sim = new ArenaSimulation({ trainingBot: false, seed: 3 });
    sim.addPlayer('a', 'bellows', 'A', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('b', 'tokan', 'B', false, { x: 0, y: 0, z: 6 });
    const forged = kit('bellows', 'taisei');
    if (forge) expect(sim.forge('a', forgeMoves(forged), shortForgeHash(forged))).toBe(true);
    return sim;
  };
  it("throws the kit's moves for that player only, and keeps them out of the rollback checkpoint", () => {
    const sim = duel(true);
    for (let tick = 0; tick < 120; tick++) {
      sim.submitInput('a', { seq: tick, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack: tick === 2 ? 'special' : undefined });
      sim.step();
    }
    expect(sim.getPlayer('b')!.hp).toBeLessThan(sim.getPlayer('b')!.maxHp);                 // the Sunpalm Cannon landed
    const checkpoint = sim.predictionCheckpoint('a') as unknown as Record<string, unknown>;
    expect(checkpoint.forged).toBeUndefined();
    expect(JSON.stringify(checkpoint).length).toBeLessThan(JSON.stringify(sim.predictionCheckpoint('b')).length + 400);
    sim.trainingCommand('a', 'reset');
    expect(sim.getPlayer('a')!.forge).toBe(shortForgeHash(kit('bellows', 'taisei')));        // a reset keeps the kit
    expect(sim.forge('a')).toBe(true); expect(sim.getPlayer('a')!.forge).toBeUndefined();
  });
  it('leaves an unforged duel exactly as it was', () => {
    const run = () => { const sim = duel(false); for (let tick = 0; tick < 200; tick++) { sim.submitInput('a', { seq: tick, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack: tick % 40 === 2 ? 'light' : undefined }); sim.step(); } return JSON.stringify(sim.snapshot(false, true)); };
    expect(run()).toBe(run());
  });
  it('lets no bot forge', () => {
    const sim = new ArenaSimulation({ roomMode: 'match', trainingBot: false, seed: 5 });
    sim.addPlayer('bot', 'bellows', 'Bot', true);
    expect(sim.forge('bot', forgeMoves(kit('bellows', 'taisei')), 'x')).toBe(false);
  });
});

describe('every page plays a forged player by hash', () => {
  it('keeps only valid kits that hash to their names, and plays their slots', () => {
    const forged = kit('bellows', 'taisei'), hash = shortForgeHash(forged), code = encodeForge(forged);
    expect(rememberForgeKits({ [hash]: code, bogus: code, [`${hash.slice(0, 15)}0`]: code, other: 'JF1.x.y' })).toBe(1);
    expect(forgedMoves(hash)?.special.name).toBe('Sunpalm Cannon');
    const state = { fighter: 'bellows' as FighterId, forge: hash, awakened: false };
    expect(forgedMoveFor({ ...state, action: 'special' })?.name).toBe('Sunpalm Cannon');
    expect(forgedMoveFor({ ...state, action: 'light', chain: 0 })?.name).toBe(MOVES.bellows.light.name);
    expect(forgedMoveFor({ ...state, action: 'light', chain: 1 })).toBeUndefined();         // later rush stages: the body's
    expect(forgedMoveFor({ ...state, action: 'run' })).toBeUndefined();
    expect(forgedMoveFor({ fighter: 'bellows', action: 'special' })).toBeUndefined();       // not forged
    expect(rememberForgeKits({ [hash]: code })).toBe(0);                                       // once
  });
});
