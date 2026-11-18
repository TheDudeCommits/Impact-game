/* Impact's economy world: the PlayerTwo world `economy` (p2.rooms.world('economy'): a room kept for good, never closed,
 * its room.store kept through every new build), running the economy (economy.ts) on its store (book.ts). The same
 * room.js as the match rooms (src/p2room/entry.ts sends a world's calls here).
 *
 * What a page says to it, and hears back (src/network/p2Economy.ts):
 *   $eco { id, path, body }            a route of the economy (api.ts's names), for the seat's player; a body too big for
 *     or { id, path, part, of, text }  one message (16 KB) comes in parts, its JSON cut in pieces, run once all are in
 *     -> $eco { id, status, body }     as HTTP would answer it
 *   $imp { id, begin }                 the operator's signed note (admin: import, with the run's id): the import's run begins
 *   $imp { id, chunk }                 a signed chunk of the match server's book (importer.ts), applied
 *     -> $imp { id, n?, applied?, error? }
 *   $ver { id, ticket, slices }        digests of these slices (importer.ts), for the verifier; ticket: admin verify
 *     -> $ver { id, digests }
 *   $wipe { id, ticket }               a slice of the store deleted (admin wipe; refused once the world is open)
 *     -> $wipe { id, left }
 * As a page comes in it hears $open { open }: whether the world answers yet (until the import is checked and the
 * operator opens it, pages ask the match server). */
import { kvOf, type KV } from './kv';
import { CFG, WorldEconomy, type Seat } from './economy';
import { digestKV, openChunk } from './importer';

declare const __P2ROOM_KEY__: string;
const KEY = typeof __P2ROOM_KEY__ === 'string' ? __P2ROOM_KEY__ : '';

interface P2Player { id: string; kind?: string }
export interface P2World {
  id: string;
  players: P2Player[];
  player(id: string): P2Player | null;
  send(type: string, data: unknown, options?: { to?: string | string[] }): void;
  store: { get(k: string): unknown; set(k: string, v: unknown): void; delete(k: string): void; keys(prefix?: string, limit?: number): string[] };
  trophy?(id: string, key: string): void;
  log(...args: unknown[]): void;
}

/** Whether a room is the economy world (a world's id is w/<game>/<world>/<area>). */
export const isEconomyWorld = (room: { id?: unknown } | null | undefined) => typeof room?.id === 'string' && /^w\/[^/]+\/economy\//.test(room.id);

/** The most of a body's parts held at once for one page, and the most a body may be (the server's progress route: 64 KB). */
const PARTS_MAX = 8, BODY_MAX = 64 * 1024;
/** The store's keys deleted in one wipe call (the rest in the next). */
const WIPE_A_CALL = 3000;

interface Held { path: string; of: number; parts: string[]; at: number }
class World {
  readonly kv: KV;
  readonly economy: WorldEconomy;
  /** Bodies in parts, by page and call. */
  private readonly held = new Map<string, Held>();
  constructor(public room: P2World, readonly key = KEY, now?: () => number) {
    /* room.store is read from the room each hook was handed, every time, never kept: rooms of a build on one machine
       share this module, and a store from another call's room (the world before it moved on to a new build, or woke)
       is another Durable Object's ("Cannot perform I/O on behalf of a different Durable Object") */
    this.kv = kvOf({
      get: k => this.room.store.get(k), set: (k, v) => this.room.store.set(k, v),
      delete: k => this.room.store.delete(k), keys: (prefix, limit) => this.room.store.keys(prefix, limit),
    });
    this.economy = new WorldEconomy(this.kv, { key, now, trophy: (player, feat) => this.room.trophy?.(player, feat), log: (...a) => this.room.log?.(...a) });
  }
  seat(player: P2Player): Seat { return { id: String(player.id), kind: typeof player.kind === 'string' ? player.kind : undefined }; }
  reply(player: P2Player, type: string, data: unknown) { this.room.send(type, data, { to: player.id }); }

  async message(player: P2Player, type: string, data: unknown) {
    const m = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>, id = typeof m.id === 'number' || typeof m.id === 'string' ? m.id : null;
    if (type === '$eco') return this.eco(player, id, m);
    if (type === '$imp') return this.reply(player, '$imp', { id, ...(await this.imp(m)) });
    if (type === '$ver') return this.reply(player, '$ver', { id, ...(await this.ver(m)) });
    if (type === '$wipe') return this.reply(player, '$wipe', { id, ...(await this.wipe(m)) });
  }

