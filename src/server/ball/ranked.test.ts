import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Client, FixedTimestepCallback } from 'colyseus';
import { ROSTER_PROTOCOL } from '../../game/rosterProtocol';
import { BALL_PROTOCOL, type BallModeId } from '../../game/ball/model';
import { RANKED, change, rate, rankedStart, seasonOf, tierOf, type RankedSeat } from '../../game/ball/ranked';
import { weeklyMutator } from '../../game/ball/mutators';
import { RankedBook, mountRanked, mountRankedRoute, ranked, setRanked } from './ranked';
import { EventEmitter } from 'node:events';
import { BallRoom } from './BallRoom';
import { Economy, mountEconomy } from '../economy/api';

const DAY = 86_400_000, MONDAY = Date.UTC(2026, 10, 9);
afterEach(() => { vi.restoreAllMocks(); setRanked(undefined); });

describe('ranked rules (game/ball/ranked.ts)', () => {
  const seat = (id: string, team: 'red' | 'blue', rating = 1000, games = 10): RankedSeat => ({ id, pk: `pk-${id}`, team, rating, games });
  it('is ranked only with a person on each side at kickoff, and rates only the people', () => {
    expect(rankedStart([seat('a', 'red'), seat('b', 'red')])).toBe(false);
    expect(rankedStart([seat('a', 'red'), seat('b', 'blue')])).toBe(true);
    const started = [seat('a', 'red', 1100), seat('b', 'blue', 1000), seat('c', 'blue', 900)];
    const after = rate(started, started, 'blue');
    expect(after.get('a')).toBeLessThan(0); expect(after.get('b')).toBeGreaterThan(0); expect(after.get('c')).toBe(after.get('b'));
    // Blue's average (950) beat a 1100: an upset is worth more than the 16 an even match pays.
    expect(after.get('b')).toBeGreaterThan(RANKED.k / 2);
    expect(rate([seat('a', 'red')], [seat('a', 'red')], 'red').size).toBe(0);
    expect(rate(started, started, 'draw').size).toBe(0);
    // The placements move further.
    expect(Math.abs(change({ games: 0 }, 1000, 1000, true))).toBe(RANKED.placementK / 2);
  });
  it('names a standing by its stamp once the placements are played, and counts seasons in eight weeks from the first', () => {
    expect(tierOf({ rating: 1500, games: 4 })).toBeNull();
    expect(tierOf({ rating: 870, games: 5 })?.name).toBe('ROUGH'); expect(tierOf({ rating: 1000, games: 5 })?.name).toBe('INKED'); expect(tierOf({ rating: 1460, games: 5 })?.name).toBe('COVER');
    expect(seasonOf(MONDAY).n).toBe(1); expect(seasonOf(MONDAY + 56 * DAY - 1).n).toBe(1); expect(seasonOf(MONDAY + 56 * DAY).n).toBe(2);
  });
});

