import { describe, expect, it } from 'vitest';
import { dockText } from '../src/ui/modes/WaitingDock';
import { boardHtml, duelChoice, duelQueueOf, rankedResultHtml } from '../src/ui/duel/ranked';
import { matchResults } from '../src/ui/MatchResults';
import { P2ColyseusRoom, type P2LiveRoom, type P2Rooms } from '../src/network/p2Room';
import { p2Mode } from '../src/p2room/protocol';
import { RANKED_DUEL, type RankedDuelView } from '../src/game/duel/ranked';
import type { RankedBoard } from '../src/game/ball/ranked';
import type { GameSnapshot, PlayerState } from '../src/game/types';

/** The ranked Duel on the page: the queue's words, the set's verdict on the results, the season's board, and the join
 *  PlayerTwo is asked for. */
const view = (seats: RankedDuelView['seats'], rated = true): RankedDuelView => ({ queue: 'ranked', season: 1, seats, rated });
const lobby = { duel: true, visibility: 'public', hostId: null, canStart: false, startsAt: null, expiresAt: null };
const frame = (players: { id: string; isBot?: boolean }[], ranked?: RankedDuelView, startsAt: number | null = null) =>
  ({ phase: 'waiting', self: { id: 'me' }, snapshot: { roomMode: 'match', serverTime: 10, lobby: { ...lobby, startsAt }, players, ...(ranked ? { ranked } : {}) } }) as never;

describe('the ranked queue\'s dock', () => {
  it('says RANKED and how it matches, offers an unranked bot after half a minute, and says when the opponent is found', () => {
    const alone = frame([{ id: 'me' }], view({ me: { rating: 1187, games: 14 } }, false));
    expect(dockText(alone, 12)).toEqual({ title: 'RANKED · FINDING AN OPPONENT · 0:12', detail: 'NEAREST RATING FIRST · NEVER A BOT', cancel: 'CANCEL' });
    expect(dockText(alone, 31)).toMatchObject({ detail: "NOBODY'S QUEUED · AN UNRANKED BOT ON THIS DEVICE?", bot: 'FIGHT A BOT', cancel: 'CANCEL' });
    expect(dockText(frame([{ id: 'me' }, { id: 'them' }], view({}), 13), 20)).toMatchObject({ title: 'RANKED OPPONENT FOUND', detail: 'GET READY · 3s' });
    // The casual queue's words are as they were.
    expect(dockText(frame([{ id: 'me' }]), 12)).toMatchObject({ title: 'FINDING AN OPPONENT · 0:12', detail: 'REAL PLAYERS ONLY · NEVER A BOT' });
  });
});

