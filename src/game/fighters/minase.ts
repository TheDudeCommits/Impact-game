import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';
/** Relay Leap is a player's committed dash/strike. No autonomous marks,
 * clone attacks or idle damage actors are created by this fighter. */
export const MINASE_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Relay Knife',duration:.43,contacts:[.152],damage:19,range:2.25,radius:.64,stamina:10,cooldown:.41,stun:.30,knockback:3.2,lunge:4.8,style:'melee'},
 heavy:{name:'Gale Palm',duration:.96,contacts:[.5376],damage:65,range:2.6,radius:.90,stamina:27,cooldown:1.33,stun:.73,knockback:8.2,lunge:4.2,style:'melee',outcome:'knockdown'},
 special:{name:'Relay Leap',duration:1.05,contacts:[.546],damage:115,range:2.50,radius:.82,stamina:33,cooldown:4.6,stun:.78,knockback:9.5,lunge:10.5,style:'melee',outcome:'launch'},
 ultimate:{name:'Fifty-Three Stations',duration:3.5,contacts:[.56,1.645,2.8],schedule:[41,51,247],damage:41,finisherDamage:208,range:2.75,radius:1.05,stamina:0,cooldown:23.5,stun:.88,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:5.3,close:5.2,style:'melee',guardBreak:true,confirm:{recovery:.56}},
};
export const MINASE_COMBOS:ComboRow={lh:{name:'Crossing Relay',range:2.35,radius:.72},llh:{name:'Rising Gale',range:2.5,radius:.82},lllh:{name:'Beacon Breaker',range:2.6,radius:.88},llls:{name:'Relay Rush',range:2.55,radius:.85},airHeavy:{name:'Falling Knife',range:2.6,radius:.87},airSpecial:{name:'Gale Descent',radius:3.3}};
export const MINASE_CONTACTS={light:.44,heavy:.56,special:.52,ultimate:[.21,.47,.80],rush:[.44,.50,.56],combos:{lh:.44,llh:.50,lllh:.52,llls:.52,airHeavy:.44,airSpecial:.56}}as const;
export const MINASE_AWAKENING={name:'FULL STRIDE',clip:'FULL STRIDE',duration:2.15,entryDuration:.9,swapAt:.522,beats:{seal:.162,stillness:.369,reveal:.522,resolve:.711},manualOnly:true}as const;
export type MinaseStrikeSide='Right'|'Left';
/** Clip seconds are the shown animation clock, including montage retiming. */
export function minaseStrikeSide(action:string,elapsed=0,clip?:string,contactIndex?:number):MinaseStrikeSide{
 if(action==='ultimate'&&(!clip||clip==='Fifty-Three Stations')){
  const i=contactIndex===undefined?(elapsed<1.19?0:elapsed<2.2225?1:2):Math.max(0,Math.min(2,Math.floor(contactIndex)));
  return i===0?'Right':'Left';
 }
 // (Rising Gale is Shiden's right-handed Rising Slash since 16 October, scripts/night/anim/picks.json: the kunai's.)
 if(clip)return ['Gale Palm','Rush 2','Rush 3','Gale Descent'].includes(clip)?'Left':'Right';
 return action==='heavy'?'Left':'Right';
}
