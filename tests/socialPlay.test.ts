import { ROSTER_PROTOCOL } from '../src/game/rosterProtocol';
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Client, FixedTimestepCallback } from 'colyseus';
import { EmoteRelay, EMOTE_GAP_MS, SOCIAL_PROTOCOL } from '../src/server/social/EmoteRelay';
import { RivalryBook, setRivalries, type Rivalries, type Record2 } from '../src/server/social/Rivalries';
import { RivalryWatch, decided } from '../src/server/social/RivalryWatch';
import { DuelRoom, PrivateArenaRoom } from '../src/server/ArenaRoom';
import { ITEMS } from '../src/game/economy/catalog';
import type { GameSnapshot } from '../src/game/types';

afterEach(() => { vi.restoreAllMocks(); setRivalries(undefined); });

const emote = ITEMS.findIndex(item => item.kind === 'emote'), other = ITEMS.findIndex((item, i) => item.kind === 'emote' && i !== emote);
const notEmote = ITEMS.findIndex(item => item.kind !== 'emote');
/** An economy whose accounts are named by their token, wearing `wheel`. */
const economy = (wheel: string[]) => () => ({ book: { find: (token: unknown) => typeof token === 'string' ? { pk: `pk-${token}`, worn: { emotes: wheel } } as never : undefined, completions: { get: () => undefined } }, complete: () => undefined });
const fakeRoom = () => {
  const handlers = new Map<string, (client: Client, message?: unknown) => void>();
  const clients: (Client & { send: ReturnType<typeof vi.fn> })[] = [];
  return { handlers, clients, onMessage: (type: string, run: (client: Client, message?: unknown) => void) => { handlers.set(type, run); return () => {}; } };
};
const client = (sessionId: string) => ({ sessionId, send: vi.fn() } as unknown as Client & { send: ReturnType<typeof vi.fn> });

describe('emotes in every room (EmoteRelay)', () => {
  it("passes an emote on the sender's wheel to the other pages that listen, once a second", () => {
    let now = 10_000;
    const room = fakeRoom(), relay = new EmoteRelay(room as never, economy([ITEMS[emote].id]), () => now);
    const a = client('a'), b = client('b'), old = client('old');
    room.clients.push(a, b, old);
    room.handlers.get('social')!(a); room.handlers.get('social')!(b);
    relay.bind('a', 'tok-a');
    room.handlers.get('emote')!(a, emote);
    expect(b.send).toHaveBeenCalledWith('emote', { id: 'a', place: emote });
    // Never back to the sender, and never to a page that did not say it listens (an old page warns for every message).
    expect(a.send).not.toHaveBeenCalled(); expect(old.send).not.toHaveBeenCalled();
    // Too soon, then after the gap.
    expect(relay.relay(a, emote)).toBe(false);
    now += EMOTE_GAP_MS; expect(relay.relay(a, emote)).toBe(true);
    expect(b.send).toHaveBeenCalledTimes(2);
  });
  it('refuses what is not an emote, not on the wheel, or from a seat with no account', () => {
    let now = 0;
    const room = fakeRoom(), relay = new EmoteRelay(room as never, economy([ITEMS[emote].id]), () => (now += 5000));
    const a = client('a'), b = client('b'); room.clients.push(a, b); room.handlers.get('social')!(b);
    expect(relay.relay(a, emote)).toBe(false);                 // no account bound yet
    relay.bind('a', 'tok-a');
    for (const bad of [notEmote, other, -1, 1.5, '3', null, ITEMS.length]) expect(relay.relay(a, bad)).toBe(false);
    expect(relay.relay(a, emote)).toBe(true);
    relay.leave('b'); expect(relay.relay(a, emote)).toBe(true); expect(b.send).toHaveBeenCalledTimes(1);
  });
  it("is said in every versus and team room's welcome", async () => {
    const room = new DuelRoom(); let tick!: FixedTimestepCallback;
    vi.spyOn(room, 'setMetadata').mockResolvedValue(undefined); vi.spyOn(room, 'setFixedTimestep').mockImplementation(c => { tick = c; });
    await room.onCreate({ rosterProtocol: ROSTER_PROTOCOL });
    try { const c = client('a'); room.clients.push(c); room.onJoin(c, { rosterProtocol: ROSTER_PROTOCOL, fighter: 'taisei' }); expect(c.send).toHaveBeenCalledWith('welcome', expect.objectContaining({ social: SOCIAL_PROTOCOL })); void tick; }
    finally { room.onDispose(); }
    const source = (file: string) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    for (const file of ['src/server/objectives/ObjectiveRoom.ts', 'src/server/moba/RiftRoom.ts']) expect(source(file)).toMatch(/send\('welcome',\{[^}]*social:SOCIAL_PROTOCOL\}/);
  });
});

