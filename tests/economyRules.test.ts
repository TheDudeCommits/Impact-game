import { describe, expect, it } from 'vitest';
import { BUNDLES, ITEMS, ITEM, KINDS, STARTERS, isBundle, lookOf, onOffer, priceOf, released, wornOf } from '../src/game/economy/catalog';
import { EFFECT_KINDS, featured, turnover } from '../src/game/economy/front';
import { ROAD, UNLOCKS } from '../src/game/economy/unlocks';
import { RARITY, RARITIES } from '../src/game/economy/rarity';
import { FEAT, FEATS } from '../src/game/economy/feats';
import { DAILY, DAILY_CHALLENGES, WEEKLY, WEEKLY_CHALLENGES, dailyChallenge, dailyMissions, weeklyChallenge, weeklyMissions } from '../src/game/economy/missions';
import { PAY, dayOf, levelOf, payFor, plausible, underCap, weekOf, xpAt, type SurvivalReport, type MatchReport } from '../src/game/economy/earn';
import { buy, cannotBuy, cannotBuyBundle, credit, merge, newAccount, settle, wear } from '../src/game/economy/account';

const NOW = Date.UTC(2026, 8, 30, 12);
const run = (id: string, over: Partial<SurvivalReport> = {}): SurvivalReport => ({ id, mode: 'survival', fighter: 'kenzo', seconds: 800, round: 7, rank: 3, bosses: 7, finishers: 3, score: 2_000_000, kills: 1800, style: 4, ...over });
const bout = (id: string, over: Partial<MatchReport> = {}): MatchReport => ({ id, mode: 'match', fighter: 'taisei', seconds: 240, place: 1, players: 12, kos: 3, ...over });
const sum = (lines: { amount: number }[]) => lines.reduce((n, line) => n + line.amount, 0);

