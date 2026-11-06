import { describe, expect, it } from 'vitest';
import type { RunResult } from '../src/survival/SurvivalGame';
import { CHALLENGES, emptyProgress, factsOf, settle, type RiftProgress } from '../src/survival/progress';
import { LOCATIONS } from '../src/survival/locations';
import { newCareer, recordCareer, type CareerMatch } from '../src/game/social/career';
import { PROGRESS_LIMITS, applyReport, cleanCareer, cleanRift, costOf, emptyState, fold, foldRift, forward, forwardRift, plausibleFacts, plausibleMatch, readReport, replay } from '../src/game/progress/rules';

/** A rich run: every field the challenges read is set, so a fact left out of RunFacts shows here. */
const run = (over: Partial<RunResult> = {}): RunResult => ({
  fighter: 'kenzo', round: 14, wave: 14, rank: 'S', act: 4, score: 9_000_000, kills: 1200, ownKills: 1100, seconds: 1500, level: 20,
  bestRank: 6, bestCombo: 80, damageDealt: 900000, damageTaken: 9000, bosses: 3, picks: ['iron-fist'], sealed: true, party: 2,
  finishers: 5, teamUltimates: 1, dealtBy: { blows: 1, specials: 1, ultimates: 1, techniques: 1, team: 1 }, relics: ['x'],
  bossLog: [{ id: 'harrow', name: 'Harrow', rank: 'F', finished: true, seconds: 64 }, { id: 'zarek', name: 'Zarek', rank: 'E', finished: false, seconds: 91 }, { id: 'shiun', name: 'Shiun', rank: 'S', finished: true, seconds: 120 }],
  places: LOCATIONS.map(place => place.id), breaks: 2, flawless: 1, cursed: 1, loop: 0, ...over });
const match = (id: string, over: Partial<CareerMatch> = {}): CareerMatch => ({ id, at: Date.UTC(2026, 10, 1), mode: 'duel', fighter: 'taisei', outcome: 'win', kills: 3, damage: 4000, seconds: 120, bosses: 0, capture: 0, score: 0, round: 1, ...over });
/** A profile after these runs, as the page settles them. */
const after = (...runs: RunResult[]) => runs.reduce((p: RiftProgress, r) => settle(p, r).progress, emptyProgress());

describe('progress on the account: a run as the server reads it', () => {
  it('a run\'s facts settle exactly as the run did, and an honest run passes the caps untouched', () => {
    for (const r of [run(), run({ sealed: false, round: 6, rank: 'E', seconds: 420, bossLog: undefined, bosses: 2, places: undefined }), run({ fighter: 'konta', loop: 1, round: 17, rank: 'S', seconds: 2400 })]) {
      expect(plausibleFacts(factsOf(r))).toEqual(factsOf(r));
      const before = after(run({ fighter: 'taisei' }));
      expect(settle(before, factsOf(r))).toEqual(settle(before, r));
    }
    // Nothing the server does not need goes: the picks, relics, damage by source...
    expect(Object.keys(factsOf(run()))).not.toEqual(expect.arrayContaining(['picks']));
    expect(JSON.stringify(factsOf(run())).length).toBeLessThan(900);
  });

  it('holds a run to what its length allows', () => {
    const facts = plausibleFacts({ ...factsOf(run()), seconds: 120, round: 150, bosses: 900, score: 1e12, kills: 1e9, finishers: 400, sealed: true, rank: 'S', loop: 9, bestRank: 99,
      bossLog: Array.from({ length: 50 }, (_, i) => ({ id: `boss-${i}`, finished: true, seconds: 9999 })), places: ['burning-village', 'nowhere', 'burning-village'] })!;
    // 120 seconds: four rounds at most (forty seconds a round), nine bosses, a score and knockouts by time, no seal.
    expect(facts).toMatchObject({ seconds: 120, round: 4, bosses: 9, sealed: false, loop: 0, bestRank: 6, finishers: 18 });
    expect(facts.bossLog).toHaveLength(9); expect(facts.bossLog!.every(b => b.seconds === 120)).toBe(true);
    expect(facts.score).toBe(120 * PROGRESS_LIMITS.scorePerSecond + PROGRESS_LIMITS.scoreFloor); expect(facts.kills).toBe(120 * PROGRESS_LIMITS.killsPerSecond);
    expect(facts.rank).toBe('E'); expect(facts.places).toEqual(['burning-village']);
    expect(plausibleFacts({ ...factsOf(run()), seconds: 1e9 })!.seconds).toBe(PROGRESS_LIMITS.runSeconds);
    expect(plausibleFacts({ ...factsOf(run()), fighter: 'nobody' })).toBeUndefined();
    expect(plausibleFacts(null)).toBeUndefined();
    // A match for the career: by its length, and never dated ahead of the server.
    const m = plausibleMatch(match('m1', { seconds: 30, kills: 5000, damage: 1e12, bosses: 99, capture: 999, at: 5e15 }), 1000)!;
    expect(m).toMatchObject({ seconds: 30, kills: 30, damage: 30 * PROGRESS_LIMITS.damagePerSecond + 20000, bosses: 6, capture: 30, at: 1000 });
    expect(plausibleMatch({ ...match('m2'), mode: 'nowhere' })).toBeUndefined();
  });

  it('applies reports by the page\'s own rules, refusing what the page would', () => {
    const s = emptyState();
    expect(applyReport(s, { id: 'buy-000', kind: 'buy', node: 'momentum' })).toBe(false); // no shards yet
    expect(applyReport(s, { id: 'run-001', kind: 'run', facts: factsOf(run()) })).toBe(true);
    expect(applyReport(s, { id: 'aura-01', kind: 'aura', fighter: 'kenzo', aura: 'gold' })).toBe(false); // mastery 10 it is not
    expect(applyReport(s, { id: 'aura-02', kind: 'aura', fighter: 'kenzo', aura: 'ki' })).toBe(true);
    const shards = s.rift.shards;
    expect(applyReport(s, { id: 'buy-001', kind: 'buy', node: 'momentum' })).toBe(true);
    expect(s.rift.shards).toBe(shards - 30); expect(s.rift.shards).toBe(s.rift.earned - costOf(s.rift.unlocked));
    expect(applyReport(s, { id: 'buy-002', kind: 'buy', node: 'momentum' })).toBe(false); // bought already
    expect(applyReport(s, { id: 'match-1', kind: 'match', match: match('a:0') })).toBe(true);
    expect(applyReport(s, { id: 'match-2', kind: 'match', match: match('a:0') })).toBe(false); // that match is counted
    expect(applyReport(s, { id: 'title-1', kind: 'title', title: 'legend' })).toBe(false);
    expect(s.career.totals).toMatchObject({ matches: 1, wins: 1 });
    expect(readReport({ id: 'x', kind: 'run', facts: {} })).toBeUndefined(); // an id too short
    expect(readReport({ id: 'abcdef', kind: 'steal', node: 'x' })).toBeUndefined();
    // replay: on a copy, in order.
    const base = emptyState(), played = replay(base, [{ id: 'run-001', kind: 'run', facts: factsOf(run()) }, { id: 'buy-001', kind: 'buy', node: 'momentum' }]);
    expect(base.rift.runs).toBe(0); expect(played.rift.unlocked).toEqual(['momentum']);
  });
});

