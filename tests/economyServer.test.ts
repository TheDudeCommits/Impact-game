import { describe, expect, it, onTestFinished } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import crypto from 'node:crypto';
import { Economy, mountEconomy } from '../src/server/economy/api';
import { Book } from '../src/server/economy/book';
import { PrivyVerifier } from '../src/server/economy/privy';
import type { SurvivalReport } from '../src/game/economy/earn';
import type { Account } from '../src/game/economy/account';
import { ITEM } from '../src/game/economy/catalog';

const run = (id: string, over: Partial<SurvivalReport> = {}): SurvivalReport => ({ id, mode: 'survival', fighter: 'kenzo', seconds: 800, round: 7, rank: 3, bosses: 7, finishers: 3, score: 2_000_000, kills: 1800, style: 4, ...over });
const clock = (start = Date.UTC(2026, 8, 30, 12)) => { let at = start; const now = () => at; now.pass = (seconds: number) => { at += seconds * 1000; }; return now; };
type Answer = { account: Account; signedIn?: boolean; token?: string; settlement?: { total: number }; sold: Record<string, number>; config: { privy?: string; pay: string } };

/** A Privy app's key, and a login's token signed with it. */
function privy(appId: string) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1' };
  const fetcher = (async () => ({ ok: true, json: async () => ({ keys: [jwk] }) })) as unknown as typeof fetch;
  const token = (did: string, claims: Record<string, unknown> = {}) => {
    const part = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const head = `${part({ alg: 'ES256', typ: 'JWT', kid: 'k1' })}.${part({ iss: 'privy.io', aud: appId, sub: did, exp: Math.floor(Date.now() / 1000) + 600, ...claims })}`;
    return `${head}.${crypto.sign('sha256', Buffer.from(head), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
  };
  return { fetcher, token };
}

describe('the economy: the server', () => {
  it('opens a guest account, pays a run once, sells and dresses, and refuses what it should', () => {
    const now = clock(), e = new Economy({ dir: false, now, adminToken: 'owner' });
    const hello = e.hello(undefined, '1.1.1.1') as Answer;
    expect(hello.token).toMatch(/^[a-f0-9]{32}$/); expect(hello.account.balance).toBe(0); expect(hello.config).toEqual({ privy: undefined, pay: 'off' });
    expect((e.hello(hello.token) as Answer).account.pk).toBe(hello.account.pk);
    expect(()=>e.report(hello.token,run('first-run'))).toThrow(/No completed/);
    e.complete(hello.account.pk,run('first-run'));
    const paid = e.report(hello.token, run('first-run')) as Answer;
    expect(paid.settlement!.total).toBeGreaterThan(100); expect(paid.account.balance).toBe(paid.settlement!.total);
    expect(() => e.report(hello.token, run('second-run'))).toThrow(/No completed/);
    now.pass(60);
    expect((e.report(hello.token, run('first-run')) as Answer).settlement).toEqual(paid.settlement);
    expect(() => e.report('0'.repeat(32), run('x-run-1'))).toThrow(/not known/);
    // (8 October, the shop streamlined: nothing costs 60 now, and the road's own items are not sold.)
    e.grant('Bearer owner', hello.account.pk, 1000, undefined);
    const bought = e.buy(hello.token, 'outfit-taisei-golden-sage') as Answer;
    expect(bought.account.items['outfit-taisei-golden-sage']).toBeTruthy(); expect(bought.account.balance).toBe(paid.settlement!.total + 1000 - 300);
    expect(() => e.buy(hello.token, 'skin-gold-leaf')).toThrow(/not in Account/);
    expect((e.wear(hello.token, 'outfit', 'outfit-taisei-golden-sage') as Answer).account.worn.outfits?.taisei).toBe('outfit-taisei-golden-sage');
    expect(() => e.wear(hello.token, 'skin', 'skin-sumi-e')).toThrow(/do not own/);
    expect(() => e.grant('Bearer nope', hello.account.pk, 100, undefined)).toThrow(/Not allowed/);
    e.close();
  });

  it('keeps its book across a restart, and replays the ledger past the last book', () => {
    const dir = mkdtempSync(join(tmpdir(), 'economy-test-'));
    try {
      const now = clock();
      let e = new Economy({ dir, now, adminToken: 'owner' });
      const hello = e.hello(undefined) as Answer;
      e.complete(hello.account.pk, run('kept-run-1'));
      e.grant('Bearer owner', hello.account.pk, 50000, undefined);
      e.buy(hello.token, 'skin-negative');
      const before = (e.hello(hello.token) as Answer).account;
      e.close();
      e = new Economy({ dir, now });
      const after = (e.hello(hello.token) as Answer).account;
      expect(after.balance).toBe(before.balance); expect(after.items['skin-negative']).toBeTruthy(); expect(after.stats.runs).toBe(1);
      // A purchase the book never saw written (the server died before its next save): the ledger has it.
      now.pass(60);
      e.buy(hello.token, 'aura-thunder-coil');
      const spent = (e.hello(hello.token) as Answer).account.balance;
      // (No close: the book on disk is the old one; only the ledger line is there.)
      const again = new Economy({ dir, now });
      const replayed = (again.hello(hello.token) as Answer).account;
      expect(replayed.items['aura-thunder-coil']).toBeTruthy(); expect(replayed.balance).toBe(spent);
      expect(readFileSync(join(dir, 'ledger.jsonl'), 'utf8')).not.toContain(hello.token);
      again.close(); e.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('loses nothing to a crash: what is worn, a sign-out, and two accounts made one are all in the ledger', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'economy-test-'));
    try {
      const now = clock(), p = privy('app-one');
      const e = new Economy({ dir, now, privyAppId: 'app-one', fetcher: p.fetcher });
      const first = e.hello(undefined) as Answer;
      e.complete(first.account.pk, run('crash-run-1'));
      e.wear(first.token, 'title', undefined);
      const signed = await e.signIn(first.token, p.token('did:privy:crash1')) as Answer;
      const other = e.hello(undefined) as Answer;
      e.complete(other.account.pk, run('crash-run-2'));
      const folded = await e.signIn(other.token, p.token('did:privy:crash1')) as Answer;
      e.signOut(signed.token);
      const stood = e.book.accounts.get(first.account.pk)!;
      // The process dies here: no book was ever written. A new one starts from the ledger alone.
      const again = new Economy({ dir, now, privyAppId: 'app-one', fetcher: p.fetcher });
      const back = again.book.accounts.get(first.account.pk)!;
      expect(back).toEqual(JSON.parse(JSON.stringify(stood)));
      expect(back.worn.title).toBeUndefined(); expect(back.label).toBeUndefined(); expect(back.stats.runs).toBe(2);
      expect(again.book.accounts.has(other.account.pk)).toBe(false);
      expect(again.book.find(signed.token)).toBeUndefined();                       // signed out
      expect(again.book.find(folded.token)?.pk).toBe(first.account.pk);             // the second device's session
      expect(again.book.find(other.token)?.pk).toBe(first.account.pk);              // and its old guest token, folded in
      expect(again.book.byLogin('did:privy:crash1')?.pk).toBe(first.account.pk);
      again.close(); e.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('keeps the match server up when the folder cannot be written: the book lives in memory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'economy-test-'));
    try {
      writeFileSync(join(dir, 'a-file'), 'x');
      const e = new Economy({ dir: join(dir, 'a-file', 'economy') });
      expect(e.kept).toBeUndefined();
      expect((e.hello(undefined) as Answer).account.balance).toBe(0);
      e.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('numbers a Mythic as it sells and stops at its last copy', () => {
    // (None is on sale since 8 October - the Author's Hand was retired - but the rule stands for the next one.)
    const mythic = ITEM.get('skin-authors-hand')!, was = { stage: mythic.stage, price: mythic.price };
    Object.assign(mythic, { stage: 'live', price: 12000 });
    onTestFinished(() => { Object.assign(mythic, was); });
    const e = new Economy({ dir: false, adminToken: 'owner' });
    const buyer = () => { const h = e.hello(undefined) as Answer; e.grant('Bearer owner', h.account.pk, 20000, undefined); const a = e.book.accounts.get(h.account.pk)!; a.xp = 100000; a.feats.push('author'); return h; };
    const first = buyer(), second = buyer();
    expect((e.buy(first.token, 'skin-authors-hand') as Answer).account.items['skin-authors-hand'].serial).toBe(1);
    expect((e.buy(second.token, 'skin-authors-hand') as Answer).account.items['skin-authors-hand'].serial).toBe(2);
    e.book.sold.set('skin-authors-hand', 100);
    expect(() => e.buy(buyer().token, 'skin-authors-hand')).toThrow(/copies are gone/);
    e.close();
  });

  it('signs a guest in with Privy, keeps the account under the login, and folds a second device in', async () => {
    const p = privy('app-one'), e = new Economy({ dir: false, privyAppId: 'app-one', fetcher: p.fetcher });
    const guest = e.hello(undefined) as Answer;
    e.complete(guest.account.pk, run('guest-run-1'));
    const signed = await e.signIn(guest.token, p.token('did:privy:abc123')) as Answer;
    expect(signed.token).toMatch(/^s_/); expect(signed.account.pk).toBe(guest.account.pk); expect(signed.signedIn).toBe(true); expect(signed.account.label).toBeUndefined(); expect(signed.config.privy).toBe('app-one');
    // Another device: a guest there has played; signing in brings its pay into the account.
    const other = e.hello(undefined) as Answer;
    e.complete(other.account.pk, run('other-run-1'));
    const both = e.book.accounts.get(guest.account.pk)!.balance + e.book.accounts.get(other.account.pk)!.balance;
    const second = await e.signIn(other.token, p.token('did:privy:abc123')) as Answer;
    expect(second.account.pk).toBe(guest.account.pk); expect(second.account.balance).toBe(both); expect(e.book.accounts.has(other.account.pk)).toBe(false);
    expect((e.hello(other.token) as Answer).account.pk).toBe(guest.account.pk);
    // Signing out leaves the device with a fresh guest; the account is still the login's.
    const out = e.signOut(second.token) as Answer;
    expect(out.account.pk).not.toBe(guest.account.pk); expect(() => e.report(second.token, run('after-out-1'))).toThrow(/not known/);
    await expect(e.signIn(undefined, p.token('did:privy:abc123', { aud: 'another-app' }))).rejects.toThrow(/another app/);
    await expect(e.signIn(undefined, p.token('did:privy:abc123', { exp: 1 }))).rejects.toThrow(/expired/);
    await expect(new PrivyVerifier('').verify('x')).rejects.toThrow(/not set up/);
    e.close();
  });

  it('answers over HTTP: only the game\'s own origins, JSON in and out, a refusal as a 400', async () => {
    const posts = new Map<string, (req: unknown, res: unknown) => void>(); let gate: ((req: unknown, res: unknown, next: () => void) => void) | undefined;
    const before = process.env.ECONOMY_ORIGINS; process.env.ECONOMY_ORIGINS = 'https://game.example.com, https://other.example.com';
    const economy = mountEconomy({ use: (_path, handler) => { gate = handler as never; }, post: (path, handler) => { posts.set(path, handler as never); } }, { dir: false });
    if (before === undefined) delete process.env.ECONOMY_ORIGINS; else process.env.ECONOMY_ORIGINS = before;
    const call = (path: string, body: unknown, origin = 'https://game.example.com', method = 'POST') => new Promise<{ status: number; headers: Record<string, string>; body: Record<string, unknown> | undefined }>(resolve => {
      const req = Object.assign(new EventEmitter(), { method, headers: { origin } as Record<string, string> });
      // (As the match server's transport leaves it: every origin already let in.)
      const headers: Record<string, string> = { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true' };
      const res = { statusCode: 0, setHeader: (k: string, v: string) => { headers[k.toLowerCase()] = v; }, removeHeader: (k: string) => { delete headers[k.toLowerCase()]; }, end: (text?: string) => resolve({ status: res.statusCode, headers, body: text ? JSON.parse(text) : undefined }) };
      gate!(req, res, () => { posts.get(path)!(req, res); queueMicrotask(() => { req.emit('data', Buffer.from(JSON.stringify(body))); req.emit('end'); }); });
    });
    const hello = await call('/api/economy/hello', {});
    expect(hello.status).toBe(200); expect(hello.headers['access-control-allow-origin']).toBe('https://game.example.com'); expect(hello.body!.token).toMatch(/^[a-f0-9]{32}$/);
    const foreign = await call('/api/economy/hello', {}, 'https://evil.example');
    expect(foreign.headers['access-control-allow-origin']).toBeUndefined(); expect(foreign.headers['access-control-allow-credentials']).toBeUndefined();
    expect((await call('/api/economy/hello', {}, 'http://127.0.0.1:5373')).headers['access-control-allow-origin']).toBe('http://127.0.0.1:5373');
    expect((await call('/api/economy/hello', {}, 'https://game.example.com.evil.example')).headers['access-control-allow-origin']).toBeUndefined();
    expect((await call('/api/economy/hello', {}, 'https://game.example.com', 'OPTIONS')).status).toBe(204);
    expect((await call('/api/economy/hello', {}, 'https://other.example.com', 'OPTIONS')).headers['access-control-allow-origin']).toBe('https://other.example.com');
    const refused = await call('/api/economy/buy', { token: hello.body!.token, item: 'outfit-taisei-golden-sage' });
    expect(refused.status).toBe(400); expect(String(refused.body!.error)).toMatch(/costs/);
    economy.close();
  });

  it('hashes tokens in the book', () => {
    const book = new Book(undefined), made = book.create(Date.now());
    expect(book.find(made.token)?.pk).toBe(made.account.pk); expect(book.find('f'.repeat(32))).toBeUndefined(); expect(book.find('not a token')).toBeUndefined();
  });
});
