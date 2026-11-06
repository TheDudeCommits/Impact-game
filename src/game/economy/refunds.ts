/** The price drop's refunds (8 October 2026, the shop streamlined; the reviewer: "Anyone who bought an item at more
 *  than its new price gets the difference back as Sumi, once, including items they paid for that are now free on the
 *  road"). The server works them out from its own ledger - the purchase lines it wrote when each item was bought -
 *  and pays each as a ledger line of its own (`refund:<item>`), so a second start pays nothing again. Never from
 *  anything the browser says.
 *
 *  A later drop (28 October 2026: every fighter's price halved) pays what is still owed: what was paid, less today's
 *  price, less every refund already paid for the item. So whoever bought before 8 October, was paid back down to that
 *  day's price, and now sees it halved, is paid the new difference too; what each ends up having paid is today's price.
 *
 *  - What was paid: a purchase line's amount; a set's price shared over the pieces it bought, by their own prices then.
 *  - What it costs now (`priceNow`): its price where the shop sells it, nothing where only the road gives it. A
 *    retired item has no new price and no refund: its owners keep it.
 *  - Accounts folded into another (a guest's, at a sign-in) take their purchases and their refunds with them.
 *
 *  Pure: the server reads its ledger files and hands the lines in (src/server/economy). */
import { ITEM } from './catalog';
import { RARITY } from './rarity';

/** A ledger line (src/server/economy/book.ts), as much of it as a refund reads. */
export interface LedgerLine { seq?: number; t: string; pk: string; item?: string; amount?: number; why?: string; into?: string }
export interface RefundDue { pk: string; item: string; amount: number; before: number }

/** What an item costs now: its price where it is sold, 0 where only the road gives it; undefined where it is not on
 *  offer (retired, or never released). */
export function priceNow(id: string): number | undefined {
  const item = ITEM.get(id);
  if (!item) return undefined;
  if (item.stage === 'live') return item.price;
  if (item.stage === 'road') return 0;
  return undefined;
}
/** The why a refund's ledger line carries, and the item it names. */
export const refundWhy = (item: string) => `refund:${item}`;
const refunded = (why: string | undefined) => why?.startsWith('refund:') ? why.slice(7) : undefined;

/** A line worth parsing for refunds (the server skips the rest of its ledger unread). */
export const refundRelevant = (raw: string) => raw.includes('"t":"buy"') || raw.includes('"t":"merge"') || raw.includes('refund:');

/** Each account's refunds due, item by item: what it paid above what the item costs now, less what was refunded for
 *  it before (`before`: a refund line without an amount counts as everything). In the order of the ledger. */
export function refundsDue(lines: Iterable<LedgerLine>): RefundDue[] {
  const ordered = [...lines].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  /** By account: what was paid for each item, and what was refunded for it already. */
  const paid = new Map<string, Map<string, number>>(), back = new Map<string, Map<string, number>>();
  const book = <T>(map: Map<string, T>, pk: string, make: () => T) => { let got = map.get(pk); if (!got) { got = make(); map.set(pk, got); } return got; };
  for (const line of ordered) {
    if (line.t === 'buy' && line.item && (line.amount ?? 0) < 0) {
      const spent = -(line.amount ?? 0), mine = book(paid, line.pk, () => new Map<string, number>());
      // A set (sold until 8 October): its price shared over the pieces it bought, by their own prices then.
      const pieces = line.item.startsWith('bundle-') ? (line.why ?? '').split(',').filter(id => ITEM.has(id)) : [line.item];
      const list = pieces.map(id => line.item!.startsWith('bundle-') ? RARITY[ITEM.get(id)!.rarity].price : 1), whole = list.reduce((sum, n) => sum + n, 0);
      pieces.forEach((id, i) => mine.set(id, (mine.get(id) ?? 0) + spent * list[i] / whole));
    } else if (line.t === 'grant' && refunded(line.why)) {
      const mine = book(back, line.pk, () => new Map<string, number>()), id = refunded(line.why)!;
      mine.set(id, (mine.get(id) ?? 0) + (typeof line.amount === 'number' ? line.amount : Infinity));
    }
    else if (line.t === 'merge' && line.into) {
      // Folded into another account: what it paid, and what it was refunded, go with it.
      for (const map of [paid, back]) {
        const from = map.get(line.pk), into = book(map, line.into, () => new Map<string, number>());
        for (const [id, amount] of from ?? []) into.set(id, (into.get(id) ?? 0) + amount);
        map.delete(line.pk);
      }
    }
  }
  const due: RefundDue[] = [];
  for (const [pk, items] of paid) for (const [item, spent] of items) {
    const now = priceNow(item), before = back.get(pk)?.get(item) ?? 0, amount = now === undefined ? 0 : Math.round(spent - now - before);
    if (amount > 0) due.push({ pk, item, amount, before });
  }
  return due;
}
