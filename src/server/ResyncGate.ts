import type { Client, Room } from 'colyseus';

export const RESYNC_MS = 500;

export class ResyncGate {
  /** When each client may next be answered at once (the room clock's currentTime, ms). */
  private readonly next = new Map<string, number>();
  /** A request that came inside its window, to be answered when the window ends. */
  private readonly held = new Map<string, { clear(): void }>();
  constructor(private readonly room: Pick<Room, 'onMessage' | 'clients' | 'clock'>, private readonly answer: (client: Client) => void) {
    room.onMessage('resync-input', (client: Client) => this.request(client));
  }
  request(client: Client) {
    const id = client.sessionId;
    if (this.held.has(id)) return;
    const wait = (this.next.get(id) ?? -Infinity) - this.room.clock.currentTime;
    if (wait <= 0) { this.send(client); return; }
    this.held.set(id, this.room.clock.setTimeout(() => {
      this.held.delete(id);
      // (The client as the room has it now: one that reconnected meanwhile is a new object; one that left is not there.)
      const now = this.room.clients.find(each => each.sessionId === id);
      if (now) this.send(now);
    }, wait));
  }
  private send(client: Client) { this.next.set(client.sessionId, this.room.clock.currentTime + RESYNC_MS); this.answer(client); }
  /** A client that reconnected (its page asks at once, and is answered at once) or left. */
  forget(id: string) { this.held.get(id)?.clear(); this.held.delete(id); this.next.delete(id); }
  clear() { for (const timer of this.held.values()) timer.clear(); this.held.clear(); this.next.clear(); }
}
