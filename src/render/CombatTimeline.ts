import { SIMULATION_HZ } from '../game/moves';
import type { CombatEvent, GameSnapshot, PlayerState } from '../game/types';
import {riftOf} from '../game/moba/model';
import {presentRift} from './moba/presentUnits';

export interface CombatFrame { snapshot: GameSnapshot; time: number; events: CombatEvent[] }
/** The server accrues frozen time a whole tick at a time, from the tick after
 *  the contact. Accruing it any more finely here would run the pose backwards
 *  the moment the next snapshot corrected it. */
const TICK = 1 / SIMULATION_HZ;
const MAX_SNAPSHOTS = 64;
const EVENT_WINDOW = 4096;
const TIME_EPSILON = 1e-9;
const copyPlayer = (p: PlayerState): PlayerState => ({ ...p, cooldowns: { ...p.cooldowns } });
const copyEvent = (e: CombatEvent): CombatEvent => ({ ...e,
  origin: e.origin ? { ...e.origin } : undefined, endpoint: e.endpoint ? { ...e.endpoint } : undefined });
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * One visual clock for actor poses, transforms and authoritative events.
 * Default display delay is 60ms after receipt (plus transport delay). The clock
 * never rewinds or runs past the newest snapshot: missing packets freeze it.
 * The first snapshot is a baseline, not invented pre-join history. Call reset()
 * on room changes; then feed sampled transforms directly, without a second lerp.
 */
export class CombatTimeline {
  /** Settable: arcade survival runs its arena in the browser, a tick away. */
  delayMs: number;
  private snapshots: GameSnapshot[] = [];
  private receivedAtMs = 0;
  private visualTime: number | null = null;
  private pending: CombatEvent[] = [];
  private seen = new Set<number>();
  private highestEventId = 0;
  private landings = new Map<string,CombatEvent[]>();
  /** The clock offset between this machine and the server, in milliseconds,
   *  and how much the arrivals wander around it. Per room: see reset(). */
  private offsetMs: number | null = null;
  private jitterMs = 0;

  /** How many snapshots it holds (a ball match's replay keeps a few seconds of them: render/ball/BallReplay.ts). */
  private readonly keep: number;
  constructor(options: { delayMs?: number; keep?: number } = {}) {
    this.delayMs = options.delayMs ?? 60; this.keep = options.keep ?? MAX_SNAPSHOTS;
    if (!Number.isFinite(this.delayMs) || this.delayMs < 0) throw new Error('Visual delay must be a nonnegative number');
  }

  /** The newest arena time held. */
  get newest() { return this.snapshots.at(-1)?.serverTime; }

  reset() {
    this.snapshots.length = 0; this.pending.length = 0; this.seen.clear();
    this.receivedAtMs = 0; this.visualTime = null; this.highestEventId = 0;
    this.landings.clear();
    // Per-room state. Carried across a room change the old offset pins the
    // clock at the newest snapshot until the average converges.
    this.offsetMs = null; this.jitterMs = 0;
  }

  /** Round 5 (SOLOPAUSE): the room was frozen and has thawed. Its clock stood still while the wall clock ran on, so
   *  the arrival offset is learnt afresh from the next newer snapshot rather than decayed toward: a twenty-second pause
   *  would otherwise hold the clock on the newest snapshot, every remote body stepping at the broadcast rate, for the
   *  ten seconds the slow decay takes to close twenty seconds. Until that snapshot the clock holds where it stood. */
  reanchor() { this.offsetMs = null; this.jitterMs = 0; }

