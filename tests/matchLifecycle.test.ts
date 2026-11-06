import { ROSTER_PROTOCOL } from '../src/game/rosterProtocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Deferred, type Client, type FixedTimestepCallback } from 'colyseus';
import { ArenaSimulation } from '../src/game/simulation';
import { createRapierCollision } from '../src/game/rapierCollision';
import { ArenaRoom, RECONNECTION_SECONDS } from '../src/server/ArenaRoom';
import { MIN_MATCH_FIELD } from '../src/game/moves';

const client = (sessionId: string) => ({ sessionId, send: vi.fn() } as unknown as Client);
function roomFixture() {
  const room = new ArenaRoom();
  room.simulation = new ArenaSimulation({ roomMode: 'match' });
  room.simulation.addPlayer('a'); room.simulation.addPlayer('b', 'konta');
  room.simulation.startMatch();
  Object.assign(room.simulation.actors.get('a')!.state, { x: 0, y: 0, z: 0 });
  Object.assign(room.simulation.actors.get('b')!.state, { x: 0, y: 0, z: 2 });
  return room;
}
function reserve(room: ArenaRoom) {
  const pending = new Deferred<Client>();
  const reservation = vi.spyOn(room, 'allowReconnection').mockReturnValue(pending);
  return { recover: (client: Client) => pending.resolve(client), reservation };
}
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('match admission and clean start', () => {
  it('holds waiting entrants at the canal edge without movement, hazard elimination or resource spending', async () => {
    const sim = new ArenaSimulation({ roomMode: 'match', collision: await createRapierCollision() });
    sim.addPlayer('a', 'taisei', 'Waiting entrant', false, { x: 0, y: 0, z: -26 });
    const before = sim.getPlayer('a')!;
    try {
      for (let frame = 0; frame < 1200; frame++) {
        sim.submitInput('a', { seq: frame, moveX: 0, moveZ: -1, yaw: Math.PI, dash: true, jump: true, attack: 'special' });
        sim.step();
      }
      expect(sim.snapshot().status).toBe('waiting');
      expect(sim.getPlayer('a')).toEqual(before);
      expect(sim.snapshot().events).toEqual([]);
      expect(sim.serverTime).toBeGreaterThan(19.9);
    } finally { sim.dispose(); }
  });

  it('reseats the final roster and clears pre-start state and queued edges without granting repeated resets', async () => {
    const sim = new ArenaSimulation({ roomMode: 'match', collision: await createRapierCollision() });
    try {
      for (let i = 0; i < 12; i++) sim.addPlayer(`p${i}`);
      sim.removePlayer('p3'); sim.addPlayer('replacement');
      const entrant = sim.actors.get('p0')!;
      Object.assign(entrant.state, { x: 0, y: -6, z: -35, hp: 0, alive: false, ultimate: 100, awakening: 100, kills: 3, damageDealt: 500, damageTaken: 900, stamina: 1, guarding: true, target: 'p1' });
      entrant.state.cooldowns.special = 999; entrant.vy = 20; entrant.kx = 20; entrant.stunUntil = 999;
      sim.submitInput('p0', { seq: 30, moveX: 1, moveZ: 0, yaw: 1, dash: true, jump: true, attack: 'ultimate' });
      expect(sim.startMatch()).toBe(true);
      const players = sim.snapshot().players;
      for (const p of players) {
        expect(p).toMatchObject({ alive: true, hp: 1000, stamina: 100, ultimate: 0, awakening: 0, kills: 0, damageDealt: 0, damageTaken: 0,
          y: 0, action: 'idle', target: null, guarding: false });
        expect(p.cooldowns).toEqual({ light: 0, heavy: 0, special: 0, ultimate: 0, area: 0 });
        for (const q of players) if (p.id !== q.id) expect(Math.hypot(p.x - q.x, p.z - q.z)).toBeGreaterThan(.9);
      }
      const position = { ...sim.getPlayer('p0')! };
      sim.step();
      // Allow Rapier's millimetre-scale settling; a queued dash or movement
      // edge would move the entrant by centimetres in this first tick.
      const settled = sim.getPlayer('p0')!;
      expect(Math.hypot(settled.x - position.x, settled.z - position.z)).toBeLessThan(.01);
      expect(settled.stamina).toBe(100);
      expect(sim.getPlayer('p0')!.grounded).toBe(true);
      expect(sim.snapshot().events.some(e => e.kind === 'cast' || e.kind === 'eliminated')).toBe(false);
      expect(sim.submitInput('p0', { seq: 30, moveX: 0, moveZ: 0, yaw: 0 })).toBe(false);
      expect(sim.submitInput('p0', { seq: 31, moveX: 0, moveZ: 0, yaw: 0 })).toBe(true);
      entrant.state.hp = 700;
      expect(sim.startMatch()).toBe(false);
      expect(entrant.state.hp).toBe(700);
    } finally { sim.dispose(); }
  });
});

