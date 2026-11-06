import '../src/originals/launch';
import '../src/originals/serverGate';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Economy } from '../src/server/economy/api';
import { merge, newAccount, owns, type Account, type Settlement } from '../src/game/economy/account';
import { ITEM, ITEMS } from '../src/game/economy/catalog';
import { OUTFITS, outfitFor } from '../src/game/economy/outfits';
import { ROAD, UNLOCKS, onRoadAt } from '../src/game/economy/unlocks';
import { levelOf, xpAt } from '../src/game/economy/earn';
import { lockedOut } from '../src/game/economy/fighters';
import { isReleasedFighter } from '../src/game/rosterAvailability';
import { MOVES } from '../src/game/moves';

const HELD_OUTFITS = ITEMS.filter(item => item.kind === 'outfit' && item.stage === 'ask').map(item => item.id);
const NOW = Date.parse('2026-11-04T12:00:00Z');
const hash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
const token = () => crypto.randomBytes(16).toString('hex');
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

function bookOf(accounts: Account[], tokens: Record<string, string>, ledger: object[] = [], dids: Record<string, string> = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'launch-accounts-'));
  dirs.push(dir);
  const seq = 100;
  fs.writeFileSync(path.join(dir, 'accounts.json'), JSON.stringify({ seq, accounts, tokens: Object.fromEntries(Object.entries(tokens).map(([t, pk]) => [hash(t), pk])), dids, sold: {}, completions: [] }));
  fs.writeFileSync(path.join(dir, 'ledger.jsonl'), ledger.map((line, i) => JSON.stringify({ seq: seq - ledger.length + i + 1, ...line })).join('\n') + (ledger.length ? '\n' : ''));
  return dir;
}
const ledgerLines = (dir: string) => fs.readFileSync(path.join(dir, 'ledger.jsonl'), 'utf8').split('\n').filter(Boolean).length;
function player(level: number, more: Partial<Account> = {}): Account {
  return { ...newAccount(crypto.randomBytes(8).toString('hex'), NOW - 20 * 86400_000), xp: xpAt(level), balance: 4000, earned: 9000, spent: 5000, ...more };
}

