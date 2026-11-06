import type { AttackSlot, CombatEvent, GameSnapshot } from './types';

/**
 * Round 3c (FEEDBACK): the blows the simulation actually landed, as this
 * client knows them.
 *
 * The second blind critic: "Gaunt' Butcher Cleave: the blade passes through the
 * hard-locked Ouga at 2.7 m. You see a slash, a flash, an impact ring and
 * dust, but there is no damage number, no HP change and no flinch." Round 3b
 * answers a blow where it is drawn: the reaction, the spark and the shove
 * start on the frame a striking surface reaches a body inside a contact window
 * (Fighter, see TORSO_RADIUS). That was geometry alone, so a blade drawn
 * longer than the simulation's reach, or a sweep past a bystander, was
 * answered as a blow nobody had landed.
 *
 * Now a blow is answered where it is drawn only if this ledger holds it:
 * - The local fighter's own, from the local copy of the simulation
 *   (Prediction), on the tick it lands there. That copy is what draws the
 *   local swing, so this is the tick the drawn swing reaches its contact.
 * - Everybody's, from the server's snapshots as they arrive (Prediction's
 *   reconcile). A remote body is drawn from the timeline at least its display
 *   delay after that, so its verdict is in before its swing is drawn.
 * - Everybody's, as the timeline hands the events over (CombatEffects). This
 *   is the only source where nothing is predicted (the arcade), and the
 *   record that the event itself has answered the blow.
 *
 * A hit the local copy predicted and the server did not land is `rejected` -
 * on the snapshot that says the server turned it away (a dodge, a parry, a
 * guard the copy did not know about yet), or at the latest once the server
 * has gone past it (RESOLVE_TICKS) - and the body lets go of what it answered
 * (Fighter.withdraw).
 * Guards carry no input edge on their events, so they are kept apart, by
 * contact and time.
 */
export type LandedBlow = {
  attacker: string; seq: number; target: string; contact: number; slot?: AttackSlot;
  /** Landed by the local copy of the simulation, ahead of the server. */
  predicted: boolean;
  /** Landed by the server. */
  confirmed: boolean;
  /** Predicted, then resolved by the server without landing. */
  rejected: boolean;
  /** Its event has been handed over by the timeline, which answered it. */
  delivered: boolean;
  /** The local input edge current when the local copy landed it. */
  tick: number;
  /** When it landed, on the clock of the simulation that said so. */
  at: number;
  /** The same blow under another input edge (see SAME_BLOW): the local
   *  copy's stage and the server's can come from different presses when an
   *  earlier stage hit on one and missed on the other. It stands or falls
   *  with that record, and is answered once, under whichever came first. */
  standsFor?: LandedBlow;
  /** Round 3e (REACT): whether the local copy's prediction of it could be
   *  believed when it was made (Prediction's `trusted`): the body it landed
   *  on was held in a reaction, or standing still. A body on the move, in a
   *  swing of its own or in the air could have been anywhere by then, and a
   *  blow on it is not answered until the server lands it (see `held`). */
  trusted?: boolean;
  /** Round 3e (REACT, for VARIETY): the outcome the blow gave the body, off
   *  its event (a crumple, a hop, a true launch all read 'launched'). */
  outcome?: CombatEvent['outcome'];
};
type Guarded = { target: string; slot?: AttackSlot; contact: number; at: number };

/** Event ids the client gives its own predicted events (main.ts starts them
 *  at a billion); the server's are small and room-local. */
const PREDICTED_IDS = 1_000_000_000;
/** How many blows and guards are kept per attacker, newest last. */
const KEPT = 24;
/** Input ticks the server is given, past the one the local copy landed a
 *  blow on, to land it too before the prediction counts as rejected: a
 *  contact that finds nobody stays open for its active frames (up to seven
 *  ticks, `activeWindow`), and a tick more either side for the handover. The
 *  server consumes one input a tick, so its acknowledgement is its clock. */
export const RESOLVE_TICKS = 10;
/** How far a replay of the unacknowledged inputs must run past the tick a
 *  hit was predicted on, and still not land it, for the prediction to be
 *  given up: a few ticks, so a contact the replay merely moves (a freeze the
 *  server's copy held that the local one did not) is not taken for a miss. */
export const REPLAY_PAST = 3;
/** Seconds apart, each on its own simulation's clock (the local copy's runs
 *  ahead of the server's by the unacknowledged inputs, the two meet on the
 *  tick an input is applied), within which a blow by the same attacker on the
 *  same body, slot and contact under another input edge is the same blow. */
