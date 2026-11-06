import { afterEach, describe, expect, it, vi } from 'vitest';
import { Packr } from 'msgpackr';
import type { Client, FixedTimestepCallback } from 'colyseus';
import { ArenaSimulation } from '../src/game/simulation';
import { ROSTER_PROTOCOL } from '../src/game/rosterProtocol';
import { PrivateArenaRoom } from '../src/server/ArenaRoom';
import { makeDriver, seeded } from '../scripts/lib/driver';
import type { GameSnapshot } from '../src/game/types';

const wire = new Packr({ useRecords: false });
// (The simulation's own fields are private; the test reads them as a plain bag, as the harnesses do.)
type Sim = Omit<ArenaSimulation, 'actors' | 'projectiles'> & { actors: Map<string, any>; projectiles: any[] };
/** The build as it was before tonight. */
function legacy(self: Sim, id: string) {
  const actor = self.actors.get(id); if (!actor) return;
  const { state: _state, cast, forged: _forged, ...rest } = actor;
  const groups = new Map<Map<string, number>, number>();
  const opened = (map: Map<string, number>) => { if (!groups.has(map)) groups.set(map, groups.size); return { opened: [...map], openedGroup: groups.get(map)! }; };
  return structuredClone({ ...rest, cast: cast ? { ...cast, ...opened(cast.opened) } : null, shots: self.projectiles.filter(p => p.actorId === id).map(p => ({ ...p, ...opened(p.opened) })) });
}
const bytes = (value: unknown) => Buffer.from(wire.pack(value) as Uint8Array);
/** The three agree: same object, same bytes, same decode. */
function same(label: string, now: unknown, before: unknown) {
  expect(now, `${label}: object`).toStrictEqual(before);
  const a = bytes(now), b = bytes(before);
  expect(a.equals(b), `${label}: msgpack bytes`).toBe(true);
  expect(wire.unpack(a), `${label}: decoded`).toStrictEqual(wire.unpack(b));
}

describe('the design checkpoint, built in one pass', () => {
  it('is the same object, bytes and decode as the old build, detached or shared, through a twelve-fighter fight', () => {
    const sim = new ArenaSimulation({ seed: 7, trainingBot: false, roomMode: 'match' } as never) as unknown as Sim;
    const roster = ['taisei', 'konta', 'gummy', 'kenzo', 'kosho', 'ouga', 'shirokane', 'shiden', 'koko', 'nigo', 'kagari', 'ward'] as const;
    const ids = roster.map((fighter, i) => { const id = `P${i}`; sim.addPlayer(id, fighter, `P${i}`, false, { x: Math.cos(i / 12 * Math.PI * 2) * 6, y: 0, z: Math.sin(i / 12 * Math.PI * 2) * 6 }); return id; });
    const drivers = ids.map((_, i) => makeDriver(i, 'fight', seeded(31 + i)));
    sim.startMatch();
    let snapshot: GameSnapshot = sim.snapshot(), samples = 0, casting = 0, projectiles = 0;
    for (let tick = 0; tick < 60 * 10; tick++) {
      ids.forEach((id, i) => { if (sim.getPlayer(id)?.alive) sim.submitInput(id, drivers[i].next(snapshot, id, sim.serverTime * 1000, null)); });
      sim.step();
      if (tick % 2 === 0) snapshot = sim.snapshot(true);
      if (tick % 5 === 0) for (const id of ids) {
        const before = legacy(sim, id);
        same(`detached ${id}@${tick}`, sim.predictionCheckpoint(id), before);
        same(`shared ${id}@${tick}`, sim.predictionCheckpoint(id, true), before);
        samples++; if (sim.actors.get(id)?.cast) casting++; projectiles += sim.projectiles.length;
      }
    }
    // The fight must have been a fight, or the comparison proves little.
    expect(samples).toBeGreaterThan(1000);
    expect(casting).toBeGreaterThan(50);
  }, 120_000);
  it('shares the cast and arrow bookkeeping the same way: one group per opened map, a dead fighter has none', () => {
    const sim = new ArenaSimulation({ seed: 3, trainingBot: false } as never) as unknown as Sim;
    sim.addPlayer('a', 'taisei', 'A', false, { x: 0, y: 0, z: 0 }); sim.addPlayer('b', 'gummy', 'B', false, { x: 0, y: 0, z: 3 });
    const map = new Map<string, number>([['b', 2], ['c', 5]]), other = new Map<string, number>([['x', 1]]);
    sim.projectiles.push({ actorId: 'a', opened: map, x: 1, y: 1, z: 1, vx: 0, vy: 0, vz: 1 }, { actorId: 'a', opened: map, x: 2, y: 1, z: 2, vx: 0, vy: 0, vz: 1 }, { actorId: 'a', opened: other, x: 3, y: 1, z: 3 }, { actorId: 'b', opened: new Map(), x: 4 });
    const noCast = sim.predictionCheckpoint('a', true)!;
    same('shots', noCast, legacy(sim, 'a'));
    expect(noCast.shots.map(shot => shot.openedGroup)).toEqual([0, 0, 1]);
    expect(sim.predictionCheckpoint('nobody', true)).toBeUndefined();
    expect(sim.predictionCheckpoint('nobody')).toBeUndefined();
    // The detached one is a copy: stepping afterwards does not move it. The shared one is the live thing, which is why only the send path takes it.
    const detached = sim.predictionCheckpoint('a')!, shared = sim.predictionCheckpoint('a', true)!;
    const x = sim.actors.get('a').kx;
    sim.actors.get('a').kx = x + 5;
    expect(detached.kx).toBe(x);
    expect(shared.kx).toBe(x);          // (a number is copied by value either way; the nested objects are what a shared checkpoint aliases)
    expect(detached.input).not.toBe(sim.actors.get('a').input);
  });
});