describe('rivalries (RivalryBook)', () => {
  it('counts each pair from both sides, survives a restart, and folds a long file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rivals-'));
    try {
      const book = new RivalryBook(dir);
      book.record('amir', 'sam', 'duel'); book.record('amir', 'sam', 'duel'); book.record('sam', 'amir', 'private');
      expect(book.between('amir', 'sam')).toEqual([2, 1]); expect(book.between('sam', 'amir')).toEqual([1, 2]);
      expect(book.between('amir', 'nobody')).toEqual([0, 0]);
      book.record('amir', 'amir'); book.record('', 'x'); book.record(42, 'x');
      expect(book.size).toBe(1);
      const again = new RivalryBook(dir); expect(again.between('sam', 'amir')).toEqual([1, 2]);
      // A torn last line (a crash mid-write) loses only itself.
      fs.appendFileSync(path.join(dir, 'rivals.jsonl'), '{"w":"amir","l":');
      expect(new RivalryBook(dir).between('amir', 'sam')).toEqual([2, 1]);
      // Folded once it has many more lines than pairs: a line a pair, the same records.
      const file = path.join(dir, 'rivals.jsonl');
      fs.writeFileSync(file, Array.from({ length: 20_010 }, (_, i) => JSON.stringify({ w: i % 3 ? 'amir' : 'sam', l: i % 3 ? 'sam' : 'amir', at: i })).join('\n') + '\n');
      const folded = new RivalryBook(dir);
      expect(folded.between('amir', 'sam')).toEqual([13_340, 6_670]);
      expect(fs.readFileSync(file, 'utf8').trim().split('\n')).toHaveLength(1);
      expect(new RivalryBook(dir).between('amir', 'sam')).toEqual([13_340, 6_670]);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});

const fighter = 'taisei' as const;
const duelSnap = (over: Partial<GameSnapshot['duel']> & object, players = ['a', 'b']) => ({ roomMode: 'match', status: 'finished', serverTime: 1, events: [], stage: 'harbor',
  players: players.map(id => ({ id, fighter, isBot: id.startsWith('bot') })), duel: { set: 1, round: 2, firstTo: 2, scores: { a: 2, b: 0 }, phase: 'complete', nextRoundAt: null, roundWinner: 'a', winner: 'a', runback: [], ...over } }) as unknown as GameSnapshot;
const royaleSnap = (winnerId: string | null, players = ['a', 'b', 'c', 'bot-1'], status = 'finished') => ({ roomMode: 'match', status, serverTime: 1, events: [], stage: 'harbor', winnerId,
  players: players.map(id => ({ id, fighter, isBot: id.startsWith('bot') })) }) as unknown as GameSnapshot;

