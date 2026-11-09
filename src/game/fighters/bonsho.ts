import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';
/** Every palm is a manual attack. The guardian is a bounded presentation,
 * not a simulation actor, autonomous target selector, or passive damage aura. */
export const BONSHO_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Dawn Bell Palm',duration:.44,contacts:[.168],damage:19,range:2.15,radius:.66,stamina:10,cooldown:.41,stun:.30,knockback:3.2,lunge:5.4,style:'melee'},
 heavy:{name:'Bell-Log Elbow',duration:58/60,contacts:[58/60*.58],damage:65,range:2.2,radius:.76,stamina:27,cooldown:1.32,stun:.73,knockback:8.2,lunge:5.8,style:'melee',outcome:'knockdown'},
 special:{name:'First Toll',duration:74/60,contacts:[74/60*.52],damage:110,range:18,radius:.9,stamina:33,cooldown:4.8,stun:.83,knockback:9,speed:23,style:'projectile',aimOnRelease:true},
 ultimate:{name:'Hundred: And: Eight: Tolls',duration:4.1,contacts:[.533,1.394,1.886,2.46,3.444],schedule:[26,40,47,70,216],damage:26,finisherDamage:186,range:2.2,radius:.8,stamina:0,cooldown:24,stun:.8,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:6.0,close:4.2,style:'melee',guardBreak:true,confirm:{recovery:.52}},
};
export const BONSHO_COMBOS:ComboRow={lh:{name:'Bead Turn',range:2.2,radius:.73},llh:{name:'Rising Bell Palm',range:2.2,radius:.75},lllh:{name:'Bronze Breaker',range:2.25,radius:.83},llls:{name:'Evening Toll',range:2.25,radius:.9},airHeavy:{name:'Cloud Palm',range:2.2,radius:.8},airSpecial:{name:'Bell Drop',radius:3.15}};
export const BONSHO_CLIPS={light:'Dawn Bell Palm',heavy:'Bell-Log Elbow',special:'First Toll',ultimate:'Hundred and Eight Tolls',awaken:'GREAT BELL',idle:'_Idle',walk:'Walk',run:'Run',guard:'Block',victory:'Bonsho Victory'}as const;
export const BONSHO_CONTACTS={light:.54,heavy:.58,special:.52,ultimate:[.13,.34,.46,.60,.84],rush:[.54,.54,.58],combos:{lh:.54,llh:.54,lllh:.58,llls:.52,airHeavy:.54,airSpecial:.52}}as const;
export const BONSHO_AWAKENING={name:'GREAT BELL',clip:'GREAT BELL',duration:2.4,entryDuration:.9,beats:{prayer:.198,quiet:.423,manifest:.585,unfurl:.765},manualOnly:true,form:'aura',canonScope:'Planted bell prayer; the golden guardian is visible only during entry and owner-commanded attacks. No idle attacks or passive damage.'}as const;
export function bonshoStrikeJoint(action:string,clip?:string){
 if(['Bell-Log Elbow','Rush 3','Bronze Breaker'].includes(clip??'')||!clip&&action==='heavy')return 'RightForeArm';
 return ['Rush 2','Bead Turn','Cloud Palm'].includes(clip??'')?'LeftHand':'RightHand';
}
