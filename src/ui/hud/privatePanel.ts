import type { RoomLobby } from '../../game/types';
import type { DuelView } from '../../game/duel/DuelSet';

/** What the private room's waiting panel (#private-status, Hud.ts) shows for this snapshot. */
export interface PrivatePanel {
  hidden: boolean;
  /** A party launched the room: no room code, no COPY / SHARE (the party has its own invite), no rules to set again. */
  party: boolean;
  label: string;
  startHidden: boolean;
  startLabel: string;
  hint: string;
}
/**
 * The waiting panel of a private room, a duel room or a co-op room, as it always read (its code, COPY CODE, COPY INVITE,
 * SHARE, START for the host) - and, for a room a party launched (lobby.party), the party's: nothing to invite to, no START
 * while the room will start by itself (lobby.autoStart; the host's START comes back if a member never arrives), and no
 * panel at all between the rounds of a party's Duel (its round banner counts them in).
 */
export function privatePanel(lobby: RoomLobby | undefined, status: string, serverTime: number, selfId: string,
  room: { coop: boolean; players: number; duel?: Pick<DuelView, 'phase'> }): PrivatePanel {
  const isPrivate = lobby?.visibility === 'private', waiting = status === 'waiting', party = !!lobby?.party;
  const host = !!lobby && lobby.hostId === selfId, between = !!room.duel && room.duel.phase === 'interval';
  const hidden = !isPrivate || !waiting || party && between;
  const label = party ? (lobby?.duel ? 'PARTY DUEL' : room.coop ? 'PARTY RUN' : 'PARTY MATCH') : lobby?.duel ? 'DUEL ROOM' : room.coop ? 'CO-OP ROOM' : 'PRIVATE ROOM';
  const startLabel = room.coop ? 'START RUN' : 'START FIGHT';
  const startHidden = !waiting || !host || party && !!lobby?.autoStart;
  const starting = lobby && lobby.startsAt !== null ? `STARTING IN ${Math.max(0, Math.ceil(lobby.startsAt - serverTime))}s` : '';
  let hint = 'INVITE CODE';
  if (waiting && lobby) {
    if (starting) hint = starting;
    else if (party) hint = lobby.autoStart ? 'STARTS BY ITSELF ONCE EVERYONE IS IN' : host ? (lobby.canStart ? 'START WHEN YOU ARE READY' : 'WAITING FOR THE PARTY') : 'WAITING FOR THE HOST';
    else hint = host ? (lobby.canStart ? (room.coop ? (room.players > 1 ? `PARTY OF ${room.players} · READY` : 'START ALONE, OR WAIT FOR FRIENDS') : 'YOUR ROOM · READY TO START') : 'WAITING FOR A FRIEND') : 'WAITING FOR HOST';
  }
  return { hidden, party, label, startHidden, startLabel, hint };
}
