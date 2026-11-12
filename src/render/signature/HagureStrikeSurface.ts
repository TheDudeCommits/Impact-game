import * as THREE from 'three';
import { hagureStrikeJoint } from './HagureSnapBiteContact';
import { hagureSurfacePoint } from './HagureContactSurface';
const point = new THREE.Vector3();
const contacts = [.44, 1.04, 1.63, 2.23, 3.02] as const;
const clips = new Set(['Snap Bite','Mauling Palm','Howling Spin','Pack of One','Rush 1','Rush 2','Rush 3','Turnaside Hand','Stray Cross','Howling Break','Feral Lunge','Falling Maul','Moonfall Break']);
/** One actual native strike surface for the authored manual hand attacks.
 * Both generic fingertip proxies used to push the defender even when the
 * active strike is a palm heel or knife edge, leaving a persistent visible gap.
 * This only informs drawn-body separation; simulation damage is untouched.
 * Caller passes this drawn body's own joints and actual displayed clip clock.
 */
export function hagureStrikeSurface(
  fighter:string, action:string, clip:string|undefined, sourceSeconds:number,
  moonless:boolean, joints:ReadonlyMap<string,THREE.Object3D>,
  submit:(point:THREE.Vector3)=>void,
):boolean {
  if(fighter!=='hagure'||!clip||!clips.has(clip)||!Number.isFinite(sourceSeconds)
    ||!['light','heavy','special','ultimate'].includes(action))return false;
  let index=0;
  if(action==='ultimate'&&clip==='Pack of One'){
    let distance=Infinity;
    for(let i=0;i<contacts.length;i++){const d=Math.abs(sourceSeconds-contacts[i]);if(d<distance){index=i;distance=d;}}
  }
  const hand=joints.get(hagureStrikeJoint(action,clip,index));
  if(!hand)return false;
  hagureSurfacePoint(hand,moonless,action,clip,index,point);
  submit(point);
  return true;
}
