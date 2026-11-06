import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import { Economy, mountEconomy } from '../src/server/economy/api';
import { BOSSES } from '../src/survival/bosses';
import { LOCATIONS } from '../src/survival/locations';
import { CAREER_MODES } from '../src/game/social/career';
import { MOVES } from '../src/game/moves';
import { merge } from '../src/game/economy/account';
import type { RunResult } from '../src/survival/SurvivalGame';
import { emptyProgress, factsOf, settle } from '../src/survival/progress';
import { newCareer, recordCareer, type CareerMatch } from '../src/game/social/career';
import { emptyState, importOf, type ProgressReport, type ProgressState, type SyncAnswer } from '../src/game/progress/rules';
import { KEEP, ProgressSync } from '../src/ui/progress/sync';
import type { Poster, Store } from '../src/ui/shop/account';

const run = (over: Partial<RunResult> = {}): RunResult => ({
  fighter: 'kenzo', round: 6, wave: 6, rank: 'E', act: 0, score: 250000, kills: 400, seconds: 420, level: 12,
  bestRank: 3, bestCombo: 40, damageDealt: 90000, damageTaken: 3000, bosses: 2, picks: ['iron-fist'], finishers: 1, teamUltimates: 0,
  bossLog: [{ id: 'harrow', name: 'Harrow', rank: 'F', finished: true, seconds: 64 }, { id: 'zarek', name: 'Zarek', rank: 'E', finished: false, seconds: 91 }],
  places: ['burning-village'], breaks: 0, flawless: 0, cursed: 0, loop: 0, ...over });
const match = (id: string, over: Partial<CareerMatch> = {}): CareerMatch => ({ id, at: Date.UTC(2026, 10, 2), mode: 'survival', fighter: 'kenzo', outcome: 'loss', kills: 400, damage: 90000, seconds: 420, bosses: 2, capture: 0, score: 250000, round: 6, ...over });
const clock = (start = Date.UTC(2026, 10, 2, 12)) => { let at = start; const now = () => at; now.pass = (seconds: number) => { at += seconds * 1000; }; return now; };
const memory = (): Store & { data: Map<string, string> } => { const data = new Map<string, string>(); return { data, get: key => data.get(key), set: (key, value) => { if (value === undefined) data.delete(key); else data.set(key, value); } }; };
let ids = 0;

/** The page's requests, answered by the server's own code over JSON (no network). `down`: unreachable; `old`: a server from before this. */
function wire(economy: Economy) {
  const state = { down: false, old: false, calls: [] as Record<string, unknown>[] };
  const post: Poster = async (path, body) => {
    const b = JSON.parse(JSON.stringify(body)) as Record<string, unknown>;
    state.calls.push(b);
    if (state.down) throw new Error('offline');
    if (state.old || path !== 'progress') return { status: 404, body: undefined };
    try { return { status: 200, body: JSON.parse(JSON.stringify(economy.progressSync(b.token, b))) }; }
    catch (error) { return { status: (error as { status?: number }).status ?? 500, body: { error: (error as Error).message } }; }
  };
  return { post, state };
}
/** One browser: its storage, its copy of the progress (as progressStore.ts and career.ts keep it), and its sync. */
function browser(post: Poster, token: () => string | undefined, pk: () => string | undefined, now: () => number, copy: ProgressState = emptyState()) {
  const store = memory(), local = { state: structuredClone(copy) };
  const sync = new ProgressSync({ post, store, local: { read: () => structuredClone(local.state), write: state => { local.state = structuredClone(state); } },
    account: { token, pk, live: () => !!token() }, later: () => () => undefined, id: () => `r-test-${++ids}`, now });
  /** A run played here: settled on the copy (progressStore.settleRun), and noted. */
  const play = (r: RunResult, m?: CareerMatch) => {
    local.state.rift = settle(local.state.rift, r).progress; sync.note({ kind: 'run', facts: factsOf(r) });
    if (m && recordCareer(local.state.career, m)) sync.note({ kind: 'match', match: m });
  };
  return { store, local, sync, play };
}
/** A new guest account on the server: its token and its id. */
const guestOf = (economy: Economy) => economy.hello(undefined) as unknown as { token: string; account: { pk: string } };
const strip = (s: ProgressState) => ({ rift: s.rift, career: { ...s.career, seen: [] } });