describe('the economy: the catalogue', () => {
  it('prices by rarity, Common to Mythic, each dearer, and gates nothing by level (8 October: the shop streamlined)', () => {
    const prices = RARITIES.map(r => RARITY[r].price), levels = RARITIES.map(r => RARITY[r].level);
    expect(prices).toEqual([...prices].sort((a, b) => a - b)); expect(new Set(prices).size).toBe(5);
    expect(levels).toEqual([1, 1, 1, 1, 1]);
    expect(RARITY.mythic.supply).toBe(100);
  });
  it('has items with ids of their own, and offers exactly what the one table says, one stage each', () => {
    expect(ITEM.size).toBe(ITEMS.length);
    for (const item of ITEMS) { expect(KINDS[item.kind], item.id).toBeTruthy(); expect(item.id.startsWith(`${item.kind}-`), item.id).toBe(true); }
    // Sold where the table gives a price (and on the road too where it gives a level), the road's alone where it gives only a level.
    for (const [id, how] of Object.entries(UNLOCKS)) {
      const item = ITEM.get(id);
      expect(item, id).toBeTruthy();
      expect(item!.stage, id).toBe(how.price !== undefined ? 'live' : 'road');
      expect(item!.price, id).toBe(how.price); expect(item!.level, id).toBe(how.level);
      expect(how.price !== undefined || how.level !== undefined, id).toBe(true);
    }
    // Everything else that was out is retired - kept by whoever owns it - and nothing waiting was put on offer.
    for (const item of ITEMS.filter(each => !UNLOCKS[each.id])) expect(['retired', 'next', 'ask'], item.id).toContain(item.stage);
    expect(ITEMS.filter(onOffer).length).toBe(Object.keys(UNLOCKS).length);
    expect(ITEMS.filter(item => item.kind === 'fighter' && onOffer(item)).length).toBe(84);
    expect(ITEMS.filter(item => item.kind === 'outfit' && onOffer(item)).length).toBe(21);
    // (The streamlining was the cosmetics': the roster's fighters, sold since 28 October 2026, are not counted in it.)
    const cosmetic = (item: (typeof ITEMS)[number]) => item.kind !== 'fighter';
    expect(ITEMS.filter(item => cosmetic(item) && onOffer(item)).length).toBeLessThan(ITEMS.filter(item => cosmetic(item) && released(item)).length * .6);
  });
  it('asks nothing of anything on offer but its price or its road level: no feat', () => {
    for (const item of ITEMS.filter(onOffer)) expect(item.feat, item.id).toBeUndefined();
  });
  it('starts an account with items that exist and are out (retired from sale, still worn)', () => { for (const id of STARTERS) expect(released(ITEM.get(id)), id).toBe(true); });
  it('keeps every place a party is told of where it was: the first seventy-seven items did not move', () => {
    // (A co-op room tells a party what each wears as places in ITEMS; the new wave went on the end.)
    expect(ITEMS[0].id).toBe('skin-newsprint'); expect(ITEMS[76].id).toBe('place-eclipse-ascendant'); expect(ITEMS[77].id).toBe('kill-soak');
    const worn = { skin: 'skin-living-ink', aura: 'aura-rising', trail: 'trail-chalk', kill: 'kill-seal', form: 'form-oni' };
    expect(lookOf(worn)).toHaveLength(5); expect(wornOf(lookOf(worn))).toEqual(worn);
    // A room that knows only the first three (an older server) is read as it was.
    expect(wornOf(lookOf(worn).slice(0, 3))).toEqual({ skin: 'skin-living-ink', aura: 'aura-rising', trail: 'trail-chalk' });
  });
  it('sells no sets any more: each piece is got its own way', () => {
    expect(BUNDLES).toEqual([]);
    for (const id of ['bundle-ink', 'bundle-cranes', 'bundle-press', 'bundle-gold', 'bundle-crimson']) {
      expect(isBundle(id)).toBe(false);
      expect(cannotBuyBundle(newAccount('a', NOW), id)).toMatch(/no such set/);
    }
  });
  it('features a fighter, an outfit and an effect a week, the same for everyone, all three on sale', () => {
    const week = featured(NOW), later = featured(NOW + 3 * 86400_000), next = featured(NOW + 7 * 86400_000);
    expect(week.fighter?.kind).toBe('fighter'); expect(week.outfit?.kind).toBe('outfit'); expect(EFFECT_KINDS).toContain(week.effect?.kind);
    for (const item of [week.fighter, week.outfit, week.effect]) { expect(item?.stage).toBe('live'); expect(item?.price).toBeGreaterThan(0); }
    // (NOW is a Wednesday: three days on is the same ISO week.)
    expect([later.fighter?.id, later.outfit?.id, later.effect?.id]).toEqual([week.fighter?.id, week.outfit?.id, week.effect?.id]);
    expect(next.fighter?.id).not.toBe(week.fighter?.id);
    // Every fighter on sale has a week at the front, in turn.
    const sold = ITEMS.filter(item => item.kind === 'fighter' && item.stage === 'live').length;
    const seen = new Set(Array.from({ length: sold }, (_, i) => featured(NOW + i * 7 * 86400_000).fighter?.id));
    expect(seen.size).toBe(sold);
    const { day, week: toWeek } = turnover(NOW);
    expect(day).toBe(12 * 3600_000); expect(toWeek).toBeGreaterThan(day - 1); expect(toWeek).toBeLessThanOrEqual(7 * 86400_000);
  });
  it('lays the road from level 2 to 60, a reward at most three levels from the last', () => {
    expect(ROAD[0].level).toBe(2); expect(ROAD[ROAD.length - 1].level).toBe(60);
    for (let i = 1; i < ROAD.length; i++) { expect(ROAD[i].level - ROAD[i - 1].level, ROAD[i].id).toBeGreaterThan(0); expect(ROAD[i].level - ROAD[i - 1].level, ROAD[i].id).toBeLessThanOrEqual(3); }
    expect(ROAD.filter(step => step.id.startsWith('fighter-')).length).toBeGreaterThanOrEqual(6);
  });
});

