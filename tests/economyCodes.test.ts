import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Economy, mountEconomy } from '../src/server/economy/api';
import { ALL_ACCESS_ID, ALL_ACCESS_MIN, CODES, codeHash, envCodes, normalCode, type CodeDef } from '../src/server/economy/codes';
import { ITEM, ITEMS } from '../src/game/economy/catalog';
import { LOCKED, mayPlay } from '../src/game/economy/fighters';
import { owns, unlocked, type Account } from '../src/game/economy/account';
import { RARITY } from '../src/game/economy/rarity';
import { AccountClient, Refused, type Poster, type Store } from '../src/ui/shop/account';
import { signInFlow } from '../src/ui/shop/signin';

const ALL_ACCESS_WORDS = 'Ink Stamp Master Key', BOUND_CODE = 'Bound To One', BOUND_EMAIL = 'owner@example.com';
const ALL_ACCESS = envCodes({ ALL_ACCESS_CODE: ALL_ACCESS_WORDS });
const BOUND: CodeDef[] = [{ id: 'test-bound', hash: codeHash(BOUND_CODE), says: 'All access.', grants: { allAccess: true }, email: BOUND_EMAIL }];
type Answer = { account: Account; token?: string; redeemed?: { says: string; allAccess: boolean; items: string[]; sumi: number } };

