/** What the engine asks of KubiwaControl.ts outside its effect layer (where a blow
 *  lands: engine/client/sockets.ts, render/Fighter.ts, render/AreaTelegraph.ts), moved out of it unchanged, so that the layer is
 *  fetched only with a room that has the fighter (RosterSignatureSet's lazy factories). KubiwaControl.ts re-exports it. */
import * as THREE from 'three';
import type { Fighter } from '../Fighter';
export function kubiwaStrikeJoint(action:string,clip?:string,contactIndex=0):'LeftHand'|'RightHand'{
 if(action==='ultimate'&&(!clip||clip==='Final Bar'))return contactIndex===1?'LeftHand':'RightHand';
 return clip==='Beckon'||clip==='Rush 2'?'LeftHand':'RightHand';
}
const fingerA=new THREE.Vector3(),fingerB=new THREE.Vector3();
/** The runtime major-joints map omits fingers; read the real native bone map. */
export function kubiwaCommandPoint(f:Pick<Fighter,'bones'|'drawnJoint'>,out:THREE.Vector3,side:'Left'|'Right'='Right'){
 const tip=f.bones?.get((side+'HandIndex3').toLowerCase()),middle=f.bones?.get((side+'HandIndex2').toLowerCase());
 if(tip&&middle){tip.getWorldPosition(fingerA);middle.getWorldPosition(fingerB);out.copy(fingerA).addScaledVector(fingerA.sub(fingerB),.65);return true;}
 const hand=f.drawnJoint(side+'Hand');if(!hand)return false;hand.getWorldPosition(out);return true;
}