describe('progress on the account: the server keeps it', () => {
  it('takes a browser\'s progress once, its runs after, and keeps them across a restart; cleared storage gets them back', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'progress-')), now = clock();
    try {
      let economy = new Economy({ dir, now });
      const { token, account } = guestOf(economy);
      // This browser played before progress was kept with the account: three runs and two matches, in its storage.
      const legacy: ProgressState = { rift: emptyProgress(), career: newCareer(Date.UTC(2026, 9, 3)) };
      for (let i = 0; i < 3; i++) { legacy.rift = settle(legacy.rift, run({ fighter: i ? 'kenzo' : 'taisei' })).progress; recordCareer(legacy.career, match(`old:${i}`)); }
      now.pass(3600);
      let wired = wire(economy);
      const one = browser(wired.post, () => token, () => account.pk, now, legacy);
      await one.sync.sync();
      expect(wired.state.calls[0]).toHaveProperty('import'); expect(wired.state.calls[0]).not.toHaveProperty('reports');
      expect(strip(one.local.state)).toEqual(strip(legacy));
      expect(readdirSync(join(dir, 'progress'))).toEqual([`${account.pk}.json`]);
      // A run from then on is a report, taken once.
      one.play(run(), match('new:0'));
      expect(one.sync.pending()).toHaveLength(2);
      await one.sync.sync();
      expect(wired.state.calls[1]).not.toHaveProperty('import'); expect((wired.state.calls[1].reports as ProgressReport[]).map(r => r.kind)).toEqual(['run', 'match']);
      expect(one.sync.pending()).toEqual([]);
      const server = economy.progress.get(account.pk);
      expect(server.rift.runs).toBe(4); expect(server.rift.mastery.taisei).toBe(legacy.rift.mastery.taisei); expect(server.career.totals.matches).toBe(4);
      expect(one.local.state.rift).toEqual(server.rift);
      // Sent again (an answer lost on the way): nothing counts twice.
      expect(economy.progressSync(token, { reports: wired.state.calls[1].reports }).rift.runs).toBe(4);
      economy.close();

      // The server restarts; this browser's storage is cleared (no copy, no sync record) but the account comes back.
      economy = new Economy({ dir, now }); wired = wire(economy);
      const cleared = browser(wired.post, () => token, () => account.pk, now);
      await cleared.sync.sync();
      expect(cleared.local.state.rift).toEqual(server.rift); expect(cleared.local.state.career.totals.matches).toBe(4);
      economy.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('caps an absurd import, and holds runs to the wall clock (one too long waits, and is taken later)', async () => {
    const now = clock(), economy = new Economy({ dir: false, now });
    const { token, account } = guestOf(economy);
    const pasted = { rift: { ...emptyProgress(), runs: 3, shards: 1e12, earned: 1e12, mastery: { kenzo: 1e12 }, unlocked: ['momentum', 'overflow', 'second-wind'] }, career: newCareer(1) };
    const imported = economy.progressSync(token, { import: pasted });
    expect(imported.rift.earned).toBe(3000); expect(imported.rift.mastery.kenzo).toBe(3000); expect(imported.rift.unlocked).toEqual(['momentum', 'overflow', 'second-wind']);
    // A fresh account: two minutes in hand. A 420-second run waits; the node bought after it waits with it, in order.
    const r1 = { id: 'r-wall-1', kind: 'run', facts: factsOf(run({ seconds: 420 })) }, buy = { id: 'r-wall-2', kind: 'aura', fighter: 'kenzo', aura: 'ki' };
    const early = economy.progressSync(token, { reports: [r1, buy] }) as SyncAnswer;
    expect(early.done).toEqual([]); expect(early.wait).toBeGreaterThan(200); expect(early.rift.runs).toBe(3);
    now.pass(early.wait!);
    const later = economy.progressSync(token, { reports: [r1, buy] });
    expect(later.done).toEqual(['r-wall-1', 'r-wall-2']); expect(later.rift.runs).toBe(4); expect(later.wait).toBeUndefined();
    // Reports that do not read are let go (so they hold nothing up); a run of a fighter not in the game changes nothing.
    const junk = economy.progressSync(token, { reports: [{ id: 'r-junk-1', kind: 'steal' }, { id: 'r-junk-2', kind: 'run', facts: { fighter: 'nobody' } }] });
    expect(junk.done).toEqual(['r-junk-1', 'r-junk-2']); expect(junk.rift.runs).toBe(4);
    // A token that opens nothing: the page is told so (401), as every economy call is.
    expect(() => economy.progressSync('f'.repeat(32), {})).toThrow(/not known/);
    economy.close();
  });

  it('goes with the account: folded into a login\'s at sign-in (a guest\'s runs added, its import once), deleted with it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'progress-')), now = clock();
    try {
      const economy = new Economy({ dir, now });
      const login = guestOf(economy), guest = guestOf(economy);
      const legacy = emptyState(); legacy.rift = settle(legacy.rift, run()).progress;
      now.pass(3600);
      // The same browser's profile imported on both (it played as the login once, and as this guest now); a run on each since.
      economy.progressSync(login.token, { import: legacy, reports: [{ id: 'r-login-1', kind: 'run', facts: factsOf(run({ fighter: 'konta' })) }] });
      economy.progressSync(guest.token, { import: legacy, reports: [{ id: 'r-guest-1', kind: 'run', facts: factsOf(run({ fighter: 'taisei' })) }, { id: 'r-guest-2', kind: 'match', match: match('g:0') }] });
      // Signing in folds the guest into the login (api.ts signIn: merge, then Book.retire).
      const into = economy.book.accounts.get(login.account.pk)!, gone = economy.book.accounts.get(guest.account.pk)!;
      merge(into, gone); economy.book.retire(gone, into);
      const one = economy.progress.get(login.account.pk);
      expect(one.rift.runs).toBe(3); expect(one.rift.mastery.kenzo).toBe(legacy.rift.mastery.kenzo); expect(one.rift.mastery.taisei).toBeGreaterThan(0); expect(one.rift.mastery.konta).toBeGreaterThan(0);
      expect(one.career.totals.matches).toBe(1);
      expect(existsSync(join(dir, 'progress', `${guest.account.pk}.json`))).toBe(false);
      // The guest's token opens the login's account now, and its progress with it.
      expect(economy.progressSync(guest.token, {}).pk).toBe(login.account.pk);
      // DELETE ACCOUNT: its progress goes too.
      economy.deleteAccount(login.token, 'DELETE');
      expect(existsSync(join(dir, 'progress', `${login.account.pk}.json`))).toBe(false);
      expect(economy.progress.get(login.account.pk)).toEqual(emptyState());
      economy.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('progress on the account: over HTTP', () => {
  it('takes the largest profile a player can have, whole, through the route (its own 64 KB limit)', async () => {
    const now = clock(), posts = new Map<string, (req: unknown, res: unknown) => void>();
    const economy = mountEconomy({ use: () => undefined, post: (path, handler) => { posts.set(path, handler as never); } }, { dir: false, now });
    const { token, account } = guestOf(economy);
    // Every fighter played and mastered, every boss beaten, every place, mode and challenge, thirty matches.
    const fighters = Object.keys(MOVES) as (keyof typeof MOVES)[], big = emptyState();
    for (let i = 0; i < 120; i++) big.rift = settle(big.rift, run({ fighter: fighters[i % fighters.length], places: LOCATIONS.map(p => p.id),
      bossLog: BOSSES.map(b => ({ id: b.id, name: b.id, rank: 'S' as const, finished: true, seconds: 40 })), round: 14, rank: 'S', seconds: 1500, bosses: BOSSES.length })).progress;
    big.career = newCareer(Date.UTC(2026, 9, 3));
    let n = 0;
    for (const mode of Object.keys(CAREER_MODES) as (keyof typeof CAREER_MODES)[]) for (const fighter of fighters) recordCareer(big.career, match(`${'0'.repeat(30)}${n++}:0`, { mode, fighter, damage: 123456.789 }));
    const body = JSON.stringify({ token, import: importOf(big) });
    expect(body.length).toBeGreaterThan(16384); expect(body.length).toBeLessThan(48_000);
    const answer = await new Promise<{ status: number; body: SyncAnswer }>(resolve => {
      const req = Object.assign(new EventEmitter(), { method: 'POST', headers: {} as Record<string, string> });
      const res = { statusCode: 0, setHeader: () => undefined, end: (text?: string) => resolve({ status: res.statusCode, body: JSON.parse(text ?? '{}') }) };
      posts.get('/api/economy/progress')!(req, res);
      queueMicrotask(() => { req.emit('data', Buffer.from(body)); req.emit('end'); });
    });
    expect(answer.status).toBe(200); expect(answer.body.pk).toBe(account.pk);
    expect(answer.body.rift.runs).toBe(120); expect(answer.body.career.totals.matches).toBe(big.career.totals.matches); expect(answer.body.career.recent).toHaveLength(30);
    economy.close();
  });
});

describe('progress on the account: the browser\'s side', () => {
  it('plays offline, and sends what it played when the server is back; a server without the route is left alone', async () => {
    const now = clock(), economy = new Economy({ dir: false, now }), { post, state } = wire(economy);
    const { token, account } = guestOf(economy);
    now.pass(7200);
    const page = browser(post, () => token, () => account.pk, now);
    await page.sync.sync();
    state.down = true;
    page.play(run(), match('off:0')); page.play(run({ fighter: 'taisei' }), match('off:1'));
    await page.sync.sync();
    expect(page.sync.pending()).toHaveLength(4); expect(page.local.state.rift.runs).toBe(2);
    // Back online: all four are taken, and the copy is the account's - the same as it was played.
    const played = structuredClone(page.local.state);
    state.down = false;
    await page.sync.sync();
    expect(page.sync.pending()).toEqual([]);
    expect(economy.progress.get(account.pk).rift).toEqual(played.rift);
    expect(page.local.state.rift).toEqual(played.rift); expect(page.local.state.career.totals).toEqual(played.career.totals);
    // A server from before this answers 404: nothing changes here, and nothing is lost.
    state.old = true;
    page.play(run());
    await page.sync.sync();
    expect(page.sync.pending()).toHaveLength(1); expect(page.local.state.rift.runs).toBe(3);
    economy.close();
  });

  it('two devices\' runs add up, and each copy becomes the account\'s', async () => {
    const now = clock(), economy = new Economy({ dir: false, now }), { post } = wire(economy);
    const { token, account } = guestOf(economy);
    now.pass(7200);
    const phone = browser(post, () => token, () => account.pk, now), desk = browser(post, () => token, () => account.pk, now);
    await phone.sync.sync(); await desk.sync.sync();
    phone.play(run({ fighter: 'taisei' })); desk.play(run({ fighter: 'konta' }));
    await phone.sync.sync(); await desk.sync.sync(); await phone.sync.sync();
    for (const each of [phone, desk]) { expect(each.local.state.rift.runs).toBe(2); expect(each.local.state.rift).toEqual(economy.progress.get(account.pk).rift); }
  });

  it('a run played while its first import was on its way is imported again; past KEEP reports the copy is sent instead', async () => {
    const now = clock(), economy = new Economy({ dir: false, now }), wired = wire(economy);
    const { token, account } = guestOf(economy);
    now.pass(7200);
    let page!: ReturnType<typeof browser>;
    const slow: Poster = async (path, body) => { const answer = wired.post(path, body); if (page.local.state.rift.runs === 0) page.play(run()); return answer; };
    page = browser(slow, () => token, () => account.pk, now);
    await page.sync.sync();
    expect(page.local.state.rift.runs).toBe(1); expect(economy.progress.get(account.pk).rift.runs).toBe(1);
    expect(wired.state.calls.filter(call => 'import' in call)).toHaveLength(2);
    // A long time offline: more reports than are kept, and the copy (which holds them all) goes as an import.
    wired.state.down = true;
    for (let i = 0; i <= KEEP; i++) page.play(run({ seconds: 100 }));
    expect(page.sync.pending()).toEqual([]);
    wired.state.down = false; now.pass(86400);
    await page.sync.sync();
    expect(economy.progress.get(account.pk).rift.runs).toBe(KEEP + 2); expect(page.local.state.rift.runs).toBe(KEEP + 2);
  });

  it('a server that lost the account\'s progress gets it back from this browser\'s copy; DELETE ACCOUNT clears the copy', async () => {
    const now = clock(), economy = new Economy({ dir: false, now }), { post } = wire(economy);
    const { token, account } = guestOf(economy);
    now.pass(7200);
    const page = browser(post, () => token, () => account.pk, now);
    await page.sync.sync();
    page.play(run(), match('lost:0')); page.play(run({ fighter: 'taisei' }));
    await page.sync.sync();
    const kept = structuredClone(page.local.state);
    economy.progress.forget(account.pk); // the server's file is gone (a volume restored from an old backup, say)
    page.play(run({ fighter: 'konta' }));
    await page.sync.sync();
    expect(page.local.state.rift.runs).toBe(3); expect(economy.progress.get(account.pk).rift.runs).toBe(3);
    expect(economy.progress.get(account.pk).rift.mastery.kenzo).toBe(kept.rift.mastery.kenzo); expect(economy.progress.get(account.pk).career.totals.matches).toBe(1);
    page.sync.forget();
    expect(page.local.state).toEqual(emptyState()); expect(page.store.data.has('jump-progress-sync')).toBe(false);
  });

  it('a new account in this browser (a sign-out, a sign-in elsewhere) takes this browser\'s copy as its import', async () => {
    const now = clock(), economy = new Economy({ dir: false, now }), { post } = wire(economy);
    const first = guestOf(economy), second = guestOf(economy);
    now.pass(7200);
    let token = first.token, pk = first.account.pk;
    const page = browser(post, () => token, () => pk, now);
    await page.sync.sync();
    page.play(run());
    await page.sync.sync();
    token = second.token; pk = second.account.pk;
    page.play(run({ fighter: 'taisei' })); // noted before this browser has synced with the new account: it is in the copy
    expect(page.sync.pending()).toEqual([]);
    await page.sync.sync();
    expect(economy.progress.get(second.account.pk).rift.runs).toBe(2); expect(economy.progress.get(first.account.pk).rift.runs).toBe(1);
  });
});
