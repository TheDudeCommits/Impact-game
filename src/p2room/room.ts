/* Impact's online rooms on PlayerTwo's servers: the room bundle's room.js (build.mjs makes the room/ folder).
 *
 * The match server's own room classes run here unchanged (ArenaRoom and
 * its kinds, BallRoom), through a stand-in for the part of Colyseus they use (colyseus.ts). The page talks to them through
 * p2.rooms (src/network/p2Room.ts), which looks to network.ts like a Colyseus room, so the client's prediction and
 * rollback (src/game/prediction.ts) are exactly what they are against the match server.
 *
 * How a room goes:
 * - PlayerTwo seats the player (matching by mode near them, or a private room's code) and calls onJoin. The page then
 *   sends `$join` with what a Colyseus join carried (the room kind, its options) and its economy pass (economy.ts); the
 *   first one makes the room (onCreate with that page's options, as Colyseus' create did), and each is checked (onAuth)
 *   and seated (onJoin) as Colyseus seats a client. The page hears `$joined`, then what the room said to it, or
 *   `$refused` with the room's own words.
 * - Every PlayerTwo tick (60 a second, each at its own time) runs the room's fixed step once (its own StepClock catches
 *   up a stall, as on the match server), then what the step gave setImmediate.
 * - What a room sends a page goes as a PlayerTwo message to that page alone. Snapshots go packed (msgpack, as Colyseus
 *   packs them) and deflated with the page's previous one as the dictionary, as permessage-deflate's carried window does
 *   on the match server: a twelve-fighter snapshot of 15 KB is about 1.4 KB (0.5 ms), a Duel's 4.5 KB about 0.35 (0.3 ms).
 * - A dropped page keeps its seat for 20 s (PlayerTwo's own hold) and its fighter in the fight, as on the match server; onLeave
 *   comes when PlayerTwo lets the seat go.
 * - room.js's module is shared by the build's rooms on one machine: everything of one room is in its Driver, by room.id.
 */
import '../originals/launch';
import '../originals/serverGate';
import { deflateSync } from 'three/examples/jsm/libs/fflate.module.js';
import { pack } from 'msgpackr';
import { LAG_COMPENSATION } from '../game/simulation';
import { initRapier } from '../game/rapierCollision';
import { ArenaRoom, BotArenaRoom, DuelRoom, PrivateArenaRoom, PrivateDuelRoom } from '../server/ArenaRoom';
import { BallRoom } from '../server/ball/BallRoom';
import { RiftRoom } from '../server/moba/RiftRoom';
import { ObjectiveRoom } from '../server/objectives/ObjectiveRoom';
import { SurvivalRoom } from '../server/SurvivalRoom';
import { PartyRoom } from '../server/social/PartyRoom';
import { p2Launches, type Client, type Host, type Room as ShimRoom } from './colyseus';
import { passEconomy } from './economy';
import { unseal, type Pass } from '../server/economy/p2roomSigned';
import { p2code } from './stubs/privateCodes';
import { P2_COMPRESSED, P2_DICTIONARY, P2_KINDS, type P2Kind } from './protocol';

/** The bundle's key (build.mjs), shared with the match server's P2ROOM_KEY. */
declare const __P2ROOM_KEY__: string;
const KEY = typeof __P2ROOM_KEY__ === 'string' ? __P2ROOM_KEY__ : '';
passEconomy.secret = KEY;

/** PlayerTwo's room, as room.js gets it (its docs: Scripted rooms). */
interface P2Player { id: string; name?: string; ping?: number | null; jitter?: number | null }
interface P2Room {
  id: string;
  players: P2Player[];
  player(id: string): P2Player | null;
  send(type: string, data: unknown, options?: { to?: string | string[] }): void;
  kick(id: string, why?: string): void;
  close(why?: string): void;
  open(on?: boolean): void;
  log(...args: unknown[]): void;
  where?: { colo?: string | null; region?: string | null } | null;
}

export const tickRate = 60;
/** The most lag compensation a room gives (scaleRewind): the lock escape's own window (LOCK_ESCAPE_REWIND). */
const REWIND_MAX = 0.35;

const CLASSES: Record<P2Kind, new () => ShimRoom> = {
  arena: ArenaRoom as never, bot_arena: BotArenaRoom as never, private_arena: PrivateArenaRoom as never,
  duel_arena: DuelRoom as never, private_duel: PrivateDuelRoom as never, ball_arena: BallRoom as never,
  rift_war: RiftRoom as never, objective_arena: ObjectiveRoom as never, survival_arena: SurvivalRoom as never, party: PartyRoom as never,
};

