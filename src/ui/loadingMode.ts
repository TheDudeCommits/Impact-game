import type { RoomMode } from '../game/types';
import type { NetworkAccess } from '../network';
import type { LoadingMode } from './LoadingScreen';

/** Which loading page a start shows (main.ts hud.onStart, LoadingScreen's MODE_TITLE), from how the match was asked
 *  for. Overnight UX pass (8 October 2026): a party's Battle Royale has its own page, PARTY MATCH, as its room panel
 *  and waiting dock already say (hud/privatePanel.ts, modes/WaitingDock.ts); it read PRIVATE ROOM, a room the party
 *  never made. A party's other modes show those modes' own pages. `survivalRun`: an Arcade run, alone or in co-op. */
export function loadingModeFor(access: NetworkAccess | undefined, room: RoomMode, survivalRun = false): LoadingMode {
  if (access?.kind === 'rift-war') return 'rift-war';
  if (access?.kind === 'ball') return access.mode;
  if (access?.kind === 'duel') return 'duel';
  if (survivalRun || access?.kind === 'survival' || access?.kind === 'coop-create' || access?.kind === 'coop-join') return 'arcade';
  if (access?.kind === 'objective') return access.objective;
  if (access?.kind === 'bots') return 'bots';
  if (access?.kind === 'create-private' || access?.kind === 'join-private') return 'private';
  if (access?.kind === 'party') return access.travel.mode === 'royale' ? 'party' : access.travel.mode === 'survival' ? 'arcade' : access.travel.mode;
  return room === 'training' ? 'training' : 'players';
}
