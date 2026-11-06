import type { IRoomCache } from 'colyseus';

export const QUEUE_MODES = ['royale', 'duel', 'last-stand', 'bad-blood', 'rift-war', 'arcade'] as const;
export type QueueMode = typeof QUEUE_MODES[number];
export type PageAt = 'home' | 'local' | 'standby';
export interface ModeCount { queue: number; playing: number; standby: number }
export interface PopulationView { online: number; modes: Record<QueueMode, ModeCount>; at: number }

/** The room listing is read at most this often; every answer in between is the cached one. */
export const CACHE_MS = 3000;
/** A page's beat lasts this long (the home beats every 30 s, a device match every 45 s, a standby every 5 s). */
export const PAGE_MS = 70_000;
/** At most this many pages are remembered (a flood of made-up ids is not let grow memory). */
export const PAGE_CAP = 50_000;
/** A standby beats every 5 s: one not heard from in this long has gone (its player left the match), and holds nothing. */
export const STANDBY_MS = 15_000;

const isMode = (mode: unknown): mode is QueueMode => (QUEUE_MODES as readonly unknown[]).includes(mode);
const empty = (): Record<QueueMode, ModeCount> => Object.fromEntries(QUEUE_MODES.map(mode => [mode, { queue: 0, playing: 0, standby: 0 }])) as Record<QueueMode, ModeCount>;

/** What the room listing says: the people in rooms, and for each mode those still queued and those playing. */
export function countRooms(rooms: readonly Pick<IRoomCache, 'name' | 'clients' | 'locked' | 'private' | 'metadata'>[]) {
  const modes = empty(); let inRooms = 0;
  for (const room of rooms) {
    // (A party's members are in its lobby and in their match at once, or on the home, beating as pages: never counted here.)
    if (room.name === 'party') continue;
    const clients = Math.max(0, Math.min(64, room.clients | 0)), meta = (room.metadata ?? {}) as Record<string, unknown>;
    inRooms += clients;
    let mode: QueueMode | undefined, open = false;
    if (room.name === 'arena' && meta.mode === 'match' && !room.private) { mode = 'royale'; open = !room.locked; }
    else if (room.name === 'bot_arena' || room.name === 'private_arena') mode = 'royale';
    else if (room.name === 'duel_arena') { mode = 'duel'; open = !room.locked && clients < 2; }
    else if (room.name === 'private_duel') mode = 'duel';
    else if (room.name === 'objective_arena' && isMode(meta.objective)) { mode = meta.objective; open = meta.access === 'quick' && !room.locked; }
    else if (room.name === 'rift_war') { mode = 'rift-war'; open = meta.access === 'quick' && !room.locked; }
    else if (room.name === 'survival_arena') { mode = 'arcade'; open = meta.visibility === 'public' && !room.locked; }
    if (!mode) continue;
    modes[mode][open ? 'queue' : 'playing'] += clients;
  }
  return { inRooms, modes };
}

export class Population {
  private readonly pages = new Map<string, { at: number; where: PageAt; mode?: QueueMode }>();
  private cached?: { at: number; view: PopulationView };
  private pending?: Promise<PopulationView>;
  constructor(private readonly rooms: () => Promise<readonly IRoomCache[]>, private readonly now: () => number = Date.now) {}
  /** A page's beat: `page` its own random id, `where` it is, `mode` the mode of its device match. Anything else is ignored. */
  beat(page: unknown, where: unknown, mode?: unknown) {
    if (typeof page !== 'string' || !/^[A-Za-z0-9-]{8,40}$/.test(page) || (where !== 'home' && where !== 'local' && where !== 'standby')) return;
    if (!this.pages.has(page) && this.pages.size >= PAGE_CAP) { this.prune(); if (this.pages.size >= PAGE_CAP) return; }
    this.pages.set(page, { at: this.now(), where, ...(isMode(mode) && where !== 'home' ? { mode } : {}) });
  }
  /** The counts, as of at most CACHE_MS ago. A listing that cannot be read leaves the last one standing (or none). */
  view(): Promise<PopulationView> {
    const now = this.now();
    if (this.cached && now - this.cached.at < CACHE_MS) return Promise.resolve(this.cached.view);
    this.pending ??= this.rooms().then(rooms => this.count(rooms), () => this.count([])).finally(() => { this.pending = undefined; });
    return this.pending;
  }
  private count(rooms: readonly IRoomCache[]): PopulationView {
    const now = this.now(), { inRooms, modes } = countRooms(rooms);
    this.prune();
    let pages = 0;
    for (const page of this.pages.values()) {
      pages++;
      if (!page.mode) continue;
      modes[page.mode].playing++;
      if (page.where === 'standby' && now - page.at < STANDBY_MS) modes[page.mode].standby++;
    }
    const view: PopulationView = { online: inRooms + pages, modes, at: now };
    this.cached = { at: now, view };
    return view;
  }
  private prune() { const old = this.now() - PAGE_MS; for (const [id, page] of this.pages) if (page.at < old) this.pages.delete(id); }
}

type Req = { query?: Record<string, unknown> };
type Res = { setHeader(k: string, v: string): void; json(body: unknown): unknown; status(code: number): { json(body: unknown): unknown } };
/** `GET /population?page=&at=&mode=` on the match server (control, or the one process). */
export function mountPopulation(app: { get(path: string, handler: (req: Req, res: Res) => void): unknown }, population: Population) {
  app.get('/population', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Cache-Control', 'no-store');
    const q = req.query ?? {};
    population.beat(q.page, q.at, q.mode);
    void population.view().then(view => res.json(view), () => res.status(503).json({}));
  });
}
