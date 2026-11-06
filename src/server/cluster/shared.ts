/** Colyseus's presence and room listing, shared across the cluster's processes through the primary (link.ts).
 *
 *  Several Colyseus processes find each other's rooms and pass seat reservations through a shared presence (pub/sub and
 *  a few Redis-like keys) and a shared matchmaker driver (the room listing). Colyseus ships Redis versions of both; here
 *  the primary keeps the state instead - presence in Colyseus's own LocalPresence, the listing in a hash of JSON - and
 *  every process reaches it over IPC. The driver mirrors @colyseus/redis-driver line for line (the listing is copies,
 *  never shared objects: LocalDriver's in-place updates only work inside one process). */
import { LocalPresence, initializeRoomCache, type IRoomCache, type MatchMakerDriver, type Presence, type SortOptions } from 'colyseus';
import { Query } from '@colyseus/redis-driver/Query';
import type { Link } from './link';

/** The child's presence: every call is the primary's LocalPresence's, over the link. */
export class LinkPresence implements Presence {
  /** The callbacks Colyseus subscribed, so `unsubscribe(topic, callback)` removes the right one. */
  private readonly callbacks = new Map<Function, (data: unknown) => void>();
  constructor(private readonly link: Link) {}
  private call<T>(m: string, ...a: unknown[]) { return this.link.call<T>('presence', m, a); }

  async subscribe(topic: string, callback: Function) {
    const listener = (data: unknown) => callback(data);
    this.callbacks.set(callback, listener);
    this.link.subscribe(topic, listener);
    // (Answered once the primary has the subscription: the link keeps order, so a publish sent after this resolves -
    // from any process - reaches it. Colyseus awaits it before publishing a request it expects a reply to.)
    await this.call('ping');
    return this;
  }
  unsubscribe(topic: string, callback?: Function) {
    const listener = callback ? this.callbacks.get(callback) : undefined;
    if (callback) this.callbacks.delete(callback);
    this.link.unsubscribe(topic, listener);
    if (callback && !listener) return this; // never subscribed here: nothing to take back
    return this;
  }
  publish(topic: string, data: unknown) { this.link.publish(topic, data); return this; }
  channels(pattern?: string) { return this.call<string[]>('channels', pattern); }
  exists(key: string) { return this.call<boolean>('exists', key); }
  set(key: string, value: string) { return this.call('set', key, value); }
  setex(key: string, value: string, seconds: number) { return this.call('setex', key, value, seconds); }
  expire(key: string, seconds: number) { return this.call('expire', key, seconds); }
  get(key: string) { return this.call('get', key); }
  del(key: string) { void this.call('del', key); }
  sadd(key: string, value: unknown) { return this.call('sadd', key, value); }
  smembers(key: string) { return this.call<string[]>('smembers', key); }
  sismember(key: string, field: string) { return this.call('sismember', key, field); }
  srem(key: string, value: unknown) { return this.call('srem', key, value); }
  scard(key: string) { return this.call('scard', key); }
  sinter(...keys: string[]) { return this.call<string[]>('sinter', ...keys); }
  hset(key: string, field: string, value: string) { return this.call<boolean>('hset', key, field, value); }
  hincrby(key: string, field: string, value: number) { return this.call<number>('hincrby', key, field, value); }
  hincrbyex(key: string, field: string, value: number, expireInSeconds: number) { return this.call<number>('hincrbyex', key, field, value, expireInSeconds); }
  hget(key: string, field: string) { return this.call<string | null>('hget', key, field); }
  hgetall(key: string) { return this.call<{ [key: string]: string }>('hgetall', key); }
  hdel(key: string, field: string) { return this.call<boolean>('hdel', key, field); }
  hlen(key: string) { return this.call<number>('hlen', key); }
  incr(key: string) { return this.call<number>('incr', key); }
  decr(key: string) { return this.call<number>('decr', key); }
  llen(key: string) { return this.call<number>('llen', key); }
  rpush(key: string, ...values: string[]) { return this.call<number>('rpush', key, ...values); }
  lpush(key: string, ...values: string[]) { return this.call<number>('lpush', key, ...values); }
  rpop(key: string) { return this.call<string | null>('rpop', key); }
  lpop(key: string) { return this.call<string | null>('lpop', key); }
  brpop(...args: [...keys: string[], timeoutInSeconds: number]) { return this.call<[string, string] | null>('brpop', ...args); }
  setMaxListeners(_n: number) { /* the link's listeners are a plain set */ }
  shutdown() { /* the primary's state outlives a child */ }
}

const ROOMCACHES = 'roomcaches';
/** The child's room listing: @colyseus/redis-driver's logic, its hash held by the primary. */
export class LinkDriver implements MatchMakerDriver {
  private byName: Record<string, Promise<IRoomCache[]> | undefined> = {};
  private all?: Promise<Record<string, string>>;
  constructor(private readonly link: Link) {}
  private store<T>(m: string, ...a: unknown[]) { return this.link.call<T>('store', m, a); }