describe('progress on the account: an import, held to plausible totals', () => {
  it('keeps an honest profile as it is', () => {
    const p = settle(after(run(), run({ fighter: 'taisei' })), run()).progress;
    const bought = { ...p, shards: p.shards - 30, unlocked: ['momentum'] };
    expect(cleanRift(JSON.parse(JSON.stringify(bought)))).toEqual(bought);
    const career = newCareer(Date.UTC(2026, 9, 1)); recordCareer(career, match('a:0')); recordCareer(career, match('b:0', { outcome: 'loss' }));
    expect(cleanCareer(JSON.parse(JSON.stringify(career)), Date.UTC(2026, 10, 2))).toEqual(career);
  });

  it('caps a pasted profile: counts by its runs, nodes by what was earned, only this game\'s ids', () => {
    const pasted = { version: 1, runs: 5, shards: 1e9, earned: 1e9, mastery: { kenzo: 1e9, taisei: 1e9, nobody: 50 }, aura: { kenzo: 'gold', taisei: 'plaid' },
      codex: { harrow: { beaten: 1e6, finished: 2e6, fastest: 0.001 }, '<script>': { beaten: 3, finished: 1 } }, places: ['burning-village', 'mars'], challenges: ['sealed', 'made-up'],
      unlocked: ['momentum', 'overflow', 'second-wind', 'not-a-node'], best: { round: 1e6, score: 1e15 } };
    const p = cleanRift(pasted);
    expect(p.runs).toBe(5);
    expect((p.mastery.kenzo ?? 0) + (p.mastery.taisei ?? 0)).toBeLessThanOrEqual(5 * PROGRESS_LIMITS.xpPerRun);
    expect(p.mastery).not.toHaveProperty('nobody'); expect(p.aura).toEqual({ kenzo: 'gold' });
    expect(p.codex.harrow.beaten).toBe(5 * PROGRESS_LIMITS.bossesPerRun); expect(p.codex.harrow.finished).toBe(p.codex.harrow.beaten); expect(p.codex).not.toHaveProperty('<script>');
    expect(p.places).toEqual(['burning-village']); expect(p.challenges).toEqual(['sealed']);
    expect(p.earned).toBe(5 * PROGRESS_LIMITS.shardsPerRun + CHALLENGES.find(c => c.id === 'sealed')!.reward);
    expect(p.unlocked).toEqual(['momentum', 'overflow', 'second-wind']); expect(p.shards).toBe(p.earned - 115);
    expect(p.best).toEqual({ round: PROGRESS_LIMITS.round, score: PROGRESS_LIMITS.bestScore });
    // No runs, nothing at all; and nodes no shards paid for stay shut.
    expect(cleanRift({ ...pasted, runs: 0 })).toEqual({ ...emptyProgress(), aura: { kenzo: 'gold' } });
    expect(cleanRift({ runs: 1, earned: 35, unlocked: ['overflow', 'momentum'] }).unlocked).toEqual(['momentum']);
    expect(cleanRift('junk')).toEqual(emptyProgress());
    const career = cleanCareer({ version: 1, since: 5, totals: { matches: 1e9, wins: 2e9, losses: 0, draws: 0, left: 0, kills: 1e12, damage: 1e15, seconds: 1e12, bosses: 1e9, capture: 1e12 },
      modes: { duel: { matches: 5e9, wins: 1 }, moon: { matches: 1 } }, fighters: {}, recent: [], seen: [], title: 'legend' });
    expect(career.totals.matches).toBe(PROGRESS_LIMITS.matches); expect(career.totals.wins).toBe(PROGRESS_LIMITS.matches);
    expect(career.totals.seconds).toBe(PROGRESS_LIMITS.matches * PROGRESS_LIMITS.matchSeconds);
    expect(career.modes.duel!.matches).toBe(PROGRESS_LIMITS.matches); expect(career.modes).not.toHaveProperty('moon');
    expect(career.title).toBe('legend');
  });
});

