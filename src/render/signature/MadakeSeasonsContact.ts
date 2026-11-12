/** What the engine asks of MadakeSeasons.ts outside its effect layer (where a blow
 *  lands: engine/client/sockets.ts, render/Fighter.ts, render/AreaTelegraph.ts), moved out of it unchanged, so that the layer is
 *  fetched only with a room that has the fighter (RosterSignatureSet's lazy factories). MadakeSeasons.ts re-exports it. */
import { isEnderKey } from '../../game/combos';
import * as THREE from 'three';
import type { Fighter } from '../Fighter';
import { bodyCentre } from '../vfx/VfxKit';
import { madakeStrikeJoint } from '../../game/fighters/madake';
const BRANCH={lh:'Rising Shoot',llh:'Flying Greeting',lllh:'Bamboo Cyclone',llls:'Spring Crane',airHeavy:'Descending Fang',airSpecial:'Autumn Stag'}as const;
const GUY_OTHER_HAND=new THREE.Vector3();
function guyJointPoint(f:Fighter,name:string,out:THREE.Vector3){const joint=f.joints?.get(name)??f.bones?.get(name.toLowerCase());return joint?joint.getWorldPosition(out):bodyCentre(f,out);}
export function madakeStrikePoint(f:Fighter,out:THREE.Vector3,clip?:string,sourceTime?:number,index?:number){
 const s=f.state;if(!clip&&isEnderKey(s.branch))clip=BRANCH[s.branch];if(!clip&&s.action==='light'&&s.chain)clip=`Rush ${s.chain}`;if(!clip)clip=s.action==='heavy'?'Bamboo Gale Kick':s.action==='special'?'Summer Wolf':s.action==='ultimate'?'Midwinter Bamboo':'Bamboo Straight';
 const t=sourceTime??s.actionTime*s.actionDuration,j= madakeStrikeJoint(clip,index??(t>2?2:t>.8?1:0));if(j==='BothHands'){guyJointPoint(f,'LeftHand',out);guyJointPoint(f,'RightHand',GUY_OTHER_HAND);return out.lerp(GUY_OTHER_HAND,.5);}return guyJointPoint(f,j,out);
}