  async has(roomId: string) { return await this.store<boolean>('hexists', ROOMCACHES, roomId); }
  async query(conditions: Partial<IRoomCache>, sortOptions?: SortOptions) {
    const query = new Query(this.rooms(), conditions as never);
    if (sortOptions) query.sort(sortOptions);
    return query.all() as Promise<IRoomCache[]>;
  }
  async cleanup(processId: string) {
    const stale = await this.query({ processId });
    if (stale.length) await this.store('hdel', ROOMCACHES, ...stale.map(room => room.roomId));
  }
  async findByIds(roomIds: string[]) {
    const found = new Map<string, IRoomCache>();
    if (!roomIds.length) return found;
    const values = await this.store<(string | null)[]>('hmget', ROOMCACHES, ...roomIds);
    roomIds.forEach((id, i) => { const raw = values[i]; if (raw) found.set(id, initializeRoomCache(JSON.parse(raw))); });
    return found;
  }
  findOne(conditions: Partial<IRoomCache>, sortOptions?: SortOptions): Promise<IRoomCache> {
    if (conditions.roomId !== undefined) {
      return this.store<string | null>('hget', ROOMCACHES, conditions.roomId).then(raw => (raw ? initializeRoomCache(JSON.parse(raw)) : undefined) as IRoomCache);
    }
    const query = new Query(this.rooms(conditions.name), conditions as never);
    if (sortOptions) query.sort(sortOptions);
    return query as unknown as Promise<IRoomCache>;
  }
  /** Every listing (of one room name), one fetch shared by the calls that arrive while it is out - as RedisDriver does. */
  private rooms(name?: string): Promise<IRoomCache[]> {
    const key = name ?? '';
    const pending = this.byName[key]; if (pending) return pending;
    const all = this.all ??= this.store<Record<string, string>>('hgetall', ROOMCACHES);
    return this.byName[key] = all.then(result => {
      this.all = undefined; delete this.byName[key];
      let entries = Object.values(result ?? {});
      if (name !== undefined) { const field = `"name":${JSON.stringify(name)}`; entries = entries.filter(raw => raw.includes(field)); }
      return entries.map(raw => initializeRoomCache(JSON.parse(raw)));
    }, error => { this.all = undefined; delete this.byName[key]; throw error; });
  }
  async update(room: IRoomCache, operations: Partial<{ $set: Partial<IRoomCache>; $inc: Partial<IRoomCache> }>) {
    const target = room as unknown as Record<string, unknown>;
    for (const [field, value] of Object.entries(operations.$set ?? {})) target[field] = value;
    for (const [field, value] of Object.entries(operations.$inc ?? {})) target[field] = (target[field] as number) + (value as number);
    await this.store('hset', ROOMCACHES, room.roomId, JSON.stringify(room));
    return true;
  }
  async persist(room: IRoomCache, _create = false) {
    if (!room.roomId) return false;
    await this.store('hset', ROOMCACHES, room.roomId, JSON.stringify(room));
    return true;
  }
  async remove(roomId: string) { return (await this.store<number>('hdel', ROOMCACHES, roomId)) > 0; }
  async clear() { await this.store('del', ROOMCACHES); }
  shutdown() { /* the primary's listing outlives a child */ }
}

/** The primary's end: Colyseus's LocalPresence for presence, and a Redis-like hash store for the listing. */
export class SharedState {
  readonly presence = new LocalPresence();
  private readonly hashes = new Map<string, Map<string, string>>();
  private hash(key: string) { let h = this.hashes.get(key); if (!h) this.hashes.set(key, h = new Map()); return h; }

  /** A presence call from a child (subscriptions and publishing travel as their own messages). */
  async presenceCall(method: string, args: unknown[]): Promise<unknown> {
    if (method === 'ping') return true;
    if (!PRESENCE_METHODS.has(method)) throw new Error(`presence has no ${method}`);
    return await (this.presence as unknown as Record<string, (...a: unknown[]) => unknown>)[method](...args);
  }
  /** A listing call: the handful of hash commands RedisDriver uses, with Redis's answers. */
  storeCall(method: string, args: unknown[]): unknown {
    const [key, ...rest] = args as [string, ...string[]];
    switch (method) {
      case 'hexists': return this.hashes.get(key)?.has(rest[0]) ?? false;
      case 'hget': return this.hashes.get(key)?.get(rest[0]) ?? null;
      case 'hmget': return rest.map(field => this.hashes.get(key)?.get(field) ?? null);
      case 'hgetall': return Object.fromEntries(this.hashes.get(key) ?? []);
      case 'hset': { const h = this.hash(key), fresh = !h.has(rest[0]); h.set(rest[0], rest[1]); return fresh ? 1 : 0; }
      case 'hdel': { const h = this.hashes.get(key); let n = 0; for (const field of rest) if (h?.delete(field)) n++; return n; }
      case 'del': return this.hashes.delete(key) ? 1 : 0;
      default: throw new Error(`store has no ${method}`);
    }
  }
  /** The listings a process left behind when it ended (the primary saw it go: no health check needed to find out). */
  forgetProcess(processId: string) {
    const listing = this.hashes.get(ROOMCACHES);
    for (const [roomId, raw] of listing ?? []) if (raw.includes(`"processId":${JSON.stringify(processId)}`)) listing!.delete(roomId);
  }
}
const PRESENCE_METHODS = new Set(['channels', 'exists', 'set', 'setex', 'expire', 'get', 'del', 'sadd', 'smembers', 'sismember', 'srem', 'scard', 'sinter',
  'hset', 'hincrby', 'hincrbyex', 'hget', 'hgetall', 'hdel', 'hlen', 'incr', 'decr', 'llen', 'rpush', 'lpush', 'rpop', 'lpop', 'brpop']);
