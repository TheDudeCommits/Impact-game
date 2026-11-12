import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';

/** Every pressure strike follows a manual command; steam and gates cause no idle harm. */
export const MADAKE_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Bamboo Straight',duration:.44,contacts:[.168],damage:21,range:2.7,radius:.78,stamina:11,cooldown:.44,stun:.35,knockback:4,lunge:4.8,style:'melee'},
 heavy:{name:'Bamboo Gale Kick',duration:.94,contacts:[.49],damage:65,range:2.95,radius:.98,stamina:27,cooldown:1.2,stun:.82,knockback:9,lunge:4.8,style:'melee',outcome:'knockdown'},
 special:{name:'Summer Wolf',duration:1.36,contacts:[.74],damage:118,range:29,radius:1.08,stamina:35,cooldown:5,stun:.88,knockback:10,speed:30,style:'projectile',aimOnRelease:true},
 ultimate:{name:'Midwinter Bamboo',duration:3.98,contacts:[.50,1.48,3.12],schedule:[49,80,217],damage:49,finisherDamage:202,range:3.1,radius:1.05,stamina:0,cooldown:24,stun:1.1,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:6,close:6,style:'melee',guardBreak:true,confirm:{recovery:.58}},
};
export const MADAKE_COMBOS:ComboRow={lh:{name:'Rising Shoot',range:2.95,radius:.92},llh:{name:'Flying Greeting',range:3.05,radius:1},lllh:{name:'Bamboo Cyclone',range:3.15,radius:1.06},llls:{name:'Spring Crane',range:3.3,radius:1.15},airHeavy:{name:'Descending Fang',range:3,radius:1},airSpecial:{name:'Autumn Stag',radius:3.6}};
export const MADAKE_AWAKENING={name:'EVERGREEN',clip:'EVERGREEN',duration:1.9,entryDuration:.9,beats:{heart:.18,resolve:.38,release:.62,stance:.84},manualOnly:true,canonScope:'Native body; authored fist-to-heart, clenched release and runner stance. Red steam is visual only; no passive damage.'}as const;
export function madakeAuthoredKick(clip:string):boolean{return ['Bamboo Gale Kick','Rising Shoot','Flying Greeting','Bamboo Cyclone','Descending Fang','Midwinter Bamboo'].includes(clip);}
/** Preserve the reviewed second-punch step only within its finite native source clip. */
export function madakeAuthoredRushStep(clip:string,sourceSeconds:number):boolean{return clip==='Rush 1'&&Number.isFinite(sourceSeconds)&&sourceSeconds>=0&&sourceSeconds<=.50001;}
/** Native source has fixed open/closed/spread/positive-thumb hand geometries, no finger chains. */
export function madakeHandState(clip:string,gateBody=false):'fists'|'open'|'spread'|'thumb'{return clip==='Madake Victory'&&!gateBody?'thumb':clip==='Summer Wolf'||clip==='Spring Crane'?'spread':clip==='_Idle'||clip==='Block'?'open':'fists';}
export function madakeStrikeJoint(clip:string,contactIndex=0):'RightHand'|'LeftHand'|'RightToeBase'|'LeftToeBase'|'BothHands'{
 if(clip==='Summer Wolf')return 'BothHands';
 if(clip==='Rush 2'||clip==='Spring Crane')return 'LeftHand';
 if(clip==='Rising Shoot'||clip==='Bamboo Cyclone')return 'LeftToeBase';
 if(clip==='Bamboo Gale Kick'||clip==='Flying Greeting'||clip==='Descending Fang')return 'RightToeBase';
 if(clip==='Midwinter Bamboo')return contactIndex>=2?'RightToeBase':contactIndex===1?'LeftHand':'RightHand';
 return 'RightHand';
}