const SAME_BLOW = .3;
/** How far past the timeline's clock an event may be and still be one it
 *  hands over this frame: the clock is last frame's, and a long frame moves
 *  it on by as much as the frame took. */
const PAIR_AHEAD = .25;

export class LandedBlows {
  /** The fighter this client predicts (Prediction), '' for none. */
  local = '';
  /** The timeline's clock on the last frame drawn (CombatEffects), which is
   *  as far as the events have been handed over. */
  clock = Infinity;
  private blows = new Map<string, LandedBlow[]>();
  private guards = new Map<string, Guarded[]>();
  /** Server events already taken as turning a prediction away. */
  private answered = new Set<number>();

  reset() { this.local = ''; this.clock = Infinity; this.blows.clear(); this.guards.clear(); this.answered.clear(); }

  /** What the local copy of the simulation just did (Prediction, after every
   *  step and every replay): the hits and guards the local fighter landed,
   *  and the input edge that was current - the latest one, for a replay. A
   *  blow keeps the edge it was first predicted on.
   *
   *  `replayed` is the first input edge of a replay: the local copy has just
   *  run every input the server has not acknowledged again, from the server's
   *  newest state. A hit it had predicted on one of those ticks - REPLAY_PAST
   *  or more before the last - that it did not land again is one it no longer
   *  believes in: the body dodged, moved off or raised a guard in the
   *  meantime. It is refused now, a round trip before the server could say. */
  predict(events: readonly CombatEvent[], local: string, tick: number, replayed?: number, trusted?: (target: string, at: number, event: CombatEvent) => boolean) {
    this.adopt(local);
    for (const event of events) {
      if (event.actorId !== local || !event.targetId) continue;
      if (event.kind === 'hit' && event.actionSeq !== undefined) {
        const blow = this.upsert(event);
        if (!blow.predicted) { blow.predicted = true; blow.tick = tick; blow.trusted = trusted ? trusted(event.targetId, event.serverTime, event) : undefined; }
      } else if (event.kind === 'blocked' || event.kind === 'guard-break') this.guard(event);
    }
    const own = replayed === undefined ? undefined : this.blows.get(local);
    if (own) for (const blow of own) {
      if (!blow.predicted || blow.confirmed || blow.rejected || blow.standsFor || blow.tick < replayed! || blow.tick > tick - REPLAY_PAST) continue;
      let again = false;
      for (const event of events) if (event.kind === 'hit' && event.actorId === local && event.targetId === blow.target && event.actionSeq === blow.seq && (event.contactIndex ?? 0) === blow.contact) { again = true; break; }
      if (again) continue;
      // Landed again under another input edge: the same blow, re-timed.
      for (const event of events) if (event.kind === 'hit' && event.actorId === local && event.actionSeq !== undefined && event.actionSeq !== blow.seq && this.sameAs(blow, event)) {
        blow.standsFor = this.blow(local, event.actionSeq, event.targetId!, event.contactIndex ?? 0);
        break;
      }
      if (!blow.standsFor) blow.rejected = true;
    }
  }

  /** A snapshot from the server, as it arrives (Prediction's reconcile): every
   *  hit and guard it carries, and the local fighter's predicted hits it has
   *  gone past without landing. */
  authoritative(snapshot: GameSnapshot, local: string) {
    this.adopt(local);
    this.serve(snapshot.events, false);
    let ack: number | undefined;
    for (const player of snapshot.players) if (player.id === local) ack = player.ackSeq;
    const own = this.blows.get(local);
    if (ack === undefined || !own) return;
    for (const blow of own) if (blow.predicted && !blow.confirmed && !blow.rejected && !blow.standsFor && ack >= blow.tick + RESOLVE_TICKS) blow.rejected = true;
  }

  /** The events the timeline hands over this frame (CombatEffects.handle). */
  deliver(events: readonly CombatEvent[]) { this.serve(events, true); }

  /** The blow an event handed over to `target` just now is (Fighter.impact):
   *  the oldest of the server's hits on it with that slot and contact that has
   *  not been handed over yet, no later than the timeline has got to. Marked
   *  handed over. Undefined where the server's record is not in (nothing is
   *  predicted in the arcade), and the caller falls back on matching. */
  pair(target: string, slot: AttackSlot | undefined, contact: number | undefined) {
    let best: LandedBlow | undefined;
    for (const list of this.blows.values()) for (const blow of list) {
      if (blow.target !== target || blow.delivered || !blow.confirmed || blow.slot !== slot) continue;
      if (contact !== undefined && blow.contact !== contact) continue;
      if (blow.at > this.clock + PAIR_AHEAD) continue;
      if (!best || blow.at < best.at) best = blow;
    }
    if (best) best.delivered = true;
    return best;
  }