describe('the economy: what a match pays', () => {
  it('pays a good survival run about forty, and a match won about forty', () => {
    expect(sum(payFor(run('r')))).toBe(5 + 6 * 1.5 + 7 * 2 + 3 * 2 + 6);
    expect(sum(payFor(bout('m')))).toBe(8 + 20 + 6);
    expect(sum(payFor(bout('m', { mode: 'bots' })))).toBe((8 + 20 + 6) / 2);
  });
  it('pays sealing the rift, and nothing for a run of a minute', () => {
    expect(sum(payFor(run('r', { round: 14, rank: 6, sealed: true, bosses: 14, finishers: 6, seconds: 1500 })))).toBe(5 + 14 * 1.5 + 28 + 12 + 30 + 60);
    expect(plausible(run('short-run', { seconds: 60 }))).toHaveProperty('refused');
    expect(plausible(bout('short-match', { seconds: 30 }))).toHaveProperty('refused');
  });
  it('holds a report to what its length allows', () => {
    const checked = plausible(run('forged', { seconds: 120, round: 40, rank: 6, bosses: 90, finishers: 90, sealed: true, kills: 999999 }));
    if ('refused' in checked) throw new Error(checked.refused);
    const r = checked.report as SurvivalReport;
    expect(r.round).toBe(4); expect(r.rank).toBe(1); expect(r.bosses).toBeLessThanOrEqual(9); expect(r.finishers).toBeLessThanOrEqual(r.bosses); expect(r.sealed).toBe(false); expect(r.kills).toBeLessThanOrEqual(1440);
  });
  it('pays match pay whole to the cap, then a fifth', () => {
    expect(underCap(50, 0)).toBe(50); expect(underCap(50, 180)).toBe(20 + 30 * PAY.past); expect(underCap(50, 400)).toBe(50 * PAY.past);
  });
  it('reaches level 3 in a day, 8 in three, and knows its days and weeks', () => {
    expect(xpAt(1)).toBe(0); expect(levelOf(0).level).toBe(1); expect(levelOf(xpAt(8)).level).toBe(8); expect(levelOf(xpAt(8) - 1).level).toBe(7);
    expect(dayOf(NOW)).toBe('2026-09-30'); expect(weekOf(NOW)).toBe('2026-W40'); expect(weekOf(Date.UTC(2026, 0, 1))).toBe('2026-W01');
  });
});

