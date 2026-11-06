/** An account: its wallet, what it owns and wears, its level, its day and
 *  week, and the rules that change any of it - a match settled, an item
 *  bought, an item worn. No storage and no network here: the server keeps
 *  accounts and calls these (src/server/economy), and the tests do.
 *
 *  Every function changes the account it is given and says what it did.
 *
 *  What an account owns, and which gates it has passed, is asked of two
 *  functions here and nowhere else: owns() and unlocked(). An account with
 *  all access (`allAccess`) owns everything the game has released and passes
 *  every gate - including whatever is added later - because the answer is
 *  computed, not listed. Any new unlockable must ask owns()/unlocked(). */
import { BUNDLE, EMOTE_SLOTS, ITEM, STARTERS, bundlePrice, priceOf, type Item, type ItemKind, type Worn } from './catalog';
import { RARITY } from './rarity';
import { FEATS, FEAT } from './feats';
import { ALL_DAILY_BONUS, dailyChallenge, dailyMissions, weeklyChallenge, weeklyMissions, type Mission } from './missions';
import { mergeModes, tallyModes, type ModeStats } from './modeStats';
import { PAY, dayOf, levelOf, payFor, plausible, roundsCleared, underCap, weekOf, type PayLine, type Report } from './earn';
import { onRoadAt } from './unlocks';

/** Lifetime numbers the feats are tested against. */
export interface AccountStats {
  runs: number; matches: number; wins: number;
  rounds: number; bosses: number; finishers: number; kills: number;
  seals: number; sealedWith: string[]; sBosses: number;
  /** The best rank reached (its place in F-S) and style grade, and the quickest a boss has fallen (0: none yet). */
  bestRank: number; bestStyle: number; fastBoss: number;
  bestStreak: number;
  /** Beyond Arcade: the modes' wins, Rift War's structures, Last Stand's best, friends and the couch (modeStats.ts; none
   *  before 2 November 2026). */
  modes?: ModeStats;
}
export interface Owned { at: number; serial?: number }
export interface Account {
  /** Its public id. */
  pk: string;
  created: number;
  /** No longer kept (8 October 2026: no login's email, handle or wallet on the server). Books written before then have
   *  it (the login as the player saw it); the server takes it out as it starts (src/server/economy/book.ts). */
  label?: string;
  balance: number;
  /** Ever earned by playing (or given), ever spent in the shop. */
  earned: number; spent: number;
  /** Sumi once bought for money. Only test-mode packs were ever bought, before buying Sumi was removed (8 October
   *  2026: "No payment system or option to buy Sumi"); the field stays as the book has it, and nothing adds to it. */
  bought: number;
  xp: number;
  items: Record<string, Owned>;
  /** Sumi given back when the shop's prices dropped (8 October 2026, refunds.ts), by item: paid once each, and what the
   *  shop tells the player, once. */
  refunded?: Record<string, number>;
  /** Everything in the game is this account's, present and future: owns() and unlocked() say yes to every released
   *  item and every gate. A flag, not a list, so what ships later is covered the day it ships. */
  allAccess?: boolean;
  /** The codes this account has redeemed (the server's codes.ts), by id, and when: each code is redeemed once. */
  redeemed?: Record<string, number>;
  /** Its username (names.ts): claimed through the server, unique whatever its case, shown wherever the account's name
   *  is - the ACCOUNT tab, the home screen's chip, and the match rooms, which read it from here. Signed-in accounts only. */
  name?: string;
  /** When the username was claimed or last changed: a change waits NAME_EVERY_DAYS after it. */
  nameAt?: number;
  worn: Worn;
  feats: string[];
  stats: AccountStats;
  /** Today (UTC): match pay so far against the cap, mission counts, which are paid, who was played. */
  day: { date: string; pay: number; played: number; progress: Record<string, number>; done: string[]; all: boolean; fighters: string[] };
  week: { id: string; progress: Record<string, number>; done: string[] };
  /** Days in a row with a match played, and the last of them. */
  streak: { last: string; days: number };
  /** The last few matches reported (a second report of one is refused). */
  reported: string[];
}

export function newAccount(pk: string, now: number): Account {
  return { pk, created: now, balance: 0, earned: 0, spent: 0, bought: 0, xp: 0,
    items: Object.fromEntries(STARTERS.map(id => [id, { at: now }])),
    worn: { entrance: 'entrance-paper', title: 'title-rookie', emotes: ['emote-interrobang'] }, feats: [],
    stats: { runs: 0, matches: 0, wins: 0, rounds: 0, bosses: 0, finishers: 0, kills: 0, seals: 0, sealedWith: [], sBosses: 0, bestRank: 0, bestStyle: 0, fastBoss: 0, bestStreak: 0 },
    day: { date: '', pay: 0, played: 0, progress: {}, done: [], all: false, fighters: [] }, week: { id: '', progress: {}, done: [] },
    streak: { last: '', days: 0 }, reported: [] };
}