/* setImmediate: what a room's step hands it runs before the PlayerTwo call returns (drain), in order. A room's calls
   never interleave (each is synchronous once the room is made), so one queue serves every room on the machine. */
const immediates: (() => void)[] = [];
(globalThis as { setImmediate?: unknown }).setImmediate = (fn: (...a: unknown[]) => void, ...args: unknown[]) => { immediates.push(() => fn(...args)); return 0; };
function drain() { for (let n = 0; immediates.length && n < 10_000; n++) immediates.shift()!(); }

/** A code for a party's room from its id (six of PlayerTwo's letters and digits). */
function partyCodeOf(id: string) {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let h = 2166136261, out = '';
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  for (let i = 0; i < 6; i++) { out += abc[(h >>> 0) % abc.length]; h = Math.imul(h ^ (i + 1), 16777619); }
  return out;
}

/** A random 32-bit stream id: a page tells a new stream from the one it had by it. */
const streamId = () => crypto.getRandomValues(new Uint32Array(1))[0];

/** A seat: a PlayerTwo player as a Colyseus client of the room. */
class Seat implements Client {
  readonly id: string;
  userData?: unknown;
  auth?: unknown;
  /** Their stream of packed messages: its id (new at their first, and after `$zreset`), the next one's number, and the
   *  last one's bytes, the next one's preset dictionary (undefined: the next starts a stream). */
  stream = 0;
  seq = 0;
  prev?: Uint8Array;
  /** The account token rooms know them by (`pass:<pk>`, economy.ts), when their page brought a pass. */
  account?: string;
  /** While their join is being checked: what the room said to them, held until `$joined` has gone first. */
  held?: [string, unknown][];
  constructor(private readonly driver: Driver, readonly sessionId: string) { this.id = sessionId; }
  send(type: string | number, message?: unknown) { this.driver.deliver(this, String(type), message); }
  /** Bytes as they are (SurvivalRoom's frames, msgpack it packs itself): PlayerTwo carries a message's bytes as bytes. */
  sendBytes(type: string | number, bytes: Uint8Array | ArrayBuffer | number[]) { this.driver.deliver(this, String(type), bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as ArrayBuffer)); }
  leave(code = 4000) { this.driver.kickSeat(this, code); }
  error(code: number, message?: string) { this.driver.p2.send('$error', { code, message: message ?? '' }, { to: this.id }); }
  /** `message` packed (msgpack, as Colyseus packs it) and deflated with the one before it as its preset dictionary, so
   *  what repeats from one snapshot to the next costs almost nothing (as permessage-deflate's carried window does on the
   *  match server): [kind, stream (4), number (4), deflated bytes]. The page keeps the last one it read to inflate the next. */
  packed(kind: number, message: unknown): Uint8Array {
    if (!this.prev) { this.stream = streamId(); this.seq = 0; }
    const bytes = pack(message), dictionary = this.prev && this.prev.length > P2_DICTIONARY ? this.prev.subarray(this.prev.length - P2_DICTIONARY) : this.prev;
    const z = deflateSync(bytes, dictionary ? { level: 1, dictionary } : { level: 1 });
    this.prev = bytes;
    const out = new Uint8Array(9 + z.length), view = new DataView(out.buffer);
    out[0] = kind; view.setUint32(1, this.stream); view.setUint32(5, this.seq++);
    out.set(z, 9);
    return out;
  }
}

/** One PlayerTwo room's Impact room, its seats and its pass-holders. */
class Driver {
  impl?: ShimRoom;
  kind?: P2Kind;
  making?: Promise<ShimRoom>;
  readonly seats = new Map<string, Seat>();
  closed = false;
  ticks = 0;
  readonly host: Host;
  constructor(public p2: P2Room) {
    this.host = {
      open: on => this.p2.open(on),
      close: code => this.close(code),
      send: (client, type, message) => this.deliver(client as Seat, String(type), message),
      kick: (client, code) => this.kickSeat(client as Seat, code),
    };
  }

