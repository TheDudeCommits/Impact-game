/* The part of Colyseus that Impact's rooms use, for running them in a PlayerTwo room (src/p2room/room.ts). The room bundle
 * (build.mjs) resolves `colyseus` to this file, so ArenaRoom, BallRoom and the rest run unchanged: what a room does
 * through `this` (its clients, messages, broadcasts, metadata, lock, disconnect, fixed step) is answered here and carried
 * out by the PlayerTwo room that holds it (the Host below, set by room.ts).
 *
 * What differs from Colyseus, by design:
 * - Seats are PlayerTwo's. A player's sessionId is their PlayerTwo id; a dropped page is held 20 s by PlayerTwo itself and
 *   comes back to the same seat, so a room never sees onDrop (allowReconnection is kept for its signature, and never
 *   called), and onLeave comes when PlayerTwo lets the seat go.
 * - setTimestep's callback runs once per PlayerTwo tick (60 a second, each step's own time), and setImmediate runs what it
 *   was given before that tick's call returns (room.ts drains it), so a room's StepClock catch-up keeps working.
 * - lock()/unlock() close and open the room to PlayerTwo's matching (room.open); setMetadata and setPrivate only keep
 *   their values (a private room is one made by p2.rooms.create, found by its code).
 */

export interface Client {
  /** The player's PlayerTwo id: the actor's id in the simulation, the same after a reconnect. */
  readonly sessionId: string;
  readonly id: string;
  send(type: string | number, message?: unknown): void;
  leave(code?: number, data?: string): void;
  error(code: number, message?: string): void;
  userData?: unknown;
  auth?: unknown;
  reconnectionToken?: string;
  state?: number;
  /** Bytes as they are (Colyseus' sendBytes). */
  sendBytes?(type: string | number, bytes: Uint8Array | ArrayBuffer | number[]): void;
}
export interface FixedTimestepInfo { dt: number; dtMs: number; tick: number; subSteps: number; subDt: number; subDtMs: number }
export type FixedTimestepCallback = (info: FixedTimestepInfo) => void;
export type RoomException = Error & { cause?: unknown };
export type RoomMethodName = 'onCreate' | 'onAuth' | 'onJoin' | 'onLeave' | 'onDispose' | 'onMessage' | 'setSimulationInterval' | 'setInterval' | 'setTimeout' | 'setTimestep' | string;
export interface IRoomCache { roomId: string; clients: number; maxClients: number; metadata?: unknown; name?: string; locked?: boolean; private?: boolean }

/** What a shimmed room asks of the PlayerTwo room that holds it (room.ts). */
export interface Host {
  /** Close (false) or open (true) the room to matching. */
  open(on: boolean): void;
  /** End the room for everyone, with a Colyseus close code (the page shows its words: network.ts closeMessage). */
  close(code: number): void;
  /** A message to one page. */
  send(client: Client, type: string | number, message: unknown): void;
  /** One page out of the room, with a close code. */
  kick(client: Client, code: number): void;
}

type Handler = (client: Client, message: unknown) => void;

export class Room<_State = unknown, _Metadata = unknown> {
  /** The PlayerTwo room's id (its pages' room.id), or the private room's name a room gives itself. */
  roomId = '';
  roomName = '';
  maxClients = Infinity;
  maxMessagesPerSecond = 0;
  autoDispose = true;
  patchRate: number | null = null;
  metadata: Record<string, unknown> = {};
  locked = false;
  private = false;
  readonly clients: Client[] & { getById?(id: string): Client | undefined } = Object.assign([] as Client[], {
    getById(this: Client[], id: string) { return this.find(c => c.sessionId === id); },
  });
  /** @internal set by room.ts */
  __host?: Host;
  /** @internal the message handlers, by type ('*': any type without one). */
  __handlers = new Map<string, Handler>();
  /** @internal the fixed step's callback (setTimestep), run each PlayerTwo tick. */
  __timestep?: () => void;
  /** @internal set when the room has been disposed. */
  __disposed = false;