  push(snapshot: GameSnapshot, receivedAtMs: number) {
    if (!Number.isFinite(snapshot.serverTime) || !Number.isFinite(receivedAtMs)) return;
    for (const event of snapshot.events) {
      if (!Number.isSafeInteger(event.id) || !Number.isFinite(event.serverTime)
        || event.id <= this.highestEventId - EVENT_WINDOW || this.seen.has(event.id)) continue;
      this.highestEventId = Math.max(this.highestEventId, event.id);
      this.seen.add(event.id); this.pending.push(copyEvent(event));
      if(event.kind==='land'&&event.origin){
        const anchors=this.landings.get(event.actorId)??[];
        anchors.push(copyEvent(event));anchors.sort((a,b)=>a.serverTime-b.serverTime);
        this.landings.set(event.actorId,anchors.slice(-4));
      }
    }
    // IDs are room-local and monotonic. Keep a bounded replay window even for a
    // long match; delayed/out-of-order events inside it are still admitted once.
    for (const id of this.seen) if (id <= this.highestEventId - EVENT_WINDOW) this.seen.delete(id);
    this.pending.sort((a, b) => a.serverTime - b.serverTime || a.id - b.id);
    if (this.pending.length > EVENT_WINDOW) this.pending.length = EVENT_WINDOW;

    const newest = this.snapshots.at(-1);
    if (!newest || snapshot.serverTime > newest.serverTime) {
      this.receivedAtMs = receivedAtMs;
      // Smooth the anchor, not the clock. Pinned to the newest arrival the
      // visual clock has ten milliseconds of headroom over a fifty millisecond
      // broadcast, so one late packet stalls every remote fighter for a frame
      // or four and the next one runs them at up to 1.4x - measured at 2.8% of
      // frames on a 5 ms-jitter connection and 9.5% on 15 ms. Tracking the
      // offset with a fast attack and a slow decay, the shape every jitter
      // buffer uses, absorbs that while sample() stays stateless per frame.
      // With a constant offset this is algebraically the old clock.
      const offset = receivedAtMs - snapshot.serverTime * 1000;
      if (this.offsetMs === null) this.offsetMs = offset;
      else {
        this.jitterMs = this.jitterMs * .94 + Math.abs(offset - this.offsetMs) * .06;
        this.offsetMs += (offset - this.offsetMs) * (offset < this.offsetMs ? .5 : .02);
      }
    }
    const copy = { ...snapshot, players: snapshot.players.map(copyPlayer), events: [] };
    const index = this.snapshots.findIndex(s => s.serverTime >= snapshot.serverTime);
    if (index < 0) this.snapshots.push(copy);
    else if (this.snapshots[index].serverTime === snapshot.serverTime) {
      if (snapshot.tick >= this.snapshots[index].tick) this.snapshots[index] = copy;
    } else this.snapshots.splice(index, 0, copy);
    if (this.snapshots.length > this.keep) this.snapshots.splice(0, this.snapshots.length - this.keep);
    for(const [id,anchors] of this.landings){
      const current=anchors.filter(a=>a.serverTime>=this.snapshots[0].serverTime);
      if(current.length)this.landings.set(id,current);else this.landings.delete(id);
    }
  }

  /** The server time of the frame last drawn: what the page's inputs report as their view (PlayerInput.view). */
  get drawnAt(): number | null { return this.visualTime; }

  sample(nowMs: number): CombatFrame | null {
    const newest = this.snapshots.at(-1);
    if (!newest || !Number.isFinite(nowMs)) return null;
    const desired = this.offsetMs === null
      ? newest.serverTime + Math.max(0, nowMs - this.receivedAtMs) / 1000 - this.delayMs / 1000
      : (nowMs - this.offsetMs - this.delayMs - 2 * this.jitterMs) / 1000;
    return this.at(desired);
  }

