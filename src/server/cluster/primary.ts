import { fork, type ChildProcess } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import type { ClusterRole, Down, Up } from './link';
import { toWire } from './link';
import { SharedState } from './shared';
import { LOAD_KEY } from './placement';
import { describeError, type ServerErrorEvent } from '../ops/errorCounts';

export const REQUEST_TIMEOUT_MS = 30_000;
/** The longest the primary waits on the process behind it with nothing coming back before it answers 504 itself and
 *  frees the socket (a request without it waited as long as the process did, for ever if it hung). The slowest answers
 *  are a few seconds: a seat reservation (Colyseus gives each call between processes 2 s), Rift War's queue, a sign-in
 *  that fetches Privy's keys; the economy's write of its book stops control for 100-130 ms. */
export const UPSTREAM_TIMEOUT_MS = 30_000;

export interface Target { role: ClusterRole; index: number }
/** Where a request goes. A room socket names its process; Rift War's public queue lives with Rift War's rooms. */
export function routeOf(url: string, upgrade: boolean): { kind: 'process'; processId: string } | { kind: 'target'; target: Target } {
  const path = url.split('?')[0];
  if (upgrade) { const [, processId] = path.split('/'); return { kind: 'process', processId: processId ?? '' }; }
  if (path === '/rift-war/reserve') return { kind: 'target', target: { role: 'rooms', index: 1 } };
  return { kind: 'target', target: { role: 'control', index: 0 } };
}

/** Headers that belong to one hop, never passed on (RFC 9110, 7.6.1). */
const HOP = new Set(['connection', 'keep-alive', 'proxy-connection', 'te', 'trailer', 'upgrade']);
const passOn = (headers: http.IncomingHttpHeaders) => Object.fromEntries(Object.entries(headers).filter(([name]) => !HOP.has(name)));

interface Child { role: ClusterRole; index: number; proc: ChildProcess; port: number; processId?: string; topics: Map<string, (data: unknown) => void>; started: number }

export class Primary {
  readonly state = new SharedState();
  private readonly children = new Map<string, Child>();
  private readonly byProcessId = new Map<string, Child>();
  private readonly relays = new Map<number, { from: Child; id: number }>();
  private nextRelay = 1;
  private stopping = false;
  private ready = false;
  private controlFailures: number[] = [];
  private readonly agent = new http.Agent({ keepAlive: true, maxSockets: 256 });
  /** The public port is open (see `stray`). */
  private serving = false;
  /** The primary's own errors not yet passed to control, which counts them (control restarting, or not up yet). */
  private unsent: ServerErrorEvent[] = [];
  server?: http.Server;

  constructor(private readonly options: { port: number; roomWorkers: number; basePort: number; entry?: string; env?: NodeJS.ProcessEnv; log?: (line: string) => void;
    /** REQUEST_TIMEOUT_MS and UPSTREAM_TIMEOUT_MS, unless a test asks for less. */
    requestTimeoutMs?: number; upstreamTimeoutMs?: number }) {}
  private log(line: string) { (this.options.log ?? console.log)(`[cluster] ${line}`); }
  private key(role: ClusterRole, index: number) { return `${role}:${index}`; }