  onMessage(type: string | number, handler: Handler) {
    const key = String(type);
    this.__handlers.set(key, handler);
    return () => { if (this.__handlers.get(key) === handler) this.__handlers.delete(key); };
  }
  broadcast(type: string | number, message?: unknown, options?: { except?: Client | Client[] }) {
    const except = options?.except === undefined ? [] : Array.isArray(options.except) ? options.except : [options.except];
    for (const client of this.clients) if (!except.includes(client)) client.send(type, message);
  }
  async setMetadata(meta: Record<string, unknown>) { this.metadata = { ...this.metadata, ...meta }; }
  async setPrivate(on = true) { this.private = on; }
  async lock() { if (this.locked) return; this.locked = true; this.__host?.open(false); }
  async unlock() { if (!this.locked) return; this.locked = false; this.__host?.open(true); }
  async disconnect(closeCode = 4000) { this.__host?.close(closeCode); }
  /** Never called on PlayerTwo (it holds a dropped seat itself); kept so a room's onDrop type-checks and, if called,
   *  waits for the leave PlayerTwo sends. */
  allowReconnection(_client: Client, _seconds?: number | 'manual'): Promise<Client> { return new Promise(() => {}); }
  /** The fixed step: `callback` once a PlayerTwo tick (60 a second). The rooms' own setFixedTimestep overrides call this. */
  setTimestep(callback: () => void, _ms?: number) { this.__timestep = callback; }
  setSimulationInterval(callback: (deltaMs: number) => void, ms = 1000 / 60) {
    let last = performance.now();
    this.__timestep = () => { const now = performance.now(); if (now - last >= ms - 0.5) { callback(now - last); last = now; } };
  }
  setFixedTimestep(step: FixedTimestepCallback, tickRate = 60) {
    const dt = 1 / tickRate; let tick = 0;
    this.__timestep = () => step({ dt, dtMs: dt * 1000, tick: tick++, subSteps: 1, subDt: dt, subDtMs: dt * 1000 });
  }
  setPatchRate(ms: number | null) { this.patchRate = ms; }
  setSeatReservationTime(_seconds: number) {}
  resetAutoDisposeTimeout(_seconds?: number) {}
  hasReachedMaxClients() { return this.clients.length >= this.maxClients; }
  get listing() { return { roomId: this.roomId, clients: this.clients.length, maxClients: this.maxClients, metadata: this.metadata, locked: this.locked, private: this.private }; }
}

/** PlayerTwo matches and seats players itself: nothing here creates or finds a room. */
/** A party's match on PlayerTwo (PartyRoom.launch): a room can't open another, so createRoom only notes what to open,
 *  and each member's seat is a ticket (`p2`) their page reads: the leader's page opens the room (PlayerTwo's create),
 *  its code comes back by the party's room (room.ts, `party-p2-room`), and the others' tickets carry it, to join by. */
export interface P2Launch { kind: string; options: Record<string, unknown>; code?: string; seats: Map<string, Record<string, unknown>> }
export const p2Launches = new Map<string, P2Launch>();
export const matchMaker = {
  query: async (_c?: unknown) => [] as IRoomCache[],
  findOneRoomAvailable: async () => undefined,
  reserveSeatFor: async () => { throw new Error('No seat reservations in a PlayerTwo room.'); },
  createRoom: async (roomName: string, options: Record<string, unknown> = {}) => {
    const roomId = `p2-${generateId(12)}`;
    p2Launches.set(roomId, { kind: roomName, options, seats: new Map() });
    return { roomId, name: roomName };
  },
  remoteRoomCall: async (roomId: string, method: string, args: unknown[] = []) => {
    const launch = p2Launches.get(roomId);
    if (method === 'disconnect') { p2Launches.delete(roomId); return true; }
    if (method === '_reserveSeat' && launch) { launch.seats.set(String(args[0]), (args[1] ?? {}) as Record<string, unknown>); return true; }
    return undefined;
  },
  /** A member's ticket: what their page opens or joins, read when it is sent (so the leader's code is in the others'). */
  buildSeatReservation: (room: { roomId: string }, sessionId: string) => {
    const launch = p2Launches.get(room.roomId);
    return { sessionId, get p2() { return launch ? { kind: launch.kind, options: { ...launch.options, ...launch.seats.get(sessionId) }, ...(launch.code ? { code: launch.code } : {}) } : undefined; }, toJSON() { return { sessionId, p2: this.p2 }; } };
  },
  stats: { local: { roomCount: 0, ccu: 0 } },
};
export function generateId(length = 9) {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_', bytes = crypto.getRandomValues(new Uint8Array(length));
  let id = ''; for (const b of bytes) id += abc[b & 63]; return id;
}
export const defineRoom = () => { throw new Error('defineRoom is the Colyseus server\'s.'); };
export const defineServer = defineRoom;
export class WebSocketTransport {}
export class LocalPresence {}
export const initializeRoomCache = () => ({});
export type Presence = unknown;
export type MatchMakerDriver = unknown;
export type SortOptions = unknown;
