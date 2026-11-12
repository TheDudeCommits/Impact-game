import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';

/** Manual chi-enhanced taijutsu. YOKOZUNA is a visible form change;
 * it never queues attacks, deals ambient damage or summons autonomous actors. */
export const KUSUSHI_MOVES: Record<CoreSlot, MoveDefinition> = {
 light: {name:'Wrapped Fist',duration:.44,contacts:[.168],damage:21,range:2.25,radius:.68,stamina:10,cooldown:.44,stun:.32,knockback:3.3,lunge:4.2,style:'melee'},
 heavy: {name:'Shiko Stomp',duration:1,contacts:[.6],damage:65,range:2.65,radius:.94,stamina:27,cooldown:1.38,stun:.78,knockback:8.8,lunge:3.8,style:'melee',outcome:'knockdown'},
 special: {name:'Ring-Out Palm',duration:1,contacts:[.55],damage:120,range:2.6,radius:.96,stamina:32,cooldown:4.8,stun:.8,knockback:10,lunge:9.2,style:'melee',outcome:'wallBounce'},
 ultimate: {name:'Bet the Purse',duration:3.2,contacts:[.544,1.248,2.56],schedule:[46,43,250],damage:46,finisherDamage:198,range:2.85,radius:1.1,stamina:0,cooldown:23,stun:.82,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:5.1,close:5.1,style:'melee',guardBreak:true,confirm:{recovery:.56}},
};
export const KUSUSHI_COMBOS: ComboRow = {
 lh:{name:'Rib Breaker',range:2.35,radius:.78},llh:{name:'Rising Thrust',range:2.45,radius:.84},lllh:{name:'Crushing Heel',range:2.7,radius:.94},llls:{name:'Pressure-Point Rupture',range:2.65,radius:.98},airHeavy:{name:'Falling Heel',range:2.65,radius:.94},airSpecial:{name:'Ring Splitter',radius:3.4},
};
export const KUSUSHI_CONTACTS = {light:.46,heavy:.6,special:.55,ultimate:[.17,.39,.8],rush:[.46,.46,.54],combos:{lh:.46,llh:.54,lllh:.6,llls:.55,airHeavy:.6,airSpecial:.55}} as const;
export const KUSUSHI_AWAKENING = {name:'YOKOZUNA',clip:'YOKOZUNA',duration:2.1,swapAt:.504,beats:{seal:.342,release:.504},manualOnly:true} as const;

export type KusushiStrikeSocket='RightHand'|'LeftHand'|'RightFoot';
const HEEL_CLIPS=new Set(['Shiko Stomp','Crushing Heel','Falling Heel']);
/** elapsed is the displayed clip clock in seconds (not simulation action time).
 * Receipt contactIndex takes priority for the three authored ultimate takes. */
export function kusushiStrikeSocket(action:string,elapsed=0,clip?:string,contactIndex?:number):KusushiStrikeSocket{
 if(action==='ultimate'&&(!clip||clip==='Bet the Purse')){
  const index=contactIndex===undefined?(elapsed<.896?0:elapsed<1.76?1:2):Math.max(0,Math.min(2,Math.floor(contactIndex)));
  return index===0?'RightHand':index===1?'LeftHand':'RightFoot';
 }
 if(clip&&HEEL_CLIPS.has(clip))return 'RightFoot';
 if(clip==='Rush 1'||clip==='Rib Breaker')return 'LeftHand';
 if(clip)return 'RightHand';
 return action==='heavy'?'RightFoot':'RightHand';
}
/** Preserve the native lift/plant only for actual heel clips/ultimate finale. */
export function kusushiAuthoredKick(action:string,elapsed=0,clip?:string):boolean{
 return clip?HEEL_CLIPS.has(clip)||action==='ultimate'&&clip==='Bet the Purse'&&elapsed>=1.6:action==='heavy'||action==='ultimate'&&elapsed>=1.6;
}
