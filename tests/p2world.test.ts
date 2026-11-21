import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { Economy } from '../src/server/economy/api';
import { PROGRESS_CLOCK as SERVER_CLOCK, ProgressStore } from '../src/server/progress/ProgressStore';
import { WorldEconomy, PROGRESS_CLOCK, codeHashOf, CFG, type Seat } from '../src/p2world/economy';
import { MemoryKV } from '../src/p2world/kv';
import { K, hashToken } from '../src/p2world/book';
import { codeHash } from '../src/server/economy/codes';
import { seal, unseal, type Pass } from '../src/server/economy/p2roomSigned';
import { chunksOf, digestKV, digestOf, openChunk, sliceOf, slicesOf, type Record_ } from '../src/p2world/importer';
import type { SurvivalReport, Report } from '../src/game/economy/earn';
import type { Account } from '../src/game/economy/account';

/** The economy in its PlayerTwo world (src/p2world): the match server's routes and rules over the world's store, the seat
 *  as the identity, the operator's signed notes, and the import's chunks and digests. */
const KEY = 'world-test-key';
const run = (id: string, over: Partial<SurvivalReport> = {}): SurvivalReport => ({ id, mode: 'survival', fighter: 'kenzo', seconds: 800, round: 7, rank: 3, bosses: 7, finishers: 3, score: 2_000_000, kills: 1800, style: 4, ...over });
const clock = (start = Date.now()) => { let at = start; const now = () => at; now.pass = (seconds: number) => { at += seconds * 1000; }; return now; };
type Body = { account: Account; signedIn?: boolean; token?: string; settlement?: { total: number }; sold: Record<string, number>; error?: string; deleted?: boolean; guest?: boolean };
const p2id = () => crypto.randomBytes(16).toString('base64url').slice(0, 22);

function world(now = clock()) {
  const kv = new MemoryKV(), trophies: [string, string][] = [];
  const e = new WorldEconomy(kv, { key: KEY, now, trophy: (p, f) => trophies.push([p, f]) });
  kv.set(CFG, { open: true });
  const call = async (seat: Seat | undefined, path: string, body: Record<string, unknown> = {}) => { const a = await e.route(seat, path, body); return { status: a.status, ...(a.body as Body) }; };
  return { kv, e, call, trophies, now };
}