  /** The frame at `desired` server seconds, on a clock the caller keeps: the
   *  arcade's local arena runs at its own time scale (slow motion on a boss's
   *  fall), which no arrival-time estimate can follow. Never rewinds, never
   *  runs past the newest snapshot. */
  at(desired: number): CombatFrame | null {
    const newest = this.snapshots.at(-1);
    if (!newest || !Number.isFinite(desired)) return null;
    const oldest = this.snapshots[0];
    const time = Math.min(newest.serverTime, Math.max(oldest.serverTime, this.visualTime ?? oldest.serverTime, desired));
    this.visualTime = time;
    let index = 0;
    while (index + 1 < this.snapshots.length && this.snapshots[index + 1].serverTime <= time + TIME_EPSILON) index++;
    const before = this.snapshots[index], after = this.snapshots[index + 1];
    const weight = after ? Math.max(0, (time - before.serverTime) / (after.serverTime - before.serverTime)) : 0;
    const laterPlayers = new Map(after?.players.map(p => [p.id, p]));
    // Membership and other discrete snapshot facts change at snapshot boundaries.
    // A departing actor remains visible until its terminal snapshot is reached.
    const players = before.players.map(player => {
      const result = copyPlayer(player), next = laterPlayers.get(player.id);
      let frozen = player.actionFrozen ?? 0;
      if (next) {
        const teleport = (!player.alive && next.alive) || (before.status === 'waiting' && after?.status === 'active')
          || Math.hypot(next.x - player.x, next.y - player.y, next.z - player.z) > 10;
        if (!teleport) {
          result.x = lerp(player.x, next.x, weight); result.y = lerp(player.y, next.y, weight); result.z = lerp(player.z, next.z, weight);
          // A landing between snapshots is a real trajectory corner. Plain
          // interpolation floats the feet above its dust event by up to 10cm.
          const landing=next.grounded?this.landings.get(player.id)?.find(e=>e.serverTime>before.serverTime&&e.serverTime<=after!.serverTime):undefined;
          if(landing?.origin){
            const landed=time+TIME_EPSILON>=landing.serverTime;
            const start=landed?landing.origin:player,end=landed?next:landing.origin;
            const startTime=landed?landing.serverTime:before.serverTime,endTime=landed?after!.serverTime:landing.serverTime;
            const phase=Math.max(0,Math.min(1,(time-startTime)/Math.max(TIME_EPSILON,endTime-startTime)));
            result.x=lerp(start.x,end.x,phase);result.y=lerp(start.y,end.y,phase);result.z=lerp(start.z,end.z,phase);
            result.grounded=landed;
          }
          const yawDelta = Math.atan2(Math.sin(next.yaw - player.yaw), Math.cos(next.yaw - player.yaw));
          result.yaw = player.yaw + yawDelta * weight;
        }
        // The next snapshot can reveal a transition between snapshots. Start it
        // at its authoritative timestamp, including hurt->hurt and slot->slot.
        if (next.actionStarted <= time + TIME_EPSILON && next.actionStarted >= player.actionStarted) {
          result.action = next.action; result.actionStarted = next.actionStarted;
          result.actionDuration = next.actionDuration; result.guarding = next.guarding;
          if (next.action === 'defeated') { result.alive = false; result.hp = 0; }
          // A pose that began inside this interval carries the new action's
          // frozen clock. The previous action's accumulated freeze is not this
          // pose's, and subtracting it starts the new one part-played.
          if (next.actionStarted > player.actionStarted) frozen = 0;
        }
        // The impact freeze as a window rather than a flag sampled on the
        // broadcast grid. The later snapshot is the one that knows about a
        // freeze which opened inside this interval, so it owns the window.
        const from = next.hitstopFrom ?? player.hitstopFrom, until = next.hitstopUntil ?? player.hitstopUntil;
        if (from !== undefined && until !== undefined) {
          result.hitstopFrom = from; result.hitstopUntil = until;
          result.hitstop = time >= from && time < until;
          // Accrue the freeze this interval has already spent. Without it the
          // remote pose plays forward through the freeze and then rewinds by
          // up to a whole snapshot when the next one lands carrying the
          // server's larger actionFrozen. Clamped to what the server actually
          // accrued, and in whole ticks, because that is how it accrues it.
          const spent = Math.min(time, until) - Math.max(before.serverTime, from, result.actionStarted);
          if (spent > 0) frozen += Math.min(Math.max(0, (next.actionFrozen ?? 0) - frozen), Math.floor(spent / TICK + 1e-9) * TICK);
        }
      }
      // The action clock is not wall time: impact freeze and time stop pause
      // it, and the server reports how long it has been paused for.
      result.actionFrozen = frozen;
      result.actionTime = result.actionDuration > 0
        ? Math.min(1, Math.max(0, (time - result.actionStarted - frozen) / result.actionDuration)) : 0;
      return result;
    });
    let ready = 0;
    while (ready < this.pending.length && this.pending[ready].serverTime <= time + TIME_EPSILON) ready++;
    const events = this.pending.splice(0, ready);
    const snapshot: GameSnapshot = { ...before, players, events, serverTime: time };
    const war=riftOf(before);if(war)Object.assign(snapshot,{rift:presentRift(war,riftOf(after),weight,time)});
    return { snapshot, time, events };
  }
}
