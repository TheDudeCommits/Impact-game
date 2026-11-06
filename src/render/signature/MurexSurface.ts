import * as T from 'three';
import type {Fighter} from '../Fighter';
import {murexStrikeJoint} from '../../game/fighters/murex';

/** Exact e68e05f6 native skin vertices. Fists use the Index1/Index2 knuckle
 * surface, and the field uses a four-weight central palm surface. */
export const MUREX_SURFACE_VERTICES=Object.freeze({rightFist:26068,leftFist:25477,leftPalm:25502,mesh:'Murex_EVA01_NativeSkin'});
const meshes=new WeakMap<object,T.SkinnedMesh>();
const other=new T.Vector3();
function skin(f:Pick<Fighter,'shownBody'>){
 const body=f.shownBody;let mesh=meshes.get(body);
 if(!mesh){const node=body.model.getObjectByName(MUREX_SURFACE_VERTICES.mesh);if(!(node instanceof T.SkinnedMesh))return;mesh=node;meshes.set(body,mesh);}
 return mesh;
}
export function murexSurfacePoint(f:Pick<Fighter,'shownBody'>,surface:'rightFist'|'leftFist'|'leftPalm',out:T.Vector3):boolean{
 const mesh=skin(f);if(!mesh)return false;mesh.getVertexPosition(MUREX_SURFACE_VERTICES[surface],out);out.applyMatrix4(mesh.matrixWorld);return true;
}
/** One allocation-free exact vertex evaluation per hand. No body or clip edits. */
export function murexStrikePoint(f:Pick<Fighter,'shownBody'|'state'>,out:T.Vector3,clip?:string,contactIndex=0):boolean{
 const side=murexStrikeJoint(f.state.action,clip,contactIndex);
 if(side==='BothHands'){
  if(!murexSurfacePoint(f,'leftFist',out)||!murexSurfacePoint(f,'rightFist',other))return false;out.add(other).multiplyScalar(.5);return true;
 }
 const palm=clip==='Flinch Wave'||clip==='Leave Me Alone'||!clip&&f.state.action==='special';
 return murexSurfacePoint(f,side==='RightHand'?'rightFist':palm?'leftPalm':'leftFist',out);
}
