import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FEATS } from '../src/game/economy/feats';
import { PlayerTwoTrophies } from '../src/server/economy/playertwoTrophies';
import { Economy } from '../src/server/economy/api';
import { deviceId } from '../src/game/economy/device';
import type { MatchReport, SurvivalReport } from '../src/game/economy/earn';
import type { Account } from '../src/game/economy/account';

type Answer = { account: Account; token?: string };
const GAME_KEY = ['p2g', 'test', 'game', 'key', '0123456789'].join('_');
const PLAYER = 'p2player0000000001';
const clock = (start = Date.UTC(2026, 9, 21, 12)) => { let at = start; const now = () => at; now.pass = (seconds: number) => { at += seconds * 1000; }; return now; };
const run = (id: string, over: Partial<SurvivalReport> = {}): SurvivalReport => ({ id, mode: 'survival', fighter: 'kenzo', seconds: 800, round: 7, rank: 3, bosses: 7, finishers: 3, score: 2_000_000, kills: 1800, style: 4, ...over });
const part = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

/** Player Two's server routes, standing in: what was given, and how it answers next (status and body, in turn). */
function playerTwo() {
  const given: { feat: string; player: string; auth?: string }[] = [], answers: { status: number; body?: unknown; hang?: true }[] = [];
  const fetcher = (async (url: unknown, init?: RequestInit) => {
    const next = answers.shift() ?? { status: 200 };
    if (next.hang) return new Promise(() => {});
    if (next.status === 0) throw new Error('offline');
    const feat = decodeURIComponent(String(url).split('/trophies/')[1] ?? '');
    if (next.status === 200) given.push({ feat, player: JSON.parse(String(init?.body)).player, auth: (init?.headers as Record<string, string>).authorization });
    return { ok: next.status < 300, status: next.status, json: async () => next.body ?? (next.status === 200 ? { new: true, trophy: { key: feat } } : {}) };
  }) as unknown as typeof fetch;
  return { fetcher, given, answers };
}
/** Player Two's identities, standing in: an RS256 key, its published set, and an identity for a player. */
function identities(now: () => number = Date.now) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }), kid = 'k1';
  const fetcher = (async () => ({ ok: true, json: async () => ({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid }] }) })) as unknown as typeof fetch;
  const identity = (sub = PLAYER) => {
    const at = Math.floor(now() / 1000), head = `${part({ alg: 'RS256', kid })}.${part({ iss: 'https://playertwo.lol', aud: 'impact', sub, typ: 'p2-id', h: 'tester', name: 'Tester', lvl: 1, kind: 'full', iat: at, exp: at + 600 })}`;
    return `${head}.${crypto.sign('sha256', Buffer.from(head), privateKey).toString('base64url')}`;
  };
  return { fetcher, identity };
}