describe('the economy: an account', () => {
  it('settles a run once: its pay, the first of the day, the streak, a feat, experience', () => {
    const a = newAccount('a', NOW);
    const s = settle(a, run('run-0001'), NOW);
    expect(s.refused).toBeUndefined();
    expect(s.lines.find(line => line.label === 'First of the day')?.amount).toBe(25);
    expect(s.lines.find(line => line.label === 'Day 1 running')?.amount).toBe(10);
    expect(s.feats).toContain('first-run'); expect(s.feats).toContain('rank-c');
    expect(a.balance).toBe(s.total); expect(s.total).toBeGreaterThan(40 + 25 + 10 + 50);
    expect(a.xp).toBe(s.xp); expect(s.level.to).toBeGreaterThanOrEqual(s.level.from);
    expect(settle(a, run('run-0001'), NOW + 1000).refused).toMatch(/already/);
    expect(a.balance).toBe(s.total);
  });
  it('keeps a streak a day at a time and starts it again after a day missed', () => {
    const a = newAccount('a', NOW);
    settle(a, run('day-one'), NOW);
    expect(settle(a, run('day-two'), NOW + 86400000).lines.find(line => /running/.test(line.label))?.label).toBe('Day 2 running');
    expect(settle(a, run('day-five'), NOW + 4 * 86400000).lines.find(line => /running/.test(line.label))?.label).toBe('Day 1 running');
    expect(a.stats.bestStreak).toBe(2);
  });
  it('caps a day of farming: the tenth run pays a fifth of the first', () => {
    const a = newAccount('a', NOW);
    const own = (i: number) => settle(a, run(`farm-${String(i).padStart(3, '0')}`), NOW + i * 1000).lines.filter(line => /Run fought|cleared|beaten|finisher|Rank/.test(line.label));
    const first = sum(own(0));
    for (let i = 1; i < 9; i++) own(i);
    const tenth = sum(own(9));
    expect(first).toBeGreaterThanOrEqual(38); expect(tenth).toBeLessThanOrEqual(Math.ceil(first * PAY.past) + 2);
  });
  it('picks three missions a day and a week, the same for everyone, and pays each once', () => {
    expect(dailyMissions('2026-09-30').map(m => m.id)).toEqual(dailyMissions('2026-09-30').map(m => m.id));
    expect(new Set(dailyMissions('2026-09-30').map(m => m.id)).size).toBe(3); expect(new Set(weeklyMissions('2026-W40').map(m => m.id)).size).toBe(3);
    const days = new Set(Array.from({ length: 30 }, (_, i) => dailyMissions(`2026-10-${String(i + 1).padStart(2, '0')}`).map(m => m.id).join()));
    expect(days.size).toBeGreaterThan(10);
    expect(DAILY.length).toBeGreaterThanOrEqual(7); expect(WEEKLY.length).toBeGreaterThanOrEqual(5);
    const a = newAccount('a', NOW);
    let paid = 0;
    for (let i = 0; i < 12; i++) paid += settle(a, i % 2 ? bout(`mission-m${i}`, { fighter: 'taisei' }) : run(`mission-r${i}`, { fighter: i % 4 ? 'kenzo' : 'nigo' }), NOW + i * 60000).missions.length;
    expect(a.day.done.length).toBe(3); expect(a.day.all).toBe(true); expect(paid).toBe(a.day.done.length + a.week.done.length);
  });
  it('sells for the price alone, nothing twice, and nothing retired or the road\'s alone', () => {
    const a = newAccount('a', NOW);
    expect(cannotBuy(a, 'skin-negative', 0)).toMatch(/costs 400/);
    credit(a, 100000);
    expect(buy(a, 'skin-negative', 0, NOW)).toMatchObject({ price: 400 });
    expect(cannotBuy(a, 'skin-negative', 0)).toMatch(/already/);
    // No level and no feat: a level-1 account buys the dearest thing in the shop.
    expect(buy(a, 'fighter-dorado', 0, NOW)).toMatchObject({ price: 1200 });
    // Retired (its owners keep it) and the road's alone are not sold; nor what is not out yet.
    expect(cannotBuy(a, 'skin-newsprint', 0)).toMatch(/not in Account/);
    expect(cannotBuy(a, 'skin-gold-leaf', 0)).toMatch(/not in Account/);
    expect(cannotBuy(a, 'aura-ink-dragon', 0)).toMatch(/not in Account/);
    expect(a.balance).toBe(100000 - 400 - 1200); expect(a.spent).toBe(400 + 1200);
    expect(priceOf(ITEM.get('fighter-dorado')!)).toBe(1200);
  });
  it('gives the road\'s items at their level without granting anything, and keeps a retired one worn', () => {
    const a = newAccount('a', NOW);
    expect(wear(a, 'aura', 'aura-azure-flame')).toHaveProperty('refused');
    a.xp = xpAt(2);
    expect(wear(a, 'aura', 'aura-azure-flame')).toMatchObject({ worn: { aura: 'aura-azure-flame' } });
    expect(a.items['aura-azure-flame']).toBeUndefined();
    a.items['aura-ume'] = { at: NOW };   // retired on 8 October: bought before, still worn
    expect(wear(a, 'aura', 'aura-ume')).toMatchObject({ worn: { aura: 'aura-ume' } });
  });
  it('wears an outfit a fighter at a time, and tells a party the one for the fighter played', () => {
    const a = newAccount('a', NOW);
    a.xp = 1e9; credit(a, 1e6);
    for (const id of ['outfit-taisei-azure-sage', 'outfit-taisei-silver-mane', 'outfit-ouga-violet-wrath']) buy(a, id, 0, NOW);
    wear(a, 'outfit', 'outfit-taisei-azure-sage'); wear(a, 'outfit', 'outfit-ouga-violet-wrath');
    expect(a.worn.outfits).toEqual({ taisei: 'outfit-taisei-azure-sage', ouga: 'outfit-ouga-violet-wrath' });
    wear(a, 'outfit', 'outfit-taisei-silver-mane');
    expect(a.worn.outfits?.taisei).toBe('outfit-taisei-silver-mane');
    wear(a, 'outfit', 'outfit-taisei-silver-mane');
    expect(a.worn.outfits).toEqual({ ouga: 'outfit-ouga-violet-wrath' });
    expect(wornOf(lookOf(a.worn, 'ouga')).outfits).toEqual({ ouga: 'outfit-ouga-violet-wrath' });
    expect(wornOf(lookOf(a.worn, 'taisei')).outfits).toBeUndefined();
  });
  it('wears what it owns: one of a kind, four emotes on the wheel', () => {
    const a = newAccount('a', NOW);
    expect(wear(a, 'skin', 'skin-newsprint')).toHaveProperty('refused');
    a.items['skin-newsprint'] = { at: NOW };
    expect(wear(a, 'skin', 'skin-newsprint')).toMatchObject({ worn: { skin: 'skin-newsprint' } });
    expect(wear(a, 'aura', 'skin-newsprint')).toHaveProperty('refused');
    wear(a, 'skin', undefined); expect(a.worn.skin).toBeUndefined();
    for (const id of ['emote-dots', 'emote-sweat', 'emote-anger', 'emote-sparkle', 'emote-don']) { a.items[id] = { at: NOW }; wear(a, 'emote', id); }
    expect(a.worn.emotes).toEqual(['emote-sweat', 'emote-anger', 'emote-sparkle', 'emote-don']);
    wear(a, 'emote', 'emote-anger'); expect(a.worn.emotes).toEqual(['emote-sweat', 'emote-sparkle', 'emote-don']);
  });
  it('takes a guest into a signed-in account: wallets added, items joined, the better numbers kept', () => {
    const a = newAccount('a', NOW), g = newAccount('g', NOW);
    settle(a, run('acct-run', { round: 9, rank: 4 }), NOW); settle(g, bout('guest-match'), NOW);
    g.items['skin-newsprint'] = { at: NOW };
    const both = a.balance + g.balance;
    merge(a, g);
    expect(a.balance).toBe(both); expect(g.balance).toBe(0); expect(a.items['skin-newsprint']).toBeTruthy(); expect(a.stats.wins).toBe(1); expect(a.stats.bestRank).toBe(4); expect(a.feats).toContain('wins-1');
  });
});