  async eco(player: P2Player, id: unknown, m: Record<string, unknown>) {
    const path = typeof m.path === 'string' ? m.path.slice(0, 40) : '';
    let body: unknown = m.body;
    if (typeof m.text === 'string' && Number.isInteger(m.part) && Number.isInteger(m.of)) {
      const of = m.of as number, part = m.part as number, at = `${player.id}\u0000${String(id)}`;
      if (of < 1 || of * 15_000 > BODY_MAX * 2 || part < 0 || part >= of) return this.reply(player, '$eco', { id, status: 400, body: { error: 'That is too much to send.' } });
      for (const [k, h] of this.held) if (Date.now() - h.at > 60_000) this.held.delete(k);
      let h = this.held.get(at);
      if (!h) {
        if ([...this.held.keys()].filter(k => k.startsWith(`${player.id}\u0000`)).length >= PARTS_MAX) return this.reply(player, '$eco', { id, status: 429, body: { error: 'Too much at once.' } });
        h = { path, of, parts: [], at: Date.now() }; this.held.set(at, h);
      }
      h.parts[part] = m.text;
      if (h.parts.filter(p => typeof p === 'string').length < h.of) return;
      this.held.delete(at);
      const text = h.parts.join('');
      if (text.length > BODY_MAX) return this.reply(player, '$eco', { id, status: 400, body: { error: 'That is too much to send.' } });
      try { body = JSON.parse(text); } catch { return this.reply(player, '$eco', { id, status: 400, body: { error: 'That was not JSON.' } }); }
    }
    const answer = await this.economy.route(this.seat(player), path, body);
    this.reply(player, '$eco', { id, ...answer });
  }

  /** The operator's import: begun by a signed note naming its run; then its chunks, while the world isn't open. */
  async imp(m: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      if (this.economy.config().open) return { error: 'This world is open: an import would overwrite its accounts.' };
      if (m.begin !== undefined) {
        const note = await this.economy.note<{ k: 'admin'; op: string; run?: unknown; of?: unknown }>(m.begin, 'admin');
        if (note.op !== 'import' || typeof note.run !== 'string' || !note.run) return { error: 'That note does not begin an import.' };
        this.kv.set('~imp', { run: note.run, of: Number(note.of) || 0, at: Date.now() });
        return { begun: note.run };
      }
      const run = this.kv.get<{ run: string }>('~imp')?.run;
      const records = await openChunk(this.key, m.chunk, run);
      if (typeof records === 'string') return { error: records };
      /* (after the last await: the chunk's keys are written together) */
      for (const [key, value] of records) this.kv.set(key, value);
      const n = (m.chunk as { n: number }).n;
      this.kv.set(`~imp/${run}/${n}`, records.length);
      return { n, applied: records.length };
    } catch (error) { return { error: error instanceof Error ? error.message : 'That did not go.' }; }
  }

  async ver(m: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      const note = await this.economy.note<{ k: 'admin'; op: string }>(m.ticket, 'admin');
      if (note.op !== 'verify') return { error: 'That note does not ask for a check.' };
      const slices = Array.isArray(m.slices) ? (m.slices as unknown[]).filter((s): s is string => typeof s === 'string').slice(0, 16) : [];
      const digests: Record<string, { count: number; hash: string }> = {};
      for (const slice of slices) digests[slice] = await digestKV(this.kv, slice);
      const imp = this.kv.get<{ run: string; of: number }>('~imp');
      const got = imp ? this.kv.keys(`~imp/${imp.run}/`, 100_000).length : 0;
      return { digests, run: imp?.run ?? null, chunks: got, of: imp?.of ?? 0, open: !!this.economy.config().open };
    } catch (error) { return { error: error instanceof Error ? error.message : 'That did not go.' }; }
  }

  async wipe(m: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      const note = await this.economy.note<{ k: 'admin'; op: string }>(m.ticket, 'admin');
      if (note.op !== 'wipe') return { error: 'That note does not ask for a wipe.' };
      if (this.economy.config().open) return { error: 'This world is open: it is never wiped.' };
      let n = 0;
      for (const key of this.kv.keys('', WIPE_A_CALL + 2)) { if (key === CFG) continue; if (n >= WIPE_A_CALL) break; this.kv.delete(key); n++; }
      return { wiped: n, left: this.kv.keys('', 2).filter(k => k !== CFG).length };
    } catch (error) { return { error: error instanceof Error ? error.message : 'That did not go.' }; }
  }

  join(player: P2Player) { this.reply(player, '$open', { open: !!this.economy.config().open }); }
  leave(player: P2Player) { for (const k of this.held.keys()) if (k.startsWith(`${player.id}\u0000`)) this.held.delete(k); }
}

/* The build's rooms on a machine share this module: one World a world room, by its id. */
const worlds = new Map<string, World>();
export function worldOf(room: P2World, key = KEY, now?: () => number): World {
  let w = worlds.get(room.id);
  if (!w || w.key !== key) { w = new World(room, key, now); worlds.set(room.id, w); }
  w.room = room;
  return w;
}
export const onCreate = (room: P2World) => { worldOf(room); };
export const onStart = (room: P2World) => { worldOf(room); };
export const onJoin = (room: P2World, player: P2Player) => worldOf(room).join(player);
export const onMessage = (room: P2World, player: P2Player, type: string, data: unknown) => worldOf(room).message(player, type, data);
export const onLeave = (room: P2World, player: P2Player) => worldOf(room).leave(player);
export const onTick = (_room: P2World) => {};
