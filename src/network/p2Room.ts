/* A PlayerTwo room as network.ts knows a Colyseus room.
 *
 * Inside PlayerTwo's player the SDK's p2.rooms seats the player near them (in Cloudflare's network), and the build's
 * room/ folder (src/p2room) runs the match server's own room there. This wraps that room in the part of Colyseus' Room
 * that network.ts and the rest of the page use (send, onMessage, onLeave, onDrop/onReconnect, sessionId, connection),
 * so everything above it, the prediction and rollback first of all, is as it is against the match server.
 *
 * - Joining: p2.rooms.join (a public kind, matched by mode near the player; between: false, so a room never moves
 *   mid-fight) or p2.rooms.create / join({ code }) (a private room), then `$join` with the Colyseus options and the
 *   economy's pass (src/p2room/economy.ts), and the room's `$joined` or `$refused`.
 * - Snapshots come as `$z` (packed and deflated: ZReader); a lost one (a reconnect) asks the room for a new stream.
 * - The allowance: PlayerTwo takes the game's rate of messages a second from a page (`room.rate`: Impact's is 240; bursts
 *   of twice that), and the page sends an input every tick. A copy
 *   of that bucket here sends two inputs in one message (`inputs`) only if it runs low, so nothing is ever refused; at
 *   240 that never happens and every input goes at once. The pairing stays as a guard should the rate be lowered.
 * - A completion the room signed (`$settle`) goes to the economy, and its settlement back to the room (`$settled`).
 */
import { ZReader } from '../p2room/zreader';
import { p2Mode, type P2Kind } from '../p2room/protocol';

/** What of the SDK's room this uses (playertwo.plus/docs/sdk#rooms). */
export interface P2LiveRoom {
  id: string; code: string | null; me: string; scripted?: boolean;
  send(type: string, data?: unknown, options?: { to?: string | string[] }): void;
  on(event: string, fn: (...args: unknown[]) => void): unknown;
  leave(): void;
  stats?(): { ping?: number | null } | undefined;
  /** Messages a second the page may send (bursts of twice that): the game's rate in PlayerTwo's studio, 60 to 240. */
  rate?: number;
}
export interface P2Rooms {
  join(options: Record<string, unknown>): Promise<P2LiveRoom>;
  create(options: Record<string, unknown>): Promise<P2LiveRoom>;
  /** The player's PlayerTwo party's own room, with only its members (rejects no-party). */
  party?(options: Record<string, unknown>): Promise<P2LiveRoom>;
}
export interface P2Ask {
  kind: P2Kind;
  /** The Colyseus join options the match server's room reads. */
  options: Record<string, unknown>;
  /** A public match (joinOrCreate) by these values, a private room to make, one to join by its code, or the player's
   *  PlayerTwo party's own room (a private room with a code when they are in no PlayerTwo party). */
  how: { match: unknown[] } | { create: true } | { code: string } | { party: true };
  /** The economy's signed pass for the page's account (none: the room seats it without one). */
  pass?: string;
  /** Seats: a royale 12, a Duel 2, a bot room 1, a private room its host's count. */
  size: number;
  /** A public match whose faction can be full (Rift War, the objectives): this many pools of it, tried in turn. */
  pools?: number;
  /** A public match by skill (the SDK's join `skill`): the waiting room whose players are rated nearest in this mode
   *  first (PlayerTwo's own rating, which the room's room.result moves): the ranked Duel. */
  skill?: boolean;
  /** POST a signed completion to the economy; its settlement back. */
  settle?: (done: string) => Promise<unknown>;
}

/** Impact's allowance for a page's messages when its room doesn't say (an SDK before `room.rate`): 240 a second, bursts
 *  of twice that, as set in PlayerTwo's studio. The studio's setting goes from 10 to 240. */
export const RATE = 240;
const MIN_RATE = 10, MAX_RATE = 240;
/** The room's allowance: its `rate`, or 240. */
export const rateOf = (live: Pick<P2LiveRoom, 'rate'>) => {
  const r = Number(live.rate);
  return Number.isFinite(r) && r > 0 ? Math.min(MAX_RATE, Math.max(MIN_RATE, Math.floor(r))) : RATE;
};

type Handler = (message: unknown) => void;

/** Codes of PlayerTwo's rooms: six of A-Z less I, L, O and 2-9 (a match server room's code is six digits). */
export const P2_CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
export const isP2Code = (code: string) => P2_CODE.test(code) && /[A-Z]/.test(code);