describe('progress on the account: merges only move forward', () => {
  it('forward(): the higher count, the union, the fastest boss, shards as earned less nodes; the same profile twice is itself', () => {
    const a = after(run(), run({ fighter: 'taisei' })), b = after(run({ bossLog: [{ id: 'harrow', name: 'J', rank: 'F', finished: true, seconds: 30 }, { id: 'gorai', name: 'K', rank: 'A', finished: false, seconds: 200 }] }));
    const bought = { ...b, shards: b.shards - 30, unlocked: ['momentum'] };
    const m = forwardRift(a, bought);
    expect(m.runs).toBe(2); expect(m.earned).toBe(Math.max(a.earned, b.earned));
    expect(m.mastery.kenzo).toBe(Math.max(a.mastery.kenzo!, b.mastery.kenzo!)); expect(m.mastery.taisei).toBe(a.mastery.taisei);
    expect(m.codex.harrow).toEqual({ beaten: 2, finished: 2, fastest: 30 }); expect(m.codex.gorai.beaten).toBe(1); expect(m.codex.shiun.beaten).toBe(2);
    expect(m.unlocked).toEqual(['momentum']); expect(m.shards).toBe(m.earned - 30);
    expect(forwardRift(a, a)).toEqual(a);
    expect(forwardRift(m, a)).toEqual(m); expect(forwardRift(m, bought)).toEqual(m);
    // Nothing goes back: every count of either is at most the merge's.
    for (const p of [a, bought]) { expect(m.runs).toBeGreaterThanOrEqual(p.runs); expect(m.earned).toBeGreaterThanOrEqual(p.earned); expect(m.best.score).toBeGreaterThanOrEqual(p.best.score); for (const c of p.challenges) expect(m.challenges).toContain(c); }
  });

  it('fold(): a guest\'s import counts once, and what its runs earned since is added', () => {
    const imported = after(run(), run()), guest = settle(imported, run({ fighter: 'taisei' })).progress;
    // The login's account already holds the same profile (this browser imported it there too), and a run of its own.
    const login = settle(imported, run({ fighter: 'konta' })).progress;
    const one = foldRift(login, guest, imported);
    expect(one.runs).toBe(4); expect(one.mastery.taisei).toBe(guest.mastery.taisei); expect(one.mastery.konta).toBe(login.mastery.konta); expect(one.mastery.kenzo).toBe(imported.mastery.kenzo);
    expect(one.earned).toBe(login.earned + guest.earned - imported.earned); expect(one.codex.harrow.beaten).toBe(4);
    // A pasted import folded in from many guests counts once.
    const pasted = cleanRift({ runs: 50, earned: 9000, mastery: { kenzo: 40000 } });
    let farmed = emptyProgress();
    for (let i = 0; i < 5; i++) farmed = foldRift(farmed, pasted, pasted);
    expect(farmed).toEqual(forwardRift(emptyProgress(), pasted));
    // Careers: the guest's matches since its import are added, its import counted once.
    const base = newCareer(1); recordCareer(base, match('a:0'));
    const g = structuredClone(base); recordCareer(g, match('b:0'));
    const l = structuredClone(base); recordCareer(l, match('c:0', { outcome: 'loss' }));
    const both = fold({ rift: emptyProgress(), career: l }, { rift: emptyProgress(), career: g }, { rift: emptyProgress(), career: base }).career;
    expect(both.totals).toMatchObject({ matches: 3, wins: 2, losses: 1 }); expect(both.recent.map(each => each.id).sort()).toEqual(['a:0', 'b:0', 'c:0']);
    expect(forward({ rift: emptyProgress(), career: l }, { rift: emptyProgress(), career: g }).career.totals).toMatchObject({ matches: 2, wins: 2, losses: 1 });
  });
});