describe('rivalries in a room (RivalryWatch)', () => {
  it('decides a Duel won on rounds and a friends royale won by a player, and nothing else', () => {
    expect(decided(duelSnap({}))).toEqual({ winner: 'a', losers: ['b'] });
    expect(decided(duelSnap({ phase: 'interval' }))).toBeUndefined();
    // A rival who left (DuelSet.forfeit) is not beaten: the set was not won on rounds.
    expect(decided(duelSnap({ scores: { a: 1, b: 0 } }, ['a']))).toBeUndefined();
    expect(decided(royaleSnap('a'))).toEqual({ winner: 'a', losers: ['b', 'c'] });
    expect(decided(royaleSnap('bot-1'))).toBeUndefined();
    expect(decided(royaleSnap(null))).toBeUndefined();
    expect(decided(royaleSnap('a', ['a', 'bot-1']))).toBeUndefined();
    expect(decided(royaleSnap('a', undefined, 'active'))).toBeUndefined();
  });
  it('asks once a pair, records a decided match once, and gives each page its own lines', async () => {
    const book = new RivalryBook(), service: Rivalries = { record: vi.fn((w, l, m) => book.record(w, l, m)), between: vi.fn(async (a: string, b: string) => book.between(a, b) as Record2) };
    book.record('pk-a', 'pk-b'); book.record('pk-b', 'pk-a'); book.record('pk-b', 'pk-a');
    const watch = new RivalryWatch('duel', () => service, economy([]));
    watch.bind('a', 'a'); watch.bind('b', 'b');
    const waiting = { ...duelSnap({ phase: 'interval', winner: null }), status: 'waiting' } as GameSnapshot;
    watch.observe(waiting, 'm1'); watch.observe(waiting, 'm1');
    expect(service.between).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(watch.forOwner(waiting, 'a').rivals).toEqual([{ id: 'b', won: 1, lost: 2 }]);
    expect(watch.forOwner(waiting, 'b').rivals).toEqual([{ id: 'a', won: 2, lost: 1 }]);
    // Not during the fight.
    expect(watch.forOwner({ ...waiting, status: 'active' }, 'a').rivals).toBeUndefined();
    const over = duelSnap({});
    watch.observe(over, 'm1'); watch.observe(over, 'm1');
    expect(service.record).toHaveBeenCalledTimes(1); expect(service.record).toHaveBeenCalledWith('pk-a', 'pk-b', 'duel');
    // Counted at once: the results already say 2–2.
    expect(watch.forOwner(over, 'a').rivals).toEqual([{ id: 'b', won: 2, lost: 2 }]);
    expect(book.between('pk-a', 'pk-b')).toEqual([2, 2]);
    // A runback's set is another match.
    watch.observe(over, 'm2'); expect(book.between('pk-a', 'pk-b')).toEqual([3, 2]);
  });
  it('is kept by a Duel room at its set and by a friends room, never by a public royale', async () => {
    const book = new RivalryBook();
    setRivalries({ record: (w, l, m) => book.record(w, l, m), between: async (a, b) => book.between(a, b) });
    const room = new PrivateArenaRoom(); let tick!: FixedTimestepCallback, frame = 0;
    vi.spyOn(room, 'setPrivate').mockResolvedValue(undefined); vi.spyOn(room, 'setMetadata').mockResolvedValue(undefined);
    vi.spyOn(room, 'broadcast').mockImplementation(() => {}); vi.spyOn(room, 'lock').mockResolvedValue(undefined);
    vi.spyOn(room, 'setFixedTimestep').mockImplementation(c => { tick = c; });
    await room.onCreate({ rosterProtocol: ROSTER_PROTOCOL, creationToken: '01234567-89ab-cdef-0123-456789abcdef', players: 2 });
    try {
      // (No economy is mounted here: the watch is told the accounts directly, as `account` would.)
      const watch = (room as unknown as { rivals: RivalryWatch }).rivals; expect(watch).toBeInstanceOf(RivalryWatch);
      (watch as unknown as { economy: unknown }).economy = economy([]);
      const host = client('host'), guest = client('guest');
      for (const c of [host, guest]) { room.clients.push(c); room.onJoin(c, { rosterProtocol: ROSTER_PROTOCOL, code: room.snapshot().lobby!.code, fighter, account: c.sessionId }); }
      const advance = (n = 1) => { for (let i = 0; i < n; i++) tick({ dt: 1 / 60, dtMs: 1000 / 60, tick: ++frame, subSteps: 1, subDt: 1 / 60, subDtMs: 1000 / 60 }); };
      // The pair's record is asked for as they meet in the lobby (an answer over the cluster's link comes later).
      advance(3); await Promise.resolve();
      room.requestPrivateStart(host);
      advance(3 * 60 + 2); expect(room.simulation.status).toBe('active');
      room.simulation.actors.get('guest')!.state.hp = 0; room.simulation.actors.get('guest')!.state.alive = false;
      advance(4);
      expect(room.simulation.status).toBe('finished');
      expect(book.between('pk-host', 'pk-guest')).toEqual([1, 0]);
      const last = host.send.mock.calls.filter(([type]) => type === 'snapshot').at(-1)![1] as GameSnapshot;
      expect(last.rivals).toEqual([{ id: 'guest', won: 1, lost: 0 }]);
    } finally { room.onDispose(); }
    const pub = new DuelRoom(); vi.spyOn(pub, 'setMetadata').mockResolvedValue(undefined); vi.spyOn(pub, 'setFixedTimestep').mockImplementation(() => {});
    await pub.onCreate({ rosterProtocol: ROSTER_PROTOCOL });
    try { expect((pub as unknown as { rivals?: RivalryWatch }).rivals).toBeInstanceOf(RivalryWatch); } finally { pub.onDispose(); }
  });
});