describe('Impact\'s accounts on the game\'s server', () => {
  it('holds only Barrow\'s outfit, sells the earlier other 23 at the earlier prices, and walks the whole road (32 steps)', () => {
    expect(HELD_OUTFITS).toEqual(['outfit-barrow-classic']);
    for (const id of HELD_OUTFITS) {
      expect(ITEM.get(id), id).toBeTruthy(); // the item stays: an account that owns it keeps a known item
      expect(OUTFITS[id], id).toBeUndefined();
    }
    const outfits = ITEMS.filter(item => item.kind === 'outfit' && item.stage !== 'ask');
    expect(outfits).toHaveLength(23);
    for (const item of outfits) {
      expect(OUTFITS[item.id]?.model, item.id).toBeUndefined(); // the original's own body, never another
      expect(OUTFITS[item.id]?.variant, item.id).toBeTruthy();
      expect(item.price, item.id).toBe(UNLOCKS[item.id]?.price);
      expect(item.level, item.id).toBe(UNLOCKS[item.id]?.level);
    }
    expect(outfits.filter(item => item.stage === 'retired').map(item => item.id).sort()).toEqual(['outfit-kagari-blue-ember', 'outfit-kenzo-masterless', 'outfit-kosho-flambe']);
    expect(ROAD).toHaveLength(Object.values(UNLOCKS).filter(how => how.level !== undefined).length);
    expect(ROAD).toHaveLength(32);
    for (const id of ['outfit-kagari-dune-walker', 'outfit-setsu-live-wire', 'outfit-ward-house-call', 'outfit-gummy-mirage', 'outfit-gummy-deckhand', 'outfit-kenzo-night-raider'])
      expect(ROAD.find(step => step.id === id)?.level, id).toBe(UNLOCKS[id].level);
    const fighters = (Object.keys(MOVES) as string[]).filter(isReleasedFighter);
    expect(fighters.length).toBeGreaterThanOrEqual(100);
  });

  it('opens a player who owns, wears and passed the road to the earlier outfits, unchanged, owning them, dressed as the originals\' own', () => {
    const t = token();
    const owner = player(60, { items: { ...newAccount('x', NOW).items, 'outfit-gummy-daybreak': { at: NOW - 86400_000 }, 'outfit-barrow-classic': { at: NOW - 86400_000 }, 'fighter-magatsu': { at: NOW - 86400_000 } },
      worn: { title: 'title-dark-choir', entrance: 'entrance-paper', emotes: ['emote-interrobang'], outfits: { gummy: 'outfit-gummy-daybreak', kenzo: 'outfit-kenzo-night-raider', barrow: 'outfit-barrow-classic', taisei: 'outfit-taisei-golden-sage' } } });
    const before = structuredClone(owner);
    const dir = bookOf([owner], { [t]: owner.pk });
    const economy = new Economy({ dir, now: () => NOW, privyAppId: '' });
    const answer = economy.hello(t);
    expect((answer as { token?: string }).token).toBeUndefined(); // the account the token opens, never a new one
    const account = answer.account;
    expect({ balance: account.balance, xp: account.xp, items: account.items, worn: account.worn, feats: account.feats })
      .toEqual({ balance: before.balance, xp: before.xp, items: before.items, worn: before.worn, feats: before.feats });
    expect(levelOf(account.xp).level).toBe(60);
    expect(owns(account, 'outfit-gummy-daybreak')).toBe(true);
    expect(owns(account, 'outfit-barrow-classic')).toBe(true);
    expect(owns(account, 'outfit-kenzo-night-raider')).toBe(true);
    expect(onRoadAt(60, 'outfit-kenzo-night-raider')).toBe(true);
    expect(onRoadAt(25, 'outfit-kenzo-night-raider')).toBe(false);
    expect(UNLOCKS['outfit-kenzo-night-raider'].level).toBe(26);
    expect(outfitFor('outfit-gummy-daybreak', 'gummy')?.variant?.palette?.length).toBeGreaterThan(0);
    expect(outfitFor('outfit-gummy-daybreak', 'gummy')?.model).toBeUndefined();
    expect(outfitFor('outfit-kenzo-night-raider', 'kenzo')?.variant).toBeTruthy();
    expect(outfitFor('outfit-barrow-classic', 'barrow')).toBeUndefined();
    expect(outfitFor('outfit-taisei-golden-sage', 'taisei')).toBeTruthy();
    expect(owns(account, 'outfit-taisei-golden-sage')).toBe(true); // road level 3
    // The shop fighter they bought is played; the title renamed (Hand of Heaven) is the same item, still worn.
    expect(lockedOut('magatsu', account)).toBeUndefined();
    expect(ITEM.get('title-dark-choir')!.name).toBe('Hand of Heaven');
    // Wearing another outfit keeps the held one on the record.
    economy.wear(t, 'outfit', 'outfit-taisei-golden-sage');
    expect(economy.book.find(t)!.worn.outfits).toEqual({ gummy: 'outfit-gummy-daybreak', kenzo: 'outfit-kenzo-night-raider', barrow: 'outfit-barrow-classic' });
    const before600 = economy.book.find(t)!.balance;
    economy.buy(t, 'outfit-kosho-sommelier');
    expect(economy.book.find(t)!.balance).toBe(before600 - 600);
    economy.wear(t, 'outfit', 'outfit-kosho-sommelier');
    expect(economy.book.find(t)!.worn.outfits?.kosho).toBe('outfit-kosho-sommelier');
    economy.close();
  });

  it('pays no refund for an outfit, held or the game\'s own, at start, and never twice (the ledger as main left it)', () => {
    const t = token(), buyer = player(20, { items: { ...newAccount('x', NOW).items, 'outfit-gummy-daybreak': { at: NOW - 30 * 86400_000 }, 'outfit-barrow-classic': { at: NOW - 30 * 86400_000 }, 'fighter-magatsu': { at: NOW - 30 * 86400_000 } } });
    // SUNRISE (Lucy · Daybreak here) and Barrow's held one bought at today's prices; Magatsu bought at 2,000 before the
    // halving and paid back 1,000 by main already.
    const ledger = [{ at: NOW - 30 * 86400_000, t: 'buy', pk: buyer.pk, item: 'outfit-gummy-daybreak', amount: -1000, after: buyer },
      { at: NOW - 30 * 86400_000, t: 'buy', pk: buyer.pk, item: 'outfit-barrow-classic', amount: -800, after: buyer },
      { at: NOW - 30 * 86400_000, t: 'buy', pk: buyer.pk, item: 'fighter-magatsu', amount: -2000, after: buyer },
      { at: NOW - 7 * 86400_000, t: 'grant', pk: buyer.pk, amount: 1000, why: 'refund:fighter-magatsu', after: buyer }];
    const dir = bookOf([buyer], { [t]: buyer.pk }, ledger);
    const economy = new Economy({ dir, now: () => NOW, privyAppId: '' });
    expect(ledgerLines(dir)).toBe(4);
    expect(economy.hello(t).account.balance).toBe(buyer.balance);
    economy.close();
    // A second start pays nothing either.
    const again = new Economy({ dir, now: () => NOW, privyAppId: '' });
    expect(ledgerLines(dir)).toBe(4);
    again.close();
  });

  it('pays a player onto a road step that came back their level and the step, and takes nothing from them', () => {
    const t = token(), climber = player(11, { stats: { ...newAccount('x', NOW).stats, matches: 80, wins: 9 } });
    climber.xp = xpAt(12) - 5;
    const dir = bookOf([climber], { [t]: climber.pk });
    const economy = new Economy({ dir, now: () => NOW, privyAppId: '' });
    const paid = economy.report(t, { id: `local-${crypto.randomBytes(16).toString('hex')}`, mode: 'bots', fighter: 'konta', seconds: 300, place: 1, players: 12, kos: 4 });
    const settlement = (paid as { settlement?: Settlement }).settlement!;
    expect(settlement.level).toEqual({ from: 11, to: 12 });
    expect(settlement.lines.some(line => line.label === 'Account level 12')).toBe(true);
    const account = economy.book.find(t)!;
    expect(account.items).toEqual(climber.items);
    expect(account.balance).toBeGreaterThan(climber.balance);
    expect(owns(account, 'outfit-gummy-deckhand')).toBe(true); // the road's, computed from the level
    expect(owns(climber, 'outfit-gummy-deckhand')).toBe(false);
    economy.close();
  });

  it('folds a guest that owns an outfit into its login with the outfit kept (a sign-in on the new site)', () => {
    const guestToken = token(), loginToken = `s_${crypto.randomBytes(24).toString('base64url')}`;
    const guest = player(5, { items: { ...newAccount('x', NOW).items, 'outfit-oro-ascendant': { at: NOW - 86400_000 } } });
    const login = player(9);
    const dir = bookOf([guest, login], { [guestToken]: guest.pk, [loginToken]: login.pk }, [], { 'did:privy:launch-test': login.pk });
    const economy = new Economy({ dir, now: () => NOW, privyAppId: 'launch-test', fetcher: (() => { throw new Error('no network'); }) as never });
    const known = economy.book.byLogin('did:privy:launch-test')!, folded = economy.book.find(guestToken)!;
    expect(known.pk).toBe(login.pk);
    merge(known, folded); economy.book.retire(folded, known);
    const account = economy.book.find(guestToken)!;
    expect(account.pk).toBe(login.pk);
    expect(owns(account, 'outfit-oro-ascendant')).toBe(true);
    expect(account.balance).toBe(guest.balance + login.balance);
    economy.close();
    // Read again from disk (the ledger's merge and grant lines replayed), as the next deployment would.
    const reread = new Economy({ dir, now: () => NOW, privyAppId: '' });
    expect(reread.book.find(guestToken)!.items['outfit-oro-ascendant']).toBeTruthy();
    reread.close();
  });
});
