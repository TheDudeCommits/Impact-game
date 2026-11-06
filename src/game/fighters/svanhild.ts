import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';

export const SVANHILD_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Swan Quill',duration:.43,contacts:[.152],damage:19,range:2.6,radius:.62,stamina:9,cooldown:.43,stun:.30,knockback:3.1,lunge:3.9,style:'melee'},
 heavy:{name:"Breaking Wing",duration:.94,contacts:[.4606],damage:63,range:2.85,radius:.9,stamina:24,cooldown:1.40,stun:.76,knockback:7.8,lunge:3.5,style:'melee',outcome:'launch',lift:5.6},
 special:{name:"Lakeglass Orb",duration:1.24,contacts:[.7564],damage:114,range:27,radius:1.05,stamina:33,cooldown:4.9,stun:.82,knockback:9.6,speed:26,style:'projectile',aimOnRelease:true},
 ultimate:{name:"Swan Song",duration:3.90,contacts:[.58,2.89],schedule:[66,246],damage:66,finisherDamage:224,range:3.0,radius:1.0,stamina:0,cooldown:25,stun:1.35,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:5.8,close:5.9,style:'melee',guardBreak:true,confirm:{recovery:.52}},
};
export const SVANHILD_COMBOS:ComboRow={
 lh:{name:'Ripple Riposte',range:2.65,radius:.66},
 llh:{name:"Mirror Lake",range:2.75,radius:.8},
 lllh:{name:'Highborn Tide',range:2.85,radius:.7},
 llls:{name:'Lakeglass Pursuit',range:2.85,radius:.85},
 airHeavy:{name:'Falling Plume',range:2.7,radius:.78},
 airSpecial:{name:'Swan Dive',radius:3.0},
};
export const SVANHILD_AWAKENING={name:'WHITE PLUMAGE',clip:'WHITE PLUMAGE',sourceDuration:2.30,runtimeDuration:.9,beats:{mark:.31,cap:.57,coronation:.76,settle:.91},sameBody:true,manualOnly:true}as const;
/** The hand a blow leaves from, as Hisame's set throws it: the lakeglass from the left, the rest from the right. */
export function svanhildStrikeJoint(action:string,clip?:string):'LeftHand'|'RightHand'{if(clip)return clip==='Sea Dragon LAKEGLASS'||clip==='Lakeglass Pursuit'||clip==='Rush 1'?'LeftHand':'RightHand';return action==='special'?'LeftHand':'RightHand';}