export class P2ColyseusRoom {
  sessionId = '';
  roomId = '';
  /** A private room's code (PlayerTwo's six letters). */
  code: string | null = null;
  readonly reconnectionToken = '';
  readonly reconnection = { enabled: true, minUptime: 0, enqueuedMessages: [] as unknown[] };
  readonly connection = { isOpen: false };
  readonly p2 = true;
  private readonly handlers = new Map<string, Handler>();
  private leaveFns: ((code: number) => void)[] = [];
  private dropFns: (() => void)[] = [];
  private reconnectFns: (() => void)[] = [];
  private errorFns: ((code: number, message?: string) => void)[] = [];
  private readonly z = new ZReader();
  /** The allowance (messages a second), its burst (twice that), and the messages in hand below which two inputs go in
   *  one message (a fifth of the burst: 24 at 60). */
  private readonly rate: number;
  private readonly burst: number;
  private readonly low: number;
  private tokens: number;
  private filledAt = performance.now();
  private heldInput: unknown;
  private closeCode: number | undefined;
  private ended = false;

  constructor(private readonly live: P2LiveRoom, private readonly settle?: (done: string) => Promise<unknown>) {
    this.rate = rateOf(live); this.burst = this.rate * 2; this.low = Math.round(this.burst / 5); this.tokens = this.burst;
    live.on('message', (type, data) => this.hear(String(type), data));
    live.on('reconnecting', () => { this.connection.isOpen = false; for (const fn of this.dropFns) fn(); });
    live.on('reconnected', () => {
      this.connection.isOpen = true; this.z.reset(); this.live.send('$zreset', null);
      for (const fn of this.reconnectFns) fn();
    });
    live.on('close', why => this.end(this.closeCode ?? codeOf(why)));
  }

  /** Joined and seated: the room's `$joined`, or its words as an error. */
  static async open(rooms: P2Rooms, ask: P2Ask): Promise<P2ColyseusRoom> {
    const pools = 'match' in ask.how ? Math.max(1, ask.pools ?? 1) : 1;
    for (let pool = 0; ; pool++) {
      try { return await P2ColyseusRoom.seat(rooms, ask, pool); }
      catch (error) { if (pool + 1 >= pools || !(error instanceof Error) || !/faction is full/i.test(error.message)) throw error; }
    }
  }
  /** One try: seated in pool `pool` of a public match (0, the first), or the room asked for. */
  private static async seat(rooms: P2Rooms, ask: P2Ask, pool: number): Promise<P2ColyseusRoom> {
    const match = 'match' in ask.how ? (pool ? [...ask.how.match, `p${pool + 1}`] : ask.how.match) : [];
    const made = { mode: p2Mode(ask.kind), size: ask.size, between: false };
    let live = 'code' in ask.how ? await rooms.join({ code: ask.how.code })
      : 'create' in ask.how ? await rooms.create(made)
      : 'party' in ask.how ? await partyRoom(rooms, made)
      : await rooms.join({ mode: p2Mode(ask.kind, match), size: ask.size, between: false, ...(ask.skill ? { skill: true } : {}) });
    /* a code of six digits would be read as the match server's: made again (a chance of about 1 in 3,000) */
    for (let again = 0; 'create' in ask.how && live.code && /^\d{6}$/.test(live.code) && again < 3; again++) {
      live.leave(); live = await rooms.create({ mode: p2Mode(ask.kind), size: ask.size, between: false });
    }
    if (!live.scripted) { live.leave(); throw new Error('The servers are restarting. Try again in a minute.'); }
    const room = new P2ColyseusRoom(live, ask.settle);
    const seated = new Promise<P2ColyseusRoom>((resolve, reject) => {
      const timer = setTimeout(() => { reject(new Error('The servers are restarting. Try again in a minute.')); live.leave(); }, 20_000);
      room.joinWait = { resolve: id => { clearTimeout(timer); room.sessionId = id; resolve(room); }, reject: message => { clearTimeout(timer); room.ended = true; try { live.leave(); } catch { /* gone already */ } reject(new Error(message)); } };
    });
    room.code = live.code;
    room.connection.isOpen = true;
    live.send('$join', { kind: ask.kind, options: ask.options, pass: ask.pass ?? null, code: live.code ?? '' });
    return seated;
  }
  private joinWait?: { resolve(id: string): void; reject(message: string): void };

