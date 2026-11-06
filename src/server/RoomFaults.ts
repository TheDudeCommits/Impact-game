import type { Room, RoomException, RoomMethodName } from 'colyseus';
import { recordServerError } from './ops/errorCounts';

export const FAULT_SECONDS = 3, CLEAN_SECONDS = .5;
/** Not a code the client's SDK tries to reconnect on (CloseCode.WITH_ERROR): the page goes home and shows the message. */
export const FAULT_CLOSE_CODE = 4002;
export const FAULT_MESSAGE = 'This match was closed after a server error. Nothing else on the server was affected; start a new one.';
/** Handler throws logged per room; the rest are counted. */
const LOGGED = 5;

export class RoomFaults {
  /** A fault has closed the room (its clock runs nothing more while it disposes). */
  closing = false;
  private faults = 0;
  private reported = 0;
  /** When the current run of faults began, and the last fault in it (performance.now(), ms). */
  private since = -Infinity;
  private last = -Infinity;
  constructor(private readonly room: Room) {}

  private where() { return `[${this.room.roomName ?? 'room'} ${this.room.roomId}]`; }

  /** One step of the room's clock, with its sends: a throw is a fault, and a room closed by one steps no more. */
  guard(step: () => void) {
    if (this.closing) return;
    try { step(); } catch (error) { this.fault(error); }
  }

  /** A step that threw (guard's, or a part of a step caught where it fell, as the co-op room's rules are). */
  fault(error: unknown, now = performance.now()) {
    if (this.closing) return;
    // (Counted once a room, as it is logged, for /health and GET /errors: a step that throws every tick is one fault.)
    if (this.faults++ === 0) { console.error(`${this.where()} step failed; the room keeps running`, error); recordServerError('room step', error); }
    if (now - this.last > CLEAN_SECONDS * 1000) this.since = now;
    this.last = now;
    if (now - this.since >= FAULT_SECONDS * 1000) this.close();
  }

  /** Colyseus's room-level onUncaughtException: a throw in a message handler, a clock event or a leave. A refused create
   *  or join is Colyseus's own to answer (it tells the client why), and is not logged here. */
  report(error: RoomException, method: RoomMethodName) {
    if (method === 'onCreate' || method === 'onAuth' || method === 'onJoin') return;
    if (this.reported++ >= LOGGED) return;
    const type = 'type' in error && typeof error.type === 'string' ? ` '${error.type}'` : '';
    console.error(`${this.where()} ${method}${type} threw; contained${this.reported === LOGGED ? ' (further throws in this room go unlogged)' : ''}`, error.cause ?? error);
    recordServerError('room handler', error.cause ?? error);
  }

  /** The room ends: every player told why, then disconnected. */
  private close() {
    this.closing = true;
    console.error(`${this.where()} closed: its step kept failing (${this.faults} faults in ${FAULT_SECONDS} s)`);
    recordServerError('room closed', `${this.room.roomName ?? 'room'} closed: its step kept failing`);
    for (const client of this.room.clients) { try { client.error(FAULT_CLOSE_CODE, FAULT_MESSAGE); } catch { /* its socket is already gone */ } }
    try { void this.room.disconnect(FAULT_CLOSE_CODE).catch(error => console.error(`${this.where()} could not close`, error)); }
    catch (error) { console.error(`${this.where()} could not close`, error); }
  }
}
