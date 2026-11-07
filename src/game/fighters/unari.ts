import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';
/** Every card and elastic strike follows a manual input. The elastic's
 * pull is a confirmed projectile impact; no persistent damaging trap. */
export const UNARI_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Fine Line',duration:.43,contacts:[.152],damage:21,range:2.45,radius:.74,stamina:9,cooldown:.43,stun:.31,knockback:3.0,lunge:3.7,style:'melee'},
 heavy:{name:'Snag',duration:.94,contacts:[.56],damage:65,range:2.8,radius:.9,stamina:24,cooldown:1.28,stun:.76,knockback:7.8,lunge:4.2,style:'melee',outcome:'stagger'},
 special:{name:'Paper Cut',duration:1.18,contacts:[.42],damage:110,range:22,radius:.82,stamina:33,cooldown:5.1,stun:.95,knockback:-8,speed:29,style:'projectile',aimOnRelease:true},
 ultimate:{name:'AYATORI: Cat\'s Cradle',duration:3.6,contacts:[.58,.87,1.21,1.55,1.89,2.23,2.52,2.89],schedule:[12,12,24,24,24,24,84,438],damage:12,finisherDamage:206,range:2.75,radius:1.05,stamina:0,cooldown:24,stun:.48,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:4.6,close:5.2,style:'melee',guardBreak:true,confirm:{recovery:.65}},
};
export const UNARI_COMBOS:ComboRow={lh:{name:'Undercut',range:2.65,radius:.82},llh:{name:'Liftoff',range:2.7,radius:.85},lllh:{name:'Nosedive',range:2.85,radius:.98},llls:{name:'Tailspin',range:2.9,radius:.92},airHeavy:{name:'Plummet',range:2.65,radius:.86},airSpecial:{name:'Tripwire',radius:3.1}};
export const UNARI_CONTACTS={light:.44,heavy:.56/.94,special:.42/1.18,ultimate:[.58,.87,1.21,1.55,1.89,2.23,2.52,2.89].map(t=>t/3.6),rush:[.44,.5,.56/.94],combos:{lh:.44,llh:.5,lllh:.56/.94,llls:.44,airHeavy:.44,airSpecial:.56/.94}}as const;
export const UNARI_AWAKENING={name:'Magician’s Malice',clip:'Magicians Malice',duration:1.8,beats:{cardAtCheek:.25,gumJoin:.5,stretch:.73,guard:.92},manualOnly:true,formSwap:false}as const;
