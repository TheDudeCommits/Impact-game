/** What the engine asks of AmpereSurge.ts outside its effect layer (where a blow
 *  lands, engine/client/sockets.ts; whose fighter it is, render/CombatEffects.ts), moved out of it unchanged, so that the layer is
 *  fetched only with a room that has the fighter (CombatEffects' lazy layers). AmpereSurge.ts re-exports it. */
import * as THREE from 'three';
import type { Fighter } from '../Fighter';
export const isAmpereSurge = (id: string | undefined) => id === 'ampere';
const socketCache = new WeakMap<Fighter, Map<string, THREE.Object3D>>();
/** Always sample the displayed form. Finger bones are outside Fighter's core
 * joint map, so cache their native nodes rather than allocating a pose search. */
export function ampereSocket(fighter: Fighter, name: string, out: THREE.Vector3) {
  const body = fighter.shownBody ?? fighter;
  let cache = socketCache.get(body);
  if (!cache) { cache = new Map(); body.model?.traverse(node => { if ((node as THREE.Bone).isBone) cache!.set(node.name, node); }); socketCache.set(body, cache); }
  const node = cache.get(name) ?? body.joints?.get(name);
  if (node) return node.getWorldPosition(out);
  return out.copy(name.startsWith('Left') ? body.handL : body.handR);
}
const KICKS = new Set(['Cape Wrath Kick', 'Rush 3', 'Good Hope Drop', 'Lineman\'s Kick']);
const FLICKS = new Set(['Finisterre Flick', 'Finisterre Burst', 'Landfall']);
export function ampereContact(f: Fighter, index: number, out: THREE.Vector3, clip = '') {
  if (!isAmpereSurge(f.state.fighter)) return false;
  const bone = KICKS.has(clip) ? 'RightToeBase' : FLICKS.has(clip) ? 'RightHandIndex3' :
    f.state.action === 'ultimate' && !f.state.branch && index === 0 || clip === 'Rush 1' || clip === 'Live Line Cross' ? 'LeftHand' : 'RightHand';
  ampereSocket(f, bone, out); return true;
}
