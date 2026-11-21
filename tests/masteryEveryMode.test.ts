import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { MASTERY_XP, MATCH_MASTERY, MATCH_XP_MOST, careerMatchFacts, emptyProgress, masteryOf, masteryXpFor, masteryXpForMatch, reportMatchFacts, settle, settleMatch, type MatchFacts } from '../src/survival/progress';
import { PROGRESS_LIMITS, applyReport, cleanRift, creditRoomMatch, emptyState, plausibleMatch, replay } from '../src/game/progress/rules';
import { CareerTracker, careerEvents, newCareer, recordCareer, type CareerMatch } from '../src/game/social/career';
import { ProgressStore } from '../src/server/progress/ProgressStore';
import { Economy } from '../src/server/economy/api';
import { WorldEconomy, CFG } from '../src/p2world/economy';
import { MemoryKV } from '../src/p2world/kv';
import type { MatchReport } from '../src/game/economy/earn';
import type { GameSnapshot } from '../src/game/types';

/** Fighter mastery in every mode: a match pays its fighter's mastery by its length and result - a
 *  device's with its career report, a room's from the room's completion - on Arcade's levels, titles and auras. */
const facts = (over: Partial<MatchFacts> = {}): MatchFacts => ({ fighter: 'taisei', mode: 'duel', seconds: 300, result: 'win', ...over });
const match = (id: string, over: Partial<CareerMatch> = {}): CareerMatch => ({ id, at: Date.UTC(2026, 10, 20), mode: 'duel', fighter: 'taisei', outcome: 'win', kills: 3, damage: 4000, seconds: 300, bosses: 0, capture: 0, score: 0, round: 1, ...over });
const report = (over: Partial<MatchReport> = {}): MatchReport => ({ id: `m-${crypto.randomUUID()}`, mode: 'duel', fighter: 'taisei', seconds: 300, place: 1, players: 2, kos: 2, ...over });