  deliver(seat: Seat, type: string, message: unknown) {
    if (this.closed) return;
    if (seat.held) { seat.held.push([type, message]); return; }
    const kind = (P2_COMPRESSED as readonly string[]).indexOf(type);
    if (kind >= 0) this.p2.send('$z', seat.packed(kind, message), { to: seat.id });
    /* (a party's ticket is read as it goes: the leader's code in it, as plain data) */
    else if (type === 'party-travel') this.p2.send(type, JSON.parse(JSON.stringify(message ?? null)), { to: seat.id });
    else this.p2.send(type, message === undefined ? null : message, { to: seat.id });
  }
  kickSeat(seat: Seat, code: number) {
    this.p2.send('$close', { code }, { to: seat.id });
    this.p2.kick(seat.id, String(code));
  }
  close(code: number) {
    if (this.closed) return;
    for (const seat of this.seats.values()) this.p2.send('$close', { code }, { to: seat.id });
    this.closed = true;
    this.p2.close(String(code));
    this.dispose();
  }
  dispose() {
    const impl = this.impl; this.impl = undefined; this.making = undefined; this.kind = undefined;
    if (impl && !impl.__disposed) { impl.__disposed = true; try { (impl as unknown as { onDispose?(): void }).onDispose?.(); } catch (error) { this.p2.log('onDispose', String(error)); } }
  }

  /** A page's `$join`: its pass checked, the room made by the first, the page checked and seated. */
  async join(player: P2Player, data: unknown) {
    const ask = (data && typeof data === 'object' ? data : {}) as { kind?: unknown; options?: unknown; pass?: unknown; code?: unknown };
    const refuse = (message: string) => { this.p2.send('$refused', { message }, { to: player.id }); this.p2.kick(player.id, 'refused'); };
    const kind = ask.kind as P2Kind;
    if (!P2_KINDS.includes(kind)) return refuse('This room is for another version of the game. Refresh the page.');
    if (this.kind && this.kind !== kind) return refuse('That room is for another mode.');
    const options: Record<string, unknown> = { ...(ask.options && typeof ask.options === 'object' ? ask.options as Record<string, unknown> : {}) };
    delete options.account;
    /* a private room's code, as its page joined it on PlayerTwo (the rooms' own check: options.code against theirs; the
       page's Colyseus options carry no code, PlayerTwo's join took it) */
    if (typeof ask.code === 'string' && ask.code && options.code === undefined) options.code = ask.code.toUpperCase().slice(0, 12);
    /* a PlayerTwo party's own room (p2.rooms.party) has no code: PlayerTwo lets in only the party's members, so the room's
       id stands for one (PartyRoom checks every joiner's against its own) */
    if (kind === 'party' && !ask.code) { ask.code = partyCodeOf(this.p2.id); options.code = ask.code; }
    const pass = KEY ? await unseal<Pass>(KEY, ask.pass) : undefined;
    if (pass?.k === 'pass' && typeof pass.pk === 'string') { options.account = passEconomy.keep(pass); passHolders.set(pass.pk, { driver: this, id: player.id }); }
    /* the same page again (its reload took its seat back by the room's id): seated as it was, its stream new */
    const had = this.seats.get(player.id);
    if (had && this.impl) {
      had.prev = undefined;
      this.p2.send('$joined', { sessionId: player.id, roomId: this.impl.roomId, again: true }, { to: player.id });
      const reconnect = (this.impl as unknown as { onReconnect?(c: Client): void }).onReconnect;
      if (reconnect) this.guard(() => reconnect.call(this.impl, had), 'onReconnect');
      return;
    }
    let impl: ShimRoom;
    try {
      if (!this.impl && !this.making) {
        /* this call builds the room (its world, its match: a Rift War's was ~65 ms of CPU in Node on top of Rapier's
           start), and the next tick seats the player (their fighter, the welcome, the first snapshot), so neither call
           comes near PlayerTwo's 100 ms */
        this.kind = kind;
        this.making = this.make(kind, ask, options);
        try { this.impl = await this.making; } catch (error) { this.making = undefined; this.kind = undefined; throw error; }
        this.deferred.push([player, data]);
        return;
      }
      if (!this.impl) {
        this.kind = kind;
        this.making ??= (async () => {
          const room = new CLASSES[kind]();
          room.roomId = this.p2.id; room.roomName = kind; room.__host = this.host;
          p2code.next = typeof ask.code === 'string' ? ask.code.toUpperCase().slice(0, 12) : '';
          await (room as unknown as { onCreate(o: unknown): Promise<void> | void }).onCreate(options);
          return room;
        })();
        try { this.impl = await this.making; } catch (error) { this.making = undefined; this.kind = undefined; throw error; }
      }
      impl = this.impl ?? await this.making!;
    } catch (error) { return refuse(error instanceof Error ? error.message : 'The room could not be opened.'); }
    if (impl.clients.length >= impl.maxClients) return refuse('This room is full.');
    const seat = new Seat(this, player.id);
    seat.held = [];
    if (typeof options.account === 'string') seat.account = options.account;
    this.seats.set(player.id, seat);
    try {
      const shim = impl as unknown as { onAuth?(c: Client, o: unknown, ctx: unknown): unknown; onJoin?(c: Client, o: unknown, auth?: unknown): unknown };
      const auth = shim.onAuth ? await shim.onAuth(seat, options, {}) : true;
      if (auth === false) throw new Error('You can\'t join this room.');
      seat.auth = auth;
      impl.clients.push(seat);
      await shim.onJoin?.(seat, options, auth);
    } catch (error) {
      const i = impl.clients.indexOf(seat); if (i >= 0) impl.clients.splice(i, 1);
      this.seats.delete(player.id); seat.held = undefined;
      return refuse(error instanceof Error ? error.message : 'You can\'t join this room.');
    }
    const held = seat.held; seat.held = undefined;
    this.p2.send('$joined', { sessionId: player.id, roomId: impl.roomId }, { to: player.id });
    for (const [type, message] of held) this.deliver(seat, type, message);
    drain();
  }

