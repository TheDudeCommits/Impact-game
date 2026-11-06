import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';
/** Armored close-range brawler. Vents and awakening are visual only. */
export const OVID_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Cracked Knuckle',duration:.47,contacts:[.168],damage:21,range:2.7,radius:.75,stamina:11,cooldown:.47,stun:.34,knockback:3.3,lunge:7,style:'melee'},
 heavy:{name:'Shovel Uppercut',duration:1,contacts:[.567],damage:65,range:2.85,radius:.9,stamina:28,cooldown:1.34,stun:.79,knockback:8.1,lunge:5.5,style:'melee',outcome:'launch',lift:4.9},
 special:{name:'Shatterburst',duration:1.30,contacts:[.78],damage:116,range:2.95,radius:.97,stamina:35,cooldown:4.9,stun:.86,knockback:10.5,lunge:8.6,close:5.8,style:'melee',outcome:'wallBounce'},
 ultimate:{name:'Full Demolition',duration:4,contacts:[.56,1.66,3.24],schedule:[40,77,232],damage:40,finisherDamage:220,range:3,radius:1.07,stamina:0,cooldown:25,stun:1.2,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:6.5,close:6,style:'melee',guardBreak:true,confirm:{recovery:.60}},
};
export const OVID_COMBOS:ComboRow={lh:{name:'Glass Hook',range:2.75,radius:.81},llh:{name:'Jackhammer Uppercut',range:2.85,radius:.91},lllh:{name:'Sledgehammer',range:2.9,radius:.97},llls:{name:'Demolition Drive',range:3,radius:1},airHeavy:{name:'Collapse',range:2.9,radius:.96},airSpecial:{name:'Controlled Demolition',radius:3.5}};
export const OVID_CONTACTS={light:.5,heavy:.54,special:.60,ultimate:.18,rush1:.5,rush2:.5,rush3:.54,combos:{lh:.5,llh:.54,lllh:.58,llls:.60,airHeavy:.58,airSpecial:.58}}as const;
export const OVID_AWAKENING={name:'CRACKED OPEN',clip:'WRATHFUL GUARDIAN Release',duration:2.5,entryDuration:.9,beats:{crossedGuard:.16,compression:.35,release:.57,roar:.74,settle:1},manualOnly:true,canonScope:'Manual wrathful-guardian concentration of the existing Ovid body; no invented form or passive heat/pressure damage.'}as const;
export const OVID_CINEMATIC={opener:{clip:'Full Demolition',at:.18},cine:{from:.18,at:.81,windows:[[.18,.56,.415],[.56,1,.81]]}}as const;
export const OVID_KNUCKLE_SOCKETS={RightHand:[-.006820356900753223,.1457025344797929,.003701477217582184],LeftHand:[.0019906458332387134,.14571377981153533,.0071342464606105604]}as const;
/** All sockets follow the actual native striking hand, including left uppercuts. */
export function ovidStrikeJoint(clip:string,contactIndex?:number,sourceFraction=0):'LeftHand'|'RightHand'{
 if(clip==='Full Demolition')return(contactIndex??(sourceFraction<.2975?0:sourceFraction<.6125?1:2))===0?'LeftHand':'RightHand';
 return['Shovel Uppercut','Rush 1','Rush 3','Glass Hook','Jackhammer Uppercut'].includes(clip)?'LeftHand':'RightHand';
}
