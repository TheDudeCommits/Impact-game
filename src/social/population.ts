export const QUEUE_MODES = ['royale', 'duel', 'last-stand', 'bad-blood', 'rift-war', 'arcade'] as const;
export type QueueMode = typeof QUEUE_MODES[number];
export interface ModeCount { queue: number; playing: number; standby: number }
export interface PopulationView { online: number; modes: Record<QueueMode, ModeCount>; at: number }
/** Where the page is: the home; a match on this device (of a mode, if it is one); such a match on standby for its mode's
 *  queue (social/standby.ts); alone in an online queue (its room may hold for a standby, QueueHold); any other room. */
export type PageWhere = { at: 'home' } | { at: 'local' | 'standby'; mode?: QueueMode } | { at: 'queue'; mode: QueueMode } | { at: 'room' } | { at: 'away' };

/** How often each kind of page asks (ms): the home's count can be half a minute old; a standby's challenger cannot. */
export const PERIOD = { home: 30_000, local: 45_000, standby: 5000, queue: 3000, dock: 4000 } as const;

const server = () => {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
  return (env.VITE_MATCH_SERVER || `${location.protocol === 'https:' ? 'https' : 'http'}://${location.hostname}:2567`).replace(/^ws/, 'http').replace(/\/+$/, '');
};
const randomId = () => { try { return crypto.randomUUID(); } catch { return `p-${Math.random().toString(36).slice(2, 14)}${Date.now().toString(36)}`; } };

/** A view the page can trust: numbers where numbers belong (anything else reads as none). */
export function readView(raw: unknown): PopulationView | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const { online, modes, at } = raw as Partial<PopulationView>;
  if (typeof online !== 'number' || !modes || typeof modes !== 'object') return undefined;
  const n = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
  return { online: n(online), at: n(at), modes: Object.fromEntries(QUEUE_MODES.map(mode => { const m = (modes as Record<string, Partial<ModeCount>>)[mode] ?? {}; return [mode, { queue: n(m.queue), playing: n(m.playing), standby: n(m.standby) }]; })) as Record<QueueMode, ModeCount> };
}

export class PopulationLink {
  view?: PopulationView;
  /** Where the page is (main.ts says; until it does, the home). */
  where: () => PageWhere = () => ({ at: 'home' });
  /** The waiting dock is up (WaitingDock): its counts every PERIOD.dock. */
  dock = false;
  private readonly id = randomId();
  private readonly listeners = new Set<(view: PopulationView | undefined) => void>();
  private last = -Infinity;
  private asking = false;
  private timer: ReturnType<typeof setInterval> | undefined;
  constructor(private readonly fetcher: (url: string) => Promise<unknown> = url => fetch(url, { signal: AbortSignal.timeout(5000) }).then(r => r.ok ? r.json() : undefined), private readonly url = server) {}
  /** Heard on every answer (and undefined when the server has no counts). */
  on(listener: (view: PopulationView | undefined) => void) { this.listeners.add(listener); if (this.view) listener(this.view); return () => this.listeners.delete(listener); }
  /** The page's ask, once a second at most, as often as where it is wants. */
  start() { if (this.timer || typeof window !== 'object') return; this.timer = setInterval(() => void this.tick(), 1000); void this.tick(); }
  stop() { clearInterval(this.timer); this.timer = undefined; }
  /** Asks now if it is time (or `force`): true when it asked. */
  async tick(force = false, now = performance.now()): Promise<boolean> {
    if (this.asking || typeof document === 'object' && document.hidden) return false;
    const where = this.where(), period = this.period(where);
    if (!force && now - this.last < period) return false;
    this.asking = true; this.last = now;
    try {
      const at = where.at === 'home' || where.at === 'local' || where.at === 'standby' ? where.at : undefined;
      const mode = where.at === 'local' || where.at === 'standby' ? where.mode : undefined;
      const query = `?page=${encodeURIComponent(this.id)}${at ? `&at=${at}` : ''}${mode ? `&mode=${mode}` : ''}`;
      this.view = readView(await this.fetcher(`${this.url()}/population${query}`).catch(() => undefined));
      for (const listener of this.listeners) listener(this.view);
    } finally { this.asking = false; }
    return true;
  }
  private period(where: PageWhere): number {
    if (where.at === 'queue') return PERIOD.queue;
    if (where.at === 'room') return this.dock ? PERIOD.dock : Infinity;
    if (where.at === 'away') return Infinity;
    return where.at === 'standby' ? PERIOD.standby : where.at === 'local' ? PERIOD.local : this.dock ? PERIOD.dock : PERIOD.home;
  }
}
/** The page's one link. */
export const population = new PopulationLink();