  message(player: P2Player, type: string, data: unknown) {
    if (type === '$join') return this.join(player, data);
    const seat = this.seats.get(player.id);
    if (type === '$zreset') { if (seat) seat.prev = undefined; return; }
    if (type === '$settled') { const d = data as { key?: unknown; completion?: unknown } | null; passEconomy.settle(d?.key, d?.completion); return; }
    const impl = this.impl;
    if (!seat || !impl || seat.held) return;
    /* (two inputs in one message, when the page was short of PlayerTwo's message allowance: network/p2Room.ts) */
    if (type === 'inputs' && Array.isArray(data)) { for (const input of data.slice(0, 4)) this.message(player, 'input', input); return; }
    /* a party's match, opened by its leader's page on PlayerTwo: its code, for the others' tickets (colyseus.ts p2Launches) */
    if (type === 'party-p2-room' && this.kind === 'party') {
      const party = impl as unknown as { view?: { leader?: string }; launchId?: string; matchId?: string };
      const d = data as { id?: unknown; code?: unknown } | null, launch = party.matchId ? p2Launches.get(party.matchId) : undefined;
      if (launch && party.view?.leader === seat.id && d?.id === party.launchId && typeof d?.code === 'string' && /^[A-Z0-9]{6}$/.test(d.code)) launch.code = d.code;
      return;
    }
    const handler = impl.__handlers.get(type) ?? impl.__handlers.get('*');
    if (!handler) return;
    /* the page's `account` (the shop's, to dress the fighter): never its secret here, the seat's pass instead */
    if (type === 'account') data = seat.account;
    this.guard(() => handler(seat, data), 'onMessage');
    drain();
  }

  leave(player: P2Player, why: string) {
    const seat = this.seats.get(player.id);
    if (!seat) return;
    this.seats.delete(player.id);
    for (const [pk, at] of passHolders) if (at.driver === this && at.id === player.id) passHolders.delete(pk);
    const impl = this.impl;
    if (!impl) return;
    const i = impl.clients.indexOf(seat); if (i >= 0) impl.clients.splice(i, 1);
    this.guard(() => (impl as unknown as { onLeave?(c: Client, consented: boolean): unknown }).onLeave?.(seat, why === 'left'), 'onLeave');
    drain();
    if (!impl.clients.length && impl.autoDispose) this.dispose();
  }

  /** A room made, its maker's seat left for the next tick (join). */
  private readonly deferred: [P2Player, unknown][] = [];
  private async make(kind: P2Kind, ask: { code?: unknown }, options: Record<string, unknown>) {
    const room = new CLASSES[kind]();
    room.roomId = this.p2.id; room.roomName = kind; room.__host = this.host;
    p2code.next = typeof ask.code === 'string' ? ask.code.toUpperCase().slice(0, 12) : '';
    await (room as unknown as { onCreate(o: unknown): Promise<void> | void }).onCreate(options);
    return room;
  }
  tick(): Promise<void> | void {
    /* a seat left by the call that made the room: this tick is theirs (if they are still here) */
    const next = this.deferred.shift();
    if (next) return this.p2.player(next[0].id) ? this.join(next[0], next[1]) : undefined;
    if (++this.ticks % 60 === 0) this.scaleRewind();
    const step = this.impl?.__timestep;
    if (step) this.guard(step, 'setTimestep');
    drain();
  }

