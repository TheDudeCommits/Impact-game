/** What the engine asks of PyroclastExplosions.ts outside its effect layer (where a blow
 *  lands, engine/client/sockets.ts; whose fighter it is, render/CombatEffects.ts), moved out of it unchanged, so that the layer is
 *  fetched only with a room that has the fighter (CombatEffects' lazy layers). PyroclastExplosions.ts re-exports it. */
import * as THREE from 'three';
import type { Fighter } from '../Fighter';
export const isPyroclastExplosions = (id: string | undefined) => id === 'pyroclast';
/** Aim from the actual palm beyond the native grenade gauntlet. */
export function pyroclastPalm(fighter: Fighter, side: 'Left' | 'Right', out: THREE.Vector3): THREE.Vector3 {
  const body = fighter.shownBody ?? fighter;
  const hand = body.joints?.get(`${side}Hand`);
  return hand ? hand.getWorldPosition(out) : out.copy(side === 'Left' ? fighter.handL : fighter.handR);
}
const otherPalm = new THREE.Vector3();
/** The actual authored contact hand, including the two-palm blast finish. */
export function pyroclastContact(fighter: Fighter, index: number, out: THREE.Vector3, clip?: string): boolean {
  if (!isPyroclastExplosions(fighter.state.fighter)) return false;
  const both = clip === 'Lava Bomb' || clip === 'Magma Cannon' || clip === 'Airburst' || clip === 'Lava Flow Landing' ||
    fighter.state.action === 'ultimate' && index >= 2;
  pyroclastPalm(fighter, clip === 'Rush 1' || clip === 'Spitfire Cross' ? 'Left' : 'Right', out);
  if (both) out.lerp(pyroclastPalm(fighter, 'Left', otherPalm), .5);
  return true;
}
