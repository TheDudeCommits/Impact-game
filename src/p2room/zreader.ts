/* A page's reader of its room's packed messages (`$z`, room.ts Seat.packed): each is msgpack deflated with the one
 * before it as its preset dictionary, numbered in a stream of the page's own. Out of turn (a message lost while the page
 * reconnected) it reads nothing more until a new stream starts: the page sends `$zreset`, and the room's next message
 * starts one. */
import { inflateSync } from 'three/examples/jsm/libs/fflate.module.js';
import { unpack } from 'msgpackr';
import { P2_COMPRESSED, P2_DICTIONARY } from './protocol';

export type ZRead = { type: typeof P2_COMPRESSED[number]; message: unknown } | 'gap' | 'skip';

export class ZReader {
  private stream = -1;
  private next = 0;
  private prev?: Uint8Array;
  private lost = false;
  /** One `$z` message: what it carried, 'gap' when one before it was missed (ask for a new stream), or 'skip' while
   *  waiting for the new stream to start. */
  read(data: unknown): ZRead {
    const b = data instanceof Uint8Array ? data : data instanceof ArrayBuffer ? new Uint8Array(data) : ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : undefined;
    if (!b || b.length < 9) return 'skip';
    const view = new DataView(b.buffer, b.byteOffset, b.byteLength), kind = b[0], stream = view.getUint32(1), n = view.getUint32(5);
    if (stream !== this.stream) {
      if (n !== 0) return this.lose();
      this.stream = stream; this.next = 0; this.prev = undefined; this.lost = false;
    }
    if (this.lost) return 'skip';
    if (n !== this.next) return this.lose();
    let bytes: Uint8Array;
    try {
      const dictionary = this.prev && this.prev.length > P2_DICTIONARY ? this.prev.subarray(this.prev.length - P2_DICTIONARY) : this.prev;
      bytes = inflateSync(b.subarray(9), dictionary ? { dictionary } : undefined);
    } catch { return this.lose(); }
    this.next++; this.prev = bytes;
    const type = P2_COMPRESSED[kind];
    if (!type) return 'skip';
    return { type, message: unpack(bytes) };
  }
  /** A new stream from here (the page asked for one, or came back to its seat). */
  reset() { this.stream = -1; this.next = 0; this.prev = undefined; this.lost = false; }
  private lose(): ZRead { if (this.lost) return 'skip'; this.lost = true; return 'gap'; }
}