  /** Lag compensation from the players' measured round trips (PlayerTwo's player.ping): a hit is judged where the
   *  attacker saw the target, up to half the worst round trip in the room plus 150 ms for the page's interpolation and
   *  the input queue, never under the match server's own quarter second and never over REWIND_MAX. PlayerTwo matches
   *  no one across more than 250 ms there and back, so a room near its players stays at 0.25 s, and the cap rises only
   *  for a far pair (a private room's code seats anyone). */
  scaleRewind() {
    const sim = (this.impl as unknown as { simulation?: { rewind: number } } | undefined)?.simulation;
    if (!sim || !(sim.rewind > 0)) return;
    let worst = 0;
    for (const p of this.p2.players) if (typeof p.ping === 'number' && Number.isFinite(p.ping)) worst = Math.max(worst, p.ping);
    sim.rewind = Math.min(REWIND_MAX, Math.max(LAG_COMPENSATION, worst / 2000 + 0.15));
  }

  /** A throw in the room is the room's to report (RoomFaults), as Colyseus hands it onUncaughtException. */
  guard(fn: () => unknown, method: string) {
    try {
      const r = fn() as Promise<unknown> | undefined;
      if (r && typeof r.then === 'function') r.then(undefined, error => this.fault(error, method));
    } catch (error) { this.fault(error, method); }
  }
  fault(error: unknown, method: string) {
    const impl = this.impl as unknown as { onUncaughtException?(e: unknown, m: string): void } | undefined;
    if (impl?.onUncaughtException) { try { impl.onUncaughtException(error, method); return; } catch { /* reported below */ } }
    this.p2.log(`[${method}]`, error instanceof Error ? error.stack ?? error.message : String(error));
  }
}

const drivers = new Map<string, Driver>();
/** Each account's room and seat, for its signed completions (economy.ts route). */
const passHolders = new Map<string, { driver: Driver; id: string }>();
passEconomy.route = (pk, note) => {
  const at = passHolders.get(pk);
  if (!at || at.driver.closed) return false;
  at.driver.p2.send('$settle', note, { to: at.id });
  return true;
};
const driverOf = (room: P2Room) => {
  let d = drivers.get(room.id);
  if (!d) { d = new Driver(room); drivers.set(room.id, d); }
  d.p2 = room;
  return d;
};

/** A room's first call: Rapier started here (once a machine: its compiled engine instantiated, about 64 ms of CPU in Node),
 *  so the first player's `$join`, which builds the room, keeps inside PlayerTwo's 100 ms a call (a Rift War's was 172 in
 *  Node with it). Hooks may be async (PlayerTwo's docs: a room/ folder). */
export async function onCreate(room: P2Room) { driverOf(room); await initRapier(); }
/** Each time the code starts: after a restart or an update, a room whose players were mid-match lost its fight (it lives
 *  in this module, not room.data): its pages are told as a server restart tells them on the match server (4001: "The server was
 *  updated. Press PLAY to jump back in."), and the room closes. The rooms join with between: false, so PlayerTwo
 *  never moves one by itself. */
export function onStart(room: P2Room) {
  if (drivers.has(room.id) || !room.players.length) { driverOf(room); return; }
  for (const p of room.players) room.send('$close', { code: 4001 }, { to: p.id });
  room.close('4001');
}
export function onJoin(room: P2Room, _player: P2Player) { driverOf(room); }
export function onMessage(room: P2Room, player: P2Player, type: string, data: unknown) { return driverOf(room).message(player, type, data); }
export function onLeave(room: P2Room, player: P2Player, why: string) {
  const d = driverOf(room);
  d.leave(player, why);
  if (!room.players.length || d.closed) { d.dispose(); drivers.delete(room.id); }
}
/* (each hook's room is the one used: never one kept from another call, which may be another Durable Object's) */
export function onTick(room: P2Room) { const d = drivers.get(room.id); if (!d) return undefined; d.p2 = room; return d.tick(); }
