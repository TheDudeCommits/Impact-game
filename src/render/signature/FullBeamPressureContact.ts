/** What the engine asks of FullBeamPressure.ts outside its effect layer (where a blow
 *  lands, engine/client/sockets.ts; whose fighter it is, render/CombatEffects.ts), moved out of it unchanged, so that the layer is
 *  fetched only with a room that has the fighter (CombatEffects' lazy layers). FullBeamPressure.ts re-exports it. */
import * as THREE from 'three';
import type { Fighter } from '../Fighter';
export const isFullBeamPressure = (id: string | undefined) => id === 'full-beam';
/** Follow the actual striking glove, including the left cross in the confirmed
 * string. The chop and two-fisted hammer meet between the two hands. */
export function fullBeamContact(fighter: Fighter, index: number, out: THREE.Vector3, clip = ''): boolean {
  if (!isFullBeamPressure(fighter.state.fighter)) return false;
  if (/Land's End Chop|Anchor Hammer|Aerial Hammer|Meteor Landing|Rush3/.test(clip)) {
    out.copy(fighter.handR).lerp(fighter.handL, .5);
  } else if (/Keeper's Backfist|Rush1/.test(clip) || fighter.state.action === 'ultimate' && index === 1) {
    out.copy(fighter.handL);
  } else out.copy(fighter.handR);
  return true;
}
