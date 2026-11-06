import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';

export const ROTFALKE_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Feather Knife',duration:.47,contacts:[.168],damage:20,range:3.55,radius:.76,stamina:11,cooldown:.43,stun:.34,knockback:3.5,lunge:3.6,style:'melee'},
 heavy:{name:'Raking Talon',duration:1,contacts:[.6],damage:65,range:3.5,radius:.91,stamina:29,cooldown:1.39,stun:.80,knockback:9,lunge:3.6,style:'melee',outcome:'launch'},
 special:{name:'Diving Stoop',duration:1.1,contacts:[.638],damage:114,range:3.4,radius:1.04,stamina:35,cooldown:4.9,stun:.85,knockback:10,lunge:5.8,style:'melee',outcome:'knockdown'},
 ultimate:{name:'Ten-Count Talons',duration:3.6,contacts:[.50,1.224,2.016,2.988],schedule:[35,48,61,220],damage:35,finisherDamage:185,range:3.55,radius:1.05,stamina:0,cooldown:24,stun:.9,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:4.8,close:5.0,style:'melee',guardBreak:true,confirm:{recovery:.6}},
};
export const ROTFALKE_COMBOS:ComboRow={lh:{name:'Cross Talon Drive',range:3.45,radius:.85},llh:{name:'Rising Talon Heel',range:3.5,radius:.89},lllh:{name:'Plate Splitter',range:3.6,radius:.98},llls:{name:'Stoop Breach',range:3.5,radius:1.03},airHeavy:{name:'Red Plummet',range:3.5,radius:.94},airSpecial:{name:'Feather Drop',radius:3.7}};
export const ROTFALKE_AWAKENING={name:'MOTHER\'S WINGS',clip:'MOTHER\'S WINGS',duration:2.5,entryDuration:.9,swapAt:.432,beats:{chest:.207,resolve:.378,field:.594,ready:.747},manualOnly:true}as const;
export const ROTFALKE_CINEMATIC={opener:{clip:'Ten-Count Talons',at:.14},cine:{from:.14,at:.83,windows:[[.14,.44,.34],[.44,.70,.56],[.70,1,.83]]}}as const;
export type RotfalkeStrikeSocket='RightHand'|'LeftHand'|'RightFoot';
/** Caller supplies the shown body's actual native clip clock, including its
 * retimed confirmed montage; this avoids guessing from actionTime. */
export function rotfalkeStrikeSocket(action:string,clip:string,sourceFraction=0,contactIndex?:number):RotfalkeStrikeSocket{
 if(clip==='Ten-Count Talons'||action==='ultimate'&&!clip){
  const index=contactIndex??(sourceFraction<.24?0:sourceFraction<.44?1:sourceFraction<.70?2:3);
  return index===1?'RightFoot':index===2?'LeftHand':'RightHand';
 }
 if(['Raking Talon','Rush 2','Rising Talon Heel','Red Plummet'].includes(clip))return 'RightFoot';
 if(['Diving Stoop','Rush 3','Stoop Breach'].includes(clip))return 'LeftHand';
 return action==='heavy'&&!clip?'RightFoot':action==='special'&&!clip?'LeftHand':'RightHand';
}
/** Preserve the native supporting leg and raised heel only during authored
 * kicking clips/contact, leaving normal stride and landing rules intact. */
export function rotfalkeAuthoredKick(clip:string,sourceFraction=0):boolean{
 return ['Raking Talon','Rush 2','Rising Talon Heel','Red Plummet'].includes(clip)||clip==='Ten-Count Talons'&&sourceFraction>=.20&&sourceFraction<.43;
}
