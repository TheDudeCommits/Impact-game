import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';

export const MUREX_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Hooked Claw',duration:.47,contacts:[.168],damage:21,range:2.85,radius:.62,stamina:10,cooldown:.47,stun:.33,knockback:3.6,lunge:6.4,style:'melee'},
 heavy:{name:'Armored Hammer',duration:1.01,contacts:[.53],damage:65,range:2.95,radius:.88,stamina:26,cooldown:1.53,stun:.80,knockback:7.7,lunge:4.4,spacing:1.32,style:'melee',outcome:'launch',lift:5.3},
 special:{name:'Flinch Wave',duration:1.26,contacts:[.7434],damage:118,range:25,radius:1.0,stamina:35,cooldown:5.3,stun:.87,knockback:10.2,speed:25,style:'projectile',aimOnRelease:true},
 ultimate:{name:'Spinestorm',duration:3.80,contacts:[.57,3.078],schedule:[57,256],damage:57,finisherDamage:233,range:3.1,radius:1.05,stamina:0,cooldown:26,stun:1.32,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:5.7,close:6.0,style:'melee',guardBreak:true,confirm:{recovery:.55}},
};
export const MUREX_COMBOS:ComboRow={lh:{name:'Twisting Claw',range:2.9,radius:.70},llh:{name:'Spine Breaker',range:3,radius:.83},lllh:{name:'Core Ram',range:3.1,radius:.75},llls:{name:'Leave Me Alone',range:3.0,radius:.94},airHeavy:{name:'Aerial Hammer',range:2.95,radius:.88},airSpecial:{name:'Mantis Drop',radius:3.2}};
export const MUREX_CONTACTS={light:.43,heavy:.51,special:.59,ultimate:[.17,.81],rush:[.43,.43,.51],combos:{lh:.43,llh:.51,lllh:.43,llls:.59,airHeavy:.51,airSpecial:.51}}as const;
export const MUREX_AWAKENING={name:'UNSTRAPPED',clip:'UNSTRAPPED',sourceDuration:2.80,runtimeDuration:.9,beats:{lock:.24,roar:.64,release:.77,settle:.93},sameBody:true,manualOnly:true,identity:'Native classic EVA01 opens its actual hinged jaw; Murex remains the pilot. Grave Hound does not enable autonomous attacks.'}as const;
/** Clip identity overrides the button; Mantis Drop is a two-fist strike. */
export function murexStrikeJoint(action:string,clip?:string,contactIndex=0):'RightHand'|'LeftHand'|'BothHands'{
 if(clip==='Spinestorm'||!clip&&action==='ultimate')return contactIndex===0?'LeftHand':'RightHand';
 if(clip==='Flinch Wave'||clip==='Leave Me Alone'||!clip&&action==='special')return'LeftHand';
 if(clip==='Armored Hammer'||clip==='Rush 3'||clip==='Spine Breaker'||clip==='Aerial Hammer'||clip==='Mantis Drop')return'BothHands';
 return'RightHand';
}