  /** Contact `contact` of swing `seq` of `attacker`, if it landed on `target`
   *  as far as anyone has said. */
  blow(attacker: string, seq: number, target: string, contact: number) {
    const list = this.blows.get(attacker);
    if (!list) return undefined;
    for (let i = list.length - 1; i >= 0; i--) {
      const blow = list[i];
      if (blow.seq === seq && blow.target === target && blow.contact === contact) return blow;
    }
    return undefined;
  }

  /** Whether any contact of swing `seq` of `attacker` landed on `target` and
   *  still stands (not a rejected prediction), or was turned away by its
   *  guard at or after `since` (the swing's start). */
  landed(attacker: string, seq: number, target: string, since: number) {
    const list = this.blows.get(attacker);
    if (list) for (const blow of list) if (blow.seq === seq && blow.target === target && !this.refused(blow)) return true;
    const guards = this.guards.get(attacker);
    if (guards) for (const guard of guards) if (guard.target === target && guard.at >= since - 1e-6) return true;
    return false;
  }

  /** Whether `attacker`'s contact `contact` in `slot` was turned away by
   *  `target`'s guard at or after `since` (the swing's start, on the clock of
   *  whichever simulation draws the attacker). */
  guarded(attacker: string, target: string, slot: AttackSlot | undefined, contact: number, since: number) {
    const list = this.guards.get(attacker);
    if (list) for (const guard of list) if (guard.target === target && guard.slot === slot && guard.contact === contact && guard.at >= since - 1e-6) return true;
    return false;
  }

  /** Round 3e (REACT): whether `blow` is a prediction to wait on - landed by
   *  the local copy on a body it could not vouch for (see `trusted`) and not
   *  yet by the server. Its touch is answered when the server lands it. */
  held(blow: LandedBlow | undefined) {
    return !!blow && blow.predicted && !blow.confirmed && blow.trusted === false && !blow.standsFor;
  }
  /** Round 3e (REACT): the newest of the local fighter's blows on `target`
   *  with this slot and contact that the local copy has landed and the
   *  server has not yet - the one a locally presented impact answers. */
  predictedOn(target: string, slot: AttackSlot | undefined, contact: number | undefined) {
    const list = this.blows.get(this.local);
    if (list) for (let i = list.length - 1; i >= 0; i--) {
      const blow = list[i];
      if (blow.target === target && blow.predicted && !blow.confirmed && !this.refused(blow) && blow.slot === slot && blow.contact === (contact ?? 0)) return blow;
    }
    return undefined;
  }
  /** Whether `blow` stands refused: it, or the record of the same blow it
   *  stands for, was predicted and not landed. */
  refused(blow: LandedBlow | undefined) {
    for (let at = blow, n = 0; at && n < 8; at = at.standsFor, n++) if (at.rejected) return true;
    return false;
  }
  /** Whether `record` is `blow`, or stands for it (see `standsFor`). */
  same(record: LandedBlow | undefined, blow: LandedBlow) {
    for (let at = record, n = 0; at && n < 8; at = at.standsFor, n++) if (at === blow) return true;
    return false;
  }

  /** A hit by the same attacker on the same body with the same slot and
   *  contact, within SAME_BLOW of `blow`. */
  private sameAs(blow: LandedBlow, event: CombatEvent) {
    return event.targetId === blow.target && event.slot === blow.slot && (event.contactIndex ?? 0) === blow.contact && Math.abs(event.serverTime - blow.at) <= SAME_BLOW;
  }
  /** A server hit the local copy did not predict under its own input edge:
   *  the oldest waiting prediction of the same blow under another edge now
   *  stands for it (see `standsFor`). */
  private match(served: LandedBlow) {
    if (served.attacker !== this.local) return;
    let oldest: LandedBlow | undefined;
    for (const blow of this.blows.get(served.attacker) ?? []) {
      if (blow === served || !blow.predicted || blow.confirmed || blow.rejected || blow.standsFor || blow.seq === served.seq) continue;
      if (blow.target !== served.target || blow.slot !== served.slot || blow.contact !== served.contact || Math.abs(blow.at - served.at) > SAME_BLOW) continue;
      if (!oldest || blow.tick < oldest.tick) oldest = blow;
    }
    if (oldest) oldest.standsFor = served;
  }

  /** A new local fighter is a new session: nothing from the last one holds. */
  private adopt(local: string) { if (local !== this.local) { this.blows.clear(); this.guards.clear(); this.answered.clear(); this.local = local; } }

