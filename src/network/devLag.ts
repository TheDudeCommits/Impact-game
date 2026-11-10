/** A made-up bad connection, for checks on this machine (the ball modes' timing skills, tried with a real round
 *  trip). `?lag=120&jitter=20` on the Vite dev server, opened on localhost, holds
 *  every message the page sends to its room, and every one it hears back, for half the round trip each way, give or take
 *  half the jitter - in order, as TCP delivers them (WebSocket rides it): a message held longer holds up the ones behind
 *  it. `window.__netLag.set(lag, jitter)` changes it on the fly; `__netLag.room` is the room it is holding up. Nothing
 *  here exists in a production build (`import.meta.env.DEV`), nor on any other host, nor without the parameter.
 *
 *  The SDK writes each outgoing message into one shared buffer and hands the socket a view of it, so a held send is copied
 *  first: the next message would write over it. */
import type {Room} from '@colyseus/sdk';

type Lane = {at: number; queue: {at: number; run: () => void}[]; timer: ReturnType<typeof setTimeout> | undefined};
interface Held {send?: (data: Uint8Array) => void; sendUnreliable?: (data: Uint8Array) => void; events?: {onmessage?: (event: unknown) => void}; __devLag?: true}

export class DevLag {
  private readonly up: Lane = {at: 0, queue: [], timer: undefined};
  private readonly down: Lane = {at: 0, queue: [], timer: undefined};
  room: Room | null = null;
  constructor(public lag: number, public jitter: number) {}
  set(lag: number, jitter = 0) { this.lag = Math.max(0, +lag || 0); this.jitter = Math.max(0, +jitter || 0); }
  /** One way's hold, ms: half the round trip, give or take half the jitter, never before the message ahead of it. */
  private hold(lane: Lane, run: () => void) {
    const now = performance.now(), at = Math.max(lane.at, now + Math.max(0, this.lag / 2 + (Math.random() - .5) * this.jitter));
    lane.at = at;
    if (at <= now && !lane.queue.length) { run(); return; }
    lane.queue.push({at, run});
    if (!lane.timer) this.pump(lane);
  }
  private pump(lane: Lane) {
    lane.timer = undefined;
    const now = performance.now();
    while (lane.queue.length && lane.queue[0].at <= now + .5) lane.queue.shift()!.run();
    if (lane.queue.length) lane.timer = setTimeout(() => this.pump(lane), Math.max(0, lane.queue[0].at - performance.now()));
  }
  /** Hold `room`'s traffic both ways from now on (a reconnect keeps the same connection, and so the hold). */
  wrap(room: Room) {
    this.room = room;
    const c = room.connection as unknown as Held;
    if (!c || c.__devLag) return;
    c.__devLag = true;
    const send = c.send?.bind(c), unreliable = c.sendUnreliable?.bind(c), events = c.events, heard = events?.onmessage;
    if (send) c.send = data => { const copy = data.slice(); this.hold(this.up, () => send(copy)); };
    if (unreliable) c.sendUnreliable = data => { const copy = data.slice(); this.hold(this.up, () => unreliable(copy)); };
    if (events && heard) events.onmessage = event => this.hold(this.down, () => heard(event));
  }
}

/** The page's made-up connection, if this is a check on this machine that asked for one; else nothing. */
export function devLag(): DevLag | undefined {
  if (!import.meta.env?.DEV || typeof location === 'undefined' || !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return undefined;
  const query = new URLSearchParams(location.search);
  if (!query.has('lag') && !query.has('jitter')) return undefined;
  const lag = new DevLag(0, 0);
  lag.set(Number(query.get('lag') ?? 0), Number(query.get('jitter') ?? 0));
  (window as unknown as {__netLag?: DevLag}).__netLag = lag;
  return lag;
}