describe('Player Two: feats given as trophies (src/server/economy/playertwoTrophies.ts)', () => {
  it('gives each once, with the game key, and tries again what Player Two could not take', async () => {
    const now = clock(), p2 = playerTwo(), lines: string[] = [];
    const t = new PlayerTwoTrophies({ key: GAME_KEY, fetcher: p2.fetcher, now, log: line => lines.push(line) });
    p2.answers.push({ status: 503 }, { status: 200 }, { status: 0 });
    t.offer(PLAYER, ['first-run', 'wins-1', 'rank-c']);
    await t.flush();
    // first-run: 503, later; wins-1: given; rank-c: no connection, later.
    expect(p2.given.map(g => g.feat)).toEqual(['wins-1']); expect(t.pending).toBe(2);
    expect(p2.given[0]).toEqual({ feat: 'wins-1', player: PLAYER, auth: `Bearer ${GAME_KEY}` });
    now.pass(61); await t.flush();
    expect(p2.given.map(g => g.feat).sort()).toEqual(['first-run', 'rank-c', 'wins-1']); expect(t.pending).toBe(0);
    // Offered again (the next settlement): nothing new to give.
    t.offer(PLAYER, ['first-run', 'wins-1', 'rank-c']); await t.flush();
    expect(p2.given).toHaveLength(3);
    // A trophy Player Two doesn't have yet (the script not run): kept, and given once it is there.
    p2.answers.push({ status: 404, body: { code: 'unknown-trophy', error: 'This game has no trophy by that key.' } });
    t.offer(PLAYER, ['seal']); await t.flush();
    expect(t.pending).toBe(1); expect(lines.some(line => /seal: 404 unknown-trophy/.test(line))).toBe(true);
    now.pass(61); await t.flush();
    expect(p2.given.map(g => g.feat)).toContain('seal'); expect(t.pending).toBe(0);
    // The key refused: everything waits an hour.
    p2.answers.push({ status: 401, body: { error: 'That key isn\'t one of a game\'s on Player Two any more.' } });
    t.offer(PLAYER, ['author', 's-rank']); await t.flush();
    expect(t.pending).toBe(2); expect(p2.given).toHaveLength(4);
    now.pass(1800); await t.flush(); expect(t.pending).toBe(2);
    now.pass(1801); await t.flush(); expect(t.pending).toBe(0); expect(p2.given).toHaveLength(6);
    // A refusal that isn't Player Two's to take (a demo player's): let go.
    p2.answers.push({ status: 403, body: { code: 'demo' } });
    t.offer(PLAYER, ['level-40']); await t.flush();
    expect(t.pending).toBe(0); expect(p2.given).toHaveLength(6);
    t.close();
  });

  it('keeps what Player Two took across a restart, and gives nothing without a game key', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'p2-trophies-'));
    try {
      const p2 = playerTwo();
      const t = new PlayerTwoTrophies({ key: GAME_KEY, fetcher: p2.fetcher, dir, log: () => {} });
      t.offer(PLAYER, ['first-run', 'wins-1']); await t.flush(); t.close();
      expect(JSON.parse(readFileSync(join(dir, 'p2-trophies.json'), 'utf8'))).toEqual({ given: { [PLAYER]: ['first-run', 'wins-1'] } });
      const again = new PlayerTwoTrophies({ key: GAME_KEY, fetcher: p2.fetcher, dir, log: () => {} });
      again.offer(PLAYER, ['first-run', 'wins-1', 'rank-c']); await again.flush(); again.close();
      expect(p2.given.map(g => g.feat)).toEqual(['first-run', 'wins-1', 'rank-c']);
      const off = new PlayerTwoTrophies({ fetcher: p2.fetcher, log: () => {} });
      expect(off.enabled).toBe(false); off.offer(PLAYER, ['seal']); expect(off.pending).toBe(0);
      expect(new PlayerTwoTrophies({ key: 'not-a-key', log: () => {} }).enabled).toBe(false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('Player Two: feats given at settlement and at sign-in (Economy)', () => {
  it('gives a linked account\'s new feats as a match settles, without the settlement waiting on Player Two', async () => {
    const now = clock(), ids = identities(now);
    // Player Two never answers: a send is in flight, and the next settlements are written and returned all the same.
    const away = playerTwo();
    away.answers.push(...Array.from({ length: 20 }, () => ({ status: 200, hang: true as const })));
    const e = new Economy({ dir: false, now, playerTwo: { fetcher: ids.fetcher }, trophies: { key: GAME_KEY, fetcher: away.fetcher, log: () => {} } });
    const signed = await e.signInPlayerTwo(undefined, ids.identity()) as Answer;
    expect(e.complete(signed.account.pk, run('room-run-1'))?.settlement.feats).toContain('first-run');
    void e.trophies.flush();
    now.pass(60);
    expect(e.complete(signed.account.pk, run('room-run-2'))?.settlement.total).toBeGreaterThan(0);
    expect(e.book.accounts.get(signed.account.pk)!.stats.runs).toBe(2);
    expect(e.trophies.pending).toBeGreaterThan(0); expect(away.given).toHaveLength(0);
    e.close();
    // Player Two answering: what the settlement earned is given, to the player the login names.
    const p2 = playerTwo();
    const e2 = new Economy({ dir: false, now, playerTwo: { fetcher: ids.fetcher }, trophies: { key: GAME_KEY, fetcher: p2.fetcher, log: () => {} } });
    const linked = await e2.signInPlayerTwo(undefined, ids.identity()) as Answer;
    const settled = e2.complete(linked.account.pk, run('room-run-3', { rank: 4 }))!;
    await e2.trophies.flush();
    expect(p2.given.map(g => g.feat).sort()).toEqual([...settled.settlement.feats].sort());
    expect(p2.given.every(g => g.player === PLAYER)).toBe(true);
    // An account with no Player Two login: nothing is given.
    const guest = e2.hello(undefined) as Answer, before = p2.given.length;
    e2.complete(guest.account.pk, run('guest-run-1')); await e2.trophies.flush();
    expect(p2.given).toHaveLength(before);
    e2.close();
  });

  it('gives the feats an account already holds the first time it is linked, and an on-device match\'s too', async () => {
    const now = clock(), p2 = playerTwo(), ids = identities(now);
    const e = new Economy({ dir: false, now, playerTwo: { fetcher: ids.fetcher }, trophies: { key: GAME_KEY, fetcher: p2.fetcher, log: () => {} } });
    const guest = e.hello(undefined) as Answer;
    const held = e.complete(guest.account.pk, run('guest-run-1', { rank: 4 }))!.settlement.feats;
    await e.trophies.flush();
    expect(p2.given).toHaveLength(0);
    const signed = await e.signInPlayerTwo(guest.token, ids.identity()) as Answer;
    await e.trophies.flush();
    expect(p2.given.map(g => g.feat).sort()).toEqual([...held].sort());
    // Signed in again on another device: nothing given twice.
    await e.signInPlayerTwo(undefined, ids.identity()); await e.trophies.flush();
    expect(p2.given).toHaveLength(held.length);
    // A Duel won against a bot on the device: the first win is a feat.
    now.pass(600);
    const duel: MatchReport = { id: deviceId(), mode: 'duel', fighter: 'konta', seconds: 120, place: 1, players: 2, kos: 2 };
    e.report(signed.token, duel); await e.trophies.flush();
    expect(p2.given.map(g => g.feat)).toContain('wins-1');
    e.close();
  });
});