  private serve(events: readonly CombatEvent[], delivered: boolean) {
    for (const event of events) {
      if (!delivered && event.kind === 'whiff') { this.whiffed(event); continue; } // Round 3d (ULTS): an opener the server found nobody for.
      if (!event.targetId || event.id >= PREDICTED_IDS) continue;
      if (event.kind === 'hit' && event.actionSeq !== undefined) {
        const blow = this.upsert(event);
        if (!blow.confirmed && !blow.predicted) this.match(blow);
        blow.confirmed = true; blow.rejected = false; blow.at = event.serverTime; blow.outcome = event.outcome ?? blow.outcome;
        if (delivered) blow.delivered = true;
        continue;
      }
      if (event.kind === 'blocked' || event.kind === 'guard-break') this.guard(event);
      // The server turned a blow away where the local copy had it land: a
      // dodge, a parry or a guard it knew about and the copy did not yet. It
      // says so on its contact tick, which is sooner than its acknowledgement
      // can (RESOLVE_TICKS). Taken once, from the snapshot as it arrives.
      if (!delivered && (event.kind === 'blocked' || event.kind === 'guard-break' || event.kind === 'dodge' || event.kind === 'just-guard')) this.turnedAway(event);
    }
  }

  /** Refuses the oldest of the local fighter's predicted hits still waiting on
   *  the server that the server has just turned away: the same body, slot and
   *  contact. The oldest, because the server resolves swings in order. */
  private turnedAway(event: CombatEvent) {
    if (event.actorId !== this.local || this.answered.has(event.id)) return;
    this.answered.add(event.id);
    if (this.answered.size > 64) this.answered.delete(this.answered.values().next().value!);
    const contact = event.contactIndex ?? 0;
    let oldest: LandedBlow | undefined;
    for (const blow of this.blows.get(event.actorId) ?? []) {
      if (!blow.predicted || blow.confirmed || blow.rejected || blow.standsFor || blow.target !== event.targetId || blow.slot !== event.slot || blow.contact !== contact) continue;
      if (!oldest || blow.tick < oldest.tick) oldest = blow;
    }
    if (oldest) oldest.rejected = true;
  }

  /** Round 3d (ULTS): the server found nobody for a hit-confirm ultimate's
   *  opener, which the local copy had landed: every blow that swing was
   *  predicted to land and the server has not confirmed is refused at once,
   *  on the tick the server decided (its 'whiff' carries the swing's input
   *  edge), rather than when the acknowledgement passes it - so the victim
   *  lets go of the opener's reaction before a cinematic that never comes. */
  private whiffed(event: CombatEvent) {
    if (event.actorId !== this.local || event.id >= PREDICTED_IDS || this.answered.has(event.id)) return;
    this.answered.add(event.id);
    if (this.answered.size > 64) this.answered.delete(this.answered.values().next().value!);
    for (const blow of this.blows.get(event.actorId) ?? []) {
      if (!blow.predicted || blow.confirmed || blow.rejected || blow.slot !== event.slot) continue;
      if (event.actionSeq !== undefined && blow.seq !== event.actionSeq) continue;
      blow.rejected = true;
    }
  }

  private upsert(event: CombatEvent) {
    const attacker = event.actorId, seq = event.actionSeq!, target = event.targetId!, contact = event.contactIndex ?? 0;
    const known = this.blow(attacker, seq, target, contact);
    if (known) return known;
    let list = this.blows.get(attacker);
    if (!list) { list = []; this.blows.set(attacker, list); }
    const blow: LandedBlow = { attacker, seq, target, contact, slot: event.slot, predicted: false, confirmed: false, rejected: false, delivered: false, tick: -1, at: event.serverTime, outcome: event.outcome };
    list.push(blow);
    if (list.length > KEPT) list.shift();
    return blow;
  }

  private guard(event: CombatEvent) {
    const contact = event.contactIndex ?? 0;
    let list = this.guards.get(event.actorId);
    if (!list) { list = []; this.guards.set(event.actorId, list); }
    for (const guard of list) if (guard.target === event.targetId && guard.slot === event.slot && guard.contact === contact && Math.abs(guard.at - event.serverTime) < 1e-6) return;
    list.push({ target: event.targetId!, slot: event.slot, contact, at: event.serverTime });
    if (list.length > KEPT) list.shift();
  }
}

/** The one ledger: Prediction writes the local copy's and the server's
 *  verdicts into it, CombatEffects the timeline's, Fighter reads it. */
export const LANDED = new LandedBlows();