describe('Colyseus room drop hooks — no sockets are opened', () => {
  it('reserves the same actor, clears controls and keeps it vulnerable through recovery', async () => {
    const room = roomFixture(), a = client('a'), reservation = reserve(room);
    const sim = room.simulation, original = sim.actors.get('a');
    sim.submitInput('a', { seq: 1, moveX: 1, moveZ: 0, yaw: 0, guard: true });
    const drop = room.onDrop(a);
    expect(reservation.reservation).toHaveBeenCalledWith(a, 15);
    for (let i = 0; i < 6; i++) sim.step();
    expect(sim.getPlayer('a')!.x).toBe(0);
    expect(sim.getPlayer('a')!.guarding).toBe(false);
    sim.submitInput('b', { seq: 1, moveX: 0, moveZ: 0, yaw: Math.PI, attack: 'light', targetId: 'a' });
    for (let i = 0; i < 30; i++) sim.step();
    const hurtHp = sim.getPlayer('a')!.hp;
    expect(hurtHp).toBeLessThan(1000); expect(sim.status).toBe('active');
    reservation.recover(a); await drop; room.onReconnect(a);
    expect(sim.actors.get('a')).toBe(original);
    expect(sim.getPlayer('a')!.hp).toBe(hurtHp);
    expect(a.send).toHaveBeenCalledWith('snapshot', expect.objectContaining({ status: 'active' }));
    expect(sim.submitInput('a', { seq: 2, moveX: 1, moveZ: 0, yaw: 0 })).toBe(true);
    room.onDispose();
  });

  it('retains a fighter until reservation expiry, then forfeits exactly once', async () => {
    vi.useFakeTimers();
    const room = roomFixture(), a = client('a');
    const remove = vi.spyOn(room.simulation, 'removePlayer');
    vi.spyOn(room, 'allowReconnection').mockImplementation((_client, seconds) => {
      const pending = new Deferred<Client>();
      setTimeout(() => pending.reject(new Error('expired')), Number(seconds) * 1000);
      return pending;
    });
    const drop = room.onDrop(a);
    await vi.advanceTimersByTimeAsync(RECONNECTION_SECONDS * 1000 - 1);
    expect(room.simulation.getPlayer('a')).toBeDefined(); expect(room.simulation.status).toBe('active');
    await vi.advanceTimersByTimeAsync(2); await drop;
    expect(remove).toHaveBeenCalledTimes(1);
    expect(room.simulation.getPlayer('a')).toBeUndefined();
    expect(room.simulation.snapshot()).toMatchObject({ status: 'finished', winnerId: 'b' });
    // Core 0.18 also calls onLeave after expired onDrop; no duplicate result.
    room.onLeave(a);
    expect(room.simulation.snapshot().events.filter(e => e.kind === 'winner')).toHaveLength(1);
    room.onDispose();
  });

  it('removes a consented leaver immediately without requesting a reconnect reservation', () => {
    const room = roomFixture(), reservation = vi.spyOn(room, 'allowReconnection');
    room.onLeave(client('a'));
    expect(reservation).not.toHaveBeenCalled();
    expect(room.simulation.getPlayer('a')).toBeUndefined();
    expect(room.simulation.snapshot()).toMatchObject({ status: 'finished', winnerId: 'b' });
    room.onDispose();
  });

  it('does not start a waiting match while another entrant has a reserved dropped seat', async () => {
    const room = new ArenaRoom();
    let tick!: FixedTimestepCallback, frame = 0;
    const advance = () => tick({ dt: 1 / 60, dtMs: 1000 / 60, tick: ++frame, subSteps: 1, subDt: 1 / 60, subDtMs: 1000 / 60 });
    vi.spyOn(room, 'setMetadata').mockResolvedValue(undefined);
    vi.spyOn(room, 'setFixedTimestep').mockImplementation(callback => { tick = callback; });
    vi.spyOn(room, 'broadcast').mockImplementation(() => {});
    vi.spyOn(room, 'lock').mockResolvedValue(undefined);
    await room.onCreate({rosterProtocol:ROSTER_PROTOCOL, mode: 'match' });
    const a = client('a'), b = client('b'), c = client('c');
    for (const player of [a, b, c]) { room.clients.push(player); room.onJoin(player, {rosterProtocol:ROSTER_PROTOCOL}); }
    const reservation = reserve(room);
    advance();
    room.clients.splice(room.clients.indexOf(a), 1);
    const drop = room.onDrop(a);
    for (let i = 0; i < 16 * 60; i++) advance();
    expect(room.simulation.status).toBe('waiting');
    expect(room.simulation.snapshot().players.some(p => p.isBot), 'no bots before kickoff').toBe(false);
    reservation.recover(a); await drop; room.clients.push(a); room.onReconnect(a);
    for (let i = 0; i < 16 * 60; i++) advance();
    expect(room.simulation.status).toBe('active');
    const players = room.simulation.snapshot().players;
    expect(players.filter(p => p.alive && !p.isBot)).toHaveLength(3);
    // Three humans is under the minimum field, so bots made up the numbers
    // at kickoff - and only at kickoff: none stood on the stage while the
    // room was still waiting for the dropped seat.
    expect(players.filter(p => p.isBot)).toHaveLength(MIN_MATCH_FIELD - 3);
    room.onDispose();
  });
});
