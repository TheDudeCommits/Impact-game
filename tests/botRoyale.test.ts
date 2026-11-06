import { ROSTER_PROTOCOL } from '../src/game/rosterProtocol';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Client, FixedTimestepCallback } from 'colyseus';
import { BotArenaRoom, BOT_ROYALE_SIZES } from '../src/server/ArenaRoom';
import { ArenaSimulation } from '../src/game/simulation';
import { createRapierCollision } from '../src/game/rapierCollision';

const client = (sessionId: string) => ({ sessionId, send: vi.fn() } as unknown as Client);
afterEach(() => vi.restoreAllMocks());

async function royale(players: number | string) {
  const room = new BotArenaRoom();
  let tick!: FixedTimestepCallback, frame = 0;
  vi.spyOn(room, 'setPrivate').mockResolvedValue(undefined);
  vi.spyOn(room, 'setMetadata').mockResolvedValue(undefined);
  vi.spyOn(room, 'broadcast').mockImplementation(() => {});
  vi.spyOn(room, 'lock').mockResolvedValue(undefined);
  vi.spyOn(room, 'setFixedTimestep').mockImplementation(callback => { tick = callback; });
  await room.onCreate({rosterProtocol:ROSTER_PROTOCOL, players: players as number });
  const advance = (n = 1) => { for (let i = 0; i < n; i++) tick({ dt: 1 / 60, dtMs: 1000 / 60, tick: ++frame, subSteps: 1, subDt: 1 / 60, subDtMs: 1 / 60 * 1000 }); };
  const join = (id: string, fighter = 'taisei') => {
    const c = client(id); room.clients.push(c);
    room.onJoin(c, {rosterProtocol:ROSTER_PROTOCOL, fighter: fighter as 'taisei', name: 'Owner' });
    return c;
  };
  return { room, advance, join };
}

describe('a battle royale you can play on your own', () => {
  it('fills every offered roster size with bots and starts by itself', async () => {
    for (const size of BOT_ROYALE_SIZES) {
      const { room, join, advance } = await royale(size);
      try {
        join('owner');
        const players = room.simulation.snapshot().players;
        expect(players.length, `${size} fighters means ${size} bodies`).toBe(size);
        expect(players.filter(p => p.isBot).length).toBe(size - 1);
        // One human seat, and the room is hidden: nobody joins your royale.
        expect(room.maxClients).toBe(1);
        expect(room.setPrivate).toHaveBeenCalledWith(true);
        expect(room.simulation.status).toBe('waiting');
        // Spread out, not stacked on one spawn - read on the tick the match
        // goes live, before anybody has taken a step toward anybody else.
        // This used to be read a second into the fight, when two bots who
        // had drawn neighbouring seats could already be inside two metres.
        for (let i = 0; i < 5 * 60 && room.simulation.status === 'waiting'; i++) advance();
        expect(room.simulation.status, 'nobody to wait for').toBe('active');
        const spawned = room.simulation.snapshot().players;
        const pairs = spawned.flatMap((p, i) => spawned.slice(i + 1).map(q => Math.hypot(p.x - q.x, p.z - q.z)));
        expect(Math.min(...pairs)).toBeGreaterThan(2);
        advance(60);
        expect(room.simulation.status).toBe('active');
      } finally { room.onDispose(); }
    }
  });

  it('refuses a roster size it never offered', async () => {
    const { room, join } = await royale(99);
    try {
      join('owner');
      expect(room.simulation.snapshot().players.length).toBe(BOT_ROYALE_SIZES[0]);
    } finally { room.onDispose(); }
  });

  it('draws a field of different fighters', async () => {
    const { room, join } = await royale(8);
    try {
      join('owner', 'kenzo');
      const fighters = room.simulation.snapshot().players.filter(p => p.isBot).map(p => p.fighter);
      expect(new Set(fighters).size, 'eight of the same fighter is not a royale').toBeGreaterThanOrEqual(6);
      expect(fighters, "and not a mirror of the player's own pick").not.toContain('kenzo');
    } finally { room.onDispose(); }
  });
});

describe('bots in a royale fight each other', () => {
  const field = (count: number) => {
    // Seeded: the default stream is drawn from the clock now, and a test
    // about bots pressing buttons should not depend on which clock it ran on.
    const sim = new ArenaSimulation({ roomMode: 'match', stage: 'proving-hall', seed: 11 });
    sim.addPlayer('owner', 'taisei', 'Owner');
    for (let i = 0; i < count; i++) sim.addPlayer('bot-' + i, (['konta', 'gummy', 'kenzo', 'shiden'] as const)[i % 4], 'Bot', true);
    sim.startMatch();
    return sim;
  };

  it('hurts someone without a human ever pressing a button', () => {
    const sim = field(5);
    for (let i = 0; i < 60 * 25; i++) sim.step();
    const bots = sim.snapshot().players.filter(p => p.isBot);
    expect(bots.some(p => p.hp < 1000 || !p.alive), 'they are each other\'s opponents now').toBe(true);
  });

  it('has no storm: a fighter waiting at the edge keeps every point of health', () => {
    const sim = new ArenaSimulation({ roomMode: 'match', stage: 'mirror-mere', seed: 3 });
    try {
      sim.addPlayer('a', 'taisei'); sim.addPlayer('b', 'konta'); sim.addPlayer('c', 'gummy');
      sim.startMatch();
      sim.place('a', { x: sim.bounds.halfX - 1, y: 0, z: sim.bounds.halfZ - 1 });
      // Two minutes: the old ring started biting at one.
      for (let i = 0; i < 60 * 120; i++) sim.step();
      const a = sim.getPlayer('a')!;
      expect(a.alive).toBe(true);
      expect(a.hp).toBe(a.maxHp);
      expect('ring' in sim.snapshot(), 'nothing on the wire about a ring').toBe(false);
    } finally { sim.dispose(); }
  });

  it('hunts a fighter nobody is fighting, and the royale ends', async () => {
    const collision = await createRapierCollision('mirror-mere');
    const sim = new ArenaSimulation({ roomMode: 'match', stage: 'mirror-mere', seed: 7, collision });
    try {
      sim.addPlayer('me', 'taisei', 'Me');
      const field = ['konta', 'gummy', 'kenzo', 'shiden', 'nigo', 'ouga', 'shirokane'] as const;
      field.forEach((f, i) => sim.addPlayer('bot-' + i, f, 'Bot', true));
      sim.startMatch();
      // Off in a corner, out of everybody's way, and never pressing a button:
      // nobody's nearest, so before the hunt nobody came.
      sim.place('me', { x: sim.bounds.halfX - 2, y: 0, z: sim.bounds.halfZ - 2 });
      const max = sim.getPlayer('me')!.maxHp;
      let firstBlow = Infinity, t = 0;
      for (; t < 60 * 300 && sim.status === 'active'; t++) {
        sim.step();
        if (firstBlow === Infinity && sim.getPlayer('me')!.hp < max) firstBlow = t / 60;
      }
      expect(firstBlow, 'somebody came for the quiet one').toBeLessThan(HUNT_BY);
      expect(sim.status, 'and the last one standing won it').toBe('finished');
    } finally { sim.dispose(); }
  }, 120_000);
});

/** Quiet for twelve seconds is hunted (HUNT_QUIET), or for twenty-four by a
 *  bot already in a fight (HUNT_ANYWAY); seeds 7-11 measured 27-29 s to the
 *  first blow on the corner, and 71-91 s to the royale's end. */
const HUNT_BY = 35;