describe('what a match pays (survival/progress.ts)', () => {
  it('pays its minutes at the mode\'s rate, a win more than a draw more than a loss, nothing under ten seconds', () => {
    expect(masteryXpForMatch(facts())).toBe(Math.round(5 * 13 * 1.3));
    expect(masteryXpForMatch(facts({ result: 'draw' }))).toBe(65);
    expect(masteryXpForMatch(facts({ result: 'loss' }))).toBe(Math.round(5 * 13 * 0.85));
    expect(masteryXpForMatch(facts({ mode: 'royale', result: 'loss' }))).toBe(Math.round(5 * 15 * 0.85));
    expect(masteryXpForMatch(facts({ seconds: 9 }))).toBe(0);
    expect(masteryXpForMatch(facts({ seconds: 10, result: 'loss' }))).toBe(2);
    // Held to its longest: a 3-hour "match" pays a 45-minute one's, and nothing pays more than MATCH_XP_MOST.
    expect(masteryXpForMatch(facts({ seconds: 3 * 3600 }))).toBe(masteryXpForMatch(facts({ seconds: 45 * 60 })));
    expect(Math.max(...(['duel', 'royale', 'rift-war'] as const).map(mode => masteryXpForMatch(facts({ mode, seconds: 1e9 }))))).toBeLessThanOrEqual(MATCH_XP_MOST);
    expect(MATCH_XP_MOST).toBe(PROGRESS_LIMITS.xpPerMatch);
  });
  it('takes a level about as long in any mode as in Arcade (minutes a level, at an even record; the royale at one win in five)', () => {
    // Arcade: a round of about 100 s with its boss, 25 XP; a sealed run 355 in 25 minutes.
    const arcade = masteryXpFor({ fighter: 'kenzo', round: 14, score: 0, seconds: 1500, bosses: 14, kills: 0, bestRank: 0, rank: 'S' }) / 25;
    const even = MATCH_MASTERY.perMinute * (MATCH_MASTERY.win + MATCH_MASTERY.loss) / 2;
    const royale = MATCH_MASTERY.royalePerMinute * (MATCH_MASTERY.win + 4 * MATCH_MASTERY.loss) / 5;
    for (const rate of [even, royale]) expect(Math.abs(rate / arcade - 1)).toBeLessThan(.05);
    const minutes = (rate: number) => MASTERY_XP.slice(1).map((xp, i) => (xp - MASTERY_XP[i]) / rate);
    expect(minutes(arcade).map(Math.round)).toEqual([4, 6, 9, 12, 15, 19, 23, 27, 31]);
    for (const rate of [even, royale]) minutes(rate).forEach((m, i) => expect(Math.abs(m / minutes(arcade)[i] - 1)).toBeLessThan(.05));
  });
  it('reads a career\'s match and a room\'s completion, and pays only Arcade\'s runs as runs', () => {
    expect(careerMatchFacts(match('a'))).toEqual(facts());
    expect(careerMatchFacts(match('b', { mode: 'bots', outcome: 'loss' }))).toMatchObject({ mode: 'royale', result: 'loss' });
    for (const mode of ['survival', 'coop', 'boss-hunt'] as const) expect(careerMatchFacts(match('c', { mode }))).toBeUndefined();
    expect(careerMatchFacts(match('d', { outcome: 'left' }))).toBeUndefined();
    expect(reportMatchFacts(report())).toEqual(facts());
    expect(reportMatchFacts(report({ mode: 'match', place: 4, players: 12 }))).toMatchObject({ mode: 'royale', result: 'loss' });
    expect(reportMatchFacts(report({ mode: 'bots', ball: 'sky-spike', place: 2 }))).toMatchObject({ mode: 'sky-spike', result: 'loss' });
    expect(reportMatchFacts({ id: 'run-x', mode: 'survival', fighter: 'kenzo', seconds: 600, round: 4, rank: 1, bosses: 3, finishers: 0, score: 1, kills: 1, style: 1 })).toBeUndefined();
  });
  it('levels the fighter on Arcade\'s levels, and touches nothing else of Arcade\'s', () => {
    const before = settle(emptyProgress(), { fighter: 'kenzo', round: 3, score: 1000, seconds: 300, bosses: 2, kills: 40, bestRank: 3, rank: 'D' }).progress;
    const done = settleMatch(before, facts({ fighter: 'kenzo', seconds: 600 }));
    expect(done.xp).toBe(169);
    expect(done.progress.mastery.kenzo).toBe((before.mastery.kenzo ?? 0) + 169);
    expect(done.to).toBe(masteryOf(done.progress.mastery.kenzo).level);
    expect({ ...done.progress, mastery: before.mastery }).toEqual(before);
    expect(settleMatch(before, facts({ seconds: 3 })).progress).toBe(before);
  });
});

