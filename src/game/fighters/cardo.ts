import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';

export const CARDO_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Weedcutter',duration:.47,contacts:[.168],damage:19,range:3.0,radius:.80,stamina:11,cooldown:.47,stun:.34,knockback:3.6,lunge:3.6,style:'melee'},
 heavy:{name:'Plowshare Drop',duration:1.01,contacts:[.4988],damage:65,range:3.3,radius:.94,stamina:28,cooldown:1.45,stun:.72,knockback:9.2,lunge:4.4,style:'melee',outcome:'launch',lift:5.2},
 special:{name:'Unspell',duration:1.18,contacts:[.6018],damage:116,range:26,radius:1.0,stamina:33,cooldown:4.9,stun:.82,knockback:9.4,speed:27,style:'projectile',outcome:'wallBounce',aimOnRelease:true},
 ultimate:{name:'Last Weed Standing',duration:3.6,contacts:[.60,.93,1.27,1.64,2.12,2.79],schedule:[40,22,30,38,52,262],damage:40,finisherDamage:90,range:3.4,radius:1.08,stamina:0,cooldown:25,stun:1.30,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:5.5,close:6.0,style:'melee',guardBreak:true,confirm:{recovery:.60}},
};
export const CARDO_COMBOS:ComboRow={lh:{name:'Headlong Thrust',range:3.2,radius:.84},llh:{name:'Rising Unspell',range:3.3,radius:.88},lllh:{name:'Thistledown Storm',range:3.4,radius:.96},llls:{name:'Overgrowth Drive',range:3.3,radius:.91},airHeavy:{name:'Falling Plowshare',range:3.3,radius:.90},airSpecial:{name:'Thornfall Crash',radius:3.4}};
export const CARDO_AWAKENING={name:'OVERGROWN',clip:'OVERGROWN',sourceDuration:2.0,beats:{reach:.26,pinch:.34,remove:.57,release:.76},manualOnly:true,formSwap:false}as const;