describe("a friends' royale's next match in the same room (RoomAgain)", () => {
  it('shows who is in, lets the host start it with them, and lets the rest leave with their results', async () => {
    const room = new PrivateArenaRoom(); let tick!: FixedTimestepCallback, frame = 0;
    vi.spyOn(room, 'setPrivate').mockResolvedValue(undefined); vi.spyOn(room, 'setMetadata').mockResolvedValue(undefined);
    vi.spyOn(room, 'broadcast').mockImplementation(() => {}); vi.spyOn(room, 'lock').mockResolvedValue(undefined); const unlock = vi.spyOn(room, 'unlock').mockResolvedValue(undefined);
    vi.spyOn(room, 'setFixedTimestep').mockImplementation(c => { tick = c; });
    await room.onCreate({ rosterProtocol: ROSTER_PROTOCOL, creationToken: '01234567-89ab-cdef-0123-456789abcdef', players: 4 });
    const advance = (n = 1) => { for (let i = 0; i < n; i++) tick({ dt: 1 / 60, dtMs: 1000 / 60, tick: ++frame, subSteps: 1, subDt: 1 / 60, subDtMs: 1000 / 60 }); };
    const join = (id: string) => { const c = { ...client(id), leave: vi.fn() } as Client & { send: ReturnType<typeof vi.fn>; leave: ReturnType<typeof vi.fn> }; room.clients.push(c); room.onJoin(c, { rosterProtocol: ROSTER_PROTOCOL, code: room.snapshot().lobby!.code, fighter }); return c; };
    const again = () => (room as unknown as { again: { press(c: Client): void } }).again;
    try {
      const host = join('host'), a = join('a'), b = join('b');
      // Nothing to say "in" for until a match has ended.
      again().press(a); expect(room.snapshot().lobby?.again).toEqual({ ids: [], match: 1 });
      room.requestPrivateStart(host); advance(3 * 60 + 2);
      expect(room.simulation.status).toBe('active'); expect(room.simulation.snapshot().players.filter(p => p.isBot)).toHaveLength(1);
      for (const id of ['a', 'b', 'bot-1']) { const s = room.simulation.actors.get(id)!.state; s.hp = 0; s.alive = false; }
      advance(4); expect(room.simulation.status).toBe('finished'); expect(room.simulation.winnerId).toBe('host');
      // The host alone cannot start it; a friend's PLAY AGAIN says they are in, and everyone sees it.
      again().press(host); expect(room.simulation.status).toBe('finished');
      expect(host.send).toHaveBeenCalledWith('notice', { message: 'Waiting for a friend to press NEXT MATCH.' });
      again().press(a); again().press(a);
      expect(room.snapshot().lobby?.again).toEqual({ ids: ['host', 'a'], match: 1 });
      // A guest's press never starts it.
      expect(room.simulation.status).toBe('finished');
      again().press(host);
      // b was not in: they keep their results and leave the room; the bot goes; the others stand again, counting down.
      expect(b.leave).toHaveBeenCalledWith(4006); expect(host.leave).not.toHaveBeenCalled(); expect(a.leave).not.toHaveBeenCalled();
      room.clients.splice(room.clients.indexOf(b), 1);
      const snap = room.snapshot();
      expect(snap.status).toBe('waiting'); expect(snap.players.map(p => p.id).sort()).toEqual(['a', 'host']);
      expect(snap.players.every(p => p.alive && p.hp === p.maxHp)).toBe(true);
      expect(snap.lobby?.again).toEqual({ ids: [], match: 2 }); expect(snap.lobby?.startsAt).not.toBeNull();
      expect(snap.lobby?.expiresAt).toBeGreaterThan(snap.serverTime); expect(unlock).toHaveBeenCalled();
      advance(3 * 60 + 2);
      expect(room.simulation.status).toBe('active');
      // The host asked for four: bots fill the seats b and the first bot left.
      expect(room.simulation.snapshot().players.filter(p => p.isBot)).toHaveLength(2);
    } finally { room.onDispose(); }
  });
  it('is never offered by a public royale or a Duel', async () => {
    const duel = new DuelRoom(); vi.spyOn(duel, 'setMetadata').mockResolvedValue(undefined); vi.spyOn(duel, 'setFixedTimestep').mockImplementation(() => {});
    await duel.onCreate({ rosterProtocol: ROSTER_PROTOCOL });
    try { expect(duel.snapshot().lobby?.again).toBeUndefined(); } finally { duel.onDispose(); }
  });
});

