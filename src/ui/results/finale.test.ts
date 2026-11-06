import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { matchResults } from '../MatchResults';
import type { GameSnapshot, PlayerState } from '../../game/types';
import { FINALE, Finale, finaleMine, finaleSeconds, finaleStateOf, finaleWinner } from './finale';

const player = (id: string, extra: Partial<PlayerState> = {}) => ({ id, name: id, fighter: 'konta', alive: true, isBot: false, hp: 1000, maxHp: 1000, ...extra }) as unknown as PlayerState;
const snap = (extra: Record<string, unknown> = {}, players = [player('me'), player('rival', { alive: false, fighter: 'taisei' })]) =>
  ({ players, events: [], serverTime: 40, roomMode: 'match', status: 'active', winnerId: null, stage: 'harbor', ...extra }) as unknown as GameSnapshot;
const all = () => true, none = () => false, known = () => 2.5;
const unknown = () => undefined;

describe('the finale holds the results for the winner\'s pose', () => {
  it('times a winner\'s finale on their line, within its bounds', () => {
    expect(finaleSeconds({ winner: true, line: 2.5 })).toBeCloseTo(FINALE.lineAt + 2.5 + FINALE.after);
    expect(finaleSeconds({ winner: true, line: .7 })).toBe(FINALE.least);
    expect(finaleSeconds({ winner: true, line: 7.3 })).toBe(FINALE.most);
    expect(finaleSeconds({ winner: true })).toBeCloseTo(FINALE.lineAt + FINALE.line + FINALE.after);
    expect(finaleSeconds({ winner: true, line: NaN })).toBeCloseTo(FINALE.lineAt + FINALE.line + FINALE.after);
    // Nobody to pose: a beat for the K.O. card.
    expect(finaleSeconds({ winner: false, line: 3 })).toBe(FINALE.beat);
    // A few seconds, never the six of the victory orbit, never the old instant.
    expect(FINALE.least).toBeGreaterThanOrEqual(3);
    expect(FINALE.most).toBeLessThanOrEqual(6);
  });

  it('holds the results after a match it watched end, then lets them show', () => {
    const finale = new Finale();
    finale.observe(undefined, true, 10);
    expect(finale.done(10)).toBe(true);
    finale.observe({ key: 'match:a', winner: true, line: 2.5 }, false, 20);
    const seconds = finaleSeconds({ winner: true, line: 2.5 });
    expect(finale.holding(20)).toBe(true);
    expect(finale.holding(20 + seconds - .01)).toBe(true);
    expect(finale.left(20 + 1)).toBeCloseTo(seconds - 1);
    expect(finale.done(20 + seconds + 1e-9)).toBe(true);
    // The same end, frame after frame, does not start it again.
    finale.observe({ key: 'match:a', winner: true, line: 2.5 }, false, 20 + seconds + 1);
    expect(finale.done(20 + seconds + 1)).toBe(true);
  });

  it('opens the results at once for an end it never saw fought (a reconnection, a room joined over)', () => {
    const finale = new Finale();
    finale.observe({ key: 'match:a', winner: true }, false, 5);
    expect(finale.done(5)).toBe(true);
    // A room still waiting is not a fight either.
    finale.observe(undefined, false, 6);
    finale.observe({ key: 'match:b', winner: true }, false, 7);
    expect(finale.done(7)).toBe(true);
  });

  it('is skipped by a confirm press, never inside its guard; the room gone skips it at once', () => {
    const finale = new Finale();
    finale.observe(undefined, true, 0);
    finale.observe({ key: 'match:a', winner: true }, false, 1);
    expect(finale.skip(1 + FINALE.guard / 2)).toBe(false);
    expect(finale.holding(1 + FINALE.guard / 2)).toBe(true);
    expect(finale.skip(1 + FINALE.guard + .01)).toBe(true);
    expect(finale.done(1 + FINALE.guard + .01)).toBe(true);
    // Nothing left to skip.
    expect(finale.skip(1 + FINALE.guard + .5)).toBe(false);
    const lost = new Finale();
    lost.observe(undefined, true, 0);
    lost.observe({ key: 'match:a', winner: true }, false, 1);
    expect(lost.skip(1.1, true)).toBe(true);
    expect(lost.done(1.1)).toBe(true);
    expect(lost.ended).toBe(true);
  });

  it('starts afresh for the next match, and forgets everything on the way home', () => {
    const finale = new Finale();
    finale.observe(undefined, true, 0);
    finale.observe({ key: 'set-1', winner: true }, false, 1);
    finale.skip(2);
    // A runback: the set waits, then is fought again.
    finale.observe(undefined, false, 3);
    expect(finale.ended).toBe(false);
    finale.observe(undefined, true, 5);
    finale.observe({ key: 'set-2', winner: true }, false, 60);
    expect(finale.holding(61)).toBe(true);
    finale.reset();
    expect(finale.done(61)).toBe(true);
    expect(finale.ended).toBe(false);
  });
});

