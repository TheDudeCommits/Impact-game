import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Economy } from '../src/server/economy/api';
import { keptLine } from '../src/server/economy/book';
import { Book as BookV26 } from './fixtures/economyBookV26';
import { newAccount, type Account } from '../src/game/economy/account';
import { AccountClient, maskEmail, type Poster, type Store } from '../src/ui/shop/account';
import { signInFlow } from '../src/ui/shop/signin';
import type { PrivyBridge } from '../src/ui/shop/privy';
import { homeOptions } from '../src/ui/HomePanels';
import { legalPage } from '../src/ui/legal';
import { CONTACT, TITLE, contactHref } from '../src/originals/brand';
import { loadSettings } from '../src/config';

const hash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
const clock = (start = Date.UTC(2026, 9, 8, 12)) => { let at = start; const now = () => at; now.pass = (seconds: number) => { at += seconds * 1000; }; return now; };
type Answer = { account: Account; signedIn?: boolean; token?: string; deleted?: boolean };
const lines = (file: string) => readFileSync(file, 'utf8').split('\n').filter(Boolean).map(raw => JSON.parse(raw) as Record<string, unknown> & { seq: number; t: string; pk: string });
const temp = () => mkdtempSync(join(tmpdir(), 'economy-privacy-'));

/** A Privy app's key, and a login's access token signed with it. */
function privy(appId: string) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1' };
  const fetcher = (async () => ({ ok: true, json: async () => ({ keys: [jwk] }) })) as unknown as typeof fetch;
  const token = (did: string) => {
    const part = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const head = `${part({ alg: 'ES256', typ: 'JWT', kid: 'k1' })}.${part({ iss: 'privy.io', aud: appId, sub: did, exp: Math.floor(Date.now() / 1000) + 600 })}`;
    return `${head}.${crypto.sign('sha256', Buffer.from(head), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
  };
  return { fetcher, token };
}

/** A volume as the live server left it before this release: labels on signed-in accounts in the book and in the ledger
 *  (before and after the book's seq), an earn line whose pay lines have labels of their own, a legacy order with its
 *  paying wallet, and a ledger set aside under its date with a label in it. */
function oldVolume(dir: string) {
  const thunderHawk: Account = { ...newAccount('thunder-hawk0001', 1), label: 'thunder-hawk@example.com', balance: 900, earned: 900 };
  const guest: Account = { ...newAccount('guest001', 2), balance: 40, earned: 40 };
  const later = { ...thunderHawk, balance: 1200, earned: 1200 }, renamed = { ...later, label: '@thunder_hawk_x', name: 'Thunder Hawk' };
  writeFileSync(join(dir, 'accounts.json'), JSON.stringify({ seq: 3, accounts: [thunderHawk, guest], tokens: { [hash('a'.repeat(32))]: 'thunder-hawk0001', [hash(`s_${'A'.repeat(32)}`)]: 'thunder-hawk0001', [hash('b'.repeat(32))]: 'guest001' },
    dids: { 'did:privy:thunder-hawk': 'thunder-hawk0001' }, sold: {}, completions: [], orders: [{ id: 'o_1', pk: 'thunder-hawk0001', status: 'paid', tx: '0x' + '12'.repeat(32), payer: '0x' + '34'.repeat(20) }] }));
  const ledger = [
    { seq: 1, at: 1, t: 'new', pk: 'thunder-hawk0001', after: { ...thunderHawk, label: undefined }, token: hash('a'.repeat(32)) },
    { seq: 2, at: 2, t: 'link', pk: 'thunder-hawk0001', after: thunderHawk, did: 'did:privy:thunder-hawk', token: hash(`s_${'A'.repeat(32)}`) },
    { seq: 3, at: 3, t: 'new', pk: 'guest001', after: guest, token: hash('b'.repeat(32)) },
    { seq: 4, at: 4, t: 'earn', pk: 'thunder-hawk0001', after: later, amount: 300, why: 'verified:arena:m1', completion: { matchId: 'm1', pk: 'thunder-hawk0001', completedAt: 4, report: { id: 'm1', mode: 'arena' }, settlement: { total: 300, lines: [{ label: 'First of the day', amount: 300 }] } } },
    { seq: 5, at: 5, t: 'name', pk: 'thunder-hawk0001', after: renamed },
    { seq: 6, at: 6, t: 'order', pk: 'thunder-hawk0001', order: { id: 'o_1', pk: 'thunder-hawk0001', status: 'paid', tx: '0x' + '12'.repeat(32), payer: '0x' + '34'.repeat(20) } },
  ];
  writeFileSync(join(dir, 'ledger.jsonl'), ledger.map(line => JSON.stringify(line)).join('\n') + '\n');
  writeFileSync(join(dir, 'ledger-2026-10-01T00-00-00-000Z.jsonl'), JSON.stringify({ seq: 0, at: 0, t: 'link', pk: 'thunder-hawk0001', after: { ...thunderHawk, label: 'old@example.com' }, did: 'did:privy:thunder-hawk' }) + '\n');
}
const personal = /thunderHawk@example\.com|@thunder_hawk_x|old@example\.com|"label":"(?!First of the day)|"payer"/;

describe('no login label, email, handle or wallet is kept on the server', () => {
  it('scrubs an old book and every ledger at start: whole files swapped in, every line kept in its place', () => {
    const dir = temp();
    try {
      oldVolume(dir);
      const before = lines(join(dir, 'ledger.jsonl'));
      const e = new Economy({ dir });
      const thunderHawk = e.book.accounts.get('thunder-hawk0001')!;
      expect(thunderHawk.label).toBeUndefined(); expect(thunderHawk.balance).toBe(1200); expect(thunderHawk.name).toBe('Thunder Hawk');
      expect(e.book.byLogin('did:privy:thunder-hawk')?.pk).toBe('thunder-hawk0001');
      e.close();
      for (const name of ['accounts.json', 'ledger.jsonl', 'ledger-2026-10-01T00-00-00-000Z.jsonl']) expect(readFileSync(join(dir, name), 'utf8'), name).not.toMatch(personal);
      // Nothing but the label and the wallet went: the same lines, seqs, kinds and pay lines, in the same order.
      const after = lines(join(dir, 'ledger.jsonl'));
      expect(after.map(line => [line.seq, line.t, line.pk])).toEqual(before.map(line => [line.seq, line.t, line.pk]));
      expect(JSON.stringify(after[3])).toContain('"label":"First of the day"');
      expect(after.map(line => { const { after: a, order, ...rest } = line; return rest; })).toEqual(before.map(line => { const { after: a, order, ...rest } = line; return rest; }));
      expect(fs.readdirSync(dir).filter(name => name.endsWith('.tmp'))).toEqual([]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('scrubs once: a second start changes no file', () => {
    const dir = temp();
    try {
      oldVolume(dir);
      new Economy({ dir }).close();
      const files = () => Object.fromEntries(fs.readdirSync(dir).sort().map(name => [name, readFileSync(join(dir, name), 'utf8')]));
      const once = files();
      new Economy({ dir }).close();
      expect(files()).toEqual(once);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('writes what the v26 server replays as the same accounts, and keeps reading what v26 writes after a rollback', () => {
    const dir = temp();
    try {
      oldVolume(dir);
      const e = new Economy({ dir }), now = e.book.accounts.get('thunder-hawk0001')!;
      e.book.record('wear', now); // (a line past the book: v26 must replay it)
      const stood = JSON.parse(JSON.stringify([...e.book.accounts.values()]));
      e.close();
      const old = new BookV26(dir);
      expect(JSON.parse(JSON.stringify([...old.accounts.values()]))).toEqual(stood);
      expect(old.find(`s_${'A'.repeat(32)}`)?.pk).toBe('thunder-hawk0001'); expect(old.byLogin('did:privy:thunder-hawk')?.pk).toBe('thunder-hawk0001');
      // v26 running again for a while (a rollback) writes labels again: the next start of this server takes them out.
      old.link(old.accounts.get('thunder-hawk0001')!, 'did:privy:thunder-hawk', 'again@example.com');
      old.close();
      new Economy({ dir }).close();
      for (const name of fs.readdirSync(dir)) expect(readFileSync(join(dir, name), 'utf8'), name).not.toMatch(/again@example\.com/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('keeps nothing a page says of its login, and says whether the account is signed in', async () => {
    const dir = temp();
    try {
      const p = privy('app-one'), e = new Economy({ dir, privyAppId: 'app-one', fetcher: p.fetcher });
      const guest = e.hello(undefined) as Answer;
      expect(guest.signedIn).toBe(false);
      // (A page from before this release still sends the login's email as `label`: it is not read.)
      const signed = await (e.signIn as (...args: unknown[]) => Promise<unknown>)(guest.token, p.token('did:privy:streamer'), 'streamer@example.com') as Answer;
      expect(signed.signedIn).toBe(true); expect(signed.account.label).toBeUndefined();
      e.close();
      for (const name of fs.readdirSync(dir)) expect(readFileSync(join(dir, name), 'utf8'), name).not.toContain('streamer@example.com');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('takes the label and the paying wallet out of a line, and drops a deleted account\'s lines', () => {
    const line = { seq: 9, at: 9, t: 'link' as const, pk: 'x1', after: { ...newAccount('x1', 1), label: 'x@y.z' }, did: 'did:privy:x' };
    expect(keptLine(line, new Set())).toEqual({ ...line, after: newAccount('x1', 1) });
    expect(keptLine({ seq: 1, at: 1, t: 'wear', pk: 'x1', after: newAccount('x1', 1) }, new Set())?.after).toEqual(newAccount('x1', 1));
    expect(keptLine(line, new Set(['x1']))).toBeUndefined();
    expect(keptLine({ seq: 2, at: 2, t: 'merge', pk: 'g1', into: 'x1' }, new Set(['x1']))).toBeUndefined();
  });
});

/** A signed-in account with a username, a code, a match paid, two devices, and a guest from a second device folded in. */
async function fullAccount(e: Economy, p: ReturnType<typeof privy>) {
  const first = e.hello(undefined, '1.1.1.1') as Answer;
  e.complete(first.account.pk, { id: 'match-1', mode: 'survival', fighter: 'kenzo', seconds: 800, round: 7, rank: 3, bosses: 7, finishers: 3, score: 2_000_000, kills: 1800, style: 4 } as never);
  const session = (await e.signIn(first.token, p.token('did:privy:leaver')) as Answer).token!;
  e.claimName(session, 'Leaver');
  const second = e.hello(undefined, '2.2.2.2') as Answer;
  const other = (await e.signIn(second.token, p.token('did:privy:leaver')) as Answer).token!;
  return { pk: first.account.pk, guestToken: first.token!, session, other, folded: second.account.pk, foldedToken: second.token! };
}

describe('DELETE ACCOUNT', () => {
  it('deletes a signed-in account for good: its name is free, its login and every token open nothing, and no file holds it', async () => {
    const dir = temp();
    try {
      const p = privy('app-one'), e = new Economy({ dir, privyAppId: 'app-one', fetcher: p.fetcher });
      const keep = e.hello(undefined, '3.3.3.3') as Answer;
      const gone = await fullAccount(e, p);
      expect(() => e.deleteAccount(gone.session, undefined, '9.9.9.9')).toThrow(/cannot be undone/);
      expect(e.book.accounts.has(gone.pk)).toBe(true);
      const answer = e.deleteAccount(gone.session, 'DELETE', '9.9.9.9') as Answer;
      expect(answer.deleted).toBe(true); expect(answer.token).toMatch(/^[a-f0-9]{32}$/); expect(answer.account.pk).not.toBe(gone.pk); expect(answer.signedIn).toBe(false);
      for (const token of [gone.session, gone.other, gone.guestToken, gone.foldedToken]) expect(e.book.find(token)).toBeUndefined();
      expect(e.book.byLogin('did:privy:leaver')).toBeUndefined(); expect(e.book.nameHolder('leaver')).toBeUndefined();
      expect([...e.book.completions.values()].some(c => c.pk === gone.pk)).toBe(false);
      // The same login signing in again gets a new, empty account; and someone else may take the name.
      const back = await e.signIn(undefined, p.token('did:privy:leaver')) as Answer;
      expect(back.account.pk).not.toBe(gone.pk); expect(back.account.name).toBeUndefined(); expect(back.account.stats.runs).toBe(0);
      expect((e.claimName(back.token, 'Leaver') as Answer).account.name).toBe('Leaver');
      // Asked again (a retry): nothing left to delete, and the same answer.
      expect((e.deleteAccount(gone.session, 'DELETE', '9.9.9.9') as Answer).deleted).toBe(true);
      // The ledger still takes lines (it was swapped under the server), and they outlive a restart.
      e.wear(keep.token, 'title', undefined);
      const appended = e.book.accounts.get(keep.account.pk)!.worn.title;
      e.close();
      for (const name of fs.readdirSync(dir).filter(name => name !== 'deleted.json')) {
        const text = readFileSync(join(dir, name), 'utf8');
        for (const secret of [gone.pk, gone.folded, hash(gone.session), hash(gone.other), hash(gone.guestToken), hash(gone.foldedToken)]) expect(text, `${name} holds ${secret}`).not.toContain(secret);
      }
      expect(JSON.parse(readFileSync(join(dir, 'deleted.json'), 'utf8'))).toEqual(expect.arrayContaining([gone.pk, gone.folded]));
      const again = new Economy({ dir, privyAppId: 'app-one', fetcher: p.fetcher });
      expect(again.book.accounts.has(gone.pk)).toBe(false); expect(again.book.find(gone.session)).toBeUndefined();
      expect(again.book.accounts.get(keep.account.pk)!.worn.title).toBe(appended); expect(again.book.byLogin('did:privy:leaver')?.pk).toBe(back.account.pk);
      again.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('stays deleted on the v26 server after a rollback, which loses nothing of anyone else', async () => {
    const dir = temp();
    try {
      const p = privy('app-one'), e = new Economy({ dir, privyAppId: 'app-one', fetcher: p.fetcher });
      const keep = e.hello(undefined, '3.3.3.3') as Answer;
      const gone = await fullAccount(e, p);
      e.save();                                              // (the book written with the account in it, as every 20 s)
      e.deleteAccount(gone.session, 'DELETE', '9.9.9.9');
      e.wear(keep.token, 'title', undefined);                // (a line past the deletion)
      // The process dies here, the book not written since the deletion: v26 starts from what is on the volume, and reads
      // every account as this server reads it.
      const copy = temp(); fs.cpSync(dir, copy, { recursive: true });
      const own = new Economy({ dir: copy, privyAppId: 'app-one', fetcher: p.fetcher }), others = JSON.parse(JSON.stringify([...own.book.accounts.values()]));
      own.close(); rmSync(copy, { recursive: true, force: true });
      expect(others.map((each: Account) => each.pk)).toContain(keep.account.pk);
      const old = new BookV26(dir);
      expect(old.accounts.has(gone.pk)).toBe(false); expect(old.accounts.has(gone.folded)).toBe(false);
      for (const token of [gone.session, gone.other, gone.guestToken, gone.foldedToken]) expect(old.find(token)).toBeUndefined();
      expect(old.byLogin('did:privy:leaver')).toBeUndefined(); expect(old.nameHolder('Leaver')).toBeUndefined();
      expect(JSON.parse(JSON.stringify([...old.accounts.values()]))).toEqual(others);
      old.close(); e.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }, 20000);

  it('finishes a deletion a crash broke off: deleted.json written, the book and ledger not yet', async () => {
    const dir = temp();
    try {
      const p = privy('app-one'), e = new Economy({ dir, privyAppId: 'app-one', fetcher: p.fetcher });
      const gone = await fullAccount(e, p);
      e.close();
      writeFileSync(join(dir, 'deleted.json'), JSON.stringify([gone.pk, gone.folded]));
      const again = new Economy({ dir, privyAppId: 'app-one', fetcher: p.fetcher });
      expect(again.book.accounts.has(gone.pk)).toBe(false); expect(again.book.find(gone.session)).toBeUndefined(); expect(again.book.byLogin('did:privy:leaver')).toBeUndefined();
      again.close();
      for (const name of ['accounts.json', 'ledger.jsonl']) expect(readFileSync(join(dir, name), 'utf8'), name).not.toContain(gone.pk);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('deletes a guest too, and refuses too many deletions from one address', () => {
    const e = new Economy({ dir: false });
    const guest = e.hello(undefined, '5.5.5.5') as Answer;
    expect((e.deleteAccount(guest.token, 'DELETE', '5.5.5.5') as Answer).deleted).toBe(true);
    expect(e.book.find(guest.token)).toBeUndefined(); expect(e.book.accounts.has(guest.account.pk)).toBe(false);
    for (let i = 0; i < 4; i++) e.deleteAccount('f'.repeat(32), 'DELETE', '5.5.5.5');
    expect(() => e.deleteAccount('f'.repeat(32), 'DELETE', '5.5.5.5')).toThrow(/Too many deletions/);
    e.close();
  });

  it('goes from the ACCOUNT tab\'s own code: the browser forgets the account, becomes a new guest, and signs out of Privy', async () => {
    const p = privy('app-one'), e = new Economy({ dir: false, privyAppId: 'app-one', fetcher: p.fetcher });
    const post: Poster = async (path, body) => {
      const b = body as Record<string, unknown>;
      try {
        const answer = path === 'hello' ? e.hello(b.token) : path === 'signin' ? await e.signIn(b.token, b.access) : path === 'delete' ? e.deleteAccount(b.token, b.confirm) : undefined;
        return { status: answer ? 200 : 404, body: JSON.parse(JSON.stringify(answer ?? {})) };
      } catch (error) { const r = error as Error & { status?: number }; return { status: r.status ?? 500, body: { error: r.message } }; }
    };
    const memory = (): Store & { data: Map<string, string> } => { const data = new Map<string, string>(); return { data, get: key => data.get(key), set: (key, value) => { if (value === undefined) data.delete(key); else data.set(key, value); } }; };
    const state = { loads: 0, logouts: 0 };
    const bridge: PrivyBridge = { login: async () => ({ token: p.token('did:privy:tab'), shown: 'with Google' }), resume: async () => ({ token: p.token('did:privy:tab') }), logout: async () => { state.logouts++; }, identity: async () => ({ token: null }) };
    const local = memory(), client = new AccountClient(post, local, async () => {});
    const flow = signInFlow({ account: client, privy: async () => { state.loads++; return bridge; }, session: memory(), local, href: () => 'https://game.example.com/', replace: () => {} });
    // A guest's deletion: Privy's island is never fetched.
    await client.open();
    const guest = client.account!.pk;
    local.set('jump-account-pending', JSON.stringify([{ id: 'kept-1' }]));
    await flow.deleteAccount();
    expect(client.account!.pk).not.toBe(guest); expect(e.book.accounts.has(guest)).toBe(false); expect(state.loads).toBe(0);
    expect(local.get('jump-account-pending')).toBeUndefined();
    // A signed-in one: shown masked, then deleted, signed out of Privy, and the next SIGN IN asks afresh.
    await flow.signIn();
    expect(client.wallet.signedIn).toBe(true); expect(client.login).toBe('with Google');
    const signed = client.account!.pk;
    await flow.deleteAccount();
    await new Promise(done => setTimeout(done, 0));
    expect(e.book.accounts.has(signed)).toBe(false); expect(client.wallet.signedIn).toBe(false); expect(client.login).toBeUndefined();
    expect(client.secret()).toMatch(/^[a-f0-9]{32}$/); expect(state.logouts).toBe(1); expect(local.get('jump-signed-out')).toBeTruthy();
    // A server from before this release has no delete route: the tab says so, and nothing is forgotten.
    const old = new AccountClient(async () => ({ status: 404, body: undefined }), memory(), async () => {});
    (old as unknown as { token: string }).token = 'a'.repeat(32);
    await expect(old.deleteAccount()).rejects.toThrow(/Hello@Dude\.work/);
    expect(old.secret()).toBe('a'.repeat(32));
    e.close();
  });
});

describe('what the screen shows', () => {
  it('masks an email', () => {
    expect(maskEmail('thunder-hawk.sato76@mail.example')).toBe('t•••@m•••.example');
    expect(maskEmail('a@b.co')).toBe('a•••@b•••.co');
    expect(maskEmail('someone@mail.example.co.uk')).toBe('s•••@m•••.uk');
  });

  it('signs in with email and socials only, and shows no wallet', () => {
    const source = readFileSync('src/ui/shop/privy.ts', 'utf8');
    expect(source).toMatch(/loginMethods: \['email', 'google', 'twitter', 'discord'\]/);
    expect(source).not.toMatch(/'wallet'|walletChainType|showWalletLoginFirst|wallet\.address/);
  });

  it('puts LEGAL and CREDITS in Options: LEGAL with the takedown address and the privacy page, CREDITS opening the credits page', () => {
    const options = homeOptions(loadSettings()), page = legalPage();
    expect(options).toMatch(/<nav class="home-options-links"[^]*id="home-legal"[^]*<\/nav>/);
    expect(page).toContain(`${TITLE} is a free, open-source browser game. Its fighters are original characters made for it`);
    expect(page).toContain(CONTACT ? contactHref(CONTACT) : 'Contact details for rights holders and players will be added here.'); expect(page).not.toMatch(/jump\.dude\.work/i);
    expect(page).toMatch(/OPEN ASSETS[^]*CC BY 4\.0/); expect(page).toContain('data-open-privacy');
    // (In a new tab, or over the game for a pad: pageViewer.ts openPage.)
    expect(readFileSync('src/ui/pageViewer.ts', 'utf8')).toMatch(/window\.open\(each, '_blank', 'noopener'\)/);
    for (const text of [options, page, readFileSync('src/ui/shop/accountPanel.ts', 'utf8'), readFileSync('public/privacy.html', 'utf8')]) {
      expect(text).not.toMatch(/credits\.html/); expect(text).not.toMatch(/not cleared/i);
    }
  });
});