import { Population, countRooms, CACHE_MS, PAGE_MS, STANDBY_MS } from '../src/server/social/Population';
import { QueueHold, HOLD_AHEAD, HOLD_MAX } from '../src/server/social/QueueHold';
import { ArenaRoom, SOLO_COUNTDOWN } from '../src/server/ArenaRoom';
import { PopulationLink, readView, PERIOD } from '../src/social/population';
import { loneIn, pageWhere, queueAccess, queueModeOf, queueWatch, standby } from '../src/social/standby';
import { cardLine, cardMode, dockLine, onlineLine } from '../src/ui/social/socialPlay';
import { rivalryLine, rivalryWords } from '../src/ui/social/rivalry';
import { FIGHTERS } from '../src/config';
import { againCard } from '../src/ui/social/roomAgain';
import * as roomSocial from '../src/social/roomSocial';

const listing = (name: string, clients: number, over: Record<string, unknown> = {}) => ({ name, clients, locked: false, private: false, metadata: {}, ...over }) as never;

describe('who is playing (Population)', () => {
  it('counts the rooms: queued in open public rooms, playing in the rest, parties left to their pages', () => {
    const { inRooms, modes } = countRooms([
      listing('arena', 1, { metadata: { mode: 'match' } }), listing('arena', 5, { locked: true, metadata: { mode: 'match' } }),
      listing('bot_arena', 1, { private: true }), listing('private_arena', 3, { private: true }),
      listing('duel_arena', 1), listing('duel_arena', 2, { locked: true }), listing('private_duel', 2, { private: true }),
      listing('objective_arena', 1, { metadata: { objective: 'last-stand', access: 'quick' } }), listing('objective_arena', 2, { private: true, metadata: { objective: 'bad-blood', access: 'host' } }),
      listing('rift_war', 2, { metadata: { access: 'quick' } }), listing('survival_arena', 2, { metadata: { visibility: 'public' } }),
      listing('party', 4, { private: true }),
    ]);
    expect(inRooms).toBe(22);
    expect(modes.royale).toEqual({ queue: 1, playing: 9, standby: 0 });
    expect(modes.duel).toEqual({ queue: 1, playing: 4, standby: 0 });
    expect(modes['last-stand'].queue).toBe(1); expect(modes['bad-blood'].playing).toBe(2);
    expect(modes['rift-war'].queue).toBe(2); expect(modes.arcade.queue).toBe(2);
  });
  it("adds the pages' beats, caches the listing, and forgets a page that stopped beating", async () => {
    let now = 1_000_000;
    const rooms = vi.fn(async () => [listing('arena', 1, { metadata: { mode: 'match' } })]);
    const population = new Population(rooms, () => now);
    population.beat('home-page-1', 'home'); population.beat('local-page-1', 'local', 'royale'); population.beat('stand-page-1', 'standby', 'royale');
    for (const bad of [['x', 'home'], ['home-page-2', 'room'], [42, 'home'], ['a'.repeat(41), 'home']] as const) population.beat(bad[0], bad[1]);
    population.beat('home-page-3', 'home', 'royale');
    let view = await population.view();
    expect(view.online).toBe(5); expect(view.modes.royale).toEqual({ queue: 1, playing: 2, standby: 1 });
    // Cached: a second ask inside CACHE_MS reads nothing new.
    now += CACHE_MS - 1; await population.view(); expect(rooms).toHaveBeenCalledTimes(1);
    // A standby that stopped beating holds nothing; a page that stopped is forgotten.
    now += STANDBY_MS; view = await population.view(); expect(view.modes.royale.standby).toBe(0); expect(view.online).toBe(5);
    now += PAGE_MS; view = await population.view(); expect(view.online).toBe(1);
    // A listing that cannot be read: the pages still count.
    rooms.mockRejectedValueOnce(new Error('down')); population.beat('home-page-1', 'home'); now += CACHE_MS;
    expect((await population.view()).online).toBe(1);
  });
});