describe('the ranked book (server/ball/ranked.ts)', () => {
  it('keeps each standing in its own file, takes a result once, and reads it back', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ranked-'));
    try {
      let now = MONDAY + DAY;
      const book = new RankedBook(dir, () => now);
      expect(book.rating('a', 'goal-rush')).toEqual({ rating: 1000, games: 0, wins: 0, peak: 1000 });
      expect(book.apply('a', 'goal-rush', 24, true, 'room:1')).toMatchObject({ rating: 1024, games: 1, wins: 1 });
      expect(book.apply('a', 'goal-rush', 24, true, 'room:1')).toMatchObject({ rating: 1024, games: 1 });
      expect(book.apply('a', 'goal-rush', -10, false, 'room:2')).toMatchObject({ rating: 1014, games: 2, wins: 1, peak: 1024 });
      expect(book.apply('a', 'nonsense', 10, true, 'room:3')).toBeUndefined();
      expect(book.rating('a', 'sky-spike').rating).toBe(1000);
      const again = new RankedBook(dir, () => now);
      expect(again.rating('a', 'goal-rush')).toMatchObject({ rating: 1014, games: 2 });
      expect(again.apply('a', 'goal-rush', 24, true, 'room:1')?.rating).toBe(1014);
      // A new season: halfway back to the start, the placements again; the answer a page is given.
      now = MONDAY + 57 * DAY;
      expect(again.rating('a', 'goal-rush')).toEqual({ rating: 1007, games: 0, wins: 0, peak: 1007 });
      expect(again.answer('a')).toMatchObject({ season: 2, modes: { 'goal-rush': { rating: 1007 }, 'sky-spike': { rating: 1000 } } });
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('the pages\' ask for their standing (POST /ball/ranked)', () => {
  it('answers an account\'s standing in both modes, and an empty one for a token it does not know', async () => {
    mountRanked(undefined);
    await ranked()!.apply('pk-a', 'sky-spike', 30, true, 'room:1');
    let handler!: (req: EventEmitter, res: { statusCode: number; setHeader(): void; end(body?: string): void }) => void;
    mountRankedRoute({ post: (path, h) => { expect(path).toBe('/ball/ranked'); handler = h as never; } }, token => token === 'secret' ? 'pk-a' : undefined);
    const ask = (body: string) => new Promise<{ status: number; body: Record<string, unknown> }>(resolve => {
      const req = new EventEmitter(), res = { statusCode: 0, setHeader: () => {}, end: (text?: string) => resolve({ status: res.statusCode, body: JSON.parse(text ?? '{}') }) };
      handler(req, res); req.emit('data', Buffer.from(body)); req.emit('end');
    });
    expect(await ask('{"token":"secret"}')).toMatchObject({ status: 200, body: { modes: { 'sky-spike': { rating: 1030, games: 1 }, 'goal-rush': { rating: 1000 } } } });
    expect(await ask('{"token":"other"}')).toMatchObject({ status: 200, body: { modes: {} } });
    expect((await ask('not json')).status).toBe(400);
  });
});

describe('a ranked room', () => {
  const client = (sessionId: string) => ({ sessionId, send: vi.fn() } as unknown as Client);
  async function fixture(queue: 'ranked' | 'playlist' = 'ranked', ball: BallModeId = 'goal-rush') {
    const economy = mountEconomy({ use: () => undefined, post: () => undefined }, { dir: false }) as Economy;
    mountRanked(undefined);
    const room = new BallRoom(); let tick!: FixedTimestepCallback; const handlers = new Map<string, (c: Client, p?: unknown) => void>();
    vi.spyOn(room, 'setPrivate').mockResolvedValue(undefined); vi.spyOn(room, 'setMetadata').mockResolvedValue(undefined); vi.spyOn(room, 'broadcast').mockImplementation(() => {});
    vi.spyOn(room, 'lock').mockResolvedValue(undefined); vi.spyOn(room, 'unlock').mockResolvedValue(undefined);
    vi.spyOn(room, 'setFixedTimestep').mockImplementation(fn => { tick = fn; });
    vi.spyOn(room, 'onMessage').mockImplementation(((type: string, handler: (c: Client, p?: unknown) => void) => { handlers.set(type, handler); return () => {}; }) as never);
    const mutator = weeklyMutator(Date.now());
    await room.onCreate({ rosterProtocol: ROSTER_PROTOCOL, access: 'quick', queue, ...(queue === 'playlist' ? { mutator } : {}), ballProtocol: BALL_PROTOCOL, ball });
    const options = (id: string, account?: string) => ({ rosterProtocol: ROSTER_PROTOCOL, fighter: 'taisei', name: id, ballProtocol: BALL_PROTOCOL, ball, queue, account });
    const token = () => (economy.hello(undefined) as unknown as { token: string }).token;
    const join = (id: string, account = token()) => { const c = client(id); room.onJoin(c, options(id, account)); room.clients.push(c); return { c, account }; };
    const advance = (seconds: number) => { for (let i = 0; i < seconds * 60; i++) tick({ dt: 1 / 60, dtMs: 1000 / 60, tick: i, subSteps: 1, subDt: 1 / 60, subDtMs: 1000 / 60 }); };
    const settle = () => new Promise(resolve => setTimeout(resolve, 0));
    return { room, economy, join, advance, settle, options, mutator, send: (c: Client, type: string, p?: unknown) => handlers.get(type)?.(c, p) };
  }
  /** Ends a Goal Rush match now, red ahead. */
  const redWins = (f: Awaited<ReturnType<typeof fixture>>) => {
    const g = f.room.game;
    for (let i = 0; i < 60 * 12 && g.view.phase !== 'live'; i++) f.advance(1 / 60);
    g.view.score.red = 1; g.view.clock = .02; g.ball.y = 3; g.ball.vy = -5; g.ball.held = false;
    for (let i = 0; i < 60 * 8 && g.view.phase !== 'over'; i++) f.advance(1 / 60);
    expect(g.view.phase).toBe('over'); expect(g.view.winner).toBe('red');
  };
  it('waits longer for people, rates the people on both sides at the final whistle, and never a bot', async () => {
    const f = await fixture();
    try {
      const a = f.join('a'), b = f.join('b');
      await f.settle();
      expect(f.room.game.view.ranked).toBe(false);
      expect(f.room.game.seats.get('a')!.rank).toMatchObject({ rating: RANKED.start, games: 0 });
      expect(f.room.game.seats.get('a')!.team).not.toBe(f.room.game.seats.get('b')!.team);
      f.advance(20); expect(f.room.game.view.phase).toBe('lobby');
      f.advance(RANKED.wait - 18); expect(f.room.game.view.phase).not.toBe('lobby');
      expect(f.room.game.view.ranked).toBe(true);
      const red = f.room.game.seats.get('a')!.team === 'red' ? a : b, blue = red === a ? b : a;
      redWins(f);
      await f.settle();
      const pkOf = (account: string) => f.economy.book.find(account)!.pk;
      expect((await ranked()!.rating(pkOf(red.account), 'goal-rush')).rating).toBe(RANKED.start + RANKED.placementK / 2);
      expect((await ranked()!.rating(pkOf(blue.account), 'goal-rush')).rating).toBe(RANKED.start - RANKED.placementK / 2);
      const redSeat = [...f.room.game.seats.values()].find(s => s.id === (red === a ? 'a' : 'b'))!;
      expect(redSeat.rank).toMatchObject({ delta: RANKED.placementK / 2, games: 1 });
      for (const bot of [...f.room.game.seats.values()].filter(s => s.bot)) expect(bot.rank).toBeUndefined();
    } finally { f.room.onDispose(); }
  }, 30000);
  it('plays on unranked when one side has no person, and takes a loss off whoever leaves a ranked match', async () => {
    const solo = await fixture();
    try {
      solo.join('a'); await solo.settle(); solo.advance(RANKED.wait + 2);
      expect(solo.room.game.view.ranked).toBe(false);
    } finally { solo.room.onDispose(); }
    const f = await fixture();
    try {
      const a = f.join('a'); f.join('b'); const c = f.join('c'); await f.settle();
      f.advance(RANKED.wait + 2);
      expect(f.room.game.view.ranked).toBe(true);
      f.room.onLeave(c.c); await f.settle();
      expect((await ranked()!.rating(f.economy.book.find(c.account)!.pk, 'goal-rush')).games).toBe(1);
      expect((await ranked()!.rating(f.economy.book.find(c.account)!.pk, 'goal-rush')).rating).toBeLessThan(RANKED.start);
      void a;
    } finally { f.room.onDispose(); }
  }, 30000);
  it('refuses ranked without an account, and keeps the queues apart', async () => {
    const f = await fixture();
    try {
      expect(() => f.room.onAuth(client('x'), f.options('x'))).toThrow('account');
      expect(() => f.room.onAuth(client('x'), { ...f.options('x', 'whatever'), queue: 'classic' })).toThrow('another queue');
      // Its rules are the queue's: nobody switches them, the first person in included.
      const first = f.join('a');
      f.send(first.c, 'ball-rules', 'giant-ball'); f.send(first.c, 'ball-rumble', true);
      expect(f.room.game.view.mutator).toBeNull(); expect(f.room.game.view.rumble).toBe(false);
    } finally { f.room.onDispose(); }
    const p = await fixture('playlist');
    try {
      expect(p.room.game.view.mutator).toBe(p.mutator);
    } finally { p.room.onDispose(); }
    // A page from last week, or one that names another mutator, is told to look again.
    const room = new BallRoom();
    vi.spyOn(room, 'setMetadata').mockResolvedValue(undefined); vi.spyOn(room, 'setFixedTimestep').mockImplementation(() => {}); vi.spyOn(room, 'onMessage').mockImplementation((() => () => {}) as never);
    const other = ['heat-rush', 'low-gravity', 'giant-ball', 'sudden-death'].find(m => m !== weeklyMutator(Date.now()));
    await expect(room.onCreate({ rosterProtocol: ROSTER_PROTOCOL, access: 'quick', queue: 'playlist', mutator: other, ballProtocol: BALL_PROTOCOL, ball: 'goal-rush' })).rejects.toThrow('playlist');
  });
});