describe('the economy world', () => {
  it('answers no page until the operator opens it (a signed note), and only signed notes', async () => {
    const { kv, e, call } = world();
    kv.set(CFG, {});
    const shut = await e.route({ id: p2id(), kind: 'full' }, 'hello', {});
    expect(shut.status).toBe(503); expect((shut.body as Record<string, unknown>)['not-open']).toBe(true);
    expect((await call(undefined, 'admin', { note: await seal('another-key', { k: 'admin', op: 'open', exp: Date.now() + 60_000 }) })).status).toBe(400);
    expect((await call(undefined, 'admin', { note: await seal(KEY, { k: 'admin', op: 'open', exp: Date.now() - 60_000 }) })).status).toBe(400);
    expect((await call(undefined, 'admin', { note: await seal(KEY, { k: 'admin', op: 'open', exp: Date.now() + 60_000 }) })).status).toBe(200);
    expect((await call({ id: p2id(), kind: 'full' }, 'hello')).status).toBe(200);
  });

  it('opens a guest by its token, pays a match once, sells and dresses, and refuses what the match server refuses', async () => {
    const { call, e } = world(), seat = { id: p2id(), kind: 'guest' };
    const hello = await call(seat, 'hello');
    expect(hello.token).toMatch(/^[a-f0-9]{32}$/);
    expect((await call(seat, 'hello', { token: hello.token })).account.pk).toBe(hello.account.pk);
    expect((await call(seat, 'report', { token: hello.token, report: run('first-run') })).error).toMatch(/No completed/);
    e.complete(hello.account.pk, run('first-run'));
    const paid = await call(seat, 'report', { token: hello.token, report: run('first-run') });
    expect(paid.settlement!.total).toBeGreaterThan(0);
    expect(e.complete(hello.account.pk, run('first-run'))!.settlement).toEqual(paid.settlement);
    expect((await call(seat, 'buy', { token: hello.token, item: 'no-such-item' })).status).toBe(400);
    expect((await call(seat, 'wear', { token: hello.token, kind: 'nonsense' })).error).toMatch(/kind of item/);
    expect((await call(seat, 'name', { token: hello.token, name: 'Someone' })).error).toMatch(/Sign in/);
    expect((await call(seat, 'buy', { token: '0'.repeat(32), item: 'x' })).status).toBe(401);
    expect((await call(seat, 'signin', { token: hello.token, access: 'x' })).error).toMatch(/PlayerTwo/);
  });

  it('settles a match the same as the match server does, from the same account and report', async () => {
    const now = clock(), server = new Economy({ dir: false, now }), w = world(now);
    const r = server.hello(undefined, '1.1.1.1') as unknown as { account: Account; token: string };
    const g = await w.call({ id: p2id(), kind: 'guest' }, 'hello');
    /* the world's account made the server's (pk aside), then both settle the same three matches */
    w.e.book.put({ ...structuredClone(r.account), pk: g.account.pk });
    for (const id of ['match-0001', 'match-0002', 'match-0003']) {
      const report: Report = { id, mode: 'match', fighter: 'kenzo', seconds: 300, place: 1, players: 8, kos: 4 } as Report;
      const a = server.complete(r.account.pk, report)!, b = w.e.complete(g.account.pk, report)!;
      expect(b.settlement).toEqual(a.settlement);
      now.pass(400);
    }
    expect({ ...w.e.book.account(g.account.pk)!, pk: 'x' }).toEqual({ ...server.book.accounts.get(r.account.pk)!, pk: 'x' });
  });

  it('takes the seat as the identity: a PlayerTwo player\'s own account whatever token comes, a guest folded in at sign-in', async () => {
    const { call, kv } = world(), id = p2id(), seat = { id, kind: 'full' };
    const guest = await call(seat, 'hello');
    const signed = await call(seat, 'p2-signin', { token: guest.token, identity: 'ignored' });
    expect(signed.token).toMatch(/^s_/); expect(signed.signedIn).toBe(true); expect(signed.account.pk).toBe(guest.account.pk);
    /* with no token at all, and with another account's token, the seat still opens its own */
    expect((await call(seat, 'hello')).account.pk).toBe(guest.account.pk);
    const other = await call({ id: p2id(), kind: 'guest' }, 'hello');
    expect((await call(seat, 'hello', { token: other.token })).account.pk).toBe(guest.account.pk);
    /* a second guest of this player's, on another device: folded into the login's at its sign-in, its token following */
    const device = await call({ id: p2id(), kind: 'guest' }, 'hello');
    const folded = await call(seat, 'p2-signin', { token: device.token });
    expect(folded.account.pk).toBe(guest.account.pk);
    expect(kv.get(K.account(device.account.pk))).toBeUndefined();
    expect(kv.get(K.token(hashToken(device.token!)))).toBe(guest.account.pk);
    expect(kv.get(`${K.merged(guest.account.pk)}${device.account.pk}`)).toBe(1);
    /* a token of an account kept under one PlayerTwo player's login opens nothing for another player's seat */
    const stranger = { id: p2id(), kind: 'full' };
    const theirs = await call(stranger, 'hello', { token: signed.token });
    expect(theirs.account.pk).not.toBe(guest.account.pk);
    expect((await call({ id: p2id(), kind: 'guest' }, 'buy', { token: signed.token, item: 'x' })).status).toBe(401);
  });

  it('claims a username once whatever its case, and frees it when the account is deleted', async () => {
    const { call, kv } = world(), a = { id: p2id(), kind: 'full' }, b = { id: p2id(), kind: 'full' };
    for (const s of [a, b]) { const g = await call(s, 'hello'); await call(s, 'p2-signin', { token: g.token }); }
    expect((await call(a, 'name', { name: 'Kenzo_Fan' })).account.name).toBe('Kenzo_Fan');
    expect((await call(b, 'name', { name: 'kenzo_fan' })).error).toMatch(/taken/);
    const before = kv.size;
    const gone = await call(a, 'delete', { confirm: 'DELETE' });
    expect(gone.deleted).toBe(true);
    expect((await call(b, 'name', { name: 'kenzo_fan' })).account.name).toBe('kenzo_fan');
    expect(kv.size).toBeLessThan(before);
    expect(kv.keys('d/p2:' + a.id)).toEqual([]);
  });

  it('redeems the operator\'s code from its hash (set by a signed note), once, a guest\'s too', async () => {
    const { call } = world(), words = 'synthetic code words';
    expect(codeHashOf(words)).toBe(codeHash(words));
    const def = { id: 'owner-all-access', hash: codeHashOf(words), says: 'All access.', grants: { allAccess: true }, guests: true };
    expect((await call(undefined, 'admin', { note: await seal(KEY, { k: 'admin', op: 'codes', codes: [def], exp: Date.now() + 60_000 }) })).status).toBe(200);
    const seat = { id: p2id(), kind: 'guest' }, g = await call(seat, 'hello');
    const r = await call(seat, 'redeem', { token: g.token, code: words.toUpperCase() });
    expect(r.account.allAccess).toBe(true);
    expect((await call(seat, 'redeem', { token: g.token, code: words })).error).toMatch(/already/);
    /* (a guest typing words that are no guest's code is told to sign in, as on the match server) */
    expect((await call(seat, 'redeem', { token: g.token, code: 'wrong words here' })).error).toMatch(/Sign in first/);
  });

  it('signs a room pass the match rooms read, and settles a room\'s signed result once', async () => {
    const { call } = world(), seat = { id: p2id(), kind: 'full' };
    const g = await call(seat, 'hello'); await call(seat, 'p2-signin', { token: g.token });
    const a = await call(seat, 'p2room-pass', { name: 'Typed' }) as unknown as { rooms: boolean; pass: string };
    expect(a.rooms).toBe(true);
    const pass = await unseal<Pass>(KEY, a.pass);
    expect(pass?.pk).toBe(g.account.pk); expect(pass?.names[20]).toBe('Typed');
    const report = { id: crypto.randomUUID(), mode: 'match', fighter: 'kenzo', seconds: 300, place: 1, players: 8, kos: 4 };
    const done = await seal(KEY, { k: 'done', pk: g.account.pk, report, exp: Date.now() + 60_000 });
    const first = await call(seat, 'p2room-complete', { done }) as unknown as { completion: { settlement: unknown } };
    const again = await call(seat, 'p2room-complete', { done }) as unknown as { completion: { settlement: unknown } };
    expect(first.completion.settlement).toEqual(again.completion.settlement);
    expect((await call(seat, 'p2room-complete', { done: await seal('x', { k: 'done', pk: g.account.pk, report, exp: Date.now() + 60_000 }) })).status).toBe(400);
    await call(undefined, 'admin', { note: await seal(KEY, { k: 'admin', op: 'rooms', on: false, exp: Date.now() + 60_000 }) });
    expect(await call(seat, 'p2room-pass', {})).toMatchObject({ rooms: false });
  });

  it('gives a PlayerTwo player\'s feats as trophies once, through the room', async () => {
    const { call, e, trophies } = world(), id = p2id(), seat = { id, kind: 'full' };
    const g = await call(seat, 'hello'); await call(seat, 'p2-signin', { token: g.token });
    e.complete(g.account.pk, run('trophy-run-1'));
    const feats = e.book.account(g.account.pk)!.feats;
    expect(feats.length).toBeGreaterThan(0);
    expect(trophies.filter(([p]) => p === id).map(([, f]) => f).sort()).toEqual([...feats].sort());
    e.complete(g.account.pk, run('trophy-run-2', { seconds: 900 }));
    expect(new Set(trophies.map(([, f]) => f)).size).toBe(trophies.length);
  });

  it('keeps progress as ProgressStore does (its clock, its import), and folds it at a sign-in', async () => {
    expect(PROGRESS_CLOCK).toEqual(SERVER_CLOCK);
    const now = clock(), w = world(now), store = new ProgressStore(undefined, now);
    const seat = { id: p2id(), kind: 'full' }, g = await w.call(seat, 'hello');
    const body = { reports: [{ id: 'r-1', kind: 'match', match: { mode: 'royale', fighter: 'kenzo', outcome: 'win', kills: 3, damage: 900, seconds: 200, bosses: 0, capture: 0, score: 10, round: 0, id: 'm-1', at: now() } }] };
    now.pass(600);
    const a = await w.call(seat, 'progress', { token: g.token, ...body }) as unknown as Record<string, unknown>;
    const b = store.sync(g.account.pk, g.account.created, body) as unknown as Record<string, unknown>;
    expect({ ...a, status: undefined }).toEqual({ ...b, status: undefined });
  });

  it('keeps forged fighters, RANKED standings and rivalries by key', async () => {
    const { call, e } = world(), seat = { id: p2id(), kind: 'full' };
    const g = await call(seat, 'hello'); await call(seat, 'p2-signin', { token: g.token });
    expect((await call(seat, 'forge-mine')).status).toBe(200);
    expect((await call(seat, 'forge-save', { code: 'not a code' })).status).toBe(400);
    const ranked = await call(seat, 'ranked') as unknown as { modes: Record<string, { rating: number }> };
    expect(Object.keys(ranked.modes).length).toBeGreaterThan(0);
    const mode = Object.keys(ranked.modes)[0];
    const after = e.applyRanked(g.account.pk, mode, 25, true, 'match-1')!;
    expect(e.applyRanked(g.account.pk, mode, 25, true, 'match-1')).toEqual(after);
    e.recordRival('aaa', 'bbb'); e.recordRival('bbb', 'aaa'); e.recordRival('aaa', 'bbb');
    expect(e.between('aaa', 'bbb')).toEqual([2, 1]); expect(e.between('bbb', 'aaa')).toEqual([1, 2]);
  });

  it('puts a player\'s RANKED standings and rivalries in their pass, and takes a room\'s rank and rivalry notes once each', async () => {
    const { call, e } = world(), seat = { id: p2id(), kind: 'full' };
    const g = await call(seat, 'hello'); await call(seat, 'p2-signin', { token: g.token });
    const pk = g.account.pk, other = 'pk-other', soon = Date.now() + 60_000;
    const rank = await seal(KEY, { k: 'rank', pk, mode: 'goal-rush', delta: 25, won: true, id: 'room:1', exp: soon });
    expect((await call(undefined, 'p2room-complete', { done: rank })).status).toBe(200);
    expect((await call(undefined, 'p2room-complete', { done: rank })).status).toBe(200);
    expect(e.rating(pk, 'goal-rush').games).toBe(1);
    const rival = await seal(KEY, { k: 'rival', winner: other, loser: pk, id: 'r-1', exp: soon });
    await call(undefined, 'p2room-complete', { done: rival }); await call(undefined, 'p2room-complete', { done: rival });
    await call(undefined, 'p2room-complete', { done: await seal(KEY, { k: 'rival', winner: pk, loser: other, id: 'r-2', exp: soon }) });
    expect(e.between(pk, other)).toEqual([1, 1]);
    const { pass } = await call(seat, 'p2room-pass', { name: 'X' }) as unknown as { pass: string };
    const opened = await unseal<Pass>(KEY, pass);
    expect(opened?.ranked?.['goal-rush']).toEqual({ rating: e.rating(pk, 'goal-rush').rating, games: 1 });
    expect(opened?.rivals?.[other]).toEqual([1, 1]);
    expect((await call(undefined, 'p2room-complete', { done: await seal('not-the-key', { k: 'rank', pk, mode: 'goal-rush', delta: 90, won: true, id: 'room:2', exp: soon }) })).status).toBe(400);
    expect(e.rating(pk, 'goal-rush').games).toBe(1);
  });

  it('cuts records into signed chunks under 16 KB that only its key opens, and digests them slice by slice', async () => {
    const records: Record_[] = Array.from({ length: 3000 }, (_, i) => [`a/${crypto.randomBytes(8).toString('hex')}`, { i, pad: crypto.randomBytes(200).toString('hex') }]);
    records.push(['sold', { x: 1 }], ['seq', 9]);
    const chunks = await chunksOf(records, KEY, 'run-1');
    expect(Math.max(...chunks.map(c => JSON.stringify({ chunk: c, id: 99 }).length))).toBeLessThan(16 * 1024);
    const kv = new MemoryKV();
    for (const c of chunks) { const got = await openChunk(KEY, c, 'run-1'); expect(Array.isArray(got)).toBe(true); for (const [k, v] of got as Record_[]) kv.set(k, v); }
    expect(await openChunk('other', chunks[0], 'run-1')).toMatch(/signed/);
    expect(await openChunk(KEY, chunks[0], 'run-2')).toMatch(/import/);
    expect(await openChunk(KEY, { ...chunks[0], z: chunks[1].z }, 'run-1')).toMatch(/signed/);
    const slices = slicesOf(records.map(([k]) => k), 300);
    for (const s of slices) expect(await digestKV(kv, s)).toEqual(digestOf(sliceOf(records, s)));
    expect(slices.reduce((n, s) => n + sliceOf(records, s).length, 0)).toBe(records.length);
    kv.set(records[5][0], { changed: true });
    expect((await Promise.all(slices.map(async s => (await digestKV(kv, s)).hash !== digestOf(sliceOf(records, s)).hash))).some(Boolean)).toBe(true);
  });
});