/** The day and the week turned over where they have (missions and the cap start again). */
export function roll(account: Account, now: number) {
  const day = dayOf(now), week = weekOf(now);
  if (account.day.date !== day) account.day = { date: day, pay: 0, played: 0, progress: {}, done: [], all: false, fighters: [] };
  if (account.week.id !== week) account.week = { id: week, progress: {}, done: [] };
}

export interface Settlement {
  /** Refused: why (nothing changed). */
  refused?: string;
  lines: PayLine[];
  /** Everything it paid, and the experience. */
  total: number; xp: number;
  /** Account levels reached by it (none: `from === to`). */
  level: { from: number; to: number };
  missions: string[]; feats: string[];
  /** The day's cap was reached during it (match pay past it is a fifth). */
  capped: boolean;
}

/** A match settled: its pay under the day's cap, the day's first, the streak, missions finished by it,
 *  feats, levels. Whole numbers are paid (the wallet holds no fractions). `past`: the share of match pay paid
 *  past the day's cap - a fifth for a server room's match; none for a match played on the player's device
 *  (src/server/economy/deviceReports.ts), which past the cap earns no experience of its own either, so levels
 *  cannot be farmed there. Its missions still count, and pay once each, as feats do. */
export function settle(account: Account, raw: Report, now: number, verified = false, past: number = PAY.past): Settlement {
  const none: Settlement = { lines: [], total: 0, xp: 0, level: { from: levelOf(account.xp).level, to: levelOf(account.xp).level }, missions: [], feats: [], capped: false };
  const checked = plausible(raw, verified);
  if ('refused' in checked) return { ...none, refused: checked.refused };
  const report = checked.report;
  if (account.reported.includes(report.id)) return { ...none, refused: 'That result was already counted.' };
  roll(account, now);
  account.reported = [...account.reported.slice(-39), report.id];
  const lines: PayLine[] = [];
  // Its own pay, under the cap.
  const base = payFor(report), asked = base.reduce((sum, line) => sum + line.amount, 0), paid = underCap(asked, account.day.pay, past);
  const share = asked > 0 ? paid / asked : 0;
  for (const line of base) lines.push({ label: line.label, amount: line.amount * share });
  const capped = paid < asked - 1e-6;
  account.day.pay += asked;
  // The day's first, and the streak it keeps.
  if (account.day.played === 0) {
    lines.push({ label: 'First of the day', amount: PAY.firstOfDay });
    const yesterday = dayOf(now - 86400000);
    account.streak.days = account.streak.last === yesterday ? account.streak.days + 1 : 1;
    account.streak.last = account.day.date;
    account.stats.bestStreak = Math.max(account.stats.bestStreak, account.streak.days);
    lines.push({ label: `Day ${account.streak.days} running`, amount: PAY.streak[(account.streak.days - 1) % PAY.streak.length] });
  }
  account.day.played++;
  // Lifetime numbers.
  const stats = account.stats, fresh = { fighter: !account.day.fighters.includes(report.fighter) };
  if (fresh.fighter) account.day.fighters.push(report.fighter);
  if (report.mode === 'survival') {
    stats.runs++; stats.rounds += roundsCleared(report); stats.bosses += report.bosses; stats.finishers += report.finishers; stats.kills += report.kills;
    stats.bestRank = Math.max(stats.bestRank, report.rank); stats.bestStyle = Math.max(stats.bestStyle, report.style); stats.sBosses += report.sBosses ?? 0;
    if (report.fastBoss) stats.fastBoss = stats.fastBoss ? Math.min(stats.fastBoss, report.fastBoss) : report.fastBoss;
    if (report.sealed) { stats.seals++; if (!stats.sealedWith.includes(report.fighter)) stats.sealedWith.push(report.fighter); }
  } else { stats.matches++; if (report.place === 1) stats.wins++; }
  tallyModes(stats, report);
  // Missions this finished.
  const missions: string[] = [];
  const advance = (list: Mission[], book: { progress: Record<string, number>; done: string[] }) => {
    for (const mission of list) {
      if (book.done.includes(mission.id)) continue;
      const at = (book.progress[mission.id] ?? 0) + mission.count(report, fresh);
      book.progress[mission.id] = Math.min(mission.goal, at);
      if (at >= mission.goal) { book.done.push(mission.id); missions.push(mission.id); lines.push({ label: mission.text, amount: mission.pay }); }
    }
  };
  // (The day's and the week's challenge counts beside the three, and never toward the bonus for all three: missions.ts.)
  const today = dailyMissions(account.day.date);
  advance([...today, dailyChallenge(account.day.date)], account.day);
  if (!account.day.all && today.every(mission => account.day.done.includes(mission.id))) { account.day.all = true; lines.push({ label: "All of the day's missions", amount: ALL_DAILY_BONUS }); }
  advance([...weeklyMissions(account.week.id), weeklyChallenge(account.week.id)], account.week);
  // Experience: the match's own (what it asked, not what the cap left; on a device, only as far as the cap paid it), and levels reached.
  const from = levelOf(account.xp).level, xp = Math.round((PAY.xp + asked) * (past > 0 || asked <= 0 ? 1 : share) + missions.length * 10);
  account.xp += xp;
  const to = levelOf(account.xp).level;
  for (let level = from + 1; level <= to; level++) lines.push({ label: `Account level ${level}`, amount: PAY.level(level) });
  // Feats (after the level: one of them is a level).
  const feats: string[] = [];
  for (const feat of FEATS) if (!account.feats.includes(feat.id) && feat.done(stats, account.xp)) { account.feats.push(feat.id); feats.push(feat.id); lines.push({ label: `Feat: ${feat.name}`, amount: feat.pay }); }
  // Paid in whole numbers: each line rounded, nothing under one dropped from the total.
  const whole = lines.map(line => ({ label: line.label, amount: Math.round(line.amount) })).filter(line => line.amount > 0);
  const total = whole.reduce((sum, line) => sum + line.amount, 0);
  account.balance += total; account.earned += total;
  return { lines: whole, total, xp, level: { from, to }, missions, feats, capped };
}