describe('the economy: missions and feats past Arcade (2 November 2026)', () => {
  const days = Array.from({ length: 90 }, (_, i) => dayOf(NOW + i * 86400000));
  it('keeps the three a day and a week as they were, and adds one challenge to each from its own pool', () => {
    // The three are picked from pools unchanged since 8 October: every date still picks the same three.
    expect(DAILY.map(m => m.id)).toEqual(['d-play-3', 'd-play-5', 'd-minutes-20', 'd-fighters-2', 'd-kos-5', 'd-top-3', 'd-win-1']);
    expect(WEEKLY.map(m => m.id)).toEqual(['w-play-20', 'w-wins-3', 'w-hours-2', 'w-kos-40', 'w-top-3-6']);
    for (const day of days) {
      expect(dailyChallenge(day).id).toBe(dailyChallenge(day).id);
      expect(dailyMissions(day).map(m => m.id)).not.toContain(dailyChallenge(day).id);
    }
    // Every challenge comes round, each paid as the others of its kind.
    expect(new Set(days.map(day => dailyChallenge(day).id)).size).toBe(DAILY_CHALLENGES.length);
    expect(new Set(Array.from({ length: 40 }, (_, i) => weeklyChallenge(weekOf(NOW + i * 7 * 86400000)).id)).size).toBe(WEEKLY_CHALLENGES.length);
    for (const m of DAILY_CHALLENGES) expect(m.pay).toBe(DAILY[0].pay);
    for (const m of WEEKLY_CHALLENGES) expect(m.pay).toBe(WEEKLY[0].pay);
    expect(new Set([...DAILY, ...WEEKLY, ...DAILY_CHALLENGES, ...WEEKLY_CHALLENGES].map(m => m.id)).size).toBe(DAILY.length + WEEKLY.length + DAILY_CHALLENGES.length + WEEKLY_CHALLENGES.length);
  });
  it('counts each challenge from what a report carries: a friend, the couch, a mode won, waves, structures', () => {
    const fresh = { fighter: false }, count = (id: string, report: MatchReport | SurvivalReport) => [...DAILY_CHALLENGES, ...WEEKLY_CHALLENGES].find(m => m.id === id)!.count(report, fresh);
    expect(count('d-friend', bout('f', { mode: 'private', friends: true }))).toBe(1); expect(count('d-friend', bout('f', { mode: 'private' }))).toBe(0);
    expect(count('d-friend', run('f', { friends: true, couch: true }))).toBe(1);
    expect(count('d-couch-win', bout('c', { mode: 'duel', players: 2, couch: true, friends: true }))).toBe(1); expect(count('d-couch-win', bout('c', { mode: 'duel', players: 2, place: 2, couch: true }))).toBe(0);
    expect(count('d-duel-win', bout('d', { mode: 'duel', players: 2 }))).toBe(1); expect(count('d-duel-win', bout('d'))).toBe(0);
    expect(count('d-royale-top-3', bout('r', { place: 3 }))).toBe(1); expect(count('d-royale-top-3', bout('r', { mode: 'duel', players: 2 }))).toBe(0);
    expect(count('d-waves-10', bout('w', { mode: 'last-stand', rounds: 10 }))).toBe(1); expect(count('w-waves-15', bout('w', { mode: 'last-stand', rounds: 14 }))).toBe(0);
    expect(count('d-bad-blood-win', bout('b', { mode: 'bad-blood' }))).toBe(1);
    expect(count('d-rift-tower', bout('t', { mode: 'rift-war', towers: 2 }))).toBe(2); expect(count('w-rift-win', bout('t', { mode: 'rift-war', place: 2 }))).toBe(0);
    expect(count('w-friends-5', bout('t', { mode: 'rift-war', friends: true }))).toBe(1);
    // A war lost is second of two sides: no podium for the three's "top three" either.
    const top3 = [...DAILY, ...WEEKLY].find(m => m.id === 'd-top-3')!;
    expect(top3.count(bout('t', { mode: 'rift-war', players: 10, place: 2 }), fresh)).toBe(0); expect(top3.count(bout('t', { mode: 'rift-war', players: 10, place: 1 }), fresh)).toBe(1);
  });
  it('pays the day\'s challenge once, beside the three, and never toward the bonus for all three', () => {
    const day = days.find(each => dailyChallenge(each).id === 'd-friend')!, at = Date.parse(`${day}T12:00:00Z`);
    const a = newAccount('a', at);
    const s = settle(a, bout('with-friend', { mode: 'private', friends: true }), at);
    expect(s.missions).toContain('d-friend'); expect(s.lines).toContainEqual({ label: dailyChallenge(day).text, amount: 40 });
    expect(a.day.all).toBe(false);
    expect(settle(a, bout('with-friend-2', { mode: 'private', friends: true }), at + 1000).missions).not.toContain('d-friend');
  });
  it('gives ten feats past Arcade from the account\'s numbers in every mode, and joins them when accounts are made one', () => {
    expect(FEATS).toHaveLength(27);
    for (const feat of FEATS) { expect(feat.id).toMatch(/^[a-z0-9-]{1,40}$/); expect([...feat.name].length).toBeLessThanOrEqual(40); expect([...feat.text].length).toBeLessThanOrEqual(120); }
    const a = newAccount('a', NOW); let at = NOW, n = 0;
    const play = (report: MatchReport | SurvivalReport) => settle(a, { ...report, id: `feat-${n++}` }, at += 600_000, true).feats;
    // An account from before has no numbers past Arcade, and settles as ever.
    expect(a.stats.modes).toBeUndefined();
    expect(play(bout('x', { mode: 'private', friends: true }))).toEqual(expect.arrayContaining(['first-run', 'wins-1', 'friends-1', 'royale-win']));
    expect(play(bout('x', { mode: 'duel', players: 2, couch: true }))).toContain('couch-1');
    for (let i = 0; i < 4; i++) play(bout('x', { mode: 'duel', players: 2, couch: true }));
    expect(a.feats).toEqual(expect.arrayContaining(['couch-wins-5', 'duel-wins-5']));
    expect(play(bout('x', { mode: 'last-stand', rounds: 19, place: 2 }))).not.toContain('waves-20');
    expect(play(bout('x', { mode: 'last-stand', rounds: 20, place: 2 }))).toContain('waves-20');
    for (let i = 0; i < 3; i++) play(bout('x', { mode: 'bad-blood', players: 6 }));
    expect(a.feats).toContain('bad-blood-wins-3');
    expect(play(bout('x', { mode: 'rift-war', players: 10, towers: 6 }))).toContain('rift-win');
    expect(play(bout('x', { mode: 'rift-war', players: 10, place: 2, towers: 4 }))).toContain('towers-10');
    expect(a.stats.modes).toMatchObject({ duelWins: 5, couch: 5, couchWins: 5, royaleWins: 1, bestWaves: 20, badBloodWins: 3, riftWins: 1, towers: 10, friends: 6 });
    for (let i = 0; i < 19; i++) play(bout('x', { mode: 'private', place: 2, friends: true }));
    expect(a.feats).toContain('friends-25');
    // Made one with a guest: counts added, the best stand kept; an account from before joins as nothing.
    const g = newAccount('g', NOW); settle(g, bout('guest-war', { mode: 'rift-war', players: 10, towers: 3 }), NOW, true); settle(g, bout('guest-stand', { mode: 'last-stand', rounds: 25, place: 2 }), NOW + 1, true);
    merge(a, g);
    expect(a.stats.modes).toMatchObject({ riftWins: 2, towers: 13, bestWaves: 25 });
    const old = newAccount('o', NOW); merge(old, newAccount('p', NOW)); expect(old.stats.modes).toBeUndefined();
  });
});
