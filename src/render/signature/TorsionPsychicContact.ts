/** What the engine asks of TorsionPsychic.ts outside its effect layer (where a blow
 *  lands: engine/client/sockets.ts, render/Fighter.ts, render/AreaTelegraph.ts), moved out of it unchanged, so that the layer is
 *  fetched only with a room that has the fighter (RosterSignatureSet's lazy factories). TorsionPsychic.ts re-exports it. */
import { isEnderKey } from '../../game/combos';
import * as THREE from 'three';
import type { Fighter } from '../Fighter';
const GROUNDED_CLIPS = new Set(['Hit 01','shake','stun','Die fall','down_end','slammed','blownback_end','Landing']);
const BRANCH_CLIPS = Object.freeze({lh:'About-Face',llh:'Hoist Up',lllh:'Cave-In',llls:'Corkscrew',airHeavy:'Air Rebuff',airSpecial:'Rubble Rain'});
/** Cached visible hand sockets; no motionEvidence() or per-frame traversal. */
export function torsionStrikeSocket(action:string,elapsed:number,clip?:string,contactIndex?:number):'LeftHand'|'RightHand'|'Both'{
 if(clip==='Full Torque'||action==='ultimate'&&!clip)return(contactIndex??(elapsed>2.8?2:elapsed>1.2?1:0))===2?'Both':'RightHand';
 if(clip==='Wring Out'||clip==='Rush 2'||clip==='About-Face'||clip==='Cave-In'||clip==='Rubble Rain'||action==='heavy'&&!clip)return'LeftHand';
 return'RightHand';
}
export function torsionAuthoredHover(clip?:string){return !!clip&&!GROUNDED_CLIPS.has(clip);}
export function torsionStrikePoint(fighter:Fighter,out:THREE.Vector3,clip?:string,sourceTime?:number,contactIndex?:number){
 const s=fighter.state;
 if(!clip&&isEnderKey(s.branch))clip=BRANCH_CLIPS[s.branch];
 if(!clip&&s.action==='light'&&s.chain)clip=`Rush ${s.chain}`;
 const joint=torsionStrikeSocket(s.action,sourceTime??s.actionTime*s.actionDuration,clip,contactIndex);
 return joint==='Both'?out.copy(fighter.handL).lerp(fighter.handR,.5):out.copy(joint==='LeftHand'?fighter.handL:fighter.handR);
}