describe('who pays it, and the bounds (progress rules.ts)', () => {
  it('a device\'s match pays with its career report; a room\'s report pays none (the room pays it)', () => {
    const state = emptyState();
    expect(applyReport(state, { id: 'r-1', kind: 'match', match: match('m1', { device: true }) })).toBe(true);
    expect(state.rift.mastery.taisei).toBe(85);
    expect(applyReport(state, { id: 'r-2', kind: 'match', match: match('m2') })).toBe(true);
    expect(state.rift.mastery.taisei).toBe(85);
    expect(state.career.totals.matches).toBe(2);
    // The same match twice: counted once, paid once.
    expect(applyReport(state, { id: 'r-3', kind: 'match', match: match('m1', { device: true }) })).toBe(false);
    expect(state.rift.mastery.taisei).toBe(85);
    expect(plausibleMatch(match('m4', { device: true }))?.device).toBe(true);
    expect(plausibleMatch({ ...match('m5'), device: 'yes' })?.device).toBeUndefined();
    // The page's copy after a sync: the account's progress, with the reports not taken yet played over it, mastery too.
    expect(replay(emptyState(), [{ id: 'r-9', kind: 'match', match: match('m9', { device: true, outcome: 'loss' }) }]).rift.mastery.taisei).toBe(55);
  });
  it('holds a device\'s mastery to the wall clock, as the career\'s matches are', () => {
    let at = Date.UTC(2026, 10, 20, 12);
    const store = new ProgressStore(undefined, () => at), created = at - 60_000;
    const send = (id: string, seconds: number) => store.sync('pk-1', created, { reports: [{ id, kind: 'match', match: match(id, { device: true, seconds }) }] });
    expect(send('first-match', 120).done).toEqual(['first-match']);
    // An hour-long "match" a minute later: it waits for the wall clock, and pays nothing until then.
    const early = send('long-match', 3600);
    expect(early.done).toEqual([]); expect(early.wait).toBeGreaterThan(2000);
    expect(early.rift.mastery.taisei).toBe(masteryXpForMatch(facts({ seconds: 120 })));
    at += 3600 * 1000;
    expect(send('long-match', 3600).rift.mastery.taisei).toBe(masteryXpForMatch(facts({ seconds: 120 })) + masteryXpForMatch(facts({ seconds: 3600 })));
  });
  it('pays a room\'s match from its completion, once, on the match server and in the economy world alike', () => {
    const state = emptyState();
    expect(creditRoomMatch(state, report({ seconds: 600 }))).toBe(true);
    expect(state.rift.mastery.taisei).toBe(169);
    expect(creditRoomMatch(state, report({ fighter: 'nobody' }))).toBe(false);
    expect(creditRoomMatch(state, { id: 'run-1', mode: 'survival', fighter: 'kenzo', seconds: 900, round: 6, rank: 3, bosses: 5, finishers: 1, score: 1, kills: 1, style: 1 })).toBe(false);
    const server = new Economy({ dir: false }), guest = server.hello(undefined) as unknown as { account: { pk: string } };
    const done = report({ mode: 'bots', ball: 'goal-rush', seconds: 480, place: 1, players: 6 });
    server.complete(guest.account.pk, done); server.complete(guest.account.pk, done);
    expect(server.progress.get(guest.account.pk).rift.mastery.taisei).toBe(masteryXpForMatch(facts({ mode: 'goal-rush', seconds: 480 })));
    const kv = new MemoryKV(), world = new WorldEconomy(kv, { key: 'k' });
    kv.set(CFG, { open: true });
    const made = world.book.create(Date.now()).account;
    world.complete(made.pk, done); world.complete(made.pk, done);
    expect(world.progress(made.pk, made.created, {}).rift.mastery.taisei).toBe(masteryXpForMatch(facts({ mode: 'goal-rush', seconds: 480 })));
  });
  it('keeps an old save\'s mastery, and an import\'s mastery from its matches as well as its runs', () => {
    const runs = 2, career = newCareer(0);
    for (let i = 0; i < 6; i++) recordCareer(career, match(`i${i}`));
    const kept = cleanRift({ runs, mastery: { kenzo: 1500, taisei: 700 } }, career.totals.matches);
    expect(kept.mastery).toEqual({ kenzo: 1500, taisei: 700 });
    // With no matches to account for it, the most two runs could have paid, shared out as before.
    expect(Object.values(cleanRift({ runs, mastery: { kenzo: 1500, taisei: 700 } }).mastery).reduce((a, b) => a! + b!, 0)).toBeLessThanOrEqual(runs * PROGRESS_LIMITS.xpPerRun);
  });
});

