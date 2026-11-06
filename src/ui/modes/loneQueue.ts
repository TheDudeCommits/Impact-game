import {riftOf} from '../../game/moba/model';
import type { NetworkAccess } from '../../network';
import type { FighterId, GameSnapshot } from '../../game/types';
import { MIN_MATCH_FIELD } from '../../game/moves';
import { RULES, objectiveOf } from '../../game/objectives/model';

export const LONE_NOTICE = 'NOBODY ELSE QUEUED · PLAYING ON YOUR DEVICE, ZERO LAG';
/** How long before the room's start the page decides, in seconds. */
export const LONE_LEAD = 1;

/** The switch, said where the waiting dock was, over the loading screen and the fight's first seconds (a HUD notice
 *  there is drawn over at once by the stage's name). */
export function loneNotice(root: HTMLElement = document.body, ms = 4500) {
  root.querySelector('.lone-notice')?.remove();
  const el = document.createElement('div');
  el.className = 'lone-notice'; el.setAttribute('role', 'status'); el.textContent = LONE_NOTICE;
  root.append(el); setTimeout(() => el.remove(), ms);
}

/** The on-device access to play instead, or undefined to stay: `access` is how the page joined the room. */
export function loneQueue(snapshot: GameSnapshot | null | undefined, selfId: string, access: NetworkAccess | undefined, planned: readonly FighterId[] = []): NetworkAccess | undefined {
  if (!snapshot || !selfId || !access) return undefined;
  const humans = snapshot.players.filter(p => !p.isBot && !p.enemy);
  if (humans.length !== 1 || humans[0].id !== selfId) return undefined;
  const left = (at: number | null | undefined) => at !== null && at !== undefined && at - snapshot.serverTime <= LONE_LEAD;
  if(access.kind==='rift-war'&&access.access==='quick'){const war=riftOf(snapshot);if(war?.phase==='lobby'&&left(war.startsAt))return {kind:'rift-war',access:'bots'};}
  // Battle royale ONLINE: a lone entrant's countdown ends with bots filling the field to six.
  if (access.kind === 'public') {
    if (!(snapshot.roomMode === 'match' && snapshot.status === 'waiting' && snapshot.lobby?.visibility === 'public' && !snapshot.lobby.duel && left(snapshot.lobby.startsAt))) return undefined;
    const field = planned.filter(id => id !== humans[0].fighter).slice(0, MIN_MATCH_FIELD - 1);
    return { kind: 'bots', players: MIN_MATCH_FIELD, lone: true, ...(snapshot.stage ? { place: snapshot.stage } : {}), ...(field.length === MIN_MATCH_FIELD - 1 ? { field } : {}) };
  }
  // Last Stand / Bad Blood ONLINE: a quick lobby starts on its own clock, RULES.quickWait after it opened (ObjectiveRoom).
  if (access.kind === 'objective' && access.access === 'quick') {
    const view = objectiveOf(snapshot);
    // (Its start as the room shows it - a lone wait a standby player is asked to join is held, server/social/QueueHold.ts -
    // and RULES.quickWait where it shows none.)
    return view?.phase === 'lobby' && view.access === 'quick' && left(view.startsAt ?? RULES.quickWait) ? { kind: 'objective', objective: view.kind, access: 'bots', fighter: access.fighter } : undefined;
  }
  // Arcade co-op ONLINE: the quick lobby's run starts at its clock (SurvivalRoom's QUICK lobby).
  if (access.kind === 'coop-join' && access.quick) return snapshot.status === 'waiting' && snapshot.lobby?.code === 'QUICK' && left(snapshot.lobby.startsAt) ? { kind: 'survival' } : undefined;
  return undefined;
}
