import type { NetworkAccess } from '../network';
import type { FighterId, GameSnapshot } from '../game/types';
import { objectiveOf } from '../game/objectives/model';
import { riftOf } from '../game/moba/model';
import { population, type PageWhere, type PopulationView, type QueueMode } from './population';
import { socialRoom } from './roomSocial';

export const STANDBY_MINUTES = 15;
/** A lone page asks its room to hold at most this often (ms); the room keeps its start QueueHold.HOLD_AHEAD off. */
export const HOLD_EVERY = 3000;

export const standby = {
  mode: undefined as QueueMode | undefined,
  since: 0,
  /** The page went to its device from an empty queue for `mode`. */
  begin(mode: QueueMode | undefined, now = Date.now()) { if (mode && mode !== 'arcade') { this.mode = mode; this.since = now; } },
  end() { this.mode = undefined; },
  /** Still on standby for `mode`. */
  holds(mode: QueueMode | undefined, now = Date.now()) { return !!mode && this.mode === mode && now - this.since < STANDBY_MINUTES * 60_000; },
};

/** The queue a lone switch's device access stands in for (loneQueue's answers, and the Duel's FIGHT A BOT). */
export function queueModeOf(access: NetworkAccess | undefined): QueueMode | undefined {
  if (!access) return undefined;
  if (access.kind === 'bots' || access.kind === 'public') return 'royale';
  if (access.kind === 'duel') return 'duel';
  if (access.kind === 'objective') return access.objective;
  if (access.kind === 'rift-war') return 'rift-war';
  if (access.kind === 'ball') return access.mode;
  return undefined;
}
/** The online way to queue for `mode` again: the challenger's JOIN. */
export function queueAccess(mode: QueueMode, fighter?: FighterId): NetworkAccess | undefined {
  if (mode === 'royale') return { kind: 'public' };
  if (mode === 'duel') return { kind: 'duel', access: 'online' };
  if (mode === 'last-stand' || mode === 'bad-blood') return { kind: 'objective', objective: mode, access: 'quick', ...(fighter ? { fighter } : {}) };
  if (mode === 'rift-war') return { kind: 'rift-war', access: 'quick' };
  if (mode === 'goal-rush' || mode === 'sky-spike') return { kind: 'ball', mode, access: 'quick' };
  return undefined;
}

/** This page alone in a public queue that has not started: its mode (before the lone switch's moment, and after it). */
export function loneIn(snapshot: GameSnapshot | null | undefined, selfId: string, access: NetworkAccess | undefined): QueueMode | undefined {
  if (!snapshot || !selfId || !access) return undefined;
  const humans = snapshot.players.filter(p => !p.isBot && !p.enemy);
  if (humans.length !== 1 || humans[0].id !== selfId) return undefined;
  if (access.kind === 'public') return snapshot.roomMode === 'match' && snapshot.status === 'waiting' && snapshot.lobby?.visibility === 'public' && !snapshot.lobby.duel ? 'royale' : undefined;
  if (access.kind === 'duel' && access.access === 'online') return snapshot.status === 'waiting' && snapshot.lobby?.duel ? 'duel' : undefined;
  if (access.kind === 'objective' && access.access === 'quick') { const view = objectiveOf(snapshot); return view?.phase === 'lobby' && view.access === 'quick' ? view.kind : undefined; }
  if (access.kind === 'rift-war' && access.access === 'quick') return riftOf(snapshot)?.phase === 'lobby' ? 'rift-war' : undefined;
  return undefined;
}

let heldAt = -Infinity;
/** Each snapshot of an online room (main.ts): a lone page in a queue whose mode has a player on standby asks its room to
 *  hold its start (only a room that said `social` in its welcome, which takes the message). True when it asked. */
export function queueWatch(snapshot: GameSnapshot | null | undefined, selfId: string, access: NetworkAccess | undefined, view: PopulationView | undefined = population.view, now = performance.now()): boolean {
  const mode = loneIn(snapshot, selfId, access);
  // (A Duel's queue has no clock to hold: it waits for a second player as long as the player does.)
  if (!mode || mode === 'duel' || !view || view.modes[mode].standby < 1 || now - heldAt < HOLD_EVERY) return false;
  const room = socialRoom(); if (!room) return false;
  heldAt = now; room.send('queue-hold');
  return true;
}

/** What main.ts knows of the page now, for `pageWhere`. */
export interface PageState { started: boolean; online: boolean; snapshot: GameSnapshot | null; selfId: string; access: NetworkAccess | undefined;
  /** The mode of the match on this device, if it is one (Training is none). */ local?: QueueMode }
/** Where the page is, for the population's beat (and the standby's end: an online room, or another mode on the device). */
export function pageWhere(state: PageState, now = Date.now()): PageWhere {
  if (!state.started) return { at: 'home' };
  if (state.online) { standby.end(); const mode = loneIn(state.snapshot, state.selfId, state.access); return mode ? { at: 'queue', mode } : { at: 'room' }; }
  if (standby.mode && state.local !== standby.mode) standby.end();
  return standby.holds(state.local, now) ? { at: 'standby', mode: state.local! } : { at: 'local', ...(state.local ? { mode: state.local } : {}) };
}