  private hear(type: string, data: unknown) {
    if (type === '$joined') { const d = data as { sessionId?: string; roomId?: string }; this.roomId = d?.roomId ?? this.live.id; this.joinWait?.resolve(d?.sessionId ?? this.live.me); this.joinWait = undefined; return; }
    if (type === '$refused') { const message = (data as { message?: string })?.message ?? 'This room is unavailable.'; this.joinWait?.reject(message); this.joinWait = undefined; return; }
    if (type === '$close') { this.closeCode = Number((data as { code?: unknown })?.code) || 4000; return; }
    if (type === '$error') { const d = data as { code?: number; message?: string }; for (const fn of this.errorFns) fn(d?.code ?? 0, d?.message); return; }
    if (type === '$settle') { this.forward(data); return; }
    if (type === '$z') {
      const r = this.z.read(data);
      if (r === 'gap') { this.live.send('$zreset', null); return; }
      if (r === 'skip') return;
      this.dispatch(r.type, r.message); return;
    }
    this.dispatch(type, data);
  }
  private dispatch(type: string, message: unknown) {
    /* (bytes as Colyseus hands them to onMessage: a Uint8Array) */
    if (message instanceof ArrayBuffer) message = new Uint8Array(message);
    const fn = this.handlers.get(type) ?? this.handlers.get('*');
    if (fn) fn(message);
  }
  /** A completion the room signed: to the economy, its settlement back to the room (for the results card). */
  private forward(data: unknown) {
    const note = data as { key?: string; done?: string } | null;
    if (!note?.done || !this.settle) return;
    void this.settle(note.done).then(completion => { if (completion && this.connection.isOpen) this.live.send('$settled', { key: note.key, completion }); }, () => {});
  }
  private end(code: number) {
    if (this.ended) return;
    this.ended = true; this.connection.isOpen = false;
    this.joinWait?.reject('This room is unavailable.'); this.joinWait = undefined;
    for (const fn of this.leaveFns) fn(code);
  }

  onMessage(type: string, handler: Handler) { this.handlers.set(type, handler); return () => { if (this.handlers.get(type) === handler) this.handlers.delete(type); }; }
  onLeave(fn: (code: number) => void) { this.leaveFns.push(fn); }
  onDrop(fn: () => void) { this.dropFns.push(fn); }
  onReconnect(fn: () => void) { this.reconnectFns.push(fn); }
  onError(fn: (code: number, message?: string) => void) { this.errorFns.push(fn); }
  /** To the room's code, within PlayerTwo's allowance: an input that would run it dry waits for the next to go with it. */
  send(type: string, message?: unknown) {
    if (!this.connection.isOpen) return;
    /* (the account's secret stays here: the room reads the account from its pass, room.ts) */
    if (type === 'account') message = null;
    const now = performance.now();
    this.tokens = Math.min(this.burst, this.tokens + (now - this.filledAt) * this.rate / 1000); this.filledAt = now;
    if (type === 'input') {
      if (this.heldInput !== undefined) { const pair = [this.heldInput, message]; this.heldInput = undefined; this.take(); this.live.send('inputs', pair); return; }
      if (this.tokens < this.low) { this.heldInput = message; return; }
    } else if (this.heldInput !== undefined) { this.take(); this.live.send('input', this.heldInput); this.heldInput = undefined; }
    this.take();
    this.live.send(type, message === undefined ? null : message);
  }
  private take() { this.tokens = Math.max(0, this.tokens - 1); }
  async leave(_consented = true) {
    if (this.ended) return;
    this.closeCode ??= 1000;
    try { this.live.leave(); } catch { /* gone already */ }
    this.end(this.closeCode);
  }
  /** The round trip to the room, as PlayerTwo measures it (ms; undefined until known). */
  ping() { const p = this.live.stats?.()?.ping; return typeof p === 'number' ? p : undefined; }
}

/** The player's PlayerTwo party's room, or (in none) a private room of their own, its code to share. */
async function partyRoom(rooms: P2Rooms, made: Record<string, unknown>): Promise<P2LiveRoom> {
  if (!rooms.party) return rooms.create(made);
  try { return await rooms.party(made); }
  catch (error) { if ((error as { code?: unknown })?.code === 'no-party') return rooms.create(made); throw error; }
}

/** A PlayerTwo room's close, as network.ts closeMessage knows Colyseus' codes. */
function codeOf(why: unknown): number {
  const n = Number(why);
  if (Number.isInteger(n) && n >= 1000) return n;
  if (why === 'update' || why === 'stopped' || why === 'script-error') return 4001;
  if (why === 'left') return 1000;
  return 4003;
}