describe("a lone queue held for a standby (QueueHold)", () => {
  it('keeps the start HOLD_AHEAD off, never more than HOLD_MAX past the room\'s own', () => {
    const hold = new QueueHold();
    expect(hold.apply(20)).toBe(20); expect(hold.apply(null)).toBeNull();
    hold.ask(5, 20); expect(hold.apply(20)).toBe(20);
    hold.ask(10, 20); expect(hold.apply(20)).toBe(10 + HOLD_AHEAD);
    hold.ask(40, 22); expect(hold.apply(20)).toBe(20 + HOLD_MAX);
    hold.reset(); expect(hold.apply(20)).toBe(20);
  });
  it("holds a public royale's lone start while asked, and a second player brings the short clock", async () => {
    const room = new ArenaRoom(); let tick!: FixedTimestepCallback, frame = 0;
    vi.spyOn(room, 'setMetadata').mockResolvedValue(undefined); vi.spyOn(room, 'broadcast').mockImplementation(() => {}); vi.spyOn(room, 'lock').mockResolvedValue(undefined);
    vi.spyOn(room, 'setFixedTimestep').mockImplementation(c => { tick = c; });
    await room.onCreate({ rosterProtocol: ROSTER_PROTOCOL, mode: 'match' });
    const advance = (n = 1) => { for (let i = 0; i < n; i++) tick({ dt: 1 / 60, dtMs: 1000 / 60, tick: ++frame, subSteps: 1, subDt: 1 / 60, subDtMs: 1000 / 60 }); };
    const hold = () => (room as unknown as { hold: QueueHold; onMessage: unknown }).hold;
    try {
      const a = client('a'); room.clients.push(a); room.onJoin(a, { rosterProtocol: ROSTER_PROTOCOL, fighter });
      advance(1); const first = room.snapshot().lobby!.startsAt!; expect(first).toBeCloseTo(SOLO_COUNTDOWN, 0);
      // The page asks while a standby exists (every 3 s, through 'queue-hold').
      for (let t = 0; t < 40; t += 3) { advance(3 * 60); hold().ask(room.simulation.serverTime, room.snapshot().lobby!.startsAt); }
      advance(1);
      expect(room.snapshot().lobby!.startsAt).toBeCloseTo(first + HOLD_MAX, 0); expect(room.simulation.status).toBe('waiting');
      const b = client('b'); room.clients.push(b); room.onJoin(b, { rosterProtocol: ROSTER_PROTOCOL, fighter });
      advance(1); expect(room.snapshot().lobby!.startsAt! - room.simulation.serverTime).toBeLessThanOrEqual(15.01);
    } finally { room.onDispose(); }
  });
});