describe('the page\'s side: the career and this browser\'s copy', () => {
  const storage = () => { const kept = new Map<string, string>(); return { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => { kept.set(k, v); } }; };
  const snap = (over: Partial<GameSnapshot>, players = [{ id: 'me', fighter: 'taisei', alive: true }]) => ({ roomMode: 'match', status: 'active', serverTime: 0, events: [], stage: 'harbor', winnerId: null, players, ...over }) as unknown as GameSnapshot;
  it('marks a device\'s matches, and counts a ball match by its side and to its final whistle', () => {
    const career = new CareerTracker(storage());
    career.start('goal-rush', true);
    const ball = (phase: string, winner: string | null, serverTime: number, alive = true) => snap({ serverTime, status: phase === 'over' ? 'finished' : 'active', ball: { mode: 'goal-rush', phase, round: 1, winner, seats: [{ id: 'me', team: 'red' }] } } as never, [{ id: 'me', fighter: 'taisei', alive } as never]);
    career.observe(ball('live', null, 1), 'me');
    // Wiped out mid-match: not the match's end.
    career.observe(ball('live', null, 30, false), 'me');
    expect(career.data.totals.matches).toBe(0);
    career.observe(ball('over', 'red', 241), 'me');
    expect(career.data.recent[0]).toMatchObject({ mode: 'goal-rush', outcome: 'win', seconds: 240, device: true });
    // The rematch is a match of its own.
    career.observe({ ...ball('live', null, 300), ball: { mode: 'goal-rush', phase: 'live', round: 2, winner: null, seats: [{ id: 'me', team: 'red' }] } } as never, 'me');
    career.observe({ ...ball('over', 'blue', 420), ball: { mode: 'goal-rush', phase: 'over', round: 2, winner: 'blue', seats: [{ id: 'me', team: 'red' }] } } as never, 'me');
    expect(career.data.recent[0]).toMatchObject({ outcome: 'loss', round: 2 });
    expect(career.data.totals.matches).toBe(2);
    const online = new CareerTracker(storage());
    online.start('duel');
    online.observe(snap({ serverTime: 1, duel: { set: 1 } as never }), 'me'); online.observe(snap({ serverTime: 200, status: 'finished', winnerId: 'me', duel: { set: 1 } as never }), 'me');
    expect(online.data.recent[0].device).toBeUndefined();
  });
});

describe('this browser\'s copy (survival/progressStore.ts) and the results strip', () => {
  const memory = new Map<string, string>();
  beforeEach(() => { memory.clear(); (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => { memory.set(k, v); }, removeItem: (k: string) => { memory.delete(k); } }; });
  afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage; });
  it('pays a counted match into this browser\'s copy at once and keeps the gain for the results; a run\'s gain too', async () => {
    const store = await import('../src/survival/progressStore'), strip = await import('../src/ui/progress/masteryStrip');
    store.forgetProgress(); store.clearMastery();
    // A fighter one level short of the next: the match takes them over it.
    memory.set('rift-survival-progress', JSON.stringify({ ...emptyProgress(), mastery: { taisei: 140 } }));
    store.forgetProgress();
    careerEvents.local?.({ kind: 'match', match: match('page-1', { seconds: 120 }) });
    const gain = store.lastMastery()!;
    expect(gain).toMatchObject({ key: 'page-1', fighter: 'taisei', xp: 34, before: 140, after: 174, from: 2, to: 3 });
    expect(store.loadProgress().mastery.taisei).toBe(174);
    // The strip: the bar from empty (a level gained), LV 3, the stamp and what level 3 opens; the line called once.
    const said: string[] = [];
    strip.masteryCalls.up = g => said.push(g.key);
    const html = strip.masteryStripHtml(gain);
    expect(html).toContain('LV 3'); expect(html).toContain('+34 XP'); expect(html).toContain('LEVEL UP'); expect(html).toContain('AURA: KI BLUE'); expect(html).toContain('--from:0.000');
    strip.masteryShown(gain); strip.masteryShown(gain);
    expect(said).toEqual(['page-1']);
    // Nothing for Arcade's career line, a match left, or one under ten seconds.
    for (const m of [match('p2', { mode: 'survival' }), match('p3', { outcome: 'left' }), match('p4', { seconds: 4 })]) expect(store.creditMatch(m)).toBeUndefined();
    store.clearMastery(); expect(store.lastMastery()).toBeUndefined();
  });
});
