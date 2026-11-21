/* The economy's calls from the page: to Impact's economy world on PlayerTwo (src/p2world: p2.rooms.world('economy'), a
 * room kept for good, its accounts in its own store) over the world's socket, or to the match server's economy over HTTP. Every caller (the shop's account, progress, the Forge,
 * RANKED, the match rooms' pass and pay) posts through `economyPost` and reads { status, body } as HTTP answers it.
 *
 * Which, by VITE_P2_ECONOMY (built in):
 *   off   HTTP to the match server.
 *   auto  (the default) inside PlayerTwo's player, the world once it says it is open (the operator opens it when the
 *         import is checked); until then, and outside PlayerTwo, HTTP. A world that can't be reached sends a call to
 *         HTTP. So the cut-over needs no client release: the world's open note is the switch.
 *   world inside PlayerTwo, the world only (no match server): a call it can't make fails as one to a server that is down.
 * `?economy=http` in the address: this page asks the match server.
 *
 * The world is joined when there is a call and left after IDLE_MS without one (a world's area seats 256: a page holds a
 * seat only while it talks to the economy). Identity is the seat's: PlayerTwo's id for the player, trusted by the world;
 * the page's token still goes with each call, for a guest's account. A call is { id, path, body } (`$eco`), its answer
 * the same id; a body over one message (16 KB) goes in parts. A world moved on to a newer build closes with "update":
 * the page is out of date, and its calls fail until it reloads (the game says so as it does for a server restart). */
import { playerTwo, inPlayerTwo } from '../boot/playerTwo';
import { economyServer } from '../ui/shop/account';

export interface Answer { status: number; body: unknown }
/** What of the SDK's room the economy's link uses. */
export interface WorldRoom {
  send(type: string, data?: unknown): void;
  on(event: string, fn: (...args: unknown[]) => void): unknown;
  leave(): void;
}
export type JoinWorld = () => Promise<WorldRoom>;

/** A world call's longest wait, a page's idle seat, and a message's most (PlayerTwo's 16 KB, less the envelope). */
const CALL_MS = 8000, IDLE_MS = 30_000, PART = 12_000;
/** After the world says it isn't open, how long the page asks the match server before it asks the world again. */
const RECHECK_MS = 60_000;

/** One page's line to the economy world: joined on a call, left when idle; requests by id. */
export class WorldLink {
  private room?: Promise<WorldRoom>;
  private n = 0;
  private readonly waiting = new Map<number, { type: string; resolve: (data: Record<string, unknown>) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private idle?: ReturnType<typeof setTimeout>;
  /** The world's word as the page came in ($open), and whether it moved on to a build newer than this page's. */
  open?: boolean;
  outdated = false;
  constructor(private readonly join: JoinWorld, private readonly idleMs = IDLE_MS) {}

  private connect(): Promise<WorldRoom> {
    if (this.outdated) return Promise.reject(Object.assign(new Error('Impact was updated. Reload the game.'), { code: 'update' }));
    return this.room ??= this.join().then(room => {
      room.on('message', (type: unknown, data: unknown) => this.heard(String(type), data));
      room.on('close', (why: unknown) => {
        if (why === 'update') this.outdated = true;
        this.room = undefined;
        for (const [id, w] of this.waiting) { clearTimeout(w.timer); this.waiting.delete(id); w.reject(Object.assign(new Error(why === 'update' ? 'Impact was updated. Reload the game.' : 'The connection to the shop dropped.'), { code: String(why) })); }
      });
      return room;
    }, error => { this.room = undefined; throw error; });
  }
  private heard(type: string, data: unknown) {
    const m = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
    if (type === '$open') { this.open = m.open === true; return; }
    const w = typeof m.id === 'number' ? this.waiting.get(m.id) : undefined;
    if (!w || w.type !== type) return;
    clearTimeout(w.timer); this.waiting.delete(m.id as number);
    w.resolve(m);
    this.rest();
  }
  /** Left after a while with nothing asked (the seat back to the world's 256). */
  private rest() {
    clearTimeout(this.idle);
    if (this.waiting.size) return;
    this.idle = setTimeout(() => { if (this.waiting.size || !this.room) return; const was = this.room; this.room = undefined; void was.then(room => room.leave(), () => {}); }, this.idleMs);
  }

  /** One message and its answer (the same id, the same type back). */
  async ask(type: string, data: Record<string, unknown>, ms = CALL_MS): Promise<Record<string, unknown>> {
    const room = await this.connect(), id = ++this.n;
    clearTimeout(this.idle);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.waiting.delete(id); this.rest(); reject(Object.assign(new Error('The shop did not answer.'), { code: 'timeout' })); }, ms);
      this.waiting.set(id, { type, resolve, reject, timer });
      try { room.send(type, { ...data, id }); } catch (error) { clearTimeout(timer); this.waiting.delete(id); reject(error as Error); }
    });
  }
  /** A route of the economy, answered as HTTP would answer it. */
  async call(path: string, body: unknown, ms = CALL_MS): Promise<Answer> {
    const text = JSON.stringify(body ?? {});
    let answer: Record<string, unknown>;
    if (text.length <= PART) answer = await this.ask('$eco', { path, body: body ?? {} }, ms);
    else {
      /* in parts: the world runs it once the last is in, and answers that id once */
      const room = await this.connect(), id = ++this.n, of = Math.ceil(text.length / PART);
      answer = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { this.waiting.delete(id); this.rest(); reject(Object.assign(new Error('The shop did not answer.'), { code: 'timeout' })); }, ms);
        this.waiting.set(id, { type: '$eco', resolve, reject, timer });
        try { for (let part = 0; part < of; part++) room.send('$eco', { id, path, part, of, text: text.slice(part * PART, (part + 1) * PART) }); }
        catch (error) { clearTimeout(timer); this.waiting.delete(id); reject(error as Error); }
      });
    }
    return { status: typeof answer.status === 'number' ? answer.status : 500, body: answer.body };
  }
  close() { clearTimeout(this.idle); const was = this.room; this.room = undefined; void was?.then(room => room.leave(), () => {}); }
}

