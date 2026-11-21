/* The economy world's storage: PlayerTwo's room.store (a scripted world's own key-value store, kept for good through
 * every new build: workers/rooms/runtime/script/harness.js, ctx.storage.kv), as the economy's book uses it.
 *
 * room.store is synchronous: get, set (null or undefined deletes), delete, keys(prefix, limit) in key order (at most
 * `limit`, 1000 by default; no "after"). A key is at most 512 characters. Values are structured clones (plain JSON
 * here). Writes made in one call with no await between them are written together (a Durable Object coalesces them),
 * so every change of the economy is made after its last await (economy.ts). MemoryKV is the same in memory, sorted as
 * SQLite sorts keys, for the tests, the emulator and the dry run. */

export interface KV {
  get<T = unknown>(key: string): T | undefined;
  set(key: string, value: unknown): void;
  delete(key: string): void;
  keys(prefix?: string, limit?: number): string[];
}

/** PlayerTwo's room.store as a KV (its get answers undefined for a key it doesn't have). */
export function kvOf(store: { get(k: string): unknown; set(k: string, v: unknown): void; delete(k: string): void; keys(prefix?: string, limit?: number): string[] }): KV {
  return {
    get: <T>(key: string) => (store.get(key) ?? undefined) as T | undefined,
    set: (key, value) => store.set(key, value === undefined ? null : value),
    delete: key => store.delete(key),
    keys: (prefix = '', limit = 1000) => store.keys(prefix, limit),
  };
}

/** Every key under `prefix`, a thousand at a time (room.store has no "start after", so a listing is repeated as keys go;
 *  `drop` deletes each as it goes, which is what lets the next listing move on). */
export function dropAll(kv: KV, prefix: string): number {
  let n = 0;
  for (let batch = kv.keys(prefix, 1000); batch.length; batch = kv.keys(prefix, 1000)) {
    for (const key of batch) kv.delete(key);
    n += batch.length;
  }
  return n;
}

/** A KV in memory: keys sorted by their UTF-16 code units (as SQLite's BINARY collation sorts them; equal for the ASCII
 *  keys the book makes). Counts its reads and writes, for the measurements. */
export class MemoryKV implements KV {
  private readonly map = new Map<string, string>();
  /** The keys in order, kept so as they come and go (a sorted insert: no sort of the whole on a listing). */
  private readonly sorted: string[] = [];
  reads = 0;
  writes = 0;
  private at(key: string) { let lo = 0, hi = this.sorted.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (this.sorted[mid] < key) lo = mid + 1; else hi = mid; } return lo; }
  get<T = unknown>(key: string): T | undefined {
    this.reads++;
    const v = this.map.get(key);
    return v === undefined ? undefined : JSON.parse(v) as T;
  }
  set(key: string, value: unknown) {
    if (key.length > 512) throw new Error('room.store: a key is at most 512 characters');
    if (value === undefined || value === null) return this.delete(key);
    this.writes++;
    if (!this.map.has(key)) this.sorted.splice(this.at(key), 0, key);
    this.map.set(key, JSON.stringify(value));
  }
  delete(key: string) { this.writes++; if (this.map.delete(key)) this.sorted.splice(this.at(key), 1); }
  keys(prefix = '', limit = 1000): string[] {
    const out: string[] = [];
    for (let i = this.at(prefix); i < this.sorted.length && out.length < limit && this.sorted[i].startsWith(prefix); i++) out.push(this.sorted[i]);
    return out;
  }
  get size() { return this.map.size; }
  /** As PlayerTwo's room.store (for a harness stand-in). */
  asRoomStore() { return { get: (k: string) => this.get(k), set: (k: string, v: unknown) => this.set(k, v), delete: (k: string) => this.delete(k), keys: (p?: string, l?: number) => this.keys(p, l) }; }
}