describe('the online queue on the page', () => {
  const view = (over: Partial<Record<string, { queue?: number; playing?: number; standby?: number }>> = {}, online = 7) =>
    readView({ online, at: 1, modes: Object.fromEntries(Object.entries(over).map(([k, v]) => [k, { queue: 0, playing: 0, standby: 0, ...v }])) })!;
  it('reads a view whole, and anything else as none', () => {
    expect(readView(undefined)).toBeUndefined(); expect(readView({ online: 'x' })).toBeUndefined();
    expect(view({ royale: { queue: 2.7, playing: -3 } }).modes.royale).toEqual({ queue: 2, playing: 0, standby: 0 });
    expect(view().modes['rift-war']).toEqual({ queue: 0, playing: 0, standby: 0 });
  });
  it('words the home, the cards and the dock plainly', () => {
    const v = view({ royale: { queue: 1, playing: 11, standby: 1 } }, 1234);
    expect(onlineLine(v)).toBe('1,234 ONLINE'); expect(onlineLine(undefined)).toBe('');
    expect(cardMode('bots')).toBe('royale'); expect(cardMode('training')).toBeUndefined(); expect(cardMode('rift-war')).toBe('rift-war');
    expect(cardLine(v, 'royale')).toBe('12 PLAYING'); expect(cardLine(v, 'duel')).toBe('');
    expect(dockLine(v, 'royale')).toBe('1 IN QUEUE · 11 PLAYING · 1 FIGHTING BOTS ASKED TO JOIN');
  });
  it('asks as often as where the page is wants, and beats as that', async () => {
    const urls: string[] = [];
    const link = new PopulationLink(async url => { urls.push(url); return { online: 3, modes: {}, at: 1 }; }, () => 'http://server');
    let where: ReturnType<typeof link.where> = { at: 'home' }; link.where = () => where;
    expect(await link.tick(false, 0)).toBe(true); expect(urls[0]).toMatch(/^http:\/\/server\/population\?page=[^&]+&at=home$/);
    expect(await link.tick(false, PERIOD.home - 1)).toBe(false); expect(await link.tick(false, PERIOD.home)).toBe(true);
    where = { at: 'standby', mode: 'royale' }; expect(await link.tick(false, PERIOD.home + PERIOD.standby)).toBe(true);
    expect(urls.at(-1)).toMatch(/&at=standby&mode=royale$/);
    where = { at: 'room' }; expect(await link.tick(false, 1e9)).toBe(false);
    link.dock = true; expect(await link.tick(false, 1e9)).toBe(true); expect(urls.at(-1)).not.toMatch(/&at=/);
    expect(link.view?.online).toBe(3);
  });
  it('finds a lone page in a queue, holds its room for a standby, and keeps a standby to its mode', () => {
    const royale = { roomMode: 'match', status: 'waiting', serverTime: 3, stage: 'harbor', events: [], players: [{ id: 'me', fighter }], lobby: { visibility: 'public', hostId: null, canStart: false, startsAt: 20, expiresAt: null } } as unknown as GameSnapshot;
    expect(loneIn(royale, 'me', { kind: 'public' })).toBe('royale');
    expect(loneIn({ ...royale, players: [{ id: 'me', fighter }, { id: 'you', fighter }] } as never, 'me', { kind: 'public' })).toBeUndefined();
    expect(loneIn(royale, 'me', { kind: 'create-private' })).toBeUndefined();
    const sent: string[] = []; vi.spyOn(roomSocial, 'socialRoom').mockReturnValue({ send: (type: string) => sent.push(type), connection: { isOpen: true } });
    expect(queueWatch(royale, 'me', { kind: 'public' }, view({ royale: { standby: 0 } }), 0)).toBe(false);
    expect(queueWatch(royale, 'me', { kind: 'public' }, view({ royale: { standby: 1 } }), 10_000)).toBe(true);
    expect(queueWatch(royale, 'me', { kind: 'public' }, view({ royale: { standby: 1 } }), 11_000)).toBe(false);
    expect(sent).toEqual(['queue-hold']);
    expect(queueModeOf({ kind: 'bots', players: 6, lone: true })).toBe('royale'); expect(queueModeOf({ kind: 'objective', objective: 'bad-blood', access: 'bots' })).toBe('bad-blood');
    expect(queueAccess('duel')).toEqual({ kind: 'duel', access: 'online' }); expect(queueAccess('arcade')).toBeUndefined();
    standby.begin('royale', 0);
    expect(pageWhere({ started: true, online: false, snapshot: null, selfId: '', access: undefined, local: 'royale' }, 1000)).toEqual({ at: 'standby', mode: 'royale' });
    expect(pageWhere({ started: false, online: false, snapshot: null, selfId: '', access: undefined }, 1000)).toEqual({ at: 'home' });
    expect(standby.mode).toBe('royale');
    expect(pageWhere({ started: true, online: false, snapshot: null, selfId: '', access: undefined, local: 'royale' }, 16 * 60_000)).toEqual({ at: 'local', mode: 'royale' });
    expect(pageWhere({ started: true, online: false, snapshot: null, selfId: '', access: undefined, local: 'duel' }, 1000)).toEqual({ at: 'local', mode: 'duel' });
    expect(standby.mode).toBeUndefined();
    standby.begin('royale', 0); expect(pageWhere({ started: true, online: true, snapshot: royale, selfId: 'me', access: { kind: 'public' } }, 1000)).toEqual({ at: 'queue', mode: 'royale' });
    expect(standby.mode).toBeUndefined();
  });
  it('words rivalries and the next match plainly', () => {
    expect(rivalryWords({ id: 'b', won: 2, lost: 3 }, 'Amir')).toBe('AMIR LEADS 3–2');
    expect(rivalryWords({ id: 'b', won: 4, lost: 1 }, 'Amir')).toBe('YOU LEAD AMIR 4–1');
    expect(rivalryWords({ id: 'b', won: 2, lost: 2 }, 'Amir')).toBe('AMIR · ALL SQUARE 2–2');
    const snap = { players: [{ id: 'me', name: 'Me', fighter }, { id: 'b', name: 'Amir', fighter }, { id: 'c', name: 'Fighter', fighter }], rivals: [{ id: 'b', won: 2, lost: 3 }, { id: 'c', won: 1, lost: 0 }] } as unknown as GameSnapshot;
    expect(rivalryLine(snap, 'me')).toBe(`AMIR LEADS 3–2 · YOU LEAD ${FIGHTERS.taisei.name.toUpperCase()} 1–0`);
    expect(rivalryLine({ ...snap, rivals: undefined }, 'me')).toBe('');
    const over = { roomMode: 'match', status: 'finished', players: [{ id: 'host', name: 'Host', fighter }, { id: 'a', name: 'Amir', fighter }, { id: 'b', name: 'Sam', fighter }, { id: 'bot-1', isBot: true, fighter }], lobby: { visibility: 'private', hostId: 'host', again: { ids: ['a'], match: 1 } } } as unknown as GameSnapshot;
    expect(againCard(over, 'host')).toEqual({ label: 'NEXT MATCH', sub: 'START · 2 OF 3 IN', disabled: false, note: 'IN FOR THE NEXT MATCH: AMIR · 1 DECIDING' });
    expect(againCard(over, 'a')).toMatchObject({ sub: "YOU'RE IN · HOST STARTS", disabled: true });
    expect(againCard(over, 'b')).toMatchObject({ sub: "I'M IN · SAME ROOM", disabled: false });
  });
});

import { secondPad } from '../src/ui/modes/CouchPrompt';
describe('Player 2 detected (CouchPrompt)', () => {
  const pad = (index: number, id = `pad ${index}`, mapping = 'standard') => ({ index, id, mapping, connected: true, axes: [], buttons: [] });
  it("finds Player 2's pad only when there are two, never the one the menus read", () => {
    expect(secondPad([pad(0)], 0)).toBeUndefined();
    expect(secondPad([pad(0), { ...pad(1), connected: false }], 0)).toBeUndefined();
    expect(secondPad([pad(0), pad(1, 'odd', '')], 0)).toBeUndefined();
    expect(secondPad([pad(0), pad(1)], 0)?.index).toBe(1);
    expect(secondPad([pad(0), pad(1)], 1)?.index).toBe(0);
    expect(secondPad([pad(0), null, pad(2)], null)?.index).toBe(2);
  });
});
