import * as THREE from 'three';
import {bonshoStrikeJoint} from '../../game/fighters/bonsho';
/** Measured native skin vertices, not a wrist approximation. The actual skin
 * evaluation retains distributed wrist correction weights in every shown pose. */
export const BONSHO_SKIN_CONTACTS=Object.freeze({RightHand:711,LeftHand:17749,RightForeArm:824});
const bodies=new WeakMap<THREE.Object3D,THREE.SkinnedMesh|null>();
export function bonshoSurfacePoint(model:THREE.Object3D,action:string,clip:string|undefined,out:THREE.Vector3):boolean{
 let mesh=bodies.get(model);
 if(mesh===undefined){const candidate=model.getObjectByName('body_bonsho');mesh=candidate instanceof THREE.SkinnedMesh?candidate:null;bodies.set(model,mesh);}
 if(!mesh)return false;
 mesh.getVertexPosition(BONSHO_SKIN_CONTACTS[bonshoStrikeJoint(action,clip)],out).applyMatrix4(mesh.matrixWorld);return true;
}
