import { describe, expect, it } from 'vitest';
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Economy } from '../src/server/economy/api';
import type { Account } from '../src/game/economy/account';
import { priceNow, refundRelevant, refundWhy, refundsDue, type LedgerLine } from '../src/game/economy/refunds';
import { ITEM } from '../src/game/economy/catalog';
import { RARITY } from '../src/game/economy/rarity';

/** The price drop's refunds (8 October 2026): whoever paid more for an item than it costs now has the difference back,
 *  once, worked out from the ledger's own purchase lines - a road item's whole price, a retired one's nothing. A later
 *  drop (28 October 2026: the fighters halved) pays what is still owed, less what was paid back before. */
let seq = 0;
const buy = (pk: string, item: string, paid: number, why?: string): LedgerLine => ({ seq: ++seq, t: 'buy', pk, item, amount: -paid, ...(why ? { why } : {}) });

describe('the price drop\'s refunds', () => {
  it('knows what each item costs now: its price, nothing on the road alone, no new price retired', () => {
    expect(priceNow('fighter-gorai')).toBe(1000);
    expect(priceNow('fighter-vesper')).toBe(800);        // on the road at 40 and sold: its price
    expect(priceNow('aura-azure-flame')).toBe(0);           // the road's alone
    expect(priceNow('skin-newsprint')).toBeUndefined();     // retired
    expect(priceNow('aura-ink-dragon')).toBeUndefined();    // never out
    expect(priceNow('no-such-item')).toBeUndefined();
  });

  it('gives back what was paid above today\'s price, item by item', () => {
    const due = refundsDue([
      buy('a', 'fighter-gorai', 15000), buy('a', 'outfit-gummy-daybreak', 1800), buy('a', 'aura-azure-flame', 600),
      buy('a', 'skin-newsprint', 60), buy('a', 'skin-authors-hand', 12000),        // retired: kept, and nothing back
      buy('b', 'outfit-taisei-golden-sage', 200),                                             // cheaper then than now: nothing back
      { seq: ++seq, t: 'grant', pk: 'a', item: 'fighter-sorrel', why: 'admin' },   // given, not bought
    ]);
    expect(due).toEqual([
      { pk: 'a', item: 'fighter-gorai', amount: 14000, before: 0 },
      { pk: 'a', item: 'outfit-gummy-daybreak', amount: 800, before: 0 },
      { pk: 'a', item: 'aura-azure-flame', amount: 600, before: 0 },
    ]);
  });

  it('shares a set\'s price over the pieces it bought, by their own prices then', () => {
    // The Ink Master, all four at a quarter off: Sumi-e (Rare 200, now the road's), Ink Wisps (Rare, retired), Soak (Rare,
    // retired), Brushstroke (Epic 600, retired).
    const paid = 900, pieces = ['skin-sumi-e', 'aura-ink-wisps', 'kill-soak', 'banner-brush'];
    const whole = pieces.reduce((sum, id) => sum + RARITY[ITEM.get(id)!.rarity].price, 0);
    const due = refundsDue([buy('c', 'bundle-ink', paid, pieces.join(','))]);
    expect(due).toEqual([{ pk: 'c', item: 'skin-sumi-e', amount: Math.round(paid * 200 / whole), before: 0 }]);
  });

  it('pays what is still owed: a refund already in the ledger is taken off, and a folded account takes both with it', () => {
    // Akagane, bought at 18,000 on 1 October, paid back down to 8 October's 2,000: owed the 28 October halving's 1,000.
    const lines = [buy('guest', 'fighter-akagane', 18000), { seq: ++seq, t: 'grant', pk: 'guest', amount: 16000, why: refundWhy('fighter-akagane') }];
    expect(refundsDue(lines)).toEqual([{ pk: 'guest', item: 'fighter-akagane', amount: 1000, before: 16000 }]);
    // ...and once that is paid, nothing more.
    const settled = [...lines, { seq: ++seq, t: 'grant', pk: 'guest', amount: 1000, why: refundWhy('fighter-akagane') }];
    expect(refundsDue(settled)).toEqual([]);
    // The guest signs in to an account that had bought something too: what it paid, and what it was paid back, go with it.
    const folded = [...settled, buy('login', 'fighter-magatsu', 2000), { seq: ++seq, t: 'merge', pk: 'guest', into: 'login' }];
    expect(refundsDue(folded)).toEqual([{ pk: 'login', item: 'fighter-magatsu', amount: 1000, before: 0 }]);
    // A purchase folded in before its refund: owed to the account it went into.
    expect(refundsDue([buy('g2', 'fighter-dorado', 18000), { seq: ++seq, t: 'merge', pk: 'g2', into: 'l2' }])).toEqual([{ pk: 'l2', item: 'fighter-dorado', amount: 16800, before: 0 }]);
    // A refund line with no amount (none is written so) counts as everything paid back: never paid again.
    expect(refundsDue([buy('h', 'fighter-banjaku', 14000), { seq: ++seq, t: 'grant', pk: 'h', why: refundWhy('fighter-banjaku') }])).toEqual([]);
  });

  it('reads the ledger in its own order, whatever order the files are read in', () => {
    const lines = [buy('d', 'fighter-banjaku', 14000), { seq: ++seq, t: 'grant', pk: 'd', amount: 12400, why: refundWhy('fighter-banjaku') }];
    const owed = [{ pk: 'd', item: 'fighter-banjaku', amount: 800, before: 12400 }];
    expect(refundsDue(lines)).toEqual(owed);
    expect(refundsDue([...lines].reverse())).toEqual(owed);
  });

  it('skips the lines a refund has nothing to do with, unread', () => {
    expect(refundRelevant(JSON.stringify(buy('e', 'skin-negative', 600)))).toBe(true);
    expect(refundRelevant(JSON.stringify({ seq: 1, t: 'grant', pk: 'e', why: refundWhy('skin-negative') }))).toBe(true);
    expect(refundRelevant(JSON.stringify({ seq: 1, t: 'merge', pk: 'e', into: 'f' }))).toBe(true);
    expect(refundRelevant(JSON.stringify({ seq: 1, t: 'wear', pk: 'e', after: { pk: 'e' } }))).toBe(false);
    expect(refundRelevant(JSON.stringify({ seq: 1, t: 'earn', pk: 'e', why: 'verified:match:x' }))).toBe(false);
  });

  it('is paid by the server from its own ledger, once - and again never, across restarts', () => {
    const dir = mkdtempSync(join(tmpdir(), 'economy-refunds-'));
    try {
      let e = new Economy({ dir });
      const hello = e.hello(undefined) as unknown as { token: string; account: Account };
      e.close();
      // Two purchases at the old prices, as the ledger has them (the account as it stood after each).
      const book = JSON.parse(readFileSync(join(dir, 'accounts.json'), 'utf8')) as { seq: number; accounts: Account[] };
      const before = book.accounts.find(each => each.pk === hello.account.pk)!;
      const gorai = { ...before, balance: 900, spent: 15000, items: { ...before.items, 'fighter-gorai': { at: 1 } } };
      const flame = { ...gorai, balance: 300, spent: 15600, items: { ...gorai.items, 'aura-azure-flame': { at: 2 } } };
      appendFileSync(join(dir, 'ledger.jsonl'), [{ seq: book.seq + 1, at: 1, t: 'buy', pk: before.pk, after: gorai, item: 'fighter-gorai', amount: -15000 },
        { seq: book.seq + 2, at: 2, t: 'buy', pk: before.pk, after: flame, item: 'aura-azure-flame', amount: -600 }].map(line => JSON.stringify(line)).join('\n') + '\n');
      e = new Economy({ dir });
      const paid = (e.hello(hello.token) as unknown as { account: Account }).account;
      expect(paid.balance).toBe(300 + 14000 + 600);
      expect(paid.refunded).toEqual({ 'fighter-gorai': 14000, 'aura-azure-flame': 600 });
      expect(paid.items['fighter-gorai']).toBeTruthy();                       // kept, of course
      const ledger = readFileSync(join(dir, 'ledger.jsonl'), 'utf8').split('\n').filter(Boolean).map(raw => JSON.parse(raw) as { why?: string });
      expect(ledger.filter(line => line.why?.startsWith('refund:')).map(line => line.why)).toEqual([refundWhy('fighter-gorai'), refundWhy('aura-azure-flame')]);
      e.close();
      // Started again (and again, with the book written whole): nothing more.
      e = new Economy({ dir });
      expect((e.hello(hello.token) as unknown as { account: Account }).account.balance).toBe(14900);
      e.close();
      e = new Economy({ dir });
      expect((e.hello(hello.token) as unknown as { account: Account }).account.balance).toBe(14900);
      e.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('pays a second drop on top of the first, by the server, once', () => {
    const dir = mkdtempSync(join(tmpdir(), 'economy-refunds-'));
    try {
      let e = new Economy({ dir });
      const hello = e.hello(undefined) as unknown as { token: string; account: Account };
      e.close();
      // Gorai bought at 1 October's 15,000 and paid back down to 8 October's 2,000, as the live ledger has it.
      const book = JSON.parse(readFileSync(join(dir, 'accounts.json'), 'utf8')) as { seq: number; accounts: Account[] };
      const before = book.accounts.find(each => each.pk === hello.account.pk)!;
      const bought = { ...before, balance: 0, spent: 15000, items: { ...before.items, 'fighter-gorai': { at: 1 } } };
      const back = { ...bought, balance: 13000, refunded: { 'fighter-gorai': 13000 } };
      appendFileSync(join(dir, 'ledger.jsonl'), [{ seq: book.seq + 1, at: 1, t: 'buy', pk: before.pk, after: bought, item: 'fighter-gorai', amount: -15000 },
        { seq: book.seq + 2, at: 2, t: 'grant', pk: before.pk, after: back, amount: 13000, why: refundWhy('fighter-gorai') }].map(line => JSON.stringify(line)).join('\n') + '\n');
      e = new Economy({ dir });
      const paid = (e.hello(hello.token) as unknown as { account: Account }).account;
      expect(paid.balance).toBe(13000 + 1000);
      expect(paid.refunded).toEqual({ 'fighter-gorai': 14000 });
      e.close();
      e = new Economy({ dir });
      expect((e.hello(hello.token) as unknown as { account: Account }).account.balance).toBe(14000);
      e.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
