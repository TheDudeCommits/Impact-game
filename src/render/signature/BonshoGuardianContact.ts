/** What the engine asks of BonshoGuardian.ts outside its effect layer (where the
 *  sculpture's palm lands: engine/client/sockets.ts), moved out of it unchanged, so that the layer is fetched only with a room
 *  that has the fighter (RosterSignatureSet's lazy factories). BonshoGuardian.ts re-exports it, and fills `drawnPalms`. */
import type * as THREE from 'three';
import type { Fighter } from '../Fighter';
/** The layer's palms, as the engine reads them (BonshoGuardian's own two methods). */
interface DrawnPalms { ultimatePalmPoint(actor: string, contactIndex: number, out: THREE.Vector3, palmIndex?: number): boolean; ultimatePalmCount(actor: string, contactIndex: number): number }
// Object identity matters: a respawn/replacement with the same player ID must
// never borrow the previous body's rendered palms. No per-contact allocation.
export const drawnPalms=new WeakMap<Fighter,DrawnPalms>();
export function bonshoDrawnPalmPoint(fighter:Fighter,contactIndex:number,out:THREE.Vector3,palmIndex=0):boolean{return drawnPalms.get(fighter)?.ultimatePalmPoint(fighter.state.id,contactIndex,out,palmIndex)??false;}
export function bonshoDrawnPalmCount(fighter:Fighter,contactIndex:number):number{return drawnPalms.get(fighter)?.ultimatePalmCount(fighter.state.id,contactIndex)??0;}
