import { afterEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import type { Client, FixedTimestepCallback } from 'colyseus';
import { ROSTER_PROTOCOL } from '../src/game/rosterProtocol';
import { RANKED, RANKED_MODES, freshRating, tierOf, type Rating } from '../src/game/ball/ranked';
import { RANKED_DUEL, RANKED_SIGN_IN, promotionOf, rateDuel, placementsLeft } from '../src/game/duel/ranked';
import { RankedDuel } from '../src/server/duel/RankedDuel';
import { setRanked, type Ranked, type RankedExtra } from '../src/server/ball/ranked';
import { DuelRoom } from '../src/server/ArenaRoom';
import { mountEconomy, type Economy } from '../src/server/economy/api';
import { WorldEconomy, BOARD_SHOWN, CFG, type Seat } from '../src/p2world/economy';
import { MemoryKV } from '../src/p2world/kv';
import { seal, unseal, type Pass } from '../src/server/economy/p2roomSigned';
import type { GameSnapshot } from '../src/game/types';
import type { Account } from '../src/game/economy/account';

afterEach(() => { vi.restoreAllMocks(); setRanked(undefined); });

const seat = (id: string, rating: number = RANKED.start, games = 10) => ({ id, pk: `pk-${id}`, rating, games });
/** A Duel's snapshot: two people (or bots), the set as it stands. */
const duel = (over: Partial<NonNullable<GameSnapshot['duel']>>, players = ['a', 'b']) => ({ roomMode: 'match', status: 'active', serverTime: 10, events: [], stage: 'harbor', winnerId: null,
  players: players.map(id => ({ id, fighter: 'taisei', isBot: id.startsWith('bot') })),
  duel: { set: 1, round: 1, firstTo: 2, scores: {}, phase: 'playing', nextRoundAt: null, roundWinner: null, winner: null, runback: [], startedAt: 5, ...over } }) as unknown as GameSnapshot;
/** A ratings service that keeps what it is told, and says who is signed in. */
function service(signed = new Set(['pk-a', 'pk-b']), standings: Record<string, Partial<Rating>> = {}) {
  const applied: { pk: string; mode: string; delta: number; won: boolean; id: string; extra?: RankedExtra }[] = [];
  const s: Ranked = {
    rating: async (pk) => ({ ...freshRating(), ...standings[pk] }),
    apply: async (pk, mode, delta, won, id, extra) => { applied.push({ pk, mode, delta, won, id, extra }); return undefined; },
    answer: async () => ({ season: 1, ends: 0, modes: {} }),
    eligible: pk => signed.has(pk),
  };
  return { s, applied };
}
/** Accounts named by their token (`a` opens pk-a). */
const economy = () => ({ book: { find: (token: unknown) => typeof token === 'string' && token ? { pk: `pk-${token}` } as never : undefined, completions: { get: () => undefined } }, complete: () => undefined });
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

describe('the ranked Duel\'s rules (game/duel/ranked.ts)', () => {
  it('is one more mode id in the ball\'s tables, on the same seasons and stamps', () => {
    expect(RANKED_MODES).toEqual(['goal-rush', 'sky-spike', 'duel']);
    expect(RANKED_DUEL.mode).toBe('duel');
  });
  it('rates a set: the winner up and the loser down by Elo, a placement\'s K for one still placing', () => {
    const even = rateDuel(seat('a'), seat('b'), 'a');
    expect(even.get('a')).toBe(RANKED.k / 2); expect(even.get('b')).toBe(-RANKED.k / 2);
    const placing = rateDuel(seat('a', 1000, 0), seat('b', 1000, 10), 'b');
    expect(placing.get('a')).toBe(-RANKED.placementK / 2); expect(placing.get('b')).toBe(RANKED.k / 2);
    // An upset moves further than the expected result.
    const upset = rateDuel(seat('a', 1400), seat('b', 1000), 'b'), expected = rateDuel(seat('a', 1400), seat('b', 1000), 'a');
    expect(upset.get('b')!).toBeGreaterThan(expected.get('a')!);
    expect(rateDuel(seat('a'), seat('b'), null).size).toBe(0);
    expect(rateDuel(seat('a'), seat('b'), 'someone-else').size).toBe(0);
  });
  it('says what a set did to the stamp: earned at the last placement, gained, lost', () => {
    expect(promotionOf({ rating: 1020, games: 4 }, { rating: 1040, games: 5 })).toEqual({ kind: 'placed', tier: tierOf({ rating: 1040, games: 5 }) });
    expect(promotionOf({ rating: 1140, games: 9 }, { rating: 1156, games: 10 })?.kind).toBe('promoted');
    expect(promotionOf({ rating: 1005, games: 9 }, { rating: 990, games: 10 })?.kind).toBe('demoted');
    expect(promotionOf({ rating: 1040, games: 9 }, { rating: 1056, games: 10 })).toBeUndefined();
    expect(promotionOf({ rating: 1000, games: 1 }, { rating: 1024, games: 2 })).toBeUndefined();
    expect(placementsLeft({ games: 3 })).toBe(2); expect(placementsLeft(undefined)).toBe(RANKED.placements); expect(placementsLeft({ games: 9 })).toBe(0);
  });
});

describe('a ranked Duel room\'s rating (RankedDuel)', () => {
  it('reads both standings, rates the set once as it is decided, carried by both pages, and tells PlayerTwo the places', async () => {
    const { s, applied } = service(undefined, { 'pk-a': { rating: 1100, games: 7 }, 'pk-b': { rating: 1000, games: 2 } }), places: string[][] = [];
    const watch = new RankedDuel(() => s, economy, p => places.push(p));
    watch.bind('a', 'a', 'Kite'); watch.bind('b', 'b', 'Rowan'); await settle();
    expect(watch.snapshot().seats).toEqual({ a: { rating: 1100, games: 7 }, b: { rating: 1000, games: 2 } });
    expect(watch.snapshot().rated).toBe(false);
    watch.observe(duel({ startedAt: null }), 'set-1');
    expect(watch.snapshot().rated).toBe(false);
    watch.observe(duel({}), 'set-1');
    expect(watch.snapshot().rated).toBe(true);
    watch.observe(duel({ phase: 'complete', winner: 'b', scores: { b: 2, a: 1 } }), 'set-1');
    watch.observe(duel({ phase: 'complete', winner: 'b', scores: { b: 2, a: 1 } }), 'set-1');
    const want = rateDuel({ id: 'a', pk: 'pk-a', rating: 1100, games: 7 }, { id: 'b', pk: 'pk-b', rating: 1000, games: 2 }, 'b');
    expect(applied).toEqual([
      { pk: 'pk-a', mode: 'duel', delta: want.get('a'), won: false, id: 'set-1:1', extra: { carriers: ['pk-b'], name: 'Kite' } },
      { pk: 'pk-b', mode: 'duel', delta: want.get('b'), won: true, id: 'set-1:1', extra: { carriers: ['pk-a'], name: 'Rowan' } },
    ]);
    expect(watch.snapshot().seats.b).toEqual({ rating: 1000 + want.get('b')!, games: 3, delta: want.get('b') });
    expect(places).toEqual([['b', 'a']]);
  });
  it('rates a leaver as beaten at once, then the one who stayed as the winner; never twice', async () => {
    const { s, applied } = service();
    const watch = new RankedDuel(() => s, economy);
    watch.bind('a', 'a'); watch.bind('b', 'b'); await settle();
    watch.observe(duel({ round: 2, scores: { a: 1 } }), 'set-9');
    watch.leave('b', { phase: 'playing', startedAt: 5 });
    expect(applied.map(a => [a.pk, a.won, a.delta < 0, a.extra?.carriers])).toEqual([['pk-b', false, true, ['pk-a']]]);
    watch.observe(duel({ phase: 'complete', winner: 'a', scores: { a: 1 } }, ['a']), 'set-9');
    watch.leave('b', { phase: 'complete', startedAt: 5 });
    expect(applied.map(a => [a.pk, a.won])).toEqual([['pk-b', false], ['pk-a', true]]);
  });
  it('pairs at "opponent found": leaving in the count to the first round loses, and the one who stayed is paired afresh', async () => {
    const { s, applied } = service(new Set(['pk-a', 'pk-b', 'pk-c']));
    const watch = new RankedDuel(() => s, economy);
    watch.bind('a', 'a'); watch.bind('b', 'b'); await settle();
    const counting = { ...duel({ startedAt: null }), status: 'waiting', lobby: { duel: true, startsAt: 13 } } as unknown as GameSnapshot;
    watch.observe(counting, 'set-1');
    expect(watch.snapshot().rated).toBe(true);
    // The VS page shows their stamps; one walks out before the first round: their loss, carried by the other's page.
    watch.leave('b', { phase: 'playing', startedAt: null });
    expect(applied.map(a => [a.pk, a.won, Math.sign(a.delta), a.id, a.extra?.carriers])).toEqual([['pk-b', false, -1, 'set-1:1', ['pk-a']]]);
    expect(watch.snapshot()).toMatchObject({ rated: false, seats: { a: { rating: 1000, games: 0 } } });
    expect(watch.snapshot().seats.b).toBeUndefined();
    // A new opponent: a pairing of its own, rated to its end.
    watch.bind('c', 'c'); await settle();
    watch.observe({ ...counting, players: [{ id: 'a', fighter: 'taisei', isBot: false }, { id: 'c', fighter: 'konta', isBot: false }] } as unknown as GameSnapshot, 'set-1');
    watch.observe({ ...duel({ phase: 'complete', winner: 'c', scores: { c: 2 } }, ['a', 'c']) }, 'set-1');
    expect(applied.slice(1).map(a => [a.pk, a.won, a.id])).toEqual([['pk-a', false, 'set-1:2'], ['pk-c', true, 'set-1:2']]);
  });
  it('rates nothing for a set that never started with both people known, a bot, or the same account twice', async () => {
    const { s, applied } = service();
    const early = new RankedDuel(() => s, economy);
    early.bind('a', 'a'); early.bind('b', 'b'); await settle();
    early.leave('b'); expect(early.snapshot().seats.b).toBeUndefined();
    early.observe(duel({ phase: 'complete', winner: 'a' }), 'x');
    const bot = new RankedDuel(() => s, economy);
    bot.bind('a', 'a'); await settle();
    bot.observe(duel({}, ['a', 'bot-1']), 'x'); bot.observe(duel({ phase: 'complete', winner: 'a' }, ['a', 'bot-1']), 'x');
    const twice = new RankedDuel(() => s, economy);
    twice.bind('a', 'a'); twice.bind('b', 'a'); await settle();
    twice.observe(duel({}), 'x'); twice.observe(duel({ phase: 'complete', winner: 'a' }), 'x');
    expect(applied).toEqual([]);
  });
  it('lets only a signed-in account queue', () => {
    const { s } = service(new Set(['pk-a']));
    const watch = new RankedDuel(() => s, economy);
    expect(watch.eligible('a')).toBe(true); expect(watch.eligible('b')).toBe(false); expect(watch.eligible(undefined)).toBe(false);
    expect(new RankedDuel(() => ({ ...s, eligible: undefined }), economy).eligible('a')).toBe(false);
  });
});

describe('the ranked Duel room (DuelRoom with queue: ranked)', () => {
  const guest = (e: Economy) => e.hello(undefined) as unknown as { account: Account; token: string };
  async function room(queue: unknown = RANKED_DUEL.queue, roomId?: string) {
    const economy = mountEconomy({ use: () => undefined, post: () => undefined }, { dir: false });
    const r = new DuelRoom(); let tick!: FixedTimestepCallback; const handlers = new Map<string, (c: Client, p?: unknown) => void>();
    if (roomId) r.roomId = roomId;
    vi.spyOn(r, 'setMetadata').mockResolvedValue(undefined); vi.spyOn(r, 'lock').mockResolvedValue(undefined); vi.spyOn(r, 'unlock').mockResolvedValue(undefined);
    vi.spyOn(r, 'broadcast').mockImplementation(() => {}); vi.spyOn(r, 'setFixedTimestep').mockImplementation(fn => { tick = fn; });
    vi.spyOn(r, 'onMessage').mockImplementation(((type: string, handler: (c: Client, p?: unknown) => void) => { handlers.set(type, handler); return () => {}; }) as never);
    await r.onCreate({ rosterProtocol: ROSTER_PROTOCOL, mode: 'match', queue });
    const join = (id: string, account: string, q: unknown = RANKED_DUEL.queue) => { const c = { sessionId: id, send: vi.fn() } as unknown as Client; r.onJoin(c, { rosterProtocol: ROSTER_PROTOCOL, fighter: 'taisei', name: id, account, mode: 'match', queue: q }); r.clients.push(c); return c; };
    const advance = (seconds: number) => { for (let i = 0; i < seconds * 60; i++) tick({ dt: 1 / 60, dtMs: 1000 / 60, tick: i, subSteps: 1, subDt: 1 / 60, subDtMs: 1000 / 60 }); };
    const last = (c: Client) => vi.mocked(c.send).mock.calls.filter(call => call[0] === 'snapshot').at(-1)![1] as GameSnapshot;
    return { economy, r, join, advance, last, send: (c: Client, type: string, p?: unknown) => handlers.get(type)?.(c, p) };
  }
  it('seats only signed-in accounts of the ranked queue, rates the set, and forfeits a leaver; no runback', async () => {
    const f = await room();
    try {
      const a = guest(f.economy), b = guest(f.economy), stranger = guest(f.economy);
      const { s, applied } = service(new Set([a.account.pk, b.account.pk]));
      setRanked(s);
      expect(() => f.join('g', stranger.token)).toThrow(RANKED_SIGN_IN);
      expect(() => f.join('c', a.token, null)).toThrow(/another queue/);
      const one = f.join('one', a.token), two = f.join('two', b.token);
      await settle();
      f.advance(8);
      const shown = f.last(one);
      expect(shown.status).toBe('active');
      expect(shown.ranked).toMatchObject({ queue: 'ranked', rated: true, seats: { one: { rating: 1000, games: 0 }, two: { rating: 1000, games: 0 } } });
      // The rival walks out mid-set: rated as beaten at once, the set forfeited to the one who stayed, who is rated the winner.
      f.r.clients.splice(f.r.clients.indexOf(two), 1); f.r.onLeave(two);
      f.advance(.2);
      expect(applied.map(x => [x.pk, x.won, Math.sign(x.delta), x.extra?.carriers])).toEqual([[b.account.pk, false, -1, [a.account.pk]], [a.account.pk, true, 1, [b.account.pk]]]);
      const after = f.last(one);
      expect(after.duel?.phase).toBe('complete');
      expect(after.ranked?.seats.one.delta).toBe(RANKED.placementK / 2);
      f.send(one, 'duel-runback'); f.advance(.2);
      expect(f.last(one).duel?.runback).toEqual([]);
    } finally { f.r.onDispose(); }
  }, 60_000);
  it('keeps the casual Duel\'s queue apart, and is never made for a room PlayerTwo opened by a code', async () => {
    const casual = await room(null);
    try {
      const a = guest(casual.economy);
      setRanked(service(new Set([a.account.pk])).s);
      expect(() => casual.join('x', a.token)).toThrow(/another queue/);
      expect(() => casual.join('y', a.token, null)).not.toThrow();
      expect(casual.last(casual.r.clients[0]).ranked).toBeUndefined();
    } finally { casual.r.onDispose(); }
    await expect(room(RANKED_DUEL.queue, 'r24/impact/build/c-0123abcd')).rejects.toThrow(/matched by its queue/);
  });
});

describe('the ranked Duel in the economy world', () => {
  const KEY = 'ranked-duel-key', p2id = () => crypto.randomBytes(16).toString('base64url').slice(0, 22);
  function world() {
    const kv = new MemoryKV(), e = new WorldEconomy(kv, { key: KEY });
    kv.set(CFG, { open: true });
    const call = async (s: Seat | undefined, path: string, body: Record<string, unknown> = {}) => { const a = await e.route(s, path, body); return { status: a.status, body: a.body as Record<string, any> }; };
    const player = async (kind = 'full') => { const s = { id: p2id(), kind }, g = await call(s, 'hello'); if (kind !== 'guest') await call(s, 'p2-signin', { token: g.body.token }); return { seat: s, pk: g.body.account.pk as string, token: g.body.token as string }; };
    return { kv, e, call, player };
  }
  const soon = () => Date.now() + 60_000;
  it('signs the Duel\'s standing and the signed-in flag into the pass, and rates only a signed-in account', async () => {
    const { e, call, player } = world(), you = await player(), visitor = await player('guest');
    const passOf = async (p: { seat: Seat; token: string }) => unseal<Pass>(KEY, (await call(p.seat, 'p2room-pass', { token: p.token, name: 'Amir' })).body.pass);
    expect((await passOf(you))?.ranked?.duel).toEqual({ rating: 1000, games: 0 });
    expect((await passOf(you))?.signed).toBe(true);
    expect((await passOf(visitor))?.signed).toBe(false);
    for (const p of [you, visitor]) await call(undefined, 'p2room-complete', { done: await seal(KEY, { k: 'rank', pk: p.pk, mode: 'duel', delta: 24, won: true, id: 'set-1', exp: soon() }) });
    expect(e.rating(you.pk, 'duel')).toMatchObject({ rating: 1024, games: 1, wins: 1 });
    expect(e.rating(visitor.pk, 'duel')).toEqual(freshRating());
    expect(((await call(you.seat, 'ranked', { token: you.token })).body.modes as Record<string, Rating>).duel.rating).toBe(1024);
  });
  it('keeps the season\'s board: a row once the placements are played, by rating, its name, the asker\'s own place', async () => {
    const { e, call, player } = world(), people = await Promise.all(Array.from({ length: BOARD_SHOWN + 2 }, () => player()));
    for (const [i, p] of people.entries()) for (let n = 0; n < RANKED.placements; n++) e.applyRanked(p.pk, 'duel', i - 3, i % 2 === 0, `s-${i}-${n}`, `Fighter${i}`);
    e.applyRanked(people[0].pk, 'duel', 5, true, 'one-short', 'Early');
    const board = (await call(people[0].seat, 'ranked-board', { token: people[0].token, mode: 'duel' })).body;
    expect(board.top).toHaveLength(BOARD_SHOWN);
    expect(board.top[0]).toMatchObject({ place: 1, name: `Fighter${people.length - 1}` });
    expect(board.top.map((row: { rating: number }) => row.rating)).toEqual([...board.top.map((row: { rating: number }) => row.rating)].sort((a: number, b: number) => b - a));
    expect(JSON.stringify(board)).not.toContain(people[0].pk);
    expect(board.me).toMatchObject({ you: true, name: 'Early' });
    expect(board.top.some((row: { you?: boolean }) => row.you)).toBe(false);
    // A deleted account leaves the board.
    await call(people.at(-1)!.seat, 'delete', { token: people.at(-1)!.token, confirm: 'DELETE' });
    expect((await call(undefined, 'ranked-board', { mode: 'duel' })).body.top[0].name).toBe(`Fighter${people.length - 2}`);
  });
});
