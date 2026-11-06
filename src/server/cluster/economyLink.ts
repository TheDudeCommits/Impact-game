import { Room } from 'colyseus';
import type { Account } from '../../game/economy/account';
import type { Report } from '../../game/economy/earn';
import type { Completion } from '../economy/completions';
import type { Link } from './link';

/** What rooms use of the economy. Economy (api.ts) has this shape; so does the stand-in. */
export interface RoomEconomy {
  book: { find(token: unknown): Account | undefined; completions: { get(key: string): Completion | undefined } };
  complete(pk: string, report: Report): Completion | undefined;
}
/** The name sizes rooms ask roomName for (ArenaRoom and the others 20, the party lobby 18). */
export const NAME_SIZES = [18, 20] as const;
/** What control answers for a token: its account, and the name each size of roomName gives for the name the page typed. */
export interface Seat { account?: Account; names: Record<number, string> }

const KEEP_MS = 10 * 60_000, RETRY_MS = 2000;

export class RemoteEconomy implements RoomEconomy {
  private readonly accounts = new Map<string, { account?: Account; at: number }>();
  private readonly names = new Map<string, string>();
  private readonly settled = new Map<string, Completion>();
  private readonly asking = new Map<string, number>();
  private readonly learning = new Map<string, Promise<void>>();
  constructor(private readonly link: Link, private readonly now: () => number = Date.now) {}

  readonly book = {
    find: (token: unknown): Account | undefined => typeof token === 'string' ? this.accounts.get(token)?.account : undefined,
    completions: { get: (key: string) => this.settled.get(key) },
  };

  /** Fetch what control knows of `token` (and the name `typed` gives), before a room reads it. Never throws: an account
   *  that could not be fetched reads as unknown, as an unknown token always has. */
  learn(token: unknown, typed?: unknown, fresh = false): Promise<void> {
    if (typeof token !== 'string' && typed === undefined) return Promise.resolve();
    const key = `${String(token)}\u0000${String(typed)}`;
    const pending = this.learning.get(key); if (pending) return pending;
    if (!fresh && typed === undefined && typeof token === 'string' && this.accounts.has(token)) return Promise.resolve();
    const run = this.link.call<Seat>('rpc', 'economy.seat', [token, typed], 4000).then(seat => {
      if (typeof token === 'string') this.accounts.set(token, { account: seat.account, at: this.now() });
      for (const [size, name] of Object.entries(seat.names)) this.names.set(`${String(token)}\u0000${String(typed)}\u0000${size}`, name);
      this.prune();
    }, error => { console.error('[cluster] an account could not be fetched from control', error instanceof Error ? error.message : error); })
      .finally(() => this.learning.delete(key));
    this.learning.set(key, run);
    return run;
  }
  /** The name roomName gave in control for this token and typed name, if it was fetched. */
  name(token: unknown, typed: unknown, max: number): string | undefined { return this.names.get(`${String(token)}\u0000${String(typed)}\u0000${max}`); }

  complete(pk: string, report: Report): Completion | undefined {
    const key = `${report.id}:${pk}`;
    const known = this.settled.get(key); if (known) return known;
    const asked = this.asking.get(key);
    if (asked !== undefined && (asked === Infinity || this.now() - asked < RETRY_MS)) return undefined;
    this.asking.set(key, Infinity);
    void this.link.call<Completion | undefined>('rpc', 'economy.complete', [pk, report], 10_000).then(completion => {
      if (completion) { this.settled.set(key, completion); this.asking.delete(key); } else this.asking.set(key, this.now());
    }, error => {
      this.asking.set(key, this.now());
      console.error('[rewards] control could not settle a match yet', error instanceof Error ? error.message : error);
    });
    return undefined;
  }

  /** Accounts not read for ten minutes are let go (a room process lives for days). */
  private prune() {
    if (this.accounts.size < 2000) return;
    const old = this.now() - KEEP_MS;
    for (const [token, entry] of this.accounts) if (entry.at < old) this.accounts.delete(token);
    if (this.names.size > 4000) this.names.clear();
    if (this.settled.size > 4000) for (const key of [...this.settled.keys()].slice(0, 2000)) this.settled.delete(key);
  }
}

let remote: RemoteEconomy | undefined;
/** This room process's stand-in, once installed. */
export const remoteEconomy = () => remote;

/** A room told an account mid-match (the page's `account` message: once a room, and again when what is worn changes):
 *  in a room process, the account is fetched afresh first, so a new outfit is seen, and `run` runs if the player is still
 *  in the room; elsewhere it runs at once, as it always did. */
export function freshAccount(token: unknown, run: () => void, stillHere: () => boolean) {
  if (!remote) { run(); return; }
  void remote.learn(token, undefined, true).then(() => { if (stillHere()) run(); });
}

/** In a room process: the stand-in, and every seat reservation waits for the account its options name. */
export function installRoomEconomy(link: Link): RemoteEconomy {
  remote = new RemoteEconomy(link);
  const proto = Room.prototype as unknown as { _reserveSeat(sessionId: string, joinOptions?: unknown, ...rest: unknown[]): Promise<boolean> };
  const reserve = proto._reserveSeat;
  proto._reserveSeat = async function (this: Room, sessionId: string, joinOptions?: unknown, ...rest: unknown[]) {
    const options = joinOptions && typeof joinOptions === 'object' ? joinOptions as { account?: unknown; name?: unknown } : undefined;
    if (options && remote) await remote.learn(options.account, options.name);
    return reserve.call(this, sessionId, joinOptions, ...rest);
  };
  return remote;
}

/** In control: answer the room processes' economy calls. */
export function answerRoomEconomy(link: Link, economy: () => { book: { find(token: unknown): Account | undefined }; complete(pk: string, report: Report): Completion | undefined } | undefined,
  roomName: (token: unknown, typed: unknown, max: number) => string) {
  link.handle('economy.seat', (token, typed) => {
    const account = economy()?.book.find(token);
    const names: Record<number, string> = {};
    if (typed !== undefined) for (const size of NAME_SIZES) names[size] = roomName(token, typed, size);
    return { account, names } satisfies Seat;
  });
  link.handle('economy.complete', (pk, report) => economy()?.complete(String(pk), report as Report));
}