describe('the set\'s verdict and the season\'s board', () => {
  it('says a promotion, a placement counted down, a plain change, and an unrated set', () => {
    const promoted = rankedResultHtml(view({ me: { rating: 1161, games: 15, delta: 21 } }), 'me');
    expect(promoted).toContain('PROMOTED · TONED'); expect(promoted).toContain('+21'); expect(promoted).toContain('dr-promoted');
    expect(rankedResultHtml(view({ me: { rating: 983, games: 3, delta: -27 } }), 'me')).toContain('PLACEMENT 3 OF 5 · 2 TO GO');
    expect(rankedResultHtml(view({ me: { rating: 1040, games: 5, delta: 24 } }), 'me')).toContain('PLACED · INKED');
    expect(rankedResultHtml(view({ me: { rating: 1056, games: 12, delta: 16 } }), 'me')).toContain('+16 RATING');
    expect(rankedResultHtml(view({ me: { rating: 1000, games: 0 } }, false), 'me')).toContain('UNRANKED');
    expect(rankedResultHtml(undefined, 'me')).toBe('');
  });
  it('draws the board\'s rows, marks the player\'s own, and their place below the top after a gap', () => {
    const row = (place: number, name: string, you = false) => ({ place, name, rating: 1500 - place * 20, games: 10, wins: 6, tier: 'toned' as const, ...(you ? { you: true as const } : {}) });
    const board: RankedBoard = { season: 1, ends: 0, mode: 'duel', top: [row(1, 'MIRAGE'), row(2, 'KITE', true)] };
    const html = boardHtml(board);
    expect(html).toContain('SEASON 1 · TOP 2'); expect(html).toContain('<i>YOU</i>'); expect(html).not.toContain('dr-gap');
    expect(boardHtml({ ...board, top: [row(1, 'MIRAGE')], me: row(14, 'KITE', true) })).toContain('dr-gap');
    expect(boardHtml({ ...board, top: [] })).toContain('Nobody has placed yet this season');
    expect(boardHtml({ ...board, top: [row(1, '<b>X</b>')] })).toContain('&lt;b&gt;X&lt;/b&gt;');
    expect(boardHtml(undefined)).toBe('');
  });
  it('keeps the Duel\'s queue on its own sheet prefs', () => {
    expect(duelQueueOf({})).toBe('quick'); expect(duelQueueOf({ queue: 'ranked' })).toBe('ranked');
    expect(duelChoice('queue:ranked')).toEqual({ queue: 'ranked' }); expect(duelChoice('queue:quick')).toEqual({ queue: 'classic' }); expect(duelChoice('mode:x')).toBeUndefined();
  });
  it('puts the verdict on the Duel\'s results, and queues ranked again instead of running it back', () => {
    const me = { id: 'me', fighter: 'kenzo', name: 'KITE', isBot: false, alive: true, kills: 2, damageDealt: 3000, damageTaken: 2000 } as unknown as PlayerState;
    const them = { ...me, id: 'them', fighter: 'konta', name: 'RUSTWING' } as PlayerState;
    const snapshot = { roomMode: 'match', status: 'finished', serverTime: 300, events: [], stage: 'sunfall-arena', winnerId: 'me', tick: 0, players: [me, them], lobby,
      duel: { set: 1, round: 3, firstTo: 2, scores: { me: 2, them: 1 }, phase: 'complete', nextRoundAt: null, roundWinner: 'me', winner: 'me', runback: [], startedAt: 20 },
      ranked: view({ me: { rating: 1161, games: 15, delta: 21 }, them: { rating: 1155, games: 23, delta: -21 } }) } as unknown as GameSnapshot;
    const html = matchResults(snapshot, me, [], 'FIND RANKED DUEL');
    expect(html).toContain('DUEL · RANKED'); expect(html).toContain('PROMOTED · TONED'); expect(html).toContain('QUEUE RANKED AGAIN');
    expect(html).not.toContain('RUN IT BACK');
    const casual = matchResults({ ...snapshot, ranked: undefined }, me, [], 'FIND NEXT DUEL');
    expect(casual).toContain('RUN IT BACK'); expect(casual).not.toContain('dr-result');
  });
});

describe('the ranked queue\'s join', () => {
  it('asks PlayerTwo for its own matching key, by skill; the casual Duel\'s as before', async () => {
    const asked: Record<string, unknown>[] = [];
    const rooms: P2Rooms = {
      create: async () => { throw new Error('not here'); },
      join: async (options) => {
        asked.push(options);
        let hear: (type: string, data: unknown) => void = () => {};
        return { id: 'r', code: null, me: 'me', scripted: true, rate: 240, leave() {}, on(event: string, fn: (...a: unknown[]) => void) { if (event === 'message') hear = fn as typeof hear; },
          send(type: string) { if (type === '$join') queueMicrotask(() => hear('$joined', { sessionId: 'me', roomId: 'r' })); } } as unknown as P2LiveRoom;
      },
    };
    await P2ColyseusRoom.open(rooms, { kind: 'duel_arena', how: { match: [RANKED_DUEL.match] }, size: 2, skill: true, options: { queue: 'ranked' } });
    await P2ColyseusRoom.open(rooms, { kind: 'duel_arena', how: { match: [] }, size: 2, options: {} });
    expect(asked).toEqual([{ mode: 'i1-duel-rk', size: 2, between: false, skill: true }, { mode: 'i1-duel', size: 2, between: false }]);
    expect(p2Mode('duel_arena', [RANKED_DUEL.match])).toBe('i1-duel-rk');
  });
});
