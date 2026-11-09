/** What the engine asks of LanthornLampblack.ts outside its effect layer (where a blow
 *  lands: engine/client/sockets.ts, render/Fighter.ts, render/AreaTelegraph.ts), moved out of it unchanged, so that the layer is
 *  fetched only with a room that has the fighter (RosterSignatureSet's lazy factories). LanthornLampblack.ts re-exports it. */
import * as THREE from 'three';
import type { Fighter } from '../Fighter';
export function lanthornStrikeJoint(action:string,clip?:string):'LeftHand'|'RightHand'{return clip==='Lampblack Edge'||clip==='Lampblack Drive'||action==='special'&&!clip?'RightHand':'LeftHand';}
// Measured from the two exported native Wick Cut skins.
const ROOT=new THREE.Vector3(.107978,-.002969,-.239428),TIP=new THREE.Vector3(.066096,.004871,.280593),FORM_ROOT=new THREE.Vector3(.048711,.067633,-.258463),FORM_TIP=new THREE.Vector3(.006830,.075473,.261558);
export function lanthornBladePoint(f:Pick<Fighter,'drawnJoint'|'shownBody'>,out:THREE.Vector3,tip=true){const hand=f.drawnJoint('LeftHand');if(!hand)return false;out.copy(f.shownBody!==f?(tip?FORM_TIP:FORM_ROOT):(tip?TIP:ROOT)).applyMatrix4(hand.matrixWorld);return true;}
