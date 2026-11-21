/* The economy as a PlayerTwo room sees it (the room bundle's src/server/economy/api.ts and cluster/economyLink.ts).
 *
 * The book lives on the match server, which a room's code can't reach: PlayerTwo's rooms have no network. So
 * the player's page carries it both ways, signed (signed.ts):
 * - As a page joins, it brings a pass the economy signed for its account (POST /p2room/pass). The room keeps it under
 *   `pass:<pk>` and gives rooms that key as the account token: book.find answers from it (locked fighters, outfits,
 *   emotes, the room name), as RemoteEconomy answers from what control sent a room process.
 * - A match's completion (RoomRewards → complete) goes to the player's page signed, as `$settle`; the page posts it to
 *   the economy (POST /p2room/complete), which settles it exactly as a room on the server would, and sends the
 *   settlement back to the room (`$settled`), where book.completions.get finds it for the results card. A page that
 *   never posts it only loses its own pay; one posted twice is settled once (the book keys completions by match and
 *   account).
 *
 * One of these serves every room of the bundle on the machine (rooms share the module): passes are keyed by the
 * account's public id, completions by match id and account, and `$settle` goes through the room the account joined.
 */
import type { Account } from '../game/economy/account';
import type { Report } from '../game/economy/earn';
import type { Completion } from '../server/economy/completions';
import { NAME_FALLBACK } from '../game/displayName';
import { DONE_MS, seal, type Pass } from '../server/economy/p2roomSigned';

/** What rooms use of the economy (economyLink's RoomEconomy). */
export interface RoomEconomy {
  book: { find(token: unknown): Account | undefined; completions: { get(key: string): Completion | undefined } };
  complete(pk: string, report: Report): Completion | undefined;
}
/** Where a room sends a player's signed completion: their page, through the room they are in. */
export type SettleRoute = (pk: string, note: { key: string; done: string }) => boolean;

const KEEP = 4000;

export class PassEconomy implements RoomEconomy {
  private readonly passes = new Map<string, { pass: Pass; at: number }>();
  private readonly settled = new Map<string, Completion>();
  private readonly asked = new Map<string, number>();
  /** The bundle's key (build.mjs), and how a completion reaches a page: set by room.ts. */
  secret = '';
  route: SettleRoute = () => false;

  readonly book = {
    find: (token: unknown): Account | undefined => {
      if (typeof token !== 'string') return undefined;
      return this.passes.get(token)?.pass.account as unknown as Account | undefined;
    },
    completions: { get: (key: string) => this.settled.get(key) },
  };

  /** A checked pass, kept: the token rooms give as the seat's account. */
  keep(pass: Pass): string {
    const token = `pass:${pass.pk}`;
    this.passes.set(token, { pass, at: Date.now() });
    if (this.passes.size > KEEP) for (const key of [...this.passes.keys()].slice(0, KEEP / 2)) this.passes.delete(key);
    return token;
  }
  /** The name roomName gave the typed name when the pass was signed (the economy works it out against the book). */
  name(token: unknown, max: number): string | undefined {
    const pass = typeof token === 'string' ? this.passes.get(token)?.pass : undefined;
    return pass ? pass.account.name || pass.names[max] || pass.names[20] || NAME_FALLBACK : undefined;
  }

  complete(pk: string, report: Report): Completion | undefined {
    const key = `${report.id}:${pk}`;
    const known = this.settled.get(key); if (known) return known;
    const at = this.asked.get(key);
    /* (RoomRewards asks again every snapshot until it has an answer: the note goes again every 5 s, for a page that
       missed it or an economy that was away) */
    if (at !== undefined && Date.now() - at < 5000) return undefined;
    this.asked.set(key, Date.now());
    if (!this.secret) return undefined;
    void seal(this.secret, { k: 'done', pk, report, exp: Date.now() + DONE_MS }).then(done => { this.route(pk, { key, done }); });
    if (this.asked.size > KEEP) for (const k of [...this.asked.keys()].slice(0, KEEP / 2)) this.asked.delete(k);
    return undefined;
  }
  /** The pass an account's page brought (its standings and records, from the economy world). */
  passOf(pk: string): Pass | undefined { return this.passes.get(`pass:${pk}`)?.pass; }
  /** A result for the economy world (a ranked change, a rivalry), signed and sent to `pk`'s page as a completion goes:
   *  the page posts it to the economy (p2room-complete), which takes each once. `carriers`: other accounts in the room
   *  whose pages carry it too - a ranked Duel's leaver has no page left in the room, so the one who stayed carries the
   *  leaver's loss (and each carries the other's, so neither can keep a result from the world by not posting it). */
  note(pk: string, body: Record<string, unknown> & { k: string; id: string }, carriers: readonly string[] = []) {
    if (!this.secret) return;
    void seal(this.secret, { ...body, exp: Date.now() + DONE_MS }).then(done => { for (const each of new Set([pk, ...carriers])) this.route(each, { key: `${body.k}:${body.id}:${pk}`, done }); });
  }
  /** The page's word that the economy settled it (only ever shown to that page's own player). */
  settle(key: unknown, completion: unknown) {
    if (typeof key !== 'string' || key.length > 200 || !completion || typeof completion !== 'object') return;
    this.settled.set(key, completion as Completion);
    if (this.settled.size > KEEP) for (const k of [...this.settled.keys()].slice(0, KEEP / 2)) this.settled.delete(k);
  }
}

export const passEconomy = new PassEconomy();
