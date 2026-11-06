import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';

/** Every transmutation follows a manual command and an authoritative contact. */
export const SHIBUICHI_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Planish',duration:.47,contacts:[.168],damage:21,range:2.85,radius:.88,stamina:13,cooldown:.47,stun:.39,knockback:4,lunge:4.2,style:'melee'},
 heavy:{name:'Billet Ram',duration:1,contacts:[.6],damage:65,range:3.05,radius:1.03,stamina:30,cooldown:1.21,stun:.90,knockback:9,lunge:5,style:'melee',outcome:'knockdown'},
 special:{name:'Quench Palm',duration:1.5,contacts:[.85],damage:117,range:26,radius:1.15,stamina:36,cooldown:5.2,stun:.9,knockback:10,speed:25,style:'projectile',aimOnRelease:true},
 ultimate:{name:'KINTSUGI: Golden Seam',duration:4.4,contacts:[.60,1.78,3.56],schedule:[48,75,224],damage:48,finisherDamage:204,range:3.15,radius:1.15,stamina:0,cooldown:24,stun:1.15,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:5.2,close:6,style:'melee',guardBreak:true,confirm:{recovery:.64}},
};
export const SHIBUICHI_COMBOS:ComboRow={lh:{name:'Backhand Peen',range:3,radius:.97},llh:{name:'Raised Seam',range:3,radius:1},lllh:{name:'Elbow Peen',range:3.15,radius:1.08},llls:{name:'Ground Quench',range:3.2,radius:1.12},airHeavy:{name:'Heel Set',range:3.05,radius:1.03},airSpecial:{name:'Falling Mantle',radius:3.7}};
export const SHIBUICHI_AWAKENING={name:'HEARTHLIGHT',clip:'HEARTHLIGHT',duration:2,entryDuration:.9,beats:{heart:.20,protect:.40,clap:.63,brace:.84},manualOnly:true,canonScope:'Authored protective resolve and full-pour preparation in the original armor; no new body or autonomous construct.'}as const;
export function shibuichiAuthoredKick(clip:string):boolean{return clip==='Heel Set';}
/** Preserve only the manual shoulder's planted step, using the exported source clock. */
export function shibuichiAuthoredShoulderStep(clip:string,sourceSeconds:number):boolean{return clip==='Billet Ram'&&Number.isFinite(sourceSeconds)&&sourceSeconds>=0&&sourceSeconds<=68/60+1e-5;}
export function shibuichiAuthoredGround(clip:string,time:number):boolean{return clip==='Quench Palm'||clip==='Ground Quench'||clip==='Falling Mantle'||clip==='KINTSUGI: Golden Seam'&&time>=2.45;}
/** The shoulder hit must follow the armor, rather than an unrelated punching hand. */
export function shibuichiStrikeJoint(clip:string,contactIndex=0):'RightHand'|'LeftHand'|'LeftArm'|'RightForeArm'|'RightToeBase'|'BothHands'{
 if(clip==='Billet Ram')return 'LeftArm';
 if(clip==='Rush 2'||clip==='Raised Seam')return 'LeftHand';
 if(clip==='Elbow Peen')return 'RightForeArm';
 if(clip==='Heel Set')return 'RightToeBase';
 if(clip==='Quench Palm'||clip==='Ground Quench'||clip==='Falling Mantle')return 'BothHands';
 if(clip==='KINTSUGI: Golden Seam')return contactIndex>=2?'BothHands':contactIndex===1?'LeftHand':'RightHand';
 return 'RightHand';
}