// ---- what an account owns, and the gates it has passed: THE checks ---------------------------------
/** Whatever can own things: an account (or what the browser holds of one). None: a visitor with no account yet. */
export type Owner = Pick<Account, 'items'> & Partial<Pick<Account, 'allAccess' | 'xp' | 'feats'>>;

const isOut = (id: string) => { const stage = ITEM.get(id)?.stage; return !!stage && stage !== 'next' && stage !== 'ask'; };

/** Whether `owner` owns item `id`: bought, given, a starter - or by all access, which owns every item the game has
 *  released, now and as each new one ships, without a numbered copy being used up. The one ownership check: the
 *  shop, the locker, wearing, the fighters and the match rooms all ask it, never `items[id]` directly. */
export function owns(owner: Owner | undefined, id: string): boolean {
  if (!owner) return false;
  if (owner.items[id]) return true;
  // The road (unlocks.ts): free at its level, computed from the account's experience, so every check here honours it.
  if (onRoadAt(levelOf(owner.xp ?? 0).level, id)) return true;
  return !!owner.allAccess && isOut(id);
}

/** Why `owner` has not passed an item's gates - its rarity's account level, then its feat - or nothing if it has
 *  (all access passes every gate). `subject` names the item in the answer ("It", or the item's name in a set). */
export function gate(owner: Owner | undefined, item: Item, subject = 'It'): string | undefined {
  if (owner?.allAccess) return undefined;
  const rule = RARITY[item.rarity];
  if (levelOf(owner?.xp ?? 0).level < rule.level) return `${subject} opens at account level ${rule.level}.`;
  if (item.feat && !owner?.feats?.includes(item.feat)) return `${subject} asks for a feat first: ${FEAT.get(item.feat)?.text ?? item.feat}`;
  return undefined;
}
/** Whether `owner` has passed item `id`'s gates (its level and its feat): the one eligibility check. */
export function unlocked(owner: Owner | undefined, id: string): boolean {
  const item = ITEM.get(id);
  return !!item && !gate(owner, item);
}

/** Why an account cannot buy an item, or nothing if it can. `sold`: copies of it bought so far, by anyone. */
export function cannotBuy(account: Account, id: string, sold: number): string | undefined {
  const item = ITEM.get(id);
  if (!item) return 'There is no such item.';
  if (item.stage !== 'live') return 'That one is not in Account yet.';
  if (owns(account, id)) return 'You already own it.';
  const rule = RARITY[item.rarity], gated = gate(account, item);
  if (gated) return gated;
  if (rule.supply !== undefined && sold >= rule.supply) return `All ${rule.supply} copies are gone.`;
  if (account.balance < priceOf(item)) return `It costs ${priceOf(item).toLocaleString('en-US')}; you have ${Math.floor(account.balance).toLocaleString('en-US')}.`;
  return undefined;
}
/** An item bought: paid for, owned, numbered if its copies are. Returns the refusal, if it is one. */
export function buy(account: Account, id: string, sold: number, now: number): { refused: string } | { owned: Owned; price: number } {
  const refused = cannotBuy(account, id, sold);
  if (refused) return { refused };
  const item = ITEM.get(id)!, price = priceOf(item);
  account.balance -= price; account.spent += price;
  const owned: Owned = { at: now, ...(RARITY[item.rarity].supply !== undefined ? { serial: sold + 1 } : {}) };
  account.items[id] = owned;
  return { owned, price };
}