/** A Privy app's key, and a login's access and identity tokens signed with it (or with another key: `forged`). */
function privy(appId: string) {
  const key = () => crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const real = key(), fake = key();
  const jwk = { ...real.publicKey.export({ format: 'jwk' }), kid: 'k1' };
  const fetcher = (async () => ({ ok: true, json: async () => ({ keys: [jwk] }) })) as unknown as typeof fetch;
  const sign = (claims: Record<string, unknown>, forged = false) => {
    const part = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const head = `${part({ alg: 'ES256', typ: 'JWT', kid: 'k1' })}.${part({ iss: 'privy.io', aud: appId, exp: Math.floor(Date.now() / 1000) + 600, ...claims })}`;
    return `${head}.${crypto.sign('sha256', Buffer.from(head), { key: (forged ? fake : real).privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
  };
  const token = (did: string) => sign({ sub: did });
  /** Privy's identity token: the login's linked accounts, as a JSON string, in `linked_accounts`. */
  const identity = (did: string, linked: unknown[], claims: Record<string, unknown> = {}, forged = false) => sign({ sub: did, linked_accounts: JSON.stringify(linked), ...claims }, forged);
  return { fetcher, token, identity };
}
const email = (address: string) => ({ type: 'email', address, verified_at: 1, first_verified_at: 1, latest_verified_at: 1 });
/** A refusal's words, its status and what it asks for. */
async function refusal(work: () => unknown) {
  try { await work(); } catch (error) { const e = error as Error & { status?: number; need?: string }; return { message: e.message, status: e.status, need: e.need }; }
  throw new Error('It was not refused.');
}
/** A browser signed in with a Privy login (nothing the browser says of the login is sent or kept since 8 October 2026). */
async function signedIn(economy: Economy, p: ReturnType<typeof privy>, did: string) {
  const guest = economy.hello(undefined) as Answer;
  return (await economy.signIn(guest.token, p.token(did)) as Answer).token!;
}

describe('codes', () => {
  const TABLE: CodeDef[] = [
    { id: 'test-gift', hash: codeHash('Ink And Paper'), says: 'A gift from the press.', grants: { items: ['skin-newsprint', 'aura-embers'], sumi: 500 } },
    { id: 'test-two', hash: codeHash('ONLY-TWO'), says: 'Two only.', grants: { sumi: 10 }, limit: 2 },
  ];

  it('grants what a code says to the account that types it, once, and says plainly why not', async () => {
    const p = privy('app-one'), e = new Economy({ dir: false, privyAppId: 'app-one', fetcher: p.fetcher, codes: TABLE });
    const guest = e.hello(undefined) as Answer;
    expect(await refusal(() => e.redeem(guest.token, 'Ink And Paper', undefined))).toMatchObject({ message: expect.stringMatching(/^Sign in first/), status: 400 });
    const token = await signedIn(e, p, 'did:privy:player1');
    expect((await refusal(() => e.redeem(token, '   ', undefined))).message).toBe('Type a code first.');
    expect((await refusal(() => e.redeem(token, 'no such code', undefined))).message).toMatch(/^That code is not known/);
    // Trimmed, and case does not count.
    const got = await e.redeem(token, '  ink AND paper ', undefined) as Answer;
    expect(got.redeemed).toEqual({ says: 'A gift from the press.', allAccess: false, items: ['skin-newsprint', 'aura-embers'], sumi: 500 });
    expect(owns(got.account, 'skin-newsprint')).toBe(true); expect(got.account.balance).toBe(500); expect(got.account.earned).toBe(500);
    expect(got.account.redeemed?.['test-gift']).toBeGreaterThan(0); expect(got.account.allAccess).toBeUndefined();
    expect((await refusal(() => e.redeem(token, 'INK AND PAPER', undefined))).message).toBe('You have already redeemed that code.');
    expect(e.book.accounts.get(got.account.pk)!.balance).toBe(500);                  // (nothing granted twice)
    // A code for so many accounts only.
    for (const did of ['did:privy:a1', 'did:privy:a2']) expect((await e.redeem(await signedIn(e, p, did), 'only-two', undefined) as Answer).redeemed?.sumi).toBe(10);
    expect((await refusal(async () => e.redeem(await signedIn(e, p, 'did:privy:a3'), 'only-two', undefined))).message).toBe('That code has been used up.');
    e.close();
  });

  it('slows down guessing: ten wrong codes in an hour, then a wait', async () => {
    let at = Date.UTC(2026, 9, 8, 12);
    const p = privy('app-one'), e = new Economy({ dir: false, privyAppId: 'app-one', fetcher: p.fetcher, codes: TABLE, now: () => at });
    const token = await signedIn(e, p, 'did:privy:guesser');
    for (let i = 0; i < 10; i++) expect((await refusal(() => e.redeem(token, `guess-${i}`, undefined, '9.9.9.9'))).status).toBe(400);
    expect(await refusal(() => e.redeem(token, 'Ink And Paper', undefined, '9.9.9.9'))).toMatchObject({ status: 429, message: expect.stringMatching(/Too many codes/) });
    at += 3601_000;
    expect((await e.redeem(token, 'Ink And Paper', undefined, '9.9.9.9') as Answer).redeemed?.sumi).toBe(500);
    e.close();
  });

  it("gives a code bound to an email to that email's account only: checked on its verified email", async () => {
    const p = privy('app-one'), e = new Economy({ dir: false, privyAppId: 'app-one', fetcher: p.fetcher, codes: BOUND });
    const other = await signedIn(e, p, 'did:privy:someoneelse');
    // No proof of the login's email: the server asks for Privy's identity token.
    expect(await refusal(() => e.redeem(other, BOUND_CODE, undefined))).toMatchObject({ status: 400, need: 'identity' });
    // Another login's verified email: refused, and nothing changes.
    expect((await refusal(() => e.redeem(other, BOUND_CODE, p.identity('did:privy:someoneelse', [email('someone@else.com')])))).message).toBe('That code belongs to another account.');
    expect((await refusal(() => e.redeem(other, BOUND_CODE, p.identity('did:privy:owner', [email(BOUND_EMAIL)])))).message).toMatch(/not this account's/);
    expect((await refusal(() => e.redeem(other, BOUND_CODE, p.identity('did:privy:someoneelse', [email(BOUND_EMAIL)], {}, true)))).message).toMatch(/did not check out/);
    expect((await refusal(() => e.redeem(other, BOUND_CODE, p.identity('did:privy:someoneelse', [email(BOUND_EMAIL)], { exp: 1 })))).message).toMatch(/expired/);
    expect((await refusal(() => e.redeem(other, BOUND_CODE, p.identity('did:privy:someoneelse', [email(BOUND_EMAIL)], { aud: 'another-app' })))).message).toMatch(/another app/);
    expect(e.book.find(other)!.allAccess).toBeUndefined();
    // Its own login, the email verified on it (whatever its case).
    const owner = await signedIn(e, p, 'did:privy:owner');
    const got = await e.redeem(owner, ' bound TO one ', p.identity('did:privy:owner', [{ type: 'wallet', address: '0x12' }, email('Owner@Example.com')])) as Answer;
    expect(got.redeemed).toMatchObject({ allAccess: true, items: [], sumi: 0 }); expect(got.account.allAccess).toBe(true);
    expect(got.account.balance).toBe(0);                                                         // (nothing bought, nothing spent)
    for (const item of ITEMS.filter(each => each.stage === 'live')) { expect(owns(got.account, item.id), item.id).toBe(true); expect(unlocked(got.account, item.id), item.id).toBe(true); }
    for (const [fighter] of LOCKED) expect(mayPlay(fighter, e.book.find(owner)), fighter).toBe(true);
    // Each account once; a Google login's email counts as verified as well.
    expect((await refusal(() => e.redeem(owner, BOUND_CODE, undefined))).message).toBe('You have already redeemed that code.');
    const google = await signedIn(e, p, 'did:privy:ownergoogle');
    expect((await e.redeem(google, BOUND_CODE, p.identity('did:privy:ownergoogle', [{ type: 'google_oauth', email: BOUND_EMAIL, subject: '1', name: null }])) as Answer).account.allAccess).toBe(true);
    e.close();
  });

  it("gives the design's all-access code to any signed-in account, once each: all access, no email asked", async () => {
    const p = privy('app-one'), e = new Economy({ dir: false, privyAppId: 'app-one', fetcher: p.fetcher, codes: ALL_ACCESS });
    expect(((await e.redeem((e.hello(undefined) as Answer).token, ALL_ACCESS_WORDS, undefined)) as Answer).account.allAccess).toBe(true);
    for (const did of ['did:privy:someone', 'did:privy:another']) {
      const token = await signedIn(e, p, did);
      const got = await e.redeem(token, ' ink STAMP master KEY ', undefined) as Answer;
      expect(got.redeemed).toMatchObject({ allAccess: true }); expect(got.account.allAccess).toBe(true);
      for (const [fighter] of LOCKED) expect(mayPlay(fighter, e.book.find(token)), fighter).toBe(true);
      expect((await refusal(() => e.redeem(token, ALL_ACCESS_WORDS, undefined))).message).toBe('You have already redeemed that code.');
    }
    e.close();
  });

  it("reads the all-access code from the server's ALL_ACCESS_CODE: off when unset or too short, on with its words", async () => {
    expect(envCodes({})).toEqual([]);
    expect(envCodes({ ALL_ACCESS_CODE: '   ' })).toEqual([]);
    expect(envCodes({ ALL_ACCESS_CODE: 'x'.repeat(ALL_ACCESS_MIN - 1) })).toEqual([]);              // too short to be safe from guessing
    expect(envCodes({ ALL_ACCESS_CODE: ` ${ALL_ACCESS_WORDS.toUpperCase()} ` })).toEqual([expect.objectContaining({
      id: ALL_ACCESS_ID, hash: codeHash(ALL_ACCESS_WORDS), grants: { allAccess: true } })]);
    expect(ALL_ACCESS_ID).toBe('owner-all-access');
    const p = privy('app-one'), quiet = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      vi.stubEnv('ALL_ACCESS_CODE', '');
      let e = new Economy({ dir: false, privyAppId: 'app-one', fetcher: p.fetcher });
      expect((await refusal(async () => e.redeem(await signedIn(e, p, 'did:privy:unset'), ALL_ACCESS_WORDS, undefined))).message).toMatch(/not known/);
      e.close();
      vi.stubEnv('ALL_ACCESS_CODE', 'short');
      e = new Economy({ dir: false, privyAppId: 'app-one', fetcher: p.fetcher });
      expect(quiet).toHaveBeenCalledWith(expect.stringContaining(`ALL_ACCESS_CODE is shorter than ${ALL_ACCESS_MIN} characters`));
      expect((await refusal(async () => e.redeem(await signedIn(e, p, 'did:privy:short'), 'short', undefined))).message).toMatch(/not known/);
      e.close();
      vi.stubEnv('ALL_ACCESS_CODE', ALL_ACCESS_WORDS);
      e = new Economy({ dir: false, privyAppId: 'app-one', fetcher: p.fetcher });
      expect((await e.redeem(await signedIn(e, p, 'did:privy:set'), ALL_ACCESS_WORDS, undefined) as Answer).account.allAccess).toBe(true);
      e.close();
    } finally { vi.unstubAllEnvs(); quiet.mockRestore(); }
  });

  it('is durable and idempotent across a restart, and its ledger line names the code, never its words', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'economy-codes-'));
    try {
      const p = privy('app-one');
      let e = new Economy({ dir, privyAppId: 'app-one', fetcher: p.fetcher, codes: ALL_ACCESS });
      const owner = await signedIn(e, p, 'did:privy:owner');
      await e.redeem(owner, ALL_ACCESS_WORDS, undefined);
      // The process dies before the book is written: the ledger has it.
      e = new Economy({ dir, privyAppId: 'app-one', fetcher: p.fetcher, codes: ALL_ACCESS });
      expect(e.book.find(owner)!.allAccess).toBe(true);
      expect((await refusal(() => e.redeem(owner, ALL_ACCESS_WORDS, undefined))).message).toBe('You have already redeemed that code.');
      e.close();
      e = new Economy({ dir, privyAppId: 'app-one', fetcher: p.fetcher, codes: envCodes({ ALL_ACCESS_CODE: 'Fresh Words For Later' }) });
      expect(e.book.find(owner)!.allAccess).toBe(true); expect(e.book.redemptions(ALL_ACCESS_ID)).toBe(1);
      expect((await refusal(() => e.redeem(owner, 'fresh words for later', undefined))).message).toBe('You have already redeemed that code.');
      const ledger = readFileSync(join(dir, 'ledger.jsonl'), 'utf8'), lines = ledger.split('\n').filter(Boolean).map(raw => JSON.parse(raw) as { t: string; code?: string });
      expect(lines.filter(line => line.t === 'redeem')).toEqual([expect.objectContaining({ code: ALL_ACCESS_ID })]);
      expect(ledger.toLowerCase()).not.toContain(normalCode(ALL_ACCESS_WORDS));
      e.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('answers over HTTP: a bound code asks for the identity token in so many words', async () => {
    const p = privy('app-one'), posts = new Map<string, (req: unknown, res: unknown) => void>();
    const economy = mountEconomy({ use: () => undefined, post: (path, handler) => { posts.set(path, handler as never); } }, { dir: false, privyAppId: 'app-one', fetcher: p.fetcher, codes: BOUND });
    const call = (path: string, body: unknown) => new Promise<{ status: number; body: Record<string, unknown> }>(resolve => {
      const req = Object.assign(new EventEmitter(), { method: 'POST', headers: { origin: 'https://game.example.com' } as Record<string, string> });
      const res = { statusCode: 0, setHeader: () => undefined, end: (text?: string) => resolve({ status: res.statusCode, body: JSON.parse(text ?? '{}') }) };
      posts.get(`/api/economy/${path}`)!(req, res);
      queueMicrotask(() => { req.emit('data', Buffer.from(JSON.stringify(body))); req.emit('end'); });
    });
    try {
      const token = await signedIn(economy, p, 'did:privy:player1');
      expect(await call('redeem', { token, code: BOUND_CODE })).toEqual({ status: 400, body: { error: expect.stringMatching(/Confirm your sign-in/), need: 'identity' } });
      expect(await call('redeem', { token, code: 'nothing like it' })).toEqual({ status: 400, body: { error: expect.stringMatching(/not known/) } });
      expect((await call('name', { token, name: 'Paper_Tiger' })).body.account).toMatchObject({ name: 'Paper_Tiger' });
    } finally { economy.close(); }
  });

  it("goes from the browser's own account code: refused for want of the identity token, then given it", async () => {
    const p = privy('app-one'), e = new Economy({ dir: false, privyAppId: 'app-one', fetcher: p.fetcher, codes: BOUND });
    const post: Poster = async (path, body) => {
      const b = body as Record<string, unknown>;
      try {
        const answer = path === 'hello' ? e.hello(b.token) : path === 'signin' ? await e.signIn(b.token, b.access) : path === 'redeem' ? await e.redeem(b.token, b.code, b.identity) : undefined;
        return { status: 200, body: JSON.parse(JSON.stringify(answer)) };
      } catch (error) { const r = error as Error & { status?: number; need?: string }; return { status: r.status ?? 500, body: { error: r.message, ...(r.need ? { need: r.need } : {}) } }; }
    };
    const memory = (): Store => { const data = new Map<string, string>(); return { get: key => data.get(key), set: (key, value) => { if (value === undefined) data.delete(key); else data.set(key, value); } }; };
    const did = 'did:privy:owner', client = new AccountClient(post, memory(), async () => {});
    const bridge = { login: async () => ({ token: p.token(did), shown: 'as o•••@g•••.com' }), resume: async () => ({ token: p.token(did) }), logout: async () => {},
      identity: async () => ({ token: p.identity(did, [email(BOUND_EMAIL)]) }) };
    const flow = signInFlow({ account: client, privy: async () => bridge, session: memory(), local: memory(), href: () => 'https://game.example.com/', replace: () => {} });
    await client.open(); await flow.signIn();
    // What the ACCOUNT tab does (accountPanel.ts submit): the code; asked for the identity token, the code with it.
    const first = await client.redeem(BOUND_CODE).then(() => undefined, (error: unknown) => error);
    expect(first).toBeInstanceOf(Refused); expect((first as Refused).need).toBe('identity');
    const got = await client.redeem(BOUND_CODE, (await flow.identity())!);
    expect(got.allAccess).toBe(true); expect(client.account!.allAccess).toBe(true);
    e.close();
  });

  it('keeps codes on the server, their words out of the source, and all access out of the table', () => {
    // All access comes only from the server's ALL_ACCESS_CODE variable (envCodes): no hash in the source opens it.
    expect(CODES.filter(each => each.grants.allAccess || each.id === ALL_ACCESS_ID)).toEqual([]);
    expect(fs.readFileSync('src/server/economy/codes.ts', 'utf8')).not.toMatch(/['"][0-9a-f]{64}['"][^\n]*\n?[^\n]*allAccess: true/);
    expect(codeHash(' ink stamp ')).toBe(codeHash('INK STAMP'));
    // Nothing the page is built from imports the table.
    const page = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? page(join(dir, entry.name)) : /\.tsx?$/.test(entry.name) ? [join(dir, entry.name)] : []);
    for (const file of [...page('src/ui'), ...page('src/render'), 'src/main.ts']) expect(fs.readFileSync(file, 'utf8'), file).not.toMatch(/economy\/codes/);
    // The table itself: ids and hashes unique, hashes whole, items real and not numbered (a code takes no Mythic's copy).
    expect(new Set(CODES.map(each => each.id)).size).toBe(CODES.length); expect(new Set(CODES.map(each => each.hash)).size).toBe(CODES.length);
    for (const code of CODES) {
      expect(code.hash, code.id).toMatch(/^[0-9a-f]{64}$/);
      for (const id of code.grants.items ?? []) { expect(ITEM.has(id), id).toBe(true); expect(RARITY[ITEM.get(id)!.rarity].supply, id).toBeUndefined(); }
    }
  });
});

describe('the all-access code', () => {
  it('reads its words from ALL_ACCESS_CODE only, and none without it', async () => {
    const { envCodes } = await import('../src/server/economy/codes');
    expect(envCodes({})).toEqual([]);
    const [def] = envCodes({ ALL_ACCESS_CODE: ' Ink Mode ' });
    expect(def).toMatchObject({ id: 'owner-all-access', hash: codeHash('ink mode'), grants: { allAccess: true }, guests: true });
    expect(def.email).toBeUndefined(); expect(def.limit).toBeUndefined();
  });

  it('unlocks everything for a guest and a signed-in account alike; other codes still ask a guest to sign in', async () => {
    const { envCodes } = await import('../src/server/economy/codes');
    const p = privy('app-one'), table: CodeDef[] = [...envCodes({ ALL_ACCESS_CODE: 'Ink Mode' }),
      { id: 'test-gift', hash: codeHash('Ink And Paper'), says: 'A gift.', grants: { sumi: 5 } }];
    const e = new Economy({ dir: false, privyAppId: 'app-one', fetcher: p.fetcher, codes: table });
    const guest = e.hello(undefined) as Answer;
    expect((await refusal(() => e.redeem(guest.token, 'Ink And Paper', undefined))).message).toMatch(/^Sign in first/);
    expect((await refusal(() => e.redeem(guest.token, 'no such code', undefined))).message).toMatch(/^Sign in first/);
    const got = await e.redeem(guest.token, 'INK MODE', undefined) as Answer;
    expect(got.redeemed?.allAccess).toBe(true); expect(got.account.allAccess).toBe(true);
    for (const item of ITEMS.filter(each => each.stage === 'live')) expect(unlocked(got.account, item.id), item.id).toBe(true);
    expect((await refusal(() => e.redeem(guest.token, 'ink mode', undefined))).message).toMatch(/already redeemed/);
    const token = await signedIn(e, p, 'did:privy:player2');
    expect((await e.redeem(token, 'ink mode', undefined) as Answer).account.allAccess).toBe(true);
  });
});