describe('what the server sends its owner', () => {
  const client = (sessionId: string, sent: { type: string; payload: any }[]) => ({ sessionId, send: vi.fn((type: string, payload: unknown) => { sent.push({ type, payload }); }) } as unknown as Client);
  afterEach(() => vi.restoreAllMocks());
  it('decodes to exactly what it decoded to before, snapshot after snapshot, for every human of a room', async () => {
    const room = new PrivateArenaRoom();
    let step!: FixedTimestepCallback, frame = 0;
    vi.spyOn(room, 'setPrivate').mockResolvedValue(undefined); vi.spyOn(room, 'setMetadata').mockResolvedValue(undefined);
    vi.spyOn(room, 'broadcast').mockImplementation(() => {}); vi.spyOn(room, 'lock').mockResolvedValue(undefined);
    vi.spyOn(room, 'setFixedTimestep').mockImplementation(callback => { step = callback; });
    await room.onCreate({ rosterProtocol: ROSTER_PROTOCOL, mode: 'match', creationToken: '01234567-89ab-cdef-0123-456789abcdef', players: 8 });
    const sent: { type: string; payload: any }[] = [];
    const humans = ['h0', 'h1', 'h2'].map((id, i) => {
      const c = client(id, sent);
      room.clients.push(c);
      room.onJoin(c, { rosterProtocol: ROSTER_PROTOCOL, code: room.snapshot().lobby!.code!, fighter: (['taisei', 'kenzo', 'kosho'] as const)[i], name: id });
      return { id, driver: makeDriver(i, 'fight', seeded(5 + i)) };
    });
    room.requestPrivateStart(room.clients[0]);
    const queues = (room as unknown as { inputQueues: Map<string, { push(raw: unknown): boolean }> }).inputQueues;
    const latest = new Map<string, GameSnapshot>();
    let compared = 0, withCast = 0;
    const unsent = sent.splice(0);   // (the join's own snapshots are kept below)
    for (const { type, payload } of unsent) if (type === 'snapshot') latest.set(payload.players[0].id, payload);
    // Every snapshot a human is sent is compared, at the moment it is sent, with the oracle on the same state: nothing steps in between.
    const sim = () => (room as unknown as { simulation: Sim }).simulation;
    for (const c of room.clients) {
      const send = (c as unknown as { send: ReturnType<typeof vi.fn> }).send;
      const real = send.getMockImplementation()! as (type: string, payload: unknown) => void;
      send.mockImplementation((type: string, payload: any) => {
        real(type, payload);
        if (type === 'snapshot' || type === 'input-resync') {
          const mine = payload.prediction?.[c.sessionId];
          if (mine) {
            const before = legacy(sim(), c.sessionId);
            same(`${c.sessionId}@${sim().tick}`, mine, before);
            // The whole message, as the page receives it: packed and unpacked, the checkpoint the same as the old build's.
            const received = wire.unpack(bytes(payload));
            expect(received.prediction[c.sessionId]).toStrictEqual(wire.unpack(bytes(before)));
            compared++; if (mine.cast) withCast++;
          }
          latest.set(c.sessionId, payload);
        }
      });
    }
    for (let i = 0; i < 60 * 25; i++) {
      for (const { id, driver } of humans) { const view = latest.get(id); if (view) queues.get(id)?.push(driver.next(view, id, sim().serverTime * 1000, null)); }
      step({ dt: 1 / 60, dtMs: 1000 / 60, tick: ++frame, subSteps: 1, subDt: 1 / 60, subDtMs: 1000 / 60 });
    }
    expect(sim().status).toBe('active');
    expect(compared).toBeGreaterThan(500);
    expect(withCast).toBeGreaterThan(20);
    room.onDispose();
  }, 120_000);
});
