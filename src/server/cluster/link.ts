
export type CallKind = 'presence' | 'store' | 'rpc';
/** What a child sends the primary. */
export type Up =
  | { t: 'q'; id: number; k: CallKind; m: string; a: unknown[] }
  | { t: 'r'; id: number; ok: boolean; v?: unknown; e?: WireError }
  | { t: 'sub' | 'unsub'; topic: string }
  | { t: 'pub'; topic: string; data: unknown }
  | { t: 'hello'; role: ClusterRole; index: number; processId: string; port: number };
/** What the primary sends a child. */
export type Down =
  | { t: 'r'; id: number; ok: boolean; v?: unknown; e?: WireError }
  | { t: 'q'; id: number; k: 'rpc'; m: string; a: unknown[] }
  | { t: 'ev'; topic: string; data: unknown };
export interface WireError { message: string; code?: number | string }
export type ClusterRole = 'control' | 'rooms';

/** An error as it crosses: its words and its code (Colyseus's ServerError carries one), never its stack. */
export const toWire = (error: unknown): WireError => {
  const e = error as { message?: unknown; code?: unknown } | undefined;
  const message = typeof e?.message === 'string' ? e.message : String(error);
  return typeof e?.code === 'number' || typeof e?.code === 'string' ? { message, code: e.code } : { message };
};
export const fromWire = (wire: WireError | undefined) => Object.assign(new Error(wire?.message ?? 'cluster call failed'), wire?.code !== undefined ? { code: wire.code } : {});

type Send = (message: Up) => void;
type Receive = (listener: (message: Down) => void) => void;

/** The child's end of the channel. `send`/`receive` are the process's own (`process.send`, `process.on('message')`);
 *  a test passes a pair of its own. */
export class Link {
  private next = 1;
  private readonly waiting = new Map<number, { resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
  private readonly listeners = new Map<string, Set<(data: unknown) => void>>();
  /** Control's answers to the others' calls (economy, ops), by method. */
  private readonly handlers = new Map<string, (...args: unknown[]) => unknown>();

  constructor(private readonly send: Send, receive: Receive) {
    receive(message => {
      if (message.t === 'r') {
        const call = this.waiting.get(message.id); if (!call) return;
        this.waiting.delete(message.id); clearTimeout(call.timer);
        if (message.ok) call.resolve(message.v); else call.reject(fromWire(message.e));
      } else if (message.t === 'ev') {
        // (A copy of the set: a listener that unsubscribes as it runs - Colyseus's IPC replies do - must not skip the next.)
        for (const listener of [...this.listeners.get(message.topic) ?? []]) {
          try { listener(message.data); } catch (error) { console.error(`[cluster] a listener of ${message.topic} threw`, error); }
        }
      } else if (message.t === 'q') void this.answer(message);
    });
  }

  /** A call answered by the primary (presence, store) or by control (rpc). Rejects after `timeoutMs`. */
  call<T = unknown>(k: CallKind, m: string, a: unknown[] = [], timeoutMs = 10_000): Promise<T> {
    const id = this.next++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => { this.waiting.delete(id); reject(new Error(`cluster ${k} ${m} timed out`)); }, timeoutMs);
      timer.unref?.();
      this.waiting.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });
      try { this.send({ t: 'q', id, k, m, a }); } catch (error) { this.waiting.delete(id); clearTimeout(timer); reject(error as Error); }
    });
  }
  /** Delivered every message published on `topic`, from any process. The first listener of a topic tells the primary. */
  subscribe(topic: string, listener: (data: unknown) => void) {
    let set = this.listeners.get(topic);
    if (!set) { this.listeners.set(topic, set = new Set()); this.send({ t: 'sub', topic }); }
    set.add(listener);
  }
  unsubscribe(topic: string, listener?: (data: unknown) => void) {
    const set = this.listeners.get(topic); if (!set) return;
    if (listener) set.delete(listener); else set.clear();
    if (!set.size) { this.listeners.delete(topic); this.send({ t: 'unsub', topic }); }
  }
  publish(topic: string, data: unknown) { this.send({ t: 'pub', topic, data }); }
  hello(role: ClusterRole, index: number, processId: string, port: number) { this.send({ t: 'hello', role, index, processId, port }); }

  /** Control only: answer `method` for the room processes. */
  handle(method: string, run: (...args: unknown[]) => unknown) { this.handlers.set(method, run); }
  private async answer(message: Extract<Down, { t: 'q' }>) {
    const run = this.handlers.get(message.m);
    try {
      if (!run) throw new Error(`no handler for ${message.m}`);
      this.send({ t: 'r', id: message.id, ok: true, v: await run(...message.a) });
    } catch (error) { this.send({ t: 'r', id: message.id, ok: false, e: toWire(error) }); }
  }
}

let link: Link | undefined;
/** This process's link, when it is a child of the cluster's primary (CLUSTER_ROLE set); otherwise none. */
export function clusterLink(): Link | undefined {
  if (link || !process.send || !process.env.CLUSTER_ROLE) return link;
  const send = process.send.bind(process);
  link = new Link(message => { send(message); }, listener => { process.on('message', message => listener(message as Down)); });
  return link;
}
export const clusterRole = (): ClusterRole | undefined => process.env.CLUSTER_ROLE === 'control' || process.env.CLUSTER_ROLE === 'rooms' ? process.env.CLUSTER_ROLE : undefined;
/** This room process's place among the room processes, 1 to `clusterSize()`; 0 outside the cluster or in control. */
export const clusterIndex = () => clusterRole() === 'rooms' ? Number(process.env.CLUSTER_INDEX) || 0 : 0;
/** How many room processes the cluster runs; 0 outside it. */
export const clusterSize = () => clusterRole() ? Number(process.env.CLUSTER_SIZE) || 0 : 0;