describe('what a snapshot shows as over', () => {
  it('a duel only once its set is decided, a royale once finished; training never', () => {
    expect(finaleStateOf(snap(), all, known)).toEqual({ running: true });
    // Between rounds the room shows the set waiting (DuelSet.snapshot): no finale.
    const between = finaleStateOf(snap({ status: 'waiting', duel: { set: 1, phase: 'interval', scores: { me: 1 } } }), all, known);
    expect(between).toEqual({ running: false });
    const set = finaleStateOf(snap({ status: 'finished', winnerId: 'me', duel: { set: 2, phase: 'complete', scores: { me: 2 } } }), all, known);
    expect(set.end).toEqual({ key: 'match::2:me', winner: true, line: 2.5 });
    const royale = finaleStateOf(snap({ status: 'finished', winnerId: 'me', matchId: 'm1' }), all, unknown);
    expect(royale.end).toEqual({ key: 'match:m1:0:me', winner: true, line: undefined });
    expect(finaleStateOf(snap({ status: 'finished', winnerId: 'me', roomMode: 'training' }), all, known)).toEqual({ running: false });
    expect(finaleStateOf(undefined, all, known)).toEqual({ running: false });
  });

  it('a draw, or a winner whose body is not drawn, gets the beat', () => {
    const draw = finaleStateOf(snap({ status: 'finished', winnerId: null }), all, known).end!;
    expect(draw.winner).toBe(false);
    expect(finaleSeconds(draw)).toBe(FINALE.beat);
    const unseen = finaleStateOf(snap({ status: 'finished', winnerId: 'me' }), none, known).end!;
    expect(unseen).toEqual({ key: 'match::0:me', winner: false, line: undefined });
  });

  it('a team\'s win poses a fighter of the side still standing; the horde\'s win poses nobody', () => {
    const heroes = [player('h1', { team: 'heroes', alive: false }), player('h2', { team: 'heroes', fighter: 'gummy' }), player('v1', { team: 'villains', alive: false })];
    const blood = snap({ status: 'finished', winnerId: 'h1', objective: { kind: 'bad-blood', phase: 'over', round: 3, endsAt: 99, winner: 'heroes' } }, heroes);
    expect(finaleWinner(blood)?.id).toBe('h2');
    expect(finaleStateOf(blood, all, f => f === 'gummy' ? 3.1 : undefined).end).toEqual({ key: 'operation:bad-blood:3:99', winner: true, line: 3.1 });
    const war = snap({ status: 'finished', winnerId: 'h1', rift: { phase: 'over', round: 1, endsAt: 400, winner: 'heroes' } }, heroes);
    expect(finaleWinner(war)?.id).toBe('h2');
    expect(finaleStateOf(war, all, unknown).end?.key).toBe('rift:1:400');
    const fell = snap({ status: 'finished', winnerId: null, objective: { kind: 'last-stand', phase: 'over', round: 1, endsAt: 50, winner: 'horde' } }, [player('d1', { team: 'defenders' })]);
    expect(finaleWinner(fell)).toBeUndefined();
    expect(finaleStateOf(fell, all, known).end?.winner).toBe(false);
    // An operation being fought, or in its lobby.
    expect(finaleStateOf(snap({ objective: { kind: 'last-stand', phase: 'active', round: 1, endsAt: 0, winner: null } }), all, known)).toEqual({ running: true });
    expect(finaleStateOf(snap({ objective: { kind: 'last-stand', phase: 'lobby', round: 1, endsAt: 0, winner: null } }), all, known)).toEqual({ running: false });
  });

  it('says whose win it is: the player\'s own, or their side\'s', () => {
    expect(finaleMine(snap({ status: 'finished', winnerId: 'me' }), 'me')).toBe(true);
    expect(finaleMine(snap({ status: 'finished', winnerId: 'rival' }), 'me')).toBe(false);
    expect(finaleMine(snap({ status: 'finished', winnerId: null }), '')).toBe(false);
    const side = [player('me', { team: 'villains', alive: false }), player('v2', { team: 'villains' }), player('h1', { team: 'heroes', alive: false })];
    expect(finaleMine(snap({ status: 'finished', winnerId: 'v2', objective: { kind: 'bad-blood', phase: 'over', round: 1, endsAt: 9, winner: 'villains' } }, side), 'me')).toBe(true);
    expect(finaleMine(snap({ status: 'finished', winnerId: 'h1', rift: { phase: 'over', round: 1, endsAt: 9, winner: 'heroes' } }, side), 'me')).toBe(false);
  });
});

describe('the finale and what it holds back', () => {
  it('is timed on the winner\'s line as main.ts starts it on the winning side\'s pages', () => {
    const main = fs.readFileSync('src/main.ts', 'utf8');
    expect(main).toContain(`audio.quote(line,.85,mine?${FINALE.lineAt}:`);
  });

  it('a rival who leaves after losing the set - during the winner\'s finale - leaves a set won on rounds', () => {
    const me = player('me', { kills: 2, damageDealt: 3000, damageTaken: 900 });
    const duel = { set: 1, round: 3, firstTo: 2, scores: { me: 2, rival: 1 }, phase: 'complete', nextRoundAt: null, roundWinner: 'me', winner: 'me', runback: [] };
    const won = matchResults(snap({ status: 'finished', winnerId: 'me', lobby: { duel: true, visibility: 'public' }, duel }, [me]), me, ['rival'], 'FIND NEXT DUEL');
    expect(won).toContain('You won the best-of-three set.');
    expect(won).not.toContain('Your rival left the duel.');
    expect(won).toContain('2–1');
    // A rival gone before it was won: a forfeit, as before.
    const left = matchResults(snap({ status: 'finished', winnerId: 'me', lobby: { duel: true, visibility: 'public' }, duel: { ...duel, scores: { me: 1, rival: 1 } } }, [me]), me, ['rival'], 'FIND NEXT DUEL');
    expect(left).toContain('Your rival left the duel.');
  });
});
