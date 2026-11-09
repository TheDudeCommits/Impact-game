/** What the engine asks of ChohanAllIn.ts outside its effect layer (where a blow
 *  lands: engine/client/sockets.ts, render/Fighter.ts, render/AreaTelegraph.ts), moved out of it unchanged, so that the layer is
 *  fetched only with a room that has the fighter (RosterSignatureSet's lazy factories). ChohanAllIn.ts re-exports it. */
import type { PlayerState } from '../../game/types';
import { moveSource, slotFx } from '../../engine/client/forgeLive';
/** Only Chohan's own uncustomized G has physical presentation; Forge remains explicit. */
export function chohanPhysicalArea(state: Pick<PlayerState, 'fighter' | 'forge'>): boolean {
  return state.fighter === 'chohan' && !slotFx(state, 'area') && !moveSource(state, 'area');
}