/** Why an account cannot buy a set, or nothing if it can: each piece still to buy asks what it asks
 *  on its own (a set is not a way round a level or a feat), and the set's price must be in the wallet. */
export function cannotBuyBundle(account: Account, id: string): string | undefined {
  const bundle = BUNDLE.get(id);
  if (!bundle) return 'There is no such set.';
  const left = bundle.items.filter(each => !owns(account, each));
  if (!left.length) return 'You own all of it already.';
  for (const each of left) {
    const item = ITEM.get(each)!, rule = RARITY[item.rarity];
    if (item.stage !== 'live') return `${item.name} is not in Account yet.`;
    if (rule.supply !== undefined) return `${item.name} is numbered, and is unlocked alone.`;
    const gated = gate(account, item, item.name);
    if (gated) return gated;
  }
  const { price } = bundlePrice(bundle, each => owns(account, each));
  if (account.balance < price) return `It costs ${price.toLocaleString('en-US')}; you have ${Math.floor(account.balance).toLocaleString('en-US')}.`;
  return undefined;
}
/** A set bought: what was still to buy of it, paid for at the set's price and owned. Returns the refusal, if it is one. */
export function buyBundle(account: Account, id: string, now: number): { refused: string } | { owned: string[]; price: number } {
  const refused = cannotBuyBundle(account, id);
  if (refused) return { refused };
  const bundle = BUNDLE.get(id)!, { price } = bundlePrice(bundle, each => owns(account, each));
  const owned = bundle.items.filter(each => !owns(account, each));
  account.balance -= price; account.spent += price;
  for (const each of owned) account.items[each] = { at: now };
  return { owned, price };
}

/** An item put on (or, with no id, the slot cleared). An emote goes on the wheel, or comes off it if it is there. */
export function wear(account: Account, kind: ItemKind, id: string | undefined): { refused: string } | { worn: Worn } {
  // (A fighter is played, not worn: owning one is all it takes.)
  if (kind === 'fighter') return { refused: 'A fighter is played, not worn.' };
  if (id !== undefined) {
    const item = ITEM.get(id);
    if (!item || item.kind !== kind) return { refused: 'That does not go there.' };
    if (!owns(account, id)) return { refused: 'You do not own it.' };
  }
  if (kind === 'emote') {
    const wheel = account.worn.emotes ?? [];
    if (id === undefined) account.worn.emotes = [];
    else if (wheel.includes(id)) account.worn.emotes = wheel.filter(each => each !== id);
    else account.worn.emotes = [...wheel, id].slice(-EMOTE_SLOTS);
  } else if (kind === 'outfit') {
    // One a fighter: worn again, it comes off; none named, every outfit comes off.
    if (id === undefined) { delete account.worn.outfits; return { worn: account.worn }; }
    const fighter = ITEM.get(id)!.fighter!, outfits = { ...account.worn.outfits };
    if (outfits[fighter] === id) delete outfits[fighter]; else outfits[fighter] = id;
    account.worn.outfits = outfits;
  } else if (id === undefined) delete account.worn[kind];
  else account.worn[kind] = id;
  return { worn: account.worn };
}

export function credit(account: Account, amount: number) {
  account.balance += amount;
  account.earned += amount;
}

/** Two accounts made one (a guest's, taken into the account a sign-in already had): wallets added,
 *  items and feats joined, the higher level and the better numbers kept. */
export function merge(into: Account, from: Account) {
  into.balance += from.balance; into.earned += from.earned; into.spent += from.spent; into.bought = (into.bought ?? 0) + (from.bought ?? 0);
  into.xp = Math.max(into.xp, from.xp);
  if (from.allAccess) into.allAccess = true;
  if (from.redeemed) into.redeemed = { ...from.redeemed, ...into.redeemed };
  for (const [id, owned] of Object.entries(from.items)) into.items[id] ??= owned;
  for (const feat of from.feats) if (!into.feats.includes(feat)) into.feats.push(feat);
  const a = into.stats, b = from.stats;
  for (const key of ['runs', 'matches', 'wins', 'rounds', 'bosses', 'finishers', 'kills', 'seals', 'sBosses'] as const) a[key] += b[key];
  for (const key of ['bestRank', 'bestStyle', 'bestStreak'] as const) a[key] = Math.max(a[key], b[key]);
  a.fastBoss = a.fastBoss && b.fastBoss ? Math.min(a.fastBoss, b.fastBoss) : a.fastBoss || b.fastBoss;
  for (const fighter of b.sealedWith) if (!a.sealedWith.includes(fighter)) a.sealedWith.push(fighter);
  mergeModes(a, b);
  from.balance = 0;
}