type Mode = 'off' | 'auto' | 'world';
const env = (typeof import.meta !== 'undefined' ? (import.meta as { env?: Record<string, string | undefined> }).env : undefined) ?? {};
const MODE: Mode = env.VITE_P2_ECONOMY === 'off' || env.VITE_P2_ECONOMY === 'world' ? env.VITE_P2_ECONOMY : 'auto';
const forcedHttp = () => typeof location === 'object' && new URLSearchParams(location.search).get('economy') === 'http';

let link: WorldLink | undefined;
let notOpenUntil = 0;
/** The page's line to the world, when this page may use it. */
async function worldLink(): Promise<WorldLink | undefined> {
  if (MODE === 'off' || forcedHttp() || !inPlayerTwo()) return undefined;
  if (link) return link;
  const api = await playerTwo() as unknown as { rooms?: { world?(name: string, options?: Record<string, unknown>): Promise<WorldRoom> } } | undefined;
  const world = api?.rooms?.world;
  if (typeof world !== 'function') return undefined;
  return link ??= new WorldLink(() => world.call(api!.rooms, 'economy'));
}

/** HTTP to the match server's economy. */
export async function httpPost(path: string, body: unknown, ms = 5000): Promise<Answer> {
  const ranked = path === 'ranked';
  const response = await fetch(ranked ? `${economyServer()}/ball/ranked` : `${economyServer()}/api/economy/${path}`, {
    method: 'POST', headers: { 'content-type': ranked ? 'text/plain' : 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(ms),
  });
  let json: unknown;
  try { json = await response.json(); } catch { json = undefined; }
  return { status: response.status, body: json };
}

/** An economy call: to the world inside PlayerTwo when it is on and open (VITE_P2_ECONOMY), to the match server otherwise.
 *  Throws when neither can be reached (as fetch does). */
export async function economyPost(path: string, body: unknown, ms = 5000): Promise<Answer> {
  const world = Date.now() >= notOpenUntil || MODE === 'world' ? await worldLink() : undefined;
  if (world) {
    try {
      const answer = await world.call(path, body, Math.max(ms, CALL_MS));
      const notOpen = answer.status === 503 && !!(answer.body as Record<string, unknown> | undefined)?.['not-open'];
      if (!notOpen || MODE === 'world') return answer;
      notOpenUntil = Date.now() + RECHECK_MS;
      world.close();
    } catch (error) { if (MODE === 'world') throw error; }
  }
  return httpPost(path, body, ms);
}
/** Which way this page's economy calls go now (for the game's evidence and tests). */
export const economyRoute = () => ({ mode: MODE, world: !!link && Date.now() >= notOpenUntil, open: link?.open, outdated: link?.outdated ?? false });

/* The operator's tools, in PlayerTwo's player with ?economy-import in the game's address: a file button for the import
   (p2EconomyImport.ts), and window.__economyAdmin(note) for a signed note (open, rooms, codes, grant). Neither needs a
   key in the page: the world checks the signatures. */
if (typeof location === 'object' && typeof document === 'object' && new URLSearchParams(location.search).has('economy-import')) void (async () => {
  const api = await playerTwo() as unknown as { rooms?: { world?(name: string): Promise<WorldRoom> } } | undefined;
  const rooms = api?.rooms, world = rooms?.world;
  if (!rooms || typeof world !== 'function') return;
  const admin = new WorldLink(() => world.call(rooms, 'economy'), 600_000);
  const { importEconomy } = await import('./p2EconomyImport');
  const pick = Object.assign(document.createElement('input'), { type: 'file', accept: '.json', title: 'Import the economy (migrate.mts file)' });
  pick.style.cssText = 'position:fixed;left:8px;top:8px;z-index:2147483647;background:#fff;color:#000;font:12px monospace';
  pick.onchange = async () => {
    const file = pick.files?.[0]; if (!file) return;
    const report = await importEconomy(admin, JSON.parse(await file.text()), line => console.log('[economy-import]', line)).catch((error: Error) => ({ error: error.message }));
    console.log('[economy-import]', JSON.stringify(report));
    (globalThis as { __economyImport?: unknown }).__economyImport = report;
  };
  document.body.append(pick);
  (globalThis as { __economyAdmin?: unknown }).__economyAdmin = (note: string) => admin.call('admin', { note }, 15_000);
})();