  async start() {
    process.on('uncaughtException', this.stray('uncaught exception'));
    process.on('unhandledRejection', this.stray('unhandled rejection'));
    this.spawn('control', 0);
    for (let i = 1; i <= this.options.roomWorkers; i++) this.spawn('rooms', i);
    await this.listen();
    this.serving = true;
    this.log(`primary on :${this.options.port}: control and ${this.options.roomWorkers} room process(es)`);
    for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => void this.stop(signal));
  }

  /** The public port, the proxy on it (start; a test opens it alone). */
  async listen() {
    const requestTimeout = this.options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS;
    this.server = http.createServer({ requestTimeout, headersTimeout: requestTimeout, connectionsCheckingInterval: Math.min(5_000, requestTimeout) }, (req, res) => this.request(req, res));
    this.server.on('upgrade', (req, socket, head) => this.upgrade(req, socket as net.Socket, head));
    this.server.keepAliveTimeout = 65_000;
    await new Promise<void>((resolve, reject) => { this.server!.once('error', reject); this.server!.listen(this.options.port, '0.0.0.0', () => resolve()); });
  }

  private stray(kind: string) {
    return (error: unknown) => {
      if (!this.serving) { console.error(`[cluster] ${kind} while starting:`, error); process.exit(1); }
      console.error(`[cluster] ${kind} in the primary; still serving:`, error);
      this.count({ at: Date.now(), kind: `primary ${kind}`, message: describeError(error) });
    };
  }
  /** One of the primary's own errors, to control's count (ops/errorCounts.ts; the rooms' come the same way). Kept, the
   *  last twenty, while control is not there to take them, and passed on when it is ready again. */
  private count(event: ServerErrorEvent) { this.unsent = [...this.unsent, event].slice(-20); this.flush(); }
  private flush() {
    const control = this.children.get(this.key('control', 0));
    if (!this.unsent.length || !control?.processId || !control.proc.connected) return;
    // (Its answer comes back under an id no relay holds, and is dropped: nothing waits on it.)
    for (const each of this.unsent.splice(0)) this.send(control, { t: 'q', id: this.nextRelay++, k: 'rpc', m: 'ops.serverError', a: [each] });
  }

  private spawn(role: ClusterRole, index: number) {
    const port = this.options.basePort + (role === 'control' ? 0 : index);
    const entry = this.options.entry ?? fileURLToPath(new URL('../index.ts', import.meta.url));
    const proc = fork(entry, [], { execArgv: process.execArgv, serialization: 'advanced',
      env: { ...process.env, ...this.options.env, CLUSTER_ROLE: role, CLUSTER_INDEX: String(index), CLUSTER_SIZE: String(this.options.roomWorkers), PORT: String(port) } });
    const child: Child = { role, index, proc, port, topics: new Map(), started: Date.now() };
    this.children.set(this.key(role, index), child);
    proc.on('message', message => this.fromChild(child, message as Up));
    proc.on('exit', (code, signal) => this.ended(child, code, signal));
    proc.on('error', error => this.log(`${role} ${index} could not be started: ${String(error)}`));
  }

  private ended(child: Child, code: number | null, signal: NodeJS.Signals | null) {
    for (const [topic, listener] of child.topics) this.state.presence.unsubscribe(topic, listener);
    child.topics.clear();
    if (child.processId) { this.byProcessId.delete(child.processId); this.state.forgetProcess(child.processId); void this.state.presence.hdel(LOAD_KEY, child.processId); }
    if (this.children.get(this.key(child.role, child.index)) === child) this.children.delete(this.key(child.role, child.index));
    if (this.stopping) { if (!this.children.size) process.exit(0); return; }
    this.log(`${child.role} ${child.index} ended (${signal ?? `code ${code}`}) after ${Math.round((Date.now() - child.started) / 1000)} s: starting it again`);
    if (child.role === 'control') {
      const now = Date.now(); this.controlFailures = [...this.controlFailures.filter(at => at > now - 60_000), now];
      if (this.controlFailures.length >= 4) { this.log('control failed 4 times in a minute: ending the server'); process.exit(1); }
    }
    const again = setTimeout(() => { if (!this.stopping) this.spawn(child.role, child.index); }, 1000); again.unref?.();
  }

  private send(child: Child, message: Down) { if (child.proc.connected) child.proc.send(message); }

  private fromChild(child: Child, message: Up) {
    switch (message.t) {
      case 'hello':
        child.processId = message.processId; this.byProcessId.set(message.processId, child);
        this.log(`${child.role} ${child.index} ready (pid ${child.proc.pid}, process ${message.processId}, :${child.port})`);
        if (child.role === 'control') this.flush();
        if (!this.ready && this.children.size === this.options.roomWorkers + 1 && [...this.children.values()].every(each => each.processId)) {
          this.ready = true; this.log('every process is listening: serving');
        }
        return;
      case 'sub': {
        if (child.topics.has(message.topic)) return;
        const listener = (data: unknown) => this.send(child, { t: 'ev', topic: message.topic, data });
        child.topics.set(message.topic, listener); void this.state.presence.subscribe(message.topic, listener);
        return;
      }
      case 'unsub': {
        const listener = child.topics.get(message.topic); if (!listener) return;
        child.topics.delete(message.topic); this.state.presence.unsubscribe(message.topic, listener);
        return;
      }
      case 'pub': this.state.presence.publish(message.topic, message.data); return;
      case 'r': {
        // Control's answer to a room process's call: back to the caller under its own id.
        const relay = this.relays.get(message.id); if (!relay) return;
        this.relays.delete(message.id);
        this.send(relay.from, { t: 'r', id: relay.id, ok: message.ok, v: message.v, e: message.e });
        return;
      }
      case 'q': {
        if (message.k === 'rpc') {
          const control = this.children.get(this.key('control', 0));
          if (!control?.proc.connected) { this.send(child, { t: 'r', id: message.id, ok: false, e: { message: 'control is restarting' } }); return; }
          const id = this.nextRelay++;
          this.relays.set(id, { from: child, id: message.id });
          // (A relay control never answers is dropped with the caller's own timeout: link.ts rejects at its end.)
          setTimeout(() => this.relays.delete(id), 30_000).unref?.();
          this.send(control, { t: 'q', id, k: 'rpc', m: message.m, a: message.a });
          return;
        }
        void (async () => {
          try {
            const v = message.k === 'presence' ? await this.state.presenceCall(message.m, message.a) : this.state.storeCall(message.m, message.a);
            this.send(child, { t: 'r', id: message.id, ok: true, v });
          } catch (error) { this.send(child, { t: 'r', id: message.id, ok: false, e: toWire(error) }); }
        })();
      }
    }
  }

  private portFor(route: ReturnType<typeof routeOf>): number | undefined {
    if (!this.ready) return undefined;
    if (route.kind === 'process') return this.byProcessId.get(route.processId)?.port;
    const child = this.children.get(this.key(route.target.role, route.target.index));
    return child?.processId ? child.port : undefined;
  }

  private request(req: http.IncomingMessage, res: http.ServerResponse) {
    const port = this.portFor(routeOf(req.url ?? '/', false));
    if (port === undefined) { res.writeHead(503, { 'Content-Type': 'application/json', 'Retry-After': '2' }); res.end(JSON.stringify({ error: 'The server is starting. Try again in a moment.' })); return; }
    const upstream = http.request({ host: '127.0.0.1', port, method: req.method, path: req.url, headers: passOn(req.headers), agent: this.agent,
      timeout: this.options.upstreamTimeoutMs ?? UPSTREAM_TIMEOUT_MS }, answer => {
      res.writeHead(answer.statusCode ?? 502, passOn(answer.headers));
      answer.pipe(res);
    });
    // Nothing back for UPSTREAM_TIMEOUT_MS: given up, its socket freed, and the visitor told (504) rather than kept waiting
    // (or, an answer that stopped half way, its connection closed: what came cannot be taken back).
    let late = false;
    upstream.on('timeout', () => { late = true; upstream.destroy(Object.assign(new Error('no answer in time'), { code: 'ETIMEDOUT' })); if (res.headersSent) res.destroy(); });
    upstream.on('error', error => {
      if (!res.headersSent) { res.writeHead(late ? 504 : 502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: late ? 'The server took too long to answer. Try again.' : 'The server could not answer. Try again.' })); }
      else res.destroy(error);
    });
    res.on('close', () => { if (!res.writableFinished) upstream.destroy(); });
    req.pipe(upstream);
  }

  private upgrade(req: http.IncomingMessage, socket: net.Socket, head: Buffer) {
    const port = this.portFor(routeOf(req.url ?? '/', true));
    if (port === undefined) { socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'); return; }
    const upstream = net.connect({ host: '127.0.0.1', port, noDelay: true });
    socket.setNoDelay(true);
    const close = () => { socket.destroy(); upstream.destroy(); };
    upstream.on('error', close); socket.on('error', close);
    upstream.on('close', () => socket.destroy()); socket.on('close', () => upstream.destroy());
    upstream.on('connect', () => {
      // The request as it came (its raw header lines, the client's own case), then whatever arrived after it.
      const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
      for (let i = 0; i < req.rawHeaders.length; i += 2) lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
      upstream.write(`${lines.join('\r\n')}\r\n\r\n`);
      if (head?.length) upstream.write(head);
      upstream.pipe(socket); socket.pipe(upstream);
    });
  }

  /** On SIGTERM: every child gets it (each saves what it keeps: control writes the book), then the primary goes. */
  private async stop(signal: NodeJS.Signals) {
    if (this.stopping) return;
    this.stopping = true;
    this.log(`${signal}: stopping ${this.children.size} process(es)`);
    this.server?.close();
    for (const child of this.children.values()) child.proc.kill(signal);
    if (!this.children.size) process.exit(0);
    setTimeout(() => { this.log('children did not stop in 25 s: ending'); process.exit(0); }, 25_000).unref?.();
  }
}
